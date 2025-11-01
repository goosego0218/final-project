import uuid
from pathlib import Path
from typing import Optional

import requests
from io import BytesIO
import numpy as np
from PIL import Image
from streamlit_drawable_canvas import st_canvas
import streamlit as st

API_URL = "http://localhost:8000/logo_pipeline"
OUTPUT_DIR = Path("data/outputs")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

st.set_page_config(page_title="AI Logo Maker", page_icon="🎨", layout="wide")

APP_TITLE = "🎨 AI Logo Maker"
#APP_SUBTITLE = "LLM Prompt Fusion + Ideogram + LangGraph + Korean Font Overlay"

MODE_TEXT_TO_IMAGE = "Text → Image"
MODE_IMAGE_TO_IMAGE = "Image → Image"

FOLLOW_UP_REMX = "Remix"
FOLLOW_UP_EDIT = "Edit"

STYLE_TYPE_OPTIONS = ["", "AUTO", "GENERAL", "REALISTIC", "DESIGN", "FICTION"]
STYLE_TYPE_GUIDE = {
    "AUTO": {
        "title": "Auto",
        "summary": "모델이 자동으로 판단해 스타일을 결정합니다.",
        "best_for": "탐색용, 아무 방향도 정하지 않았을 때",
    },
    "GENERAL": {
        "title": "General",
        "summary": "균형 잡힌 결과물을 노리는 기본 스타일.",
        "best_for": "다양한 그래픽 스타일을 두루 시도해보고 싶을 때",
    },
    "REALISTIC": {
        "title": "Realistic",
        "summary": "사진/실사에 가까운 질감을 강조합니다.",
        "best_for": "제품 사진, 포토리얼 이미지",
    },
    "DESIGN": {
        "title": "Design",
        "summary": "그래픽/벡터 형태와 타이포그래피에 최적화.",
        "best_for": "로고, 아이콘, 포스터 등 브랜드 디자인 작업",
    },
    "FICTION": {
        "title": "Fiction",
        "summary": "상상력 있는 콘셉트와 판타지 이미지에 적합.",
        "best_for": "캐릭터, 판타지 세계관",
    },
}


def reset_session_for_mode(new_mode: str) -> None:
    if st.session_state.get("active_mode") == new_mode:
        return
    for key in [
        "generated_logo",
        "edited_logo",
        "base_prompt",
        "last_action",
        "last_error",
    ]:
        st.session_state.pop(key, None)
    st.session_state["active_mode"] = new_mode


def parse_seed(raw_seed: str) -> Optional[int]:
    if not raw_seed:
        return None
    try:
        return int(raw_seed)
    except ValueError:
        st.warning("시드 값은 숫자여야 합니다. 입력을 무시합니다.")
        return None


def post_to_pipeline(payload: dict) -> Optional[dict]:
    try:
        response = requests.post(API_URL, json=payload, timeout=60)
    except requests.RequestException as exc:
        st.error(f"API 요청 실패: {exc}")
        return None

    if response.status_code != 200:
        st.error(f"❌ API 오류: {response.text}")
        return None
    return response.json()


def save_uploaded_image(uploaded_file) -> Path:
    file_ext = Path(uploaded_file.name).suffix or ".png"
    safe_name = f"user_upload_{uuid.uuid4().hex}{file_ext}"
    target_path = OUTPUT_DIR / safe_name
    target_path.write_bytes(uploaded_file.getvalue())
    return target_path


def build_mask_from_canvas(canvas_data: np.ndarray, out_path: Path) -> Path:
    """Convert RGBA canvas data to a binary mask: drawn area -> black (edit),
    elsewhere -> white. Save as PNG and return path."""
    if canvas_data is None:
        raise ValueError("캔버스 데이터가 비어 있습니다.")
    # canvas_data: H x W x 4 (RGBA)
    alpha = canvas_data[:, :, 3]
    # Drawn pixels: alpha > 0
    drawn = alpha > 0
    h, w = alpha.shape
    mask = np.ones((h, w), dtype=np.uint8) * 255  # default white
    mask[drawn] = 0  # black where edited
    img = Image.fromarray(mask, mode="L")
    img.save(out_path)
    return out_path


@st.cache_data(show_spinner=False)
def load_image_bytes(src: str) -> bytes:
    """Load image bytes from URL or local path (cached)."""
    if src.startswith("http://") or src.startswith("https://"):
        return requests.get(src, timeout=30).content
    return Path(src).read_bytes()


def sanitize_mask_file(path: Path) -> Path:
    """Ensure mask contains only pure black(0) and white(255) pixels and
    has an allowed mode. Convert to L, threshold, then force RGB for safety."""
    try:
        img = Image.open(path).convert("L")
        arr = np.array(img)
        bw = (arr > 127).astype(np.uint8) * 255
        img_bw = Image.fromarray(bw, mode="L")
        rgb = Image.merge("RGB", (img_bw, img_bw, img_bw))
        rgb.save(path)
    except Exception:
        # If sanitization fails, leave original; downstream will error clearly
        pass
    return path

 


def draw_mask_canvas_with_fallback(
    *,
    bg_image: Image.Image | None,
    width: int,
    height: int,
    key: str,
    update_streamlit: bool = False,
):
    """Try drawing canvas with background image. If the installed Streamlit/
    canvas plugin combo does not support background images, fall back to a
    blank canvas of the same size so 사용자가 대략 위치를 맞춰 그릴 수 있게 합니다."""
    try:
        return st_canvas(
            fill_color="rgba(0, 0, 0, 1)",
            stroke_width=20,
            stroke_color="#000000",
            background_image=bg_image,
            height=height,
            width=width,
            drawing_mode="freedraw",
            update_streamlit=update_streamlit,
            key=key,
        )
    except AttributeError:
        st.warning(
            "캔버스 배경 이미지를 설정하지 못했습니다. (스트림릿/캔버스 버전 호환 이슈)\n"
            "대신 동일 크기의 빈 캔버스를 제공합니다."
        )
        return st_canvas(
            fill_color="rgba(0, 0, 0, 1)",
            stroke_width=20,
            stroke_color="#000000",
            background_color="#FFFFFF",
            height=height,
            width=width,
            drawing_mode="freedraw",
            update_streamlit=update_streamlit,
            key=f"{key}_fallback",
        )


st.title(APP_TITLE)
#st.caption(APP_SUBTITLE)

sidebar = st.sidebar
sidebar.header("Workflow")
mode = sidebar.radio("생성 모드 선택", [MODE_TEXT_TO_IMAGE, MODE_IMAGE_TO_IMAGE])
reset_session_for_mode(mode)

character_reference_upload = None
uploaded_image = None

if mode == MODE_TEXT_TO_IMAGE:
    sidebar.markdown("---")
    sidebar.subheader("Controls")

    brand = sidebar.text_input(
        "브랜드명",
        st.session_state.get("text_brand", "서민고기"),
        key="text_brand_input",
    )
    st.session_state["text_brand"] = brand

    description = sidebar.text_area(
        "브랜드 설명",
        st.session_state.get(
            "text_description", "직화구이 전문점, 따뜻하고 정직한 이미지"
        ),
        key="text_description_input",
    )
    st.session_state["text_description"] = description

    style = sidebar.text_input(
        "디자인 스타일",
        st.session_state.get(
            "text_style", "warm, minimal, Korean calligraphy inspired"
        ),
        key="text_style_input",
    )
    st.session_state["text_style"] = style

    negative_input = sidebar.text_input(
        "네거티브 프롬프트 (선택)",
        st.session_state.get("text_negative", ""),
        key="text_negative_input",
    )
    st.session_state["text_negative"] = negative_input

    seed_raw = sidebar.text_input(
        "시드 값 (선택)",
        st.session_state.get("text_seed_raw", ""),
        key="text_seed_input",
    )
    st.session_state["text_seed_raw"] = seed_raw

    style_type_default = st.session_state.get("text_style_type", "DESIGN")
    style_type_index = (
        STYLE_TYPE_OPTIONS.index(style_type_default)
        if style_type_default in STYLE_TYPE_OPTIONS
        else 0
    )
    style_type = sidebar.selectbox(
        "스타일 타입",
        STYLE_TYPE_OPTIONS,
        index=style_type_index,
        key="text_style_type_select",
    )
    st.session_state["text_style_type"] = style_type

    if style_type:
        guide = STYLE_TYPE_GUIDE.get(style_type)
        if guide:
            sidebar.markdown(
                f"**{guide['title']}**\n\n"
                f"- {guide['summary']}\n"
                f"- 권장 용도: {guide['best_for']}"
            )

    cfg_default = float(st.session_state.get("text_cfg_scale", 15.0))
    cfg_scale = sidebar.slider(
        "CFG Scale(프롬프트 충실도)",
        min_value=1.0,
        max_value=20.0,
        value=cfg_default,
        step=0.5,
        key="text_cfg_scale_slider",
    )
    st.session_state["text_cfg_scale"] = cfg_scale

    character_reference_upload = None
    image_weight = None
    seed_value = parse_seed(seed_raw)
    style_type_payload = style_type or None
    negative_payload = negative_input.strip() or None

else:
    sidebar.markdown("---")
    sidebar.subheader("입력 이미지")
    uploaded_image = sidebar.file_uploader(
        "원본 이미지 업로드",
        type=["png", "jpg", "jpeg", "webp"],
        key="image_mode_upload",
    )
    sidebar.markdown("---")

    default_weight = int(st.session_state.get("image_mode_weight", 70))
    image_weight = sidebar.slider(
        "Image Weight (원본 보존 정도)",
        min_value=0,
        max_value=100,
        value=default_weight,
        step=5,
        key="image_mode_weight_slider",
        help="값이 높을수록 업로드한 이미지의 구성을 더 강하게 유지합니다.",
    )
    st.session_state["image_mode_weight"] = image_weight
    sidebar.caption("Ideogram Remix 기본값은 50입니다. 필요에 따라 조절하세요.")

    character_reference_upload = None

    brand = st.session_state.get("text_brand", "이미지 리믹스")
    description = st.session_state.get("text_description", "")
    style = st.session_state.get("text_style", "logo remix")
    cfg_scale = float(st.session_state.get("text_cfg_scale", 15.0))
    style_type_payload = st.session_state.get("text_style_type") or None
    negative_payload = None
    seed_value = None
    negative_payload = None
    seed_value = None

sidebar.markdown("---")
sidebar.markdown(
    "### Ideogram 3.0 API\n"
    "- Generate (`/v1/ideogram-v3/generate`)\n"
    "- Remix (`/v1/ideogram-v3/remix`)\n"
    "- Edit (`/v1/ideogram-v3/edit`)\n"
    "[API Reference](https://developer.ideogram.ai/api-reference/) 참고"
)

main_container = st.container()
prompt_container = st.container()

if mode == MODE_TEXT_TO_IMAGE:
    st.markdown("### 텍스트 기반 로고 생성")
    generate_clicked = st.button("🚀 로고 생성하기", use_container_width=True)

    if generate_clicked:
        with st.spinner("로고 생성 중..."):
            payload = {
                "brand_name": brand,
                "description": description,
                "style": style,
                "negative_prompt": negative_payload,
                "cfg_scale": cfg_scale,
                "enable_palette_suggestion": True,
            }
            if seed_value is not None:
                payload["seed"] = seed_value
            if style_type_payload:
                payload["style_type"] = style_type_payload
            if character_reference_upload:
                if getattr(character_reference_upload, "size", 0) > 10 * 1024 * 1024:
                    st.error("캐릭터 레퍼런스 이미지는 10MB 이하만 지원합니다.")
                    st.stop()
                reference_path = save_uploaded_image(character_reference_upload)
                payload["character_reference_images"] = [str(reference_path)]

            result = post_to_pipeline(payload)
            if result:
                st.session_state["generated_logo"] = result
                st.session_state["base_prompt"] = result.get(
                    "base_prompt"
                ) or result.get("prompt")
                st.session_state.pop("edited_logo", None)
                st.success("✅ 로고 생성 완료!")

    generated = st.session_state.get("generated_logo")
    if generated:
        col_left, col_right = st.columns([2, 1])
        with col_left:
            st.image(
                generated["image_url"], caption="AI 생성 로고", use_column_width=True
            )
            if generated.get("final_logo"):
                st.image(
                    generated["final_logo"],
                    caption="한글 폰트 적용 버전",
                    use_column_width=True,
                )
        with col_right:
            st.markdown("#### 생성 정보")
            st.write(f"- 브랜드명: **{brand}**")
            st.write(f"- 스타일 타입: **{style_type_payload or '미지정'}**")
            st.write(f"- CFG Scale: **{cfg_scale}**")
            if seed_value is not None:
                st.write(f"- Seed: **{seed_value}**")
            if negative_payload:
                st.write(f"- Negative: `{negative_payload}`")

        st.markdown("### 후속 작업 선택")
        action = st.radio(
            "수정 옵션",
            [FOLLOW_UP_REMX, FOLLOW_UP_EDIT],
            horizontal=True,
        )

        if action == FOLLOW_UP_REMX:
            edit_instruction = st.text_area(
                "Remix 지시문",
                value=st.session_state.get(
                    "last_remix_instruction",
                    "배경에 은은한 불빛 효과를 추가하고 텍스트를 더 선명하게 만들어 주세요.",
                ),
            )
            remix_clicked = st.button("🔄 Remix 실행", use_container_width=True)
            if remix_clicked:
                if not edit_instruction.strip():
                    st.error("Remix 지시문을 입력해주세요.")
                else:
                    with st.spinner("Remix 작업 중..."):
                        payload = {
                            "brand_name": brand,
                            "description": description,
                            "style": style,
                            "edit_instruction": edit_instruction.strip(),
                            "edit_image_url": generated.get("original_logo")
                            or generated.get("image_url"),
                            "base_prompt": st.session_state.get("base_prompt"),
                            "negative_prompt": negative_payload,
                            "cfg_scale": cfg_scale,
                            "auto_retry_remix": True,
                            "remix_max_retries": 1,
                        }
                        if seed_value is not None:
                            payload["seed"] = seed_value
                        if style_type_payload:
                            payload["style_type"] = style_type_payload

                        remix_result = post_to_pipeline(payload)
                        if remix_result:
                            st.session_state["edited_logo"] = remix_result
                            st.session_state["last_remix_instruction"] = (
                                edit_instruction
                            )
                            st.success("✨ Remix 완료!")
        else:
            st.markdown("---")
            st.subheader("Edit (마스크 기반)")
            st.caption("검은색(또는 불투명) 영역이 수정 대상입니다. PNG 권장")
            mask_mode = st.radio("마스크 입력 방식", ["파일 업로드", "직접 그리기"], horizontal=True, key="mask_mode_text")
            edit_inst2 = st.text_area("Edit 지시문", value="문자 가독성 강화, 아이콘 단순화")

            mask_path: Path | None = None
            if mask_mode == "파일 업로드":
                mask_upload = st.file_uploader(
                    "마스크 이미지 업로드",
                    type=["png", "jpg", "jpeg", "webp"],
                    key="mask_upload_text_mode",
                )
                if mask_upload is not None:
                    mask_path = sanitize_mask_file(save_uploaded_image(mask_upload))
                    st.session_state["last_mask_path"] = str(mask_path)
            else:
                st.caption("원본 이미지 위에 수정할 영역을 그려주세요.")
                base_url = generated.get("original_logo") or generated.get("image_url")
                applied_text_mask = False
                if base_url:
                    if Path(str(base_url)).exists():
                        bg_img = Image.open(base_url)
                    else:
                        bg_bytes = load_image_bytes(str(base_url))
                        bg_img = Image.open(BytesIO(bg_bytes))

                    with st.form("mask_form_text"):
                        canvas_result = draw_mask_canvas_with_fallback(
                            bg_image=bg_img,
                            width=bg_img.width,
                            height=bg_img.height,
                            key="mask_canvas_text_mode",
                            update_streamlit=False,
                        )
                        applied_text_mask = st.form_submit_button("🖌️ 마스크 적용")
                    if applied_text_mask and canvas_result.image_data is not None:
                        st.session_state["mask_canvas_text_data"] = canvas_result.image_data

            edit_clicked = st.button("✏️ Edit 실행", use_container_width=True)
            if edit_clicked:
                if mask_mode == "직접 그리기":
                    canvas_data = st.session_state.get("mask_canvas_text_data")
                    if canvas_data is None:
                        st.error("캔버스에 마스크를 그려주세요.")
                        st.stop()
                    out_path = OUTPUT_DIR / f"user_mask_{uuid.uuid4().hex}.png"
                    mask_path = sanitize_mask_file(build_mask_from_canvas(canvas_data, out_path))
                    st.session_state["last_mask_path"] = str(mask_path)
                if mask_path is None:
                    st.error("마스크를 업로드하거나 직접 그려주세요.")
                else:
                    with st.spinner("Edit 작업 중..."):
                        payload = {
                            "brand_name": brand,
                            "description": description,
                            "style": style,
                            "negative_prompt": negative_payload,
                            "edit_instruction": edit_inst2.strip(),
                            "edit_image_url": generated.get("original_logo") or generated.get("image_url"),
                            "mask_image_url": str(mask_path),
                            "cfg_scale": cfg_scale,
                        }
                        if seed_value is not None:
                            payload["seed"] = seed_value
                        if style_type_payload:
                            payload["style_type"] = style_type_payload
                        edited = post_to_pipeline(payload)
                        if edited:
                            st.session_state["edited_logo"] = edited
                            st.success("✨ Edit 완료!")

    edited = st.session_state.get("edited_logo")
    if edited:
        st.markdown("### Remix 결과 비교")
        original = st.session_state["generated_logo"]
        col_original, col_remix = st.columns(2)
        with col_original:
            st.image(
                original["image_url"], caption="원본 로고", use_column_width=True
            )
        with col_remix:
            st.image(
                edited["image_url"], caption="Remix 로고", use_column_width=True
            )

        st.markdown("#### 프롬프트 비교")
        st.markdown("**기존(base_prompt)**")
        st.code(
            original.get("base_prompt") or original.get("prompt"), language="markdown"
        )
        st.markdown("**Remix Prompt**")
        st.code(
            edited.get("prompt") or "No remix prompt returned.", language="markdown"
        )

    if generated and not st.session_state.get("edited_logo"):
        st.markdown("#### 현재 프롬프트")
        st.code(generated.get("prompt") or "No prompt returned.", language="markdown")

elif mode == MODE_IMAGE_TO_IMAGE:
    st.markdown("### 이미지 기반 리믹스")
    if uploaded_image:
        st.image(
            uploaded_image,
            caption="업로드 이미지 미리보기 (전송 전 확인용)",
            use_container_width=True,
        )

    edit_instruction = st.text_area(
        "수정 지시문",
        "원본 이미지를 유지하면서 브랜드 텍스트를 좀 더 굵고 선명하게 만들어 주세요.",
    )

    generate_from_image = st.button("🖼️ 이미지에서 생성하기", use_container_width=True)

    if generate_from_image:
        if not uploaded_image:
            st.error("이미지를 업로드해주세요.")
        elif not edit_instruction.strip():
            st.error("수정 지시문을 입력해주세요.")
        else:
            image_path = save_uploaded_image(uploaded_image)
            with st.spinner("이미지 기반 리믹스 중..."):
                payload = {
                    "brand_name": brand,
                    "description": description,
                    "style": style,
                    "edit_instruction": edit_instruction.strip(),
                    "edit_image_url": str(image_path),
                    "negative_prompt": negative_payload,
                    "cfg_scale": cfg_scale,
                    "skip_prompt_refine": True,
                    "auto_retry_remix": True,
                    "remix_max_retries": 1,
                }
                if seed_value is not None:
                    payload["seed"] = seed_value
                if style_type_payload:
                    payload["style_type"] = style_type_payload
                if image_weight is not None:
                    payload["image_weight"] = image_weight

                result = post_to_pipeline(payload)
                if result:
                    st.session_state["generated_logo"] = result
                    st.session_state["base_prompt"] = result.get(
                        "base_prompt"
                    ) or result.get("prompt")
                    st.session_state.pop("edited_logo", None)
                    st.session_state["last_image_to_image_prompt"] = payload[
                        "edit_instruction"
                    ]
                    st.session_state["last_image_to_image_source"] = str(image_path)
                    st.success("✅ 이미지 리믹스 완료!")

    generated = st.session_state.get("generated_logo")
    if generated:
        st.image(
            generated["image_url"], caption="리믹스 결과", use_column_width=True
        )
        if generated.get("final_logo"):
            st.image(
                generated["final_logo"],
                caption="한글 폰트 적용 버전",
                use_column_width=True,
            )

        st.markdown("#### 프롬프트")
        st.code(generated.get("prompt") or "No prompt returned.", language="markdown")

    if st.session_state.get("last_image_to_image_prompt"):
        st.markdown("#### 전송 프롬프트 (이미지→이미지)")
        st.code(
            st.session_state["last_image_to_image_prompt"],
            language="markdown",
        )
    if st.session_state.get("last_image_to_image_source"):
        st.image(
            st.session_state["last_image_to_image_source"],
            caption="전송에 사용된 원본 이미지",
            use_container_width=True,
        )

 

    st.markdown("---")
    st.subheader("마스크 기반 Edit (이미지 → 이미지)")
    st.caption("검은색(또는 불투명) 영역이 수정 대상입니다. PNG 권장")
    mask_mode_img = st.radio("마스크 입력 방식", ["파일 업로드", "직접 그리기"], horizontal=True, key="mask_mode_image")
    edit_instruction2 = st.text_area(
        "Edit 지시문",
        value=st.session_state.get(
            "last_edit_instruction",
            "원본 로고는 유지하고 배경만 교체해 주세요.",
        ),
    )

    mask_path2: Path | None = None
    if mask_mode_img == "파일 업로드":
        mask_upload2 = st.file_uploader(
            "마스크 이미지 업로드",
            type=["png", "jpg", "jpeg", "webp"],
            key="mask_upload_image_mode",
        )
        if mask_upload2 is not None:
            mask_path2 = sanitize_mask_file(save_uploaded_image(mask_upload2))
            st.session_state["last_mask_path"] = str(mask_path2)
    else:
        if uploaded_image is not None:
            base_preview = Image.open(uploaded_image)
            with st.form("mask_form_image"):
                canvas_result2 = draw_mask_canvas_with_fallback(
                    bg_image=base_preview,
                    width=base_preview.width,
                    height=base_preview.height,
                    key="mask_canvas_image_mode",
                    update_streamlit=False,
                )
                applied_image_mask = st.form_submit_button("🖌️ 마스크 적용")
            if applied_image_mask and canvas_result2.image_data is not None:
                st.session_state["mask_canvas_image_data"] = canvas_result2.image_data

    edit_btn = st.button("✏️ Edit 실행", use_container_width=True)
    if edit_btn:
        if not uploaded_image:
            st.error("원본 이미지를 먼저 업로드해주세요.")
        elif mask_mode_img == "직접 그리기":
            canvas_data2 = st.session_state.get("mask_canvas_image_data")
            if canvas_data2 is None and mask_path2 is None:
                st.error("마스크를 업로드하거나 직접 그려주세요.")
                st.stop()
            if canvas_data2 is not None and mask_path2 is None:
                out_path2 = OUTPUT_DIR / f"user_mask_{uuid.uuid4().hex}.png"
                mask_path2 = sanitize_mask_file(build_mask_from_canvas(canvas_data2, out_path2))
                st.session_state["last_mask_path"] = str(mask_path2)
        elif mask_path2 is None:
            st.error("마스크를 업로드하거나 직접 그려주세요.")
        elif not edit_instruction2.strip():
            st.error("Edit 지시문을 입력해주세요.")
        else:
            base_path = save_uploaded_image(uploaded_image)
            with st.spinner("Edit 작업 중..."):
                payload = {
                    "brand_name": brand,
                    "description": description,
                    "style": style,
                    "edit_instruction": edit_instruction2.strip(),
                    "edit_image_url": str(base_path),
                    "mask_image_url": str(mask_path2),
                    "cfg_scale": cfg_scale,
                }
                if style_type_payload:
                    payload["style_type"] = style_type_payload
                edited2 = post_to_pipeline(payload)
                if edited2:
                    st.session_state["generated_logo"] = edited2
                    st.session_state["last_image_to_image_prompt"] = payload["edit_instruction"]
                    st.session_state["last_image_to_image_source"] = str(base_path)
                    st.success("✨ Edit 완료!")

    # Debug section for mask validation
    with st.expander("디버그: 마스크 점검"):
        last_mask = st.session_state.get("last_mask_path")
        if last_mask and Path(last_mask).exists():
            try:
                mimg = Image.open(last_mask)
                st.image(last_mask, caption=f"마스크 미리보기 ({mimg.mode} {mimg.size})")
                arr = np.array(mimg.convert("L"))
                uniques = np.unique(arr)
                st.write({"mode": mimg.mode, "size": mimg.size, "unique": uniques.tolist()[:10]})
                st.write(
                    f"검정 비율: {(arr==0).mean():.2%}, 흰색 비율: {(arr==255).mean():.2%}"
                )
            except Exception as e:
                st.warning(f"마스크 분석 실패: {e}")
        else:
            st.info("최근 생성된 마스크가 없습니다. (적용/실행 후 표시)")
