from __future__ import annotations

import os
import sys
import uuid
from io import BytesIO
from pathlib import Path
from typing import Dict, List, Optional

import numpy as np
from PIL import Image
import requests
import streamlit as st
from streamlit_drawable_canvas import st_canvas

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.library import query_logo_library


API_URL = os.getenv("PIPELINE_API_URL", "http://localhost:8000/logo_pipeline")
OUTPUT_DIR = Path("data/outputs")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TREND_HIGHLIGHTS = [
    "Rounded sans-serif logotypes with soft drop shadows",
    "Muted backgrounds + neon accent strokes",
    "Badge layouts mixing Hangul + Latin sans typography",
    "Animated-ready symbol marks with thick outlines",
]
TARGET_USAGE_OPTIONS = ["SNS", "패키지", "간판", "웹사이트", "굿즈", "이벤트"]
LOGO_TYPE_LABELS = {
    "lettermark": "레터마크",
    "wordmark": "워드마크",
    "pictorial": "픽토리얼",
    "abstract": "추상",
    "emblem": "엠블럼",
    "combination": "조합형",
}
STYLE_TYPE_DEFAULT = "DESIGN"


def _ensure_session_defaults() -> None:
    defaults = {
        "brand_name": "",
        "brand_slogan": "",
        "brand_industry": "",
        "brand_story": "",
        "brand_tone": "modern",
        "target_usage": [],
        "prompt_hint": "",
        "selected_logo_type": "",
        "selected_styles": [],
        "reference_entry": None,
        "last_result": None,
    }
    for key, value in defaults.items():
        st.session_state.setdefault(key, value)


@st.cache_data(show_spinner=False)
def load_library_entries() -> List[Dict]:
    entries = query_logo_library(limit=0, refresh=False)
    return [entry.model_dump() for entry in entries]


def filter_entries(
    entries: List[Dict],
    logo_type: Optional[str] = None,
    style_tag: Optional[str] = None,
    limit: int = 9,
) -> List[Dict]:
    filtered = entries
    if logo_type:
        filtered = [
            e for e in filtered if (e.get("logo_type") or "").lower() == logo_type.lower()
        ]
    if style_tag:
        lowered = style_tag.lower()
        filtered = [
            e
            for e in filtered
            if any(tag.lower() == lowered for tag in (e.get("style_tags") or []))
        ]
    if limit and limit > 0:
        filtered = filtered[:limit]
    return filtered


def get_logo_type_options(entries: List[Dict]) -> List[str]:
    types = sorted(
        {e.get("logo_type", "").lower() for e in entries if e.get("logo_type")}
    )
    return types


def get_style_options(entries: List[Dict]) -> List[str]:
    tags: set[str] = set()
    for entry in entries:
        for tag in entry.get("style_tags") or []:
            if tag:
                tags.add(tag)
    return sorted(tags)


def post_to_pipeline(payload: dict) -> Optional[dict]:
    try:
        resp = requests.post(API_URL, json=payload, timeout=180)
    except requests.RequestException as exc:  # pragma: no cover - UI path
        st.error(f"API 요청 실패: {exc}")
        return None
    if resp.status_code != 200:
        st.error(f"API 오류: {resp.text}")
        return None
    return resp.json()


def load_image_bytes(path_or_url: str) -> Optional[bytes]:
    try:
        if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
            return requests.get(path_or_url, timeout=30).content
        return Path(path_or_url).read_bytes()
    except OSError:
        return None


def build_mask_from_canvas(canvas_data: np.ndarray, out_path: Path) -> Path:
    """Convert magenta strokes to black mask region (Ideogram edit semantics)."""
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
    mask = np.ones((arr.shape[0], arr.shape[1]), dtype=np.uint8) * 255
    mask[is_magenta] = 0
    img = Image.fromarray(mask, mode="L")
    img.save(out_path)
    return out_path


def select_reference(entry: Dict) -> None:
    st.session_state["reference_entry"] = entry


def reference_selected(entry: Dict) -> bool:
    ref = st.session_state.get("reference_entry")
    return bool(ref and ref.get("id") == entry.get("id"))


def render_gallery(entries: List[Dict], key_prefix: str, caption_prefix: str) -> None:
    if not entries:
        st.info("해당 조건의 예시가 없습니다. 다른 옵션을 선택해 주세요.")
        return
    cols = st.columns(3)
    for idx, entry in enumerate(entries):
        col = cols[idx % 3]
        with col:
            caption_bits = [
                caption_prefix,
                entry.get("logo_type") or "",
                ", ".join(entry.get("style_tags") or [])[:40],
            ]
            caption = " | ".join([bit for bit in caption_bits if bit])
            st.image(entry["image_path"], use_column_width=True, caption=caption)
            if reference_selected(entry):
                st.success("현재 레퍼런스로 선택됨")
            elif st.button("이 로고 선택", key=f"{key_prefix}_{entry['id']}"):
                select_reference(entry)
                st.success(f"{entry['file_name']} 선택됨")


def build_reference_payload(entry: Dict) -> Optional[dict]:
    if not entry:
        return None
    return {
        "image_url": entry["image_path"],
        "logo_type": entry.get("logo_type"),
        "style_tags": entry.get("style_tags"),
        "source_image": entry.get("file_name"),
        "notes": "Streamlit library selection",
    }


st.set_page_config(page_title="AI 로고 메이커", page_icon="🎨", layout="wide")
_ensure_session_defaults()

st.title("AI 로고 메이커 – 레퍼런스 기반 워크플로")
st.caption("로고 타입 → 스타일 → 레퍼런스를 단계적으로 고르고 Ideogram 파이프라인으로 생성합니다.")

library_entries = load_library_entries()
logo_type_options = get_logo_type_options(library_entries)
style_options = get_style_options(library_entries)

# 1. 브랜드 브리프
st.header("1. 브랜드 브리프")
col1, col2 = st.columns(2)
with col1:
    brand_name = st.text_input(
        "브랜드명 *", value=st.session_state["brand_name"], placeholder="예: SWEETMORE"
    )
    brand_slogan = st.text_input(
        "슬로건", value=st.session_state["brand_slogan"], placeholder="예: Warm fruit desserts"
    )
    brand_industry = st.text_input(
        "업종 / 카테고리", value=st.session_state["brand_industry"], placeholder="예: 디저트 카페"
    )
with col2:
    brand_tone = st.selectbox(
        "브랜드 톤",
        ["modern", "classic", "playful", "luxury", "eco"],
        index=0,
        key="brand_tone_select",
    )
    target_usage = st.multiselect(
        "사용 채널",
        options=TARGET_USAGE_OPTIONS,
        default=st.session_state["target_usage"],
    )
brand_story = st.text_area(
    "브랜드 설명",
    value=st.session_state["brand_story"],
    placeholder="상세 설명, 제품 특징, 전달하고 싶은 키워드를 적어주세요.",
)
prompt_hint = st.text_area(
    "추가 프롬프트 힌트",
    value=st.session_state["prompt_hint"],
    placeholder="예: 곡선형 타이포, 파스텔 살몬 컬러 강조",
)

# Persist latest inputs
st.session_state["brand_name"] = brand_name
st.session_state["brand_slogan"] = brand_slogan
st.session_state["brand_industry"] = brand_industry
st.session_state["brand_story"] = brand_story
st.session_state["target_usage"] = target_usage
st.session_state["prompt_hint"] = prompt_hint

# 2. 트렌드 안내
st.header("2. 최신 트렌드 프롬프트")
trend_cols = st.columns(len(TREND_HIGHLIGHTS))
for idx, trend in enumerate(TREND_HIGHLIGHTS):
    trend_cols[idx].info(trend)

# 3. 로고 타입 선택
st.header("3. 로고 타입 선택")
logo_type_display = LOGO_TYPE_LABELS.get(
    st.session_state["selected_logo_type"], st.session_state["selected_logo_type"]
)
st.caption("로고 타입을 고르면 해당 예시들을 먼저 보여줍니다.")
selected_logo_type = st.selectbox(
    "선호 로고 타입",
    options=[""] + logo_type_options,
    format_func=lambda v: LOGO_TYPE_LABELS.get(v, v or "전체"),
    index=(logo_type_options.index(st.session_state["selected_logo_type"]) + 1)
    if st.session_state["selected_logo_type"] in logo_type_options
    else 0,
)
st.session_state["selected_logo_type"] = selected_logo_type
type_examples = filter_entries(
    library_entries, logo_type=selected_logo_type or None, limit=6
)
render_gallery(type_examples, "type_gallery", "타입 예시")

# 4. 스타일 선택
st.header("4. 스타일 선택")
selected_styles = st.multiselect(
    "스타일 태그",
    options=style_options,
    default=st.session_state["selected_styles"],
    help="예시: minimal, retro, futuristic, bold 등",
)
st.session_state["selected_styles"] = selected_styles
style_examples = filter_entries(
    library_entries,
    logo_type=selected_logo_type or None,
    style_tag=selected_styles[0] if selected_styles else None,
    limit=9,
)
render_gallery(style_examples, "style_gallery", "스타일 예시")

# 5. 레퍼런스 확정
st.header("5. 레퍼런스 확정")
reference_entry = st.session_state.get("reference_entry")
if reference_entry:
    st.success(
        f"선택된 레퍼런스: {reference_entry['file_name']} "
        f"({reference_entry.get('logo_type')}, {', '.join(reference_entry.get('style_tags') or [])})"
    )
    st.image(reference_entry["image_path"], width=320)
    if st.button("레퍼런스 초기화"):
        st.session_state["reference_entry"] = None
else:
    st.info("위 예시에서 마음에 드는 로고를 선택하면 여기에서 확인할 수 있습니다.")

# 6. 생성
st.header("6. 생성 및 평가")
col_generate, col_retry = st.columns([2, 1])
can_generate = bool(brand_name and reference_entry)
with col_generate:
    if st.button("로고 생성하기", use_container_width=True, disabled=not can_generate):
        base_description = " / ".join(
            bit for bit in [brand_industry, brand_slogan, brand_story] if bit
        ).strip()
        payload = {
            "brand_name": brand_name,
            "description": base_description or brand_story or brand_slogan or "",
            "style": brand_tone or ", ".join(selected_styles) or "modern",
            "style_type": STYLE_TYPE_DEFAULT,
            "prompt_keywords": selected_styles or None,
            "user_prompt": prompt_hint or None,
            "base_prompt": prompt_hint or None,
            "target_usage": target_usage or None,
            "logo_type": selected_logo_type or None,
            "style_preferences": selected_styles or None,
            "trend_highlights": TREND_HIGHLIGHTS,
            "reference_images": [reference_entry["image_path"]] if reference_entry else None,
            "reference_logo": build_reference_payload(reference_entry),
        }
        st.session_state["last_payload"] = payload
        result = post_to_pipeline(payload)
        if result:
            st.session_state["last_result"] = result
            st.success("로고 생성이 완료되었습니다.")
with col_retry:
    if st.button(
        "같은 설정으로 다시 생성",
        disabled=not can_generate or not st.session_state.get("last_payload"),
    ):
        payload = st.session_state.get("last_payload") or {}
        result = post_to_pipeline(payload)
        if result:
            st.session_state["last_result"] = result

# 7. 결과/다운로드
st.header("7. 결과 확인 및 다운로드")
def extract_image_url(result: dict) -> Optional[str]:
    if not result:
        return None
    image_url = result.get("image_url") or result.get("original_logo")
    if image_url:
        return image_url
    candidates = result.get("candidate_images") or result.get("candidateImages") or []
    if candidates:
        first = candidates[0]
        if isinstance(first, dict):
            return first.get("url")
    return None


result = st.session_state.get("last_result")
if not result:
    st.info("생성된 로고가 여기 표시됩니다.")
else:
    image_url = extract_image_url(result)
    if image_url:
        st.image(image_url, caption="최신 생성 로고", use_column_width=True)
        st.caption("생성되었습니다")
        data = load_image_bytes(image_url)
        cols = st.columns(2)
        if data:
            with cols[0]:
                st.download_button(
                    "PNG 다운로드 (확정)",
                    data=data,
                    file_name=f"{brand_name or 'logo'}_ideogram.png",
                    mime="image/png",
                    key="download_final",
                )
        with cols[1]:
            if st.button("추가 편집 계속", key="continue_edit"):
                st.success("아래 8번 섹션에서 마스크를 그리고 편집을 이어가세요.")
    st.subheader("평가 피드백")
    st.write(result.get("eval_feedback") or "아직 평가 정보가 없습니다.")
    scores = result.get("eval_scores") or {}
    if scores:
        st.json(scores)
    if result.get("next_prompt_hint"):
        st.info(f"다음 힌트: {result['next_prompt_hint']}")
    if result.get("regen_history"):
        st.caption("재생성 기록")
        st.json(result["regen_history"])

# 8. 마스크 편집
st.header("8. 마스크 기반 편집")
last_image_url = extract_image_url(st.session_state.get("last_result") or {})

if not last_image_url:
    st.info("생성된 로고가 있어야 마스크 편집을 진행할 수 있습니다.")
else:
    image_bytes = load_image_bytes(last_image_url)
    if not image_bytes:
        st.warning("이미지를 불러오지 못했습니다. 다시 생성한 뒤 시도하세요.")
    else:
        base_img = Image.open(BytesIO(image_bytes))
        st.caption("마젠타(핑크)로 칠한 영역만 수정됩니다.")
        canvas_result = st_canvas(
            fill_color="rgba(255, 0, 255, 0.3)",
            stroke_width=40,
            stroke_color="#FF00FF",
            background_image=base_img,
            update_streamlit=True,
            height=base_img.height,
            width=base_img.width,
            drawing_mode="freedraw",
            key="edit_canvas",
        )
        if canvas_result.image_data is not None:
            if st.button("마스크 저장"):
                mask_path = OUTPUT_DIR / f"user_mask_{uuid.uuid4().hex}.png"
                build_mask_from_canvas(canvas_result.image_data, mask_path)
                st.session_state["last_mask_path"] = str(mask_path)
                st.success(f"마스크 저장 완료: {mask_path.name}")
        mask_ready = bool(st.session_state.get("last_mask_path"))
        edit_instruction = st.text_area(
            "편집 지시문",
            value=st.session_state.get("edit_instruction_text", ""),
            placeholder="예: 글자 부분만 붉은색으로 변경, 심볼에 별 모양 추가",
        )
        st.session_state["edit_instruction_text"] = edit_instruction
        if st.button(
            "마스크 영역 편집 실행",
            disabled=not (mask_ready and edit_instruction),
        ):
            payload = {
                "brand_name": brand_name or st.session_state.get("brand_name"),
                "description": brand_story or brand_slogan or brand_industry,
                "style": brand_tone or ", ".join(selected_styles) or "modern",
                "style_type": STYLE_TYPE_DEFAULT,
                "user_prompt": edit_instruction,
                "base_prompt": edit_instruction,
                "edit_image_url": last_image_url,
                "mask_image_url": st.session_state.get("last_mask_path"),
                "edit_instruction": edit_instruction,
                "image_task_mode": "edit",
                "target_usage": target_usage or None,
                "logo_type": selected_logo_type or None,
                "style_preferences": selected_styles or None,
                "trend_highlights": TREND_HIGHLIGHTS,
            }
            result = post_to_pipeline(payload)
            if result:
                st.session_state["last_result"] = result
                st.success("마스크 편집 결과가 생성되었습니다.")
                edited_url = extract_image_url(result)
                if edited_url:
                    st.image(edited_url, caption="편집 결과 (최신)", use_column_width=True)
