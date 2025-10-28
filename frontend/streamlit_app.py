import uuid
from pathlib import Path
from typing import Optional

import requests
import streamlit as st

API_URL = "http://localhost:8000/logo_pipeline"
OUTPUT_DIR = Path("data/outputs")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

st.set_page_config(page_title="AI Logo Maker", page_icon="🎨", layout="wide")

APP_TITLE = "🎨 AI Logo Maker"
APP_SUBTITLE = "LLM Prompt Fusion + Ideogram + LangGraph + Korean Font Overlay"

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


st.title(APP_TITLE)
st.caption(APP_SUBTITLE)

sidebar = st.sidebar
sidebar.header("Workflow")
mode = sidebar.radio("생성 모드 선택", [MODE_TEXT_TO_IMAGE, MODE_IMAGE_TO_IMAGE])
reset_session_for_mode(mode)

uploaded_image = None
character_reference_upload = None
if mode == MODE_IMAGE_TO_IMAGE:
    sidebar.subheader("입력 이미지")
    uploaded_image = sidebar.file_uploader(
        "원본 이미지 업로드", type=["png", "jpg", "jpeg", "webp"]
    )
    sidebar.markdown("---")
elif mode == MODE_TEXT_TO_IMAGE:
    character_reference_upload = sidebar.file_uploader(
        "캐릭터 레퍼런스 이미지 (선택)", type=["png", "jpg", "jpeg", "webp"]
    )
    if character_reference_upload:
        sidebar.caption("· 최대 1장 업로드 가능 (총 용량 10MB 이하 권장)")
    sidebar.markdown("---")

sidebar.subheader("Ideogram 3.0 Controls")

brand = sidebar.text_input("브랜드명", "서민고기")
description = sidebar.text_area(
    "브랜드 설명", "직화구이 전문점, 따뜻하고 정직한 이미지"
)
style = sidebar.text_input(
    "디자인 스타일", "warm, minimal, Korean calligraphy inspired"
)
negative = sidebar.text_input("네거티브 프롬프트 (선택)", "")
seed_raw = sidebar.text_input("시드 값 (선택)", "")
style_type = sidebar.selectbox("스타일 타입", STYLE_TYPE_OPTIONS, index=4)
if style_type:
    guide = STYLE_TYPE_GUIDE.get(style_type)
    if guide:
        sidebar.markdown(
            f"**{guide['title']}**\n\n"
            f"- {guide['summary']}\n"
            f"- 권장 용도: {guide['best_for']}"
        )
cfg_scale = sidebar.slider(
    "CFG Scale", min_value=1.0, max_value=20.0, value=15.0, step=0.5
)

sidebar.markdown("---")
sidebar.markdown(
    "### Ideogram 3.0 API\n"
    "- Generate (`/v1/ideogram-v3/generate`)\n"
    "- Remix (`/v1/ideogram-v3/remix`)\n"
    "- Edit (`/v1/ideogram-v3/edit`)\n"
    "[API Reference](https://developer.ideogram.ai/api-reference/) 참고"
)

seed_value = parse_seed(seed_raw)
style_type_payload = style_type or None
negative_payload = negative.strip() or None

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
                generated["image_url"], caption="AI 생성 로고", use_container_width=True
            )
            if generated.get("final_logo"):
                st.image(
                    generated["final_logo"],
                    caption="한글 폰트 적용 버전",
                    use_container_width=True,
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
            st.info("Edit 워크플로우는 준비 중입니다. 곧 제공될 예정이에요.")

    edited = st.session_state.get("edited_logo")
    if edited:
        st.markdown("### Remix 결과 비교")
        original = st.session_state["generated_logo"]
        col_original, col_remix = st.columns(2)
        with col_original:
            st.image(
                original["image_url"], caption="원본 로고", use_container_width=True
            )
        with col_remix:
            st.image(
                edited["image_url"], caption="Remix 로고", use_container_width=True
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
                }
                if seed_value is not None:
                    payload["seed"] = seed_value
                if style_type_payload:
                    payload["style_type"] = style_type_payload

                result = post_to_pipeline(payload)
                if result:
                    st.session_state["generated_logo"] = result
                    st.session_state["base_prompt"] = result.get(
                        "base_prompt"
                    ) or result.get("prompt")
                    st.session_state.pop("edited_logo", None)
                    st.success("✅ 이미지 리믹스 완료!")

    generated = st.session_state.get("generated_logo")
    if generated:
        st.image(
            generated["image_url"], caption="리믹스 결과", use_container_width=True
        )
        if generated.get("final_logo"):
            st.image(
                generated["final_logo"],
                caption="한글 폰트 적용 버전",
                use_container_width=True,
            )

        st.markdown("#### 프롬프트")
        st.code(generated.get("prompt") or "No prompt returned.", language="markdown")
