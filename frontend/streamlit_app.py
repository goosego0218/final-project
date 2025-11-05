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

st.set_page_config(page_title="AI 로고 메이커", page_icon=":art:", layout="wide")

APP_TITLE = "AI 로고 메이커"

MODE_TEXT_TO_IMAGE = "텍스트 → 이미지"
MODE_IMAGE_TO_IMAGE = "이미지 → 이미지"

FOLLOW_UP_REMX = "Remix"
FOLLOW_UP_EDIT = "Edit"

STYLE_TYPE_OPTIONS = ["", "AUTO", "GENERAL", "REALISTIC", "DESIGN", "FICTION"]


def reset_session_for_mode(new_mode: str) -> None:
    if st.session_state.get("active_mode") == new_mode:
        return
    for key in [
        "generated_logo",
        "edited_logo",
        "base_prompt",
        "last_action",
        "last_error",
        "last_mask_path",
    ]:
        st.session_state.pop(key, None)
    st.session_state["active_mode"] = new_mode


def parse_seed(raw_seed: str) -> Optional[int]:
    if not raw_seed:
        return None
    try:
        return int(raw_seed)
    except ValueError:
        st.warning("시드는 숫자만 입력 가능합니다.")
        return None


def post_to_pipeline(payload: dict) -> Optional[dict]:
    try:
        response = requests.post(API_URL, json=payload, timeout=120)
    except requests.RequestException as exc:
        st.error(f"API 요청 실패: {exc}")
        return None

    if response.status_code != 200:
        st.error(f"API 오류: {response.text}")
        return None
    return response.json()


def save_uploaded_image(uploaded_file) -> Path:
    file_ext = Path(uploaded_file.name).suffix or ".png"
    safe_name = f"user_upload_{uuid.uuid4().hex}{file_ext}"
    target_path = OUTPUT_DIR / safe_name
    target_path.write_bytes(uploaded_file.getvalue())
    return target_path


def build_mask_from_canvas(canvas_data: np.ndarray, out_path: Path) -> Path:
    if canvas_data is None:
        raise ValueError("Canvas data is empty.")
    arr = canvas_data
    if arr.dtype != np.uint8:
        arr = arr.astype("float32")
        if arr.max() <= 1.0:
            arr = (arr * 255.0).clip(0, 255)
        arr = arr.astype("uint8")
    r = arr[:, :, 0].astype("int16")
    g = arr[:, :, 1].astype("int16")
    b = arr[:, :, 2].astype("int16")
    a = arr[:, :, 3].astype("int16")
    tol = 10
    is_magenta = (
        (abs(r - 255) <= tol)
        & (abs(g - 0) <= tol)
        & (abs(b - 255) <= tol)
        & (a > 0)
    )
    h, w = a.shape
    mask = np.ones((h, w), dtype=np.uint8) * 255
    mask[is_magenta] = 0
    img = Image.fromarray(mask, mode="L")
    img.save(out_path)
    return out_path


def apply_image_options(payload: dict, force_mode: Optional[str] = None) -> dict:
    """Attach shared image-to-image options captured from the sidebar."""
    payload["image_task_mode"] = force_mode or st.session_state.get("image_task_mode")
    payload["remix_strength"] = st.session_state.get("remix_strength")
    payload["remix_num_images"] = st.session_state.get("remix_num_images")
    payload["edit_inpaint_strength"] = st.session_state.get("edit_inpaint_strength")
    payload["edit_keep_background"] = st.session_state.get("edit_keep_background")
    return payload


@st.cache_data(show_spinner=False)
def load_image_bytes(src: str) -> bytes:
    if src.startswith("http://") or src.startswith("https://"):
        return requests.get(src, timeout=30).content
    return Path(src).read_bytes()


def sanitize_mask_file(path: Path) -> Path:
    try:
        img = Image.open(path).convert("L")
        arr = np.array(img)
        bw = (arr > 127).astype(np.uint8) * 255
        img_bw = Image.fromarray(bw, mode="L")
        rgb = Image.merge("RGB", (img_bw, img_bw, img_bw))
        rgb.save(path)
    except Exception:
        pass
    return path


def draw_mask_canvas_with_fallback(*, bg_image: Image.Image | None, width: int, height: int, key: str, update_streamlit: bool = False):
    try:
        background_kwargs = {"background_image": bg_image} if bg_image is not None else {"background_color": "rgba(0, 0, 0, 0)"}
        return st_canvas(
            fill_color="rgba(255, 0, 255, 1)",
            stroke_width=20,
            stroke_color="#ff00ff",
            height=height,
            width=width,
            drawing_mode="freedraw",
            update_streamlit=update_streamlit,
            key=key,
            **background_kwargs,
        )
    except AttributeError:
        return st_canvas(
            fill_color="rgba(255, 0, 255, 1)",
            stroke_width=20,
            stroke_color="#ff00ff",
            background_color="rgba(0, 0, 0, 0)",
            height=height,
            width=width,
            drawing_mode="freedraw",
            update_streamlit=update_streamlit,
            key=f"{key}_fallback",
        )


st.title(APP_TITLE)

st.session_state.setdefault("image_task_mode", "remix")
st.session_state.setdefault("remix_strength", 0.55)
st.session_state.setdefault("remix_num_images", 1)
st.session_state.setdefault("edit_inpaint_strength", 0.75)
st.session_state.setdefault("edit_keep_background", True)

sidebar = st.sidebar
sidebar.header("워크플로우")
mode = sidebar.radio("작업 모드", [MODE_TEXT_TO_IMAGE, MODE_IMAGE_TO_IMAGE])
reset_session_for_mode(mode)

# 공통 사이드바 입력
brand = sidebar.text_input(
    "브랜드명",
    st.session_state.get("text_brand", ""),
    placeholder="예: 카페모카"
)
st.session_state["text_brand"] = brand

description = sidebar.text_area(
    "브랜드 설명",
    st.session_state.get("text_description", ""),
    placeholder="예: 스페셜티 커피, 따뜻하고 신뢰감 있는 브랜드"
)
st.session_state["text_description"] = description

style = sidebar.text_input(
    "스타일/톤 (간단 키워드)",
    st.session_state.get("text_style", ""),
    placeholder="예: modern, minimal, cafe logo, coffee bean icon"
)
st.session_state["text_style"] = style

negative_input = sidebar.text_input(
    "부정 프롬프트 (선택)",
    st.session_state.get("text_negative", ""),
    placeholder="예: blurry text, gradient background"
)
st.session_state["text_negative"] = negative_input

seed_raw = sidebar.text_input(
    "시드 (선택)",
    st.session_state.get("text_seed_raw", ""),
    placeholder="예: 42"
)
st.session_state["text_seed_raw"] = seed_raw
seed_value = parse_seed(seed_raw)

style_type_default = st.session_state.get("text_style_type", "")
style_type_index = STYLE_TYPE_OPTIONS.index(style_type_default) if style_type_default in STYLE_TYPE_OPTIONS else 0
style_type = sidebar.selectbox("스타일 타입", STYLE_TYPE_OPTIONS, index=style_type_index)
st.session_state["text_style_type"] = style_type

cfg_default = float(st.session_state.get("text_cfg_scale", 15.0))
cfg_scale = sidebar.slider("CFG 강도", 1.0, 20.0, cfg_default, 0.5)
st.session_state["text_cfg_scale"] = cfg_scale

# 사이드바: 중요 키워드 (콤마 구분)
keywords_raw = sidebar.text_input(
    "중요 키워드 (콤마로 구분)",
    st.session_state.get("text_keywords_raw", ""),
    placeholder="예: minimal, neon, mascot"
)
st.session_state["text_keywords_raw"] = keywords_raw
prompt_keywords = [k.strip() for k in keywords_raw.split(",") if k.strip()]
st.session_state["text_prompt_keywords"] = prompt_keywords

# 메인 프롬프트 영역
st.markdown("### 메인 프롬프트")
user_prompt = st.text_area(
    "메인 프롬프트 (상세 요구사항)",
    value=st.session_state.get("user_prompt", ""),
    height=120,
    placeholder="예: 브랜드 네임은 Cafe Mocha, 심볼은 커피콩과 미니멀한 원으로 구성"
)
st.session_state["user_prompt"] = user_prompt

sidebar.markdown("---")
sidebar.caption("Ideogram 3.0: Generate / Remix / Edit")

if mode == MODE_IMAGE_TO_IMAGE:
    image_mode_labels = {
        "Remix (원본 변형)": "remix",
        "Edit (마스크)": "edit",
    }
    current_mode = st.session_state.get("image_task_mode", "remix")
    default_label = next((label for label, value in image_mode_labels.items() if value == current_mode), "Remix (원본 변형)")
    options_list = list(image_mode_labels.keys())
    default_index = options_list.index(default_label) if default_label in options_list else 0
    selected_label = sidebar.radio(
        "이미지 작업 유형",
        options_list,
        index=default_index,
        key="image_task_mode_label",
    )
    st.session_state["image_task_mode"] = image_mode_labels[selected_label]

    remix_expander = sidebar.expander("Remix 세부 옵션", expanded=False)
    with remix_expander:
        st.slider(
            "강도 (strength)",
            0.0,
            1.0,
            float(st.session_state.get("remix_strength", 0.55)),
            0.05,
            key="remix_strength",
        )
        st.slider(
            "생성 이미지 수",
            1,
            4,
            int(st.session_state.get("remix_num_images", 1)),
            1,
            key="remix_num_images",
        )

    edit_expander = sidebar.expander("Edit 세부 옵션", expanded=False)
    with edit_expander:
        st.slider(
            "Inpaint 강도",
            0.0,
            1.0,
            float(st.session_state.get("edit_inpaint_strength", 0.75)),
            0.05,
            key="edit_inpaint_strength",
        )
        st.checkbox(
            "배경 유지",
            value=st.session_state.get("edit_keep_background", True),
            key="edit_keep_background",
        )

if mode == MODE_TEXT_TO_IMAGE:
    st.markdown("### 텍스트 → 이미지 생성")
    if st.button("생성하기", use_container_width=True):
        with st.spinner("생성 중..."):
            payload = {
                "brand_name": brand,
                "description": description,
                "style": style,
                "negative_prompt": (negative_input.strip() or None),
                "cfg_scale": cfg_scale,
                "seed": seed_value,
                "style_type": (style_type or None),
                "prompt_keywords": prompt_keywords or None,
                "user_prompt": (user_prompt or None),
            }
            result = post_to_pipeline(payload)
            if result:
                st.session_state["generated_logo"] = result
                st.session_state["base_prompt"] = result.get("base_prompt") or result.get("prompt")
                st.success("완료!")

    generated = st.session_state.get("generated_logo")
    if generated:
        st.image(generated.get("image_url"), caption="생성된 로고", use_column_width=True)
        st.markdown("#### 사용된 프롬프트")
        st.code(generated.get("prompt") or "프롬프트가 반환되지 않았습니다.")

        eval_scores = generated.get("eval_scores") or {}
        score_labels = [
            ("overall", "총점"),
            ("match", "요구 반영"),
            ("typography", "가독성/타이포"),
            ("hangul", "한글 품질"),
            ("negative", "네거티브 준수"),
            ("layout", "레이아웃"),
            ("feedback", "피드백 반영"),
        ]
        if any(eval_scores.get(k) is not None for k, _ in score_labels):
            st.markdown("#### 평가 점수")
            cols = st.columns(len(score_labels))
            for col, (key, label) in zip(cols, score_labels):
                value = eval_scores.get(key)
                display = f"{value}/100" if isinstance(value, (int, float)) else "--"
                col.metric(label, display)

        eval_feedback = generated.get("eval_feedback")
        if eval_feedback:
            st.info(f"평가 피드백: {eval_feedback}")
        next_hint = generated.get("next_prompt_hint")
        if next_hint:
            st.warning(f"다음 개선 힌트: {next_hint}")

        regen_attempts = generated.get("regen_attempts") or generated.get("remix_attempts") or 0
        regen_history = generated.get("regen_history") or []
        if regen_attempts:
            st.caption(f"자동 재생성 시도: {regen_attempts}회 (최대 3회)")
        if regen_history:
            st.markdown("##### 재생성 기록")
            for item in regen_history:
                round_id = item.get("round") or "?"
                reason = item.get("reason") or "사유 없음"
                score = item.get("score") or "-"
                timestamp = item.get("timestamp") or ""
                st.write(f"- {round_id}회차 | 점수 {score} | {reason} | {timestamp}")

        base_image_url = generated.get("image_url")
        st.markdown("### 후속 작업")
        follow_action = st.radio(
            "다음 작업",
            [FOLLOW_UP_REMX, FOLLOW_UP_EDIT],
            horizontal=True,
            key="post_generate_action",
        )

        if follow_action == FOLLOW_UP_REMX:
            remix_instruction = st.text_area(
                "Remix 지시",
                value=st.session_state.get(
                    "post_gen_remix_instruction",
                    "구도는 유지하고, 텍스트 가독성 개선, 아이콘 단순화",
                ),
                key="post_gen_remix_instruction_field",
            )
            if st.button("생성된 로고 Remix", use_container_width=True, key="post_gen_remix_btn"):
                if not base_image_url:
                    st.error("생성된 이미지가 없습니다.")
                else:
                    st.session_state["post_gen_remix_instruction"] = remix_instruction
                    payload = apply_image_options({
                        "brand_name": brand,
                        "description": description,
                        "style": style,
                        "edit_instruction": remix_instruction.strip(),
                        "edit_image_url": base_image_url,
                        "base_prompt": st.session_state.get("base_prompt"),
                        "negative_prompt": (negative_input.strip() or None),
                        "cfg_scale": cfg_scale,
                        "auto_retry_remix": True,
                        "remix_max_retries": 1,
                        "seed": seed_value,
                        "style_type": (style_type or None),
                        "prompt_keywords": prompt_keywords or None,
                        "user_prompt": (user_prompt or None),
                    }, force_mode="remix")
                    remix_result = post_to_pipeline(payload)
                    if remix_result:
                        st.session_state["edited_logo"] = remix_result
                        st.success("Remix 완료!")
                        if remix_result.get("image_url"):
                            st.image(remix_result["image_url"], caption="Remix 결과", use_column_width=True)
        else:
            st.caption("마스크: 검정=수정, 흰색=보존 (PNG)")
            mask_mode_gen = st.radio(
                "마스크 입력",
                ["업로드", "그리기"],
                horizontal=True,
                key="post_gen_mask_mode",
            )
            mask_path_gen: Optional[Path] = None

            if mask_mode_gen == "업로드":
                mask_upload = st.file_uploader(
                    "마스크 업로드",
                    type=["png", "jpg", "jpeg", "webp"],
                    key="post_gen_mask_upload",
                )
                if mask_upload is not None:
                    mask_path_gen = sanitize_mask_file(save_uploaded_image(mask_upload))
                    st.session_state["post_gen_mask_path"] = str(mask_path_gen)
            else:
                if base_image_url:
                    try:
                        bg_bytes = load_image_bytes(base_image_url)
                        bg_img = Image.open(BytesIO(bg_bytes))
                        canvas_result = draw_mask_canvas_with_fallback(
                            bg_image=bg_img,
                            width=bg_img.width,
                            height=bg_img.height,
                            key="post_gen_mask_canvas",
                            update_streamlit=True,
                        )
                        if st.button("마스크 적용", key="post_gen_apply_mask") and canvas_result.image_data is not None:
                            out_path = OUTPUT_DIR / f"user_mask_{uuid.uuid4().hex}.png"
                            mask_path_gen = sanitize_mask_file(
                                build_mask_from_canvas(canvas_result.image_data, out_path)
                            )
                            st.session_state["post_gen_mask_path"] = str(mask_path_gen)
                            st.success("Mask applied")
                    except Exception as exc:
                        st.error(f"마스크 캔버스를 불러오지 못했습니다: {exc}")
                else:
                    st.info("생성된 이미지가 없습니다.")

            edit_inst_gen = st.text_area(
                "Edit 지시",
                value=st.session_state.get("post_gen_edit_instruction", "문구 산세리프, 배경 단색"),
                key="post_gen_edit_instruction_field",
            )

            if st.button("생성된 로고 Edit", use_container_width=True, key="post_gen_edit_btn"):
                if not base_image_url:
                    st.error("생성된 이미지가 없습니다.")
                else:
                    if mask_path_gen is None:
                        mask_path_saved = st.session_state.get("post_gen_mask_path")
                        if mask_path_saved:
                            mask_path_gen = Path(mask_path_saved)
                    if mask_path_gen is None:
                        st.error("마스크를 업로드하거나 그려주세요.")
                    elif not edit_inst_gen.strip():
                        st.error("Edit 지시를 입력해 주세요.")
                    else:
                        st.session_state["post_gen_edit_instruction"] = edit_inst_gen
                        payload = apply_image_options({
                            "brand_name": brand,
                            "description": description,
                            "style": style,
                            "edit_instruction": edit_inst_gen.strip(),
                            "edit_image_url": base_image_url,
                            "mask_image_url": str(mask_path_gen),
                            "cfg_scale": cfg_scale,
                            "style_type": (style_type or None),
                            "prompt_keywords": prompt_keywords or None,
                            "user_prompt": (user_prompt or None),
                        }, force_mode="edit")
                        edited_gen = post_to_pipeline(payload)
                        if edited_gen:
                            st.session_state["generated_logo"] = edited_gen
                            st.success("Edit 완료!")
                            if edited_gen.get("image_url"):
                                st.image(edited_gen["image_url"], caption="Edit 결과", use_column_width=True)

else:
    st.markdown("### 이미지 → 이미지 (Remix / Edit)")
    uploaded_image = sidebar.file_uploader("원본 이미지 업로드", type=["png", "jpg", "jpeg", "webp"]) 

    if st.button("이미지 기반 생성", use_container_width=True):
        if not uploaded_image:
            st.error("이미지를 업로드해 주세요.")
        else:
            base_path = save_uploaded_image(uploaded_image)
            base_prompt_payload = st.session_state.get("base_prompt")
            instruction = (user_prompt or "").strip() or "업로드된 로고를 개선해주세요."
            task_mode = st.session_state.get("image_task_mode", "remix")
            if task_mode == "edit":
                st.warning("Edit 모드는 아래 Edit 탭에서 마스크를 설정한 뒤 실행해 주세요.")
            else:
                payload = apply_image_options(
                    {
                        "brand_name": brand,
                        "description": description,
                        "style": style,
                        "edit_instruction": instruction,
                        "edit_image_url": str(base_path),
                        "base_prompt": base_prompt_payload,
                        "negative_prompt": (negative_input.strip() or None),
                        "cfg_scale": cfg_scale,
                        "seed": seed_value,
                        "style_type": (style_type or None),
                        "prompt_keywords": prompt_keywords or None,
                        "user_prompt": (user_prompt or None),
                    },
                    force_mode=task_mode,
                )
                result = post_to_pipeline(payload)
                if result:
                    st.session_state["generated_logo"] = result
                    st.session_state["last_image_to_image_source"] = str(base_path)
                    st.success("이미지 기반 생성 완료!")
                    if result.get("image_url"):
                        st.image(result["image_url"], caption="이미지 기반 생성 결과", use_column_width=True)

    tabs = st.tabs([FOLLOW_UP_REMX, FOLLOW_UP_EDIT])

    # Remix tab
    with tabs[0]:
        remix_instruction = st.text_area(
            "Remix 지시",
            value=st.session_state.get(
                "last_remix_instruction",
                "구도는 유지하고, 텍스트 가독성 개선, 아이콘 단순화"
            ),
        )
        if st.button("Remix 실행", use_container_width=True):
            if not uploaded_image:
                st.error("이미지를 업로드해 주세요.")
            else:
                base_path = save_uploaded_image(uploaded_image)
                payload = apply_image_options(
                    {
                        "brand_name": brand,
                        "description": description,
                        "style": style,
                        "edit_instruction": remix_instruction.strip(),
                        "edit_image_url": str(base_path),
                        "base_prompt": st.session_state.get("base_prompt"),
                        "negative_prompt": (negative_input.strip() or None),
                        "cfg_scale": cfg_scale,
                        "auto_retry_remix": True,
                        "remix_max_retries": 1,
                        "seed": seed_value,
                        "style_type": (style_type or None),
                        "prompt_keywords": prompt_keywords or None,
                        "user_prompt": (user_prompt or None),
                    },
                    force_mode="remix",
                )
                remix_result = post_to_pipeline(payload)
                if remix_result:
                    st.session_state["edited_logo"] = remix_result
                    st.session_state["last_remix_instruction"] = remix_instruction
                    st.success("Remix 완료!")
                if remix_result and remix_result.get("image_url"):
                    st.image(remix_result["image_url"], caption="Remix 결과", use_column_width=True)

    # Edit tab
    with tabs[1]:
        st.caption("마스크: 검정=수정, 흰색=보존 (PNG)")
        mask_mode = st.radio("마스크 입력", ["업로드", "그리기"], horizontal=True)
        mask_path: Path | None = None

        if mask_mode == "업로드":
            mask_upload = st.file_uploader("마스크 업로드", type=["png", "jpg", "jpeg", "webp"], key="mask_upload_img")
            if mask_upload is not None:
                mask_path = sanitize_mask_file(save_uploaded_image(mask_upload))
                st.session_state["last_mask_path"] = str(mask_path)
        else:
            if uploaded_image is not None:
                base_path = save_uploaded_image(uploaded_image)
                base_bytes = load_image_bytes(str(base_path))
                bg_img = Image.open(BytesIO(base_bytes))
                canvas_result = draw_mask_canvas_with_fallback(
                    bg_image=bg_img, width=bg_img.width, height=bg_img.height, key="mask_canvas_img", update_streamlit=True
                )
                if st.button("마스크 적용") and canvas_result.image_data is not None:
                    out_path = OUTPUT_DIR / f"user_mask_{uuid.uuid4().hex}.png"
                    mask_path = sanitize_mask_file(build_mask_from_canvas(canvas_result.image_data, out_path))
                    st.session_state["last_mask_path"] = str(mask_path)
                    st.success("Mask applied")
            else:
                st.info("먼저 이미지를 업로드해 주세요.")

        edit_inst2 = st.text_area("Edit 지시", value="문구 산세리프, 배경 단색")
        if st.button("Edit 실행", use_container_width=True):
            if not uploaded_image:
                st.error("이미지를 업로드해 주세요.")
            elif not st.session_state.get("last_mask_path") and mask_path is None:
                st.error("마스크를 업로드하거나 그려주세요.")
            elif not edit_inst2.strip():
                st.error("Edit 지시를 입력해 주세요.")
            else:
                base_path = save_uploaded_image(uploaded_image)
                mask_final = mask_path or Path(st.session_state["last_mask_path"]) 
                payload = apply_image_options(
                    {
                        "brand_name": brand,
                        "description": description,
                        "style": style,
                        "edit_instruction": edit_inst2.strip(),
                        "edit_image_url": str(base_path),
                        "mask_image_url": str(mask_final),
                        "cfg_scale": cfg_scale,
                        "style_type": (style_type or None),
                        "prompt_keywords": prompt_keywords or None,
                        "user_prompt": (user_prompt or None),
                    },
                    force_mode="edit",
                )
                edited2 = post_to_pipeline(payload)
                if edited2:
                    st.session_state["generated_logo"] = edited2
                    st.session_state["last_image_to_image_prompt"] = payload["edit_instruction"]
                    st.session_state["last_image_to_image_source"] = str(base_path)
                    st.success("Edit 완료!")
                if edited2 and edited2.get("image_url"):
                    st.image(edited2["image_url"], caption="Edit 결과", use_column_width=True)
