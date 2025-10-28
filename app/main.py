from fastapi import FastAPI, HTTPException
from langgraph.graph import StateGraph, END
from typing import TypedDict, Optional
import os, requests
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from openai import OpenAI
from pydantic import BaseModel
from dotenv import load_dotenv

# === 환경 설정 ===
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

IDEOGRAM_API_KEY = os.getenv("IDEOGRAM_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

client = OpenAI(api_key=OPENAI_API_KEY)
SAVE_DIR = Path("data/outputs")
FONT_DIR = Path("fonts")
SAVE_DIR.mkdir(parents=True, exist_ok=True)
FONT_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="AI Logo Maker LangGraph", version="4.2 (Localized Prompt Fusion)")


# === Models ===
class LogoRequest(BaseModel):
    brand_name: str
    description: str
    style: str = "minimal, clean, flat design"
    negative_prompt: Optional[str] = None
    reference_images: Optional[list[str]] = None
    edit_image_url: Optional[str] = None
    edit_instruction: Optional[str] = None
    seed: Optional[int] = None
    style_type: Optional[str] = None
    cfg_scale: float = 15.0
    base_prompt: Optional[str] = None  # ✅ 추가 (remix 시 전달받기)


class LogoState(TypedDict, total=False):
    brand_name: str
    description: str
    style: str
    prompt: str
    base_prompt: str
    image_url: str
    original_path: str
    overlay_path: str
    edit_image_url: Optional[str]
    edit_instruction: Optional[str]
    negative_prompt: Optional[str]
    reference_images: Optional[list[str]]
    style_type: Optional[str]
    seed: Optional[int]
    cfg_scale: float


# === Utility ===
def contains_korean(text: str) -> bool:
    return any("\uac00" <= c <= "\ud7a3" for c in text)


def overlay_korean_font(image_bytes: bytes, brand_name: str) -> Optional[str]:
    try:
        img = Image.open(BytesIO(image_bytes)).convert("RGBA")
        draw = ImageDraw.Draw(img)

        font_candidates = [
            FONT_DIR / "Pretendard-Bold.ttf",
            FONT_DIR / "BMHANNAPro.ttf",
            FONT_DIR / "NanumGothic.ttf",
        ]
        font_path = next((p for p in font_candidates if p.exists()), None)
        if not font_path:
            return None

        font = ImageFont.truetype(str(font_path), size=120)
        text_w, text_h = draw.textsize(brand_name, font=font)
        pos = ((img.width - text_w) // 2, img.height - text_h - 60)
        draw.rectangle(
            [(pos[0] - 30, pos[1] - 20), (pos[0] + text_w + 30, pos[1] + text_h + 20)],
            fill=(255, 255, 255, 180),
        )
        draw.text(pos, brand_name, font=font, fill=(30, 30, 30, 255))

        output_path = SAVE_DIR / f"{brand_name}_final.png"
        img.save(output_path)
        return str(output_path)
    except Exception as e:
        print(f"[Overlay Error] {e}")
        return None


# === Prompt Fusion (v2.0 — Semantic Consistency + Self-Reference) ===
def refine_remix_prompt(
    base_prompt: str,
    edit_instruction: str | None,
    negative_prompt: str | None = None,
    previous_changes: list[dict] | None = None,
) -> str:

    if not edit_instruction:
        return base_prompt

    # === 이전 변경 이력이 있을 경우 ===
    change_history = ""
    if previous_changes:
        summarized = "\n".join(
            [f"- {c.get('edit_instruction', '')}" for c in previous_changes[-3:]]
        )
        change_history = f"[PREVIOUS CHANGES]\n{summarized}\n"

    # === 유저 메시지 구성 ===
    user_message = f"""
            [BASE PROMPT]
            {base_prompt.strip()}

            [EDIT INSTRUCTION]
            {edit_instruction.strip()}

            {change_history}

            Your task:
            1. Treat the BASE PROMPT as a finalized, structured design brief.
            2. Only update or add content related to the EDIT INSTRUCTION.
            3. Keep the structure (Typography, Color, Iconography, Layout, etc.) intact.
            4. Ensure **semantic consistency** across all sections — typography, color, and iconography
            should harmonize in tone, energy, and mood as part of one cohesive brand concept.
            5. Reflect **previous changes** naturally so the evolution feels continuous,
            not like separate revisions.
            6. Maintain the tone and language style of the base prompt (English, Markdown structured).
            7. Return the full updated prompt text (including unmodified sections).
            8. Append a “Constraints” section if a NEGATIVE PROMPT exists.
                """

    if negative_prompt:
        user_message += f"\n[NEGATIVE PROMPT]\n{negative_prompt.strip()}"

    # === LLM 호출 ===
    completion = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a senior logo prompt editor. "
                    "You must preserve the base structure and style of the logo brief. "
                    "Apply localized edits while maintaining semantic consistency across sections. "
                    "Incorporate prior change context to create smooth, iterative evolution. "
                    "Return the final structured prompt in Markdown, no explanations."
                ),
            },
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )

    return completion.choices[0].message.content.strip()


# === Nodes ===
def prompt_node(state: LogoState) -> LogoState:
    """
    Step 1: base_prompt 생성
    Step 2: edit_instruction이 있을 경우 기존 프롬프트를 유지하면서 최소 수정
    """

    # === Case 1: 최초 생성 ===
    if not state.get("edit_image_url"):
        base_prompt = (
            f"Generate a professional logo concept for '{state['brand_name']}'. "
            f"Description: {state['description']}. Style: {state['style']}."
        )
        if state.get("negative_prompt"):
            base_prompt += f" Avoid: {state['negative_prompt']}."

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a professional logo prompt engineer.",
                },
                {"role": "user", "content": base_prompt},
            ],
        )
        refined_base = completion.choices[0].message.content.strip()
        state["base_prompt"] = refined_base
        state["prompt"] = refined_base
        return state

    # === Case 2: 수정(remix) ===
    # ⚙️ base_prompt 없으면 prompt나 description 기반으로 재생성
    base_prompt = (
        state.get("base_prompt")
        or state.get("prompt")
        or f"Generate a professional logo for '{state['brand_name']}' with style {state['style']}."
    )

    remix_prompt = refine_remix_prompt(
        base_prompt=base_prompt,
        edit_instruction=state.get("edit_instruction"),
        negative_prompt=state.get("negative_prompt"),
    )

    state["prompt"] = remix_prompt
    state["base_prompt"] = base_prompt
    return state


def generate_node(state: LogoState) -> LogoState:
    headers = {"Api-Key": IDEOGRAM_API_KEY}
    payload = {
        "prompt": state["prompt"],
        "model": "3.0-turbo",
        "num_outputs": 1,
        "aspect_ratio": "1x1",
        "cfg_scale": state.get("cfg_scale", 15.0),
    }
    resp = requests.post(
        "https://api.ideogram.ai/v1/ideogram-v3/generate",
        headers=headers,
        json=payload,
        timeout=60,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=resp.text)

    image_url = resp.json()["data"][0]["url"]
    img_bytes = requests.get(image_url).content
    save_path = SAVE_DIR / f"{state['brand_name']}_original.png"
    save_path.write_bytes(img_bytes)
    state["image_url"] = image_url
    state["original_path"] = str(save_path)
    return state


def edit_node(state: LogoState) -> LogoState:
    if not state.get("edit_image_url"):
        raise HTTPException(
            status_code=400, detail="edit_image_url is required for edits"
        )

    def _load_image_bytes(source: str) -> bytes:
        if source.startswith("http"):
            response = requests.get(source, timeout=60)
            response.raise_for_status()
            return response.content
        return Path(source).read_bytes()

    prompt = state.get("prompt") or state.get("base_prompt")
    if not prompt:
        raise HTTPException(status_code=400, detail="Unable to compose remix prompt")

    files = {
        "image": ("input.png", _load_image_bytes(state["edit_image_url"]), "image/png")
    }
    data = {
        "prompt": prompt,
        "rendering_speed": "DEFAULT",
        "style_type": state.get("style_type") or "GENERAL",
    }
    if state.get("negative_prompt"):
        data["negative_prompt"] = state["negative_prompt"]
    if state.get("seed") is not None:
        data["seed"] = str(state["seed"])

    headers = {"Api-Key": IDEOGRAM_API_KEY}
    resp = requests.post(
        "https://api.ideogram.ai/v1/ideogram-v3/remix",
        headers=headers,
        data=data,
        files=files,
        timeout=60,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=resp.text)

    image_url = resp.json()["data"][0]["url"]
    img_bytes = requests.get(image_url, timeout=60).content
    save_path = SAVE_DIR / f"{state['brand_name']}_remix.png"
    save_path.write_bytes(img_bytes)
    state["image_url"] = image_url
    state["original_path"] = str(save_path)
    return state


def overlay_node(state: LogoState) -> LogoState:
    image_bytes = Path(state["original_path"]).read_bytes()
    overlay_path = (
        overlay_korean_font(image_bytes, state["brand_name"])
        if contains_korean(state["brand_name"])
        else None
    )
    state["overlay_path"] = overlay_path
    return state


# === LangGraph ===
graph = StateGraph(LogoState)
graph.add_node("enhance_prompt", prompt_node)
graph.add_node("generate_logo", generate_node)
graph.add_node("edit_logo", edit_node)
graph.add_node("overlay_font", overlay_node)
graph.set_entry_point("enhance_prompt")


def choose_branch(state: LogoState) -> str:
    return "edit" if state.get("edit_image_url") else "generate"


graph.add_conditional_edges(
    "enhance_prompt", choose_branch, {"generate": "generate_logo", "edit": "edit_logo"}
)
graph.add_edge("generate_logo", "overlay_font")
graph.add_edge("edit_logo", "overlay_font")
graph.add_edge("overlay_font", END)
compiled_graph = graph.compile()


# === API ===
@app.post("/logo_pipeline")
def run_logo_pipeline(req: LogoRequest):
    try:
        state = compiled_graph.invoke(req.dict())
        return {
            "prompt": state.get("prompt"),
            "base_prompt": state.get("base_prompt"),
            "image_url": state.get("image_url"),
            "original_logo": state.get("original_path"),
            "final_logo": state.get("overlay_path"),
            "negative_prompt": state.get("negative_prompt"),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
def root():
    return {
        "message": "🚀 AI Logo Maker LangGraph (Localized Prompt Fusion) is running!"
    }
