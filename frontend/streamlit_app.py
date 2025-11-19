from __future__ import annotations

import json
import os
import re
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

BACKEND_DIR = ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.logo_library import query_logo_library


API_URL = os.getenv("PIPELINE_API_URL", "http://localhost:8000/logo_pipeline")
OUTPUT_DIR = Path("data/outputs")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
LOGO_IMAGE_DIR = Path("logos")
API_BASE_URL = API_URL.rstrip("/")
if API_BASE_URL.endswith("logo_pipeline"):
    API_BASE_URL = API_BASE_URL.rsplit("/", 1)[0]
RECOMMENDATIONS_URL = f"{API_BASE_URL}/logo_recommendations"
SIMILAR_BATCH_SIZE = 8
IDEOGRAM_MODES = {
    "remix": {
        "label": "리믹스 (참고 이미지 + 스타일 조정)",
        "description": "기존 레퍼런스나 최근 결과를 유지하며, 새 프롬프트로 색감/타이포/구성 감성을 바꾸고 싶을 때 선택하세요.",
        "prompt_hint": "기존 레이아웃이나 컬러 팔레트를 유지하면서, 어떤 스타일/무드로 변화시키고 싶은지 구체적으로 적어 주세요.",
    },
    "edit": {
        "label": "에디트 (마스크 기반 부분 수정)",
        "description": "정해진 영역만 수정하거나 텍스트/색상을 세밀하게 조정할 때 마스크와 편집 지시문을 제공합니다.",
        "prompt_hint": "수정 영역, 느낌, 금지 요소 등을 명시하고 마스크에 핑크 브러시로 표시한 부위만 바꿔달라고 요청하세요.",
    },
    "replace_bg": {
        "label": "배경 교체 (replace_bg)",
        "description": "기존 로고의 배경만 깔끔하게 바꾸고 싶을 때 선택하세요. 마스크를 같이 써서 영역을 지정하면 좋습니다.",
        "prompt_hint": "어떤 배경을 원하는지, 배경과 대비되는 색감이나 느낌을 설명해 주시고, 마스크 영역을 확실히 지정하세요.",
    },
}
IDEOGRAM_MODE_KEYS = list(IDEOGRAM_MODES.keys())
TREND_LOGO_FEATURES = [
    {
        "label": "키치 캐릭터 베이커리",
        "image": LOGO_IMAGE_DIR / "symbol_plus_text" / "베이커리_27.jpg",
        "summary": "키치한 캐릭터를 전면에 배치해 MZ 취향의 playful 베이커리 무드를 정확히 짚은 사례입니다.",
        "source": "제일기획 트렌드 리포트",
    },
    {
        "label": "미니멀 베이커리 타이포",
        "image": LOGO_IMAGE_DIR / "symbol_plus_text" / "베이커리_35.jpg",
        "summary": "얇은 선과 미니멀한 글자 조합으로 크로와상 같은 시각 요소를 세련되게 강조하며 트렌드를 리드하고 있습니다.",
        "source": "구글 마케팅 트렌드",
    },
    {
        "label": "한글 추상 워드마크",
        "image": LOGO_IMAGE_DIR / "wordmark_lettermark" / "커피_13.jpg",
        "summary": "한글 자모를 추상화한 워드마크가 뉴-코리안 감성을 표현하며 카페 브랜딩에서 크게 사랑받고 있습니다.",
        "source": "뉴닉 트렌드 브리프",
    },
]
TREND_HIGHLIGHTS = [f"{item['summary']}" for item in TREND_LOGO_FEATURES]
APPEARANCE_TYPES = [
    {
        "key": "wordmark_lettermark",
        "sample": LOGO_IMAGE_DIR / "wordmark_lettermark" / "003_영주새우.jpg",
        "description": "글꼴과 레터 변주가 중심인 로고",
    },
    {
        "key": "symbol_plus_text",
        "sample": LOGO_IMAGE_DIR / "symbol_plus_text" / "커피_27.jpg",
        "description": "아이콘/캐릭터와 텍스트 조합으로 균형 잡힌 로고",
    },
    {
        "key": "emblem",
        "sample": LOGO_IMAGE_DIR / "emblem" / "카페_14.jpg",
        "description": "원형·방패형 등 배지 형태로 묶인 클래식 스타일",
    },
]
CURATED_LOGO_SETS = {
    "wordmark_lettermark": [
        {"name": "011_강호수산", "group": "캘리그라피"},
        {"name": "029_소꿉", "group": "캘리그라피"},
        {"name": "커피_32", "group": "얇은 선 타이포"},
        {"name": "page6_30", "group": "얇은 선 타이포"},
        {"name": "빵_72", "group": "한글 형이상학"},
        {"name": "커피_13", "group": "한글 형이상학"},
        {"name": "018_ANGELOOMING", "group": "영문 필기체"},
        {"name": "커피_163", "group": "영문 필기체"},
    ],
    "symbol_plus_text": [
        {"name": "page1_9", "group": "한글 형이상학"},
        {"name": "page1_3", "group": "한글 형이상학"},
        {"name": "커피_21", "group": "키치 캐릭터"},
        {"name": "빵_56", "group": "키치 캐릭터"},
        {"name": "빵_28", "group": "얇은 선 심볼"},
        {"name": "커피_17", "group": "얇은 선 심볼"},
        {"name": "009_카페", "group": "힙한 무드"},
        {"name": "카페_17", "group": "힙한 무드"},
    ],
    "emblem": [
        {"name": "커피_114", "group": "얇은 선"},
        {"name": "커피_82", "group": "얇은 선"},
        {"name": "커피_93", "group": "키치 캐릭터"},
        {"name": "012_본야구84", "group": "키치 캐릭터"},
        {"name": "page7_7", "group": "한글 중심"},
        {"name": "page7_27", "group": "한글 중심"},
        {"name": "page7_11", "group": "아이콘형"},
        {"name": "page2_29", "group": "아이콘형"},
    ],
}

TOKEN_PATTERN = re.compile(r"[0-9a-zA-Z가-힣]+")


def normalize_stem(value: str) -> str:
    if not value:
        return ""
    cleaned = value.lower().replace(" ", "_").replace("-", "_")
    cleaned = re.sub(r"[^0-9a-z가-힣_]+", "_", cleaned)
    return re.sub(r"_+", "_", cleaned).strip("_")


def resolve_logo_image(name: str) -> Optional[str]:
    target = normalize_stem(name)
    for path in LOGO_IMAGE_DIR.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            continue
        if normalize_stem(path.stem) == target:
            return str(path)
    return None


def ensure_local_logo_path(raw_path: str, fallback_name: str) -> Optional[str]:
    """
    Normalize remote logo paths returned by the API into ones that exist on this
    Streamlit host so the images can be read from disk.
    """
    if raw_path:
        candidate = Path(raw_path)
        search_targets = [candidate]
        if not candidate.is_absolute():
            search_targets.append((ROOT / candidate).resolve())
            search_targets.append((Path.cwd() / candidate).resolve())
        for path in search_targets:
            if path.exists():
                return str(path)
    fallback_name = fallback_name or Path(raw_path or "").stem
    if fallback_name:
        resolved = resolve_logo_image(fallback_name)
        if resolved:
            return resolved
    return raw_path or None


def find_entry_by_name(entries: List[Dict], name: str) -> Optional[Dict]:
    target = normalize_stem(name)
    for entry in entries:
        if normalize_stem(entry.get("id")) == target:
            return entry
        stem = normalize_stem(Path(entry.get("image_path", "")).stem)
        if stem == target:
            return entry
        file_stem = normalize_stem(entry.get("file_name") or "")
        if file_stem == target:
            return entry
    return None


def fetch_recommendations(seed_id: str, limit: int, offset: int) -> Optional[dict]:
    try:
        resp = requests.get(
            RECOMMENDATIONS_URL,
            params={"seed_id": seed_id, "limit": limit, "offset": offset},
            timeout=30,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        st.error(f"???? ??? ??o ??? ????: {exc}")
        return None
    payload = resp.json()
    for item in payload.get(
        "items", []
    ):
        item["image_path"] = ensure_local_logo_path(
            item.get("image_path", ""), item.get("id", "")
        )
    return payload


def start_recommendations(seed_entry: Dict) -> None:
    result = fetch_recommendations(seed_entry["id"], SIMILAR_BATCH_SIZE, 0)
    if not result:
        return
    st.session_state["similar_seed"] = result["seed_id"]
    st.session_state["similar_items"] = result["items"]
    st.session_state["similar_offset"] = result["offset"] + result["limit"]
    st.session_state["similar_total"] = result["total"]


def load_more_recommendations() -> None:
    seed_id = st.session_state.get("similar_seed")
    offset = st.session_state.get("similar_offset", 0)
    if not seed_id:
        return
    result = fetch_recommendations(seed_id, SIMILAR_BATCH_SIZE, offset)
    if not result:
        return
    st.session_state["similar_items"].extend(result["items"])
    st.session_state["similar_offset"] = result["offset"] + result["limit"]
    st.session_state["similar_total"] = result["total"]


def render_curated_examples(selected_type: str, entries: List[Dict]) -> None:
    curated = CURATED_LOGO_SETS.get(selected_type)
    if not curated:
        st.info("해당 타입의 추천 예시가 아직 준비되지 않았습니다.")
        return
    st.caption("원하는 예시를 누르면 유사한 로고를 추천해 드려요.")
    for row in range(0, len(curated), 4):
        cols = st.columns(4)
        for idx, item in enumerate(curated[row: row + 4]):
            col = cols[idx]
            with col:
                image_path = resolve_logo_image(item["name"])
                if image_path:
                    st.image(image_path, use_column_width=True)
                else:
                    st.warning("이미지를 찾지 못했습니다.", icon="⚠️")
                if st.button(
                    f"{item['group']} · 유사 보기",
                    key=f"curated_{selected_type}_{row}_{idx}",
                ):
                    entry = find_entry_by_name(entries, item["name"])
                    if entry:
                        start_recommendations(entry)
                        st.experimental_rerun()
                    else:
                        st.warning("해당 로고 데이터를 찾을 수 없습니다.", icon="⚠️")

def infer_appearance_category(image_path: str) -> Optional[str]:
    if not image_path:
        return None
    path = Path(image_path)
    parts = path.parts
    if "logos" in parts:
        idx = parts.index("logos")
        if idx + 1 < len(parts):
            return parts[idx + 1]
    # Handle relative strings like "logos/category/file.png"
    posix = path.as_posix()
    if posix.startswith("logos/"):
        return posix.split("/", 2)[1]
    return None


def _ensure_session_defaults() -> None:
    defaults = {
        "brand_name": "",
        "brand_slogan": "",
        "brand_industry": "",
        "brand_story": "",
        "brand_tone": "",
        "prompt_hint": "",
        "selected_logo_type": "",
        "reference_entry": None,
        "last_result": None,
        "similar_seed": "",
        "similar_items": [],
        "similar_offset": 0,
        "similar_total": 0,
        "reuse_last_image": "",
        "remix_strength_value": 0.65,
        "mask_mode": "edit",
        "last_mask_path": "",
        "edit_instruction_text": "",
        "selected_task_mode": "remix",
        "finalized_image_url": "",
        "revision_notice": False,
    }
    for key, value in defaults.items():
        st.session_state.setdefault(key, value)


@st.cache_data(show_spinner=False)
def load_library_entries() -> List[Dict]:
    entries = query_logo_library(limit=0, refresh=False)
    enriched: List[Dict] = []
    for entry in entries:
        data = entry.model_dump()
        data["appearance_category"] = infer_appearance_category(data.get("image_path", ""))
        enriched.append(data)
    return enriched




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
        if isinstance(first, str):
            return first
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


def build_reference_payload(entry: Dict, caption: Optional[str] = None) -> Optional[dict]:
    if not entry:
        return None
    notes = caption.strip() if caption else "Streamlit library selection"
    image_path = Path(entry["image_path"]).resolve()
    return {
        "image_url": str(image_path),
        "logo_type": entry.get("logo_type"),
        "style_tags": entry.get("style_tags"),
        "source_image": entry.get("file_name"),
        "notes": notes,
    }


st.set_page_config(page_title="AI 로고 메이커", page_icon="🎨", layout="wide")
_ensure_session_defaults()
st.markdown(
    """
    <style>
    div[data-testid="stImage"] img {
        border-radius: 14px !important;
        aspect-ratio: 1 / 1;
        object-fit: cover;
    }
    .trend-tile {
        display: flex;
        flex-direction: column;
        min-height: 180px;
        margin-top: 0.35rem;
    }
    .trend-summary {
        flex: 1;
        color: #f5f5f5;
        font-size: 0.95rem;
        line-height: 1.4;
        margin: 0.2rem 0 0.35rem;
    }
    .trend-source {
        text-align: right;
    }
    .trend-source span {
        display: inline-block;
        padding: 0.15rem 0.6rem;
        border-radius: 999px;
        background-color: #f0f0f5;
        color: #4b4b4b;
        font-size: 0.72rem;
    }
    .section-spacer {
        height: 1.4rem;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("AI 로고 메이커")

library_entries = load_library_entries()

# 고정 브랜드 컨텍스트 (브리프 입력 없음)
brand_name = st.session_state["brand_name"] = ""
brand_slogan = st.session_state["brand_slogan"] = ""
brand_industry = st.session_state["brand_industry"] = ""
brand_story = st.session_state["brand_story"] = ""
prompt_hint = st.session_state["prompt_hint"] = ""
brand_tone = st.session_state["brand_tone"] = ""

# 1. 최신 트렌드 스포트라이트
st.header("1. 최신 트렌드 스포트라이트")
trend_cols = st.columns(len(TREND_LOGO_FEATURES))
for feature, col in zip(TREND_LOGO_FEATURES, trend_cols):
    with col:
        if feature["image"].exists():
            col.image(str(feature["image"]), use_column_width=True)
        else:
            col.warning("이미지를 찾을 수 없습니다.")
        col.markdown(
            f"""
            <div class="trend-tile">
                <p class="trend-summary">{feature['summary']}</p>
                <div class="trend-source">
                    <span>출처 · {feature['source']}</span>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

# 2. 로고 타입 선택
st.markdown("<div class='section-spacer'></div>", unsafe_allow_html=True)
st.header("2. 로고 타입 선택")
type_cols = st.columns(len(APPEARANCE_TYPES))
for cfg, col in zip(APPEARANCE_TYPES, type_cols):
    with col:
        sample_path = str(cfg.get("sample")) if cfg.get("sample") else None
        if sample_path:
            st.image(sample_path, use_column_width=True)
        st.caption(cfg["description"])
        is_selected = st.session_state["selected_logo_type"] == cfg["key"]
        button_label = "선택됨" if is_selected else "이 타입 선택"
        if st.button(button_label, key=f"type_picker_{cfg['key']}"):
            st.session_state["selected_logo_type"] = cfg["key"]
            is_selected = True
        if is_selected:
            st.success("현재 선택")

selected_logo_type = st.session_state["selected_logo_type"]
if selected_logo_type:
    render_curated_examples(selected_logo_type, library_entries)
else:
    st.info("타입을 선택하면 관련 예시를 보여드릴게요.")

similar_seed = st.session_state.get("similar_seed")
similar_items = st.session_state.get("similar_items", [])
if similar_seed and similar_items:
    st.markdown("<div class='section-spacer'></div>", unsafe_allow_html=True)
    st.subheader("유사한 로고 추천")
    cols_header = st.columns([1, 1])
    with cols_header[0]:
        st.caption(f"기준 로고: {similar_seed}")
    with cols_header[1]:
        if st.button("추천 초기화", key="reset_similar"):
            st.session_state["similar_seed"] = ""
            st.session_state["similar_items"] = []
            st.session_state["similar_offset"] = 0
            st.session_state["similar_total"] = 0
            st.experimental_rerun()
    for row in range(0, len(similar_items), 4):
        cols = st.columns(4)
        for idx, item in enumerate(similar_items[row : row + 4]):
            col = cols[idx]
            with col:
                image_path = item.get("image_path") or ""
                image_bytes = load_image_bytes(image_path) if image_path else None
                if image_bytes:
                    st.image(image_bytes, use_column_width=True)
                else:
                    st.warning("이미지를 찾지 못했어요.", icon="⚠️")
                    if image_path:
                        st.caption(image_path)
                if st.button(
                    "이 로고 선택",
                    key=f"similar_select_{item['id']}_{row}_{idx}",
                ):
                    entry = find_entry_by_name(library_entries, item["id"])
                    if entry:
                        select_reference(entry)
                        st.success("레퍼런스로 설정되었습니다.")
                        st.session_state["similar_seed"] = ""
                        st.session_state["similar_items"] = []
                        st.experimental_rerun()
                    else:
                        st.warning("해당 로고 데이터를 찾을 수 없습니다.", icon="⚠️")
    total = st.session_state.get("similar_total", 0)
    shown = len(similar_items)
    if shown < total:
        if st.button("더 보기", key="similar_load_more"):
            load_more_recommendations()
            st.experimental_rerun()

# 3. 레퍼런스 확정
st.markdown("<div class='section-spacer'></div>", unsafe_allow_html=True)
st.header("3. 레퍼런스 확정")
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

reuse_source = st.session_state.get("reuse_last_image") or ""
reference_image_abs = (
    str(Path(reference_entry["image_path"]).resolve())
    if reference_entry
    else None
)
mask_base_source = reuse_source or reference_image_abs
mask_base_bytes = (
    load_image_bytes(mask_base_source) if mask_base_source else None
)
if reuse_source:
    st.caption("최근 생성된 결과를 기반으로 다시 수정하도록 설정되었습니다.")
mask_path = st.session_state.get("last_mask_path")
mask_bytes_loaded = None
if mask_path:
    mask_bytes_loaded = load_image_bytes(mask_path)
mask_ready = bool(mask_bytes_loaded)

# 4. 프롬프트 입력
st.markdown("<div class='section-spacer'></div>", unsafe_allow_html=True)
st.header("4. 작업 유형 및 프롬프트")
selected_mode = st.session_state.get("selected_task_mode", "remix")
mode_cols = st.columns([1, 3])
with mode_cols[0]:
    mode_choice = st.radio(
        "Ideogram 작업 모드",
        options=IDEOGRAM_MODE_KEYS,
        index=IDEOGRAM_MODE_KEYS.index(selected_mode),
        format_func=lambda key: IDEOGRAM_MODES[key]["label"],
        key="mode_selector",
        horizontal=True,
    )
    st.session_state["selected_task_mode"] = mode_choice
selected_mode = st.session_state["selected_task_mode"]
with mode_cols[1]:
    st.caption(IDEOGRAM_MODES[selected_mode]["description"])

prompt_placeholder = IDEOGRAM_MODES[selected_mode]["prompt_hint"]
prompt_value = st.text_area(
    "프롬프트 내용",
    value=st.session_state.get("prompt_hint", ""),
    height=180,
    placeholder=prompt_placeholder,
    key="prompt_editor",
)
st.session_state["prompt_hint"] = prompt_value
confirm_disabled = not prompt_value.strip()
if confirm_disabled:
    st.info("프롬프트를 입력해야 Ideogram API 호출이 활성화됩니다.")
if st.session_state.get("revision_notice"):
    st.info(
        "더 수정을 원하면 Remix/Edit/Replace Background 중 하나를 다시 선택하고, 프롬프트를 조정한 뒤 실행해 주세요."
    )
if selected_mode == "remix":
    remix_strength = st.slider(
        "이미지 영향도 (Remix Strength)",
        min_value=0.1,
        max_value=1.0,
        step=0.05,
        value=float(st.session_state.get("remix_strength_value", 0.65)),
        help="값이 높을수록 기존 레이아웃을 유지하고, 낮을수록 프롬프트 변형이 커집니다.",
    )
    st.session_state["remix_strength_value"] = remix_strength

def _run_mode_action(mode_key: str):
    prompt_text = prompt_value.strip()
    if not prompt_text:
        st.warning("프롬프트를 입력한 후 각 작업 버튼을 눌러주세요.")
        return

    if mode_key == "remix":
        base_image = reference_image_abs or reuse_source
        if not base_image:
            st.warning("Remix 작업을 위해 라이브러리에서 레퍼런스나 최근 결과를 선택하세요.")
            return
    else:
        base_image = mask_base_source
        if not base_image:
            st.warning("Edit/Replace Background를 하려면 기준 이미지를 준비해 주세요.")
            return
        if mode_key == "edit" and not mask_ready:
            st.warning("Edit 작업은 마스크가 있어야 합니다. 마스크를 먼저 저장해 주세요.")
            return

    payload = {
        "brand_name": brand_name,
        "description": brand_story or brand_slogan or brand_industry,
        "style": brand_tone,
        "user_prompt": prompt_text,
        "base_prompt": prompt_text,
        "logo_type": selected_logo_type or None,
        "style_preferences": None,
        "trend_highlights": TREND_HIGHLIGHTS,
        "image_task_mode": mode_key,
        "remix_strength": float(st.session_state.get("remix_strength_value", 0.65))
        if mode_key == "remix"
        else None,
    }
    if mode_key == "remix":
        payload["reference_images"] = [base_image]
        if reference_entry:
            payload["reference_logo"] = build_reference_payload(reference_entry)
    else:
        payload["edit_image_url"] = base_image
        if mode_key == "replace_bg":
            payload["reference_images"] = [base_image]
            if reference_entry:
                payload["reference_logo"] = build_reference_payload(reference_entry)
        if mode_key == "edit":
            payload["mask_image_url"] = mask_path
            payload["edit_instruction"] = prompt_text

    result = post_to_pipeline(payload)
    if result:
        st.session_state["last_result"] = result
        st.session_state["finalized_image_url"] = ""
        st.session_state["revision_notice"] = False
        st.success(f"{IDEOGRAM_MODES[mode_key]['label']} 결과가 생성되었습니다.")

if st.button(f"{IDEOGRAM_MODES[selected_mode]['label']} 생성", disabled=confirm_disabled):
    _run_mode_action(selected_mode)

if selected_mode == "edit":
    st.markdown("<div class='section-spacer'></div>", unsafe_allow_html=True)
    st.header("5. 마스크 기반 편집 (필요 시)")
    if mask_path and not mask_ready:
        st.warning("저장된 마스크를 불러올 수 없습니다. 다시 마스크를 그려주세요.")
    if not mask_base_source:
        st.info("편집할 이미지를 먼저 준비해야 합니다. 레퍼런스나 최근 생성 결과를 선택하세요.")
    elif not mask_base_bytes:
        st.warning("이미지를 불러오지 못했습니다. 다시 생성한 뒤 시도하세요.")
    else:
        base_img = Image.open(BytesIO(mask_base_bytes))
        st.caption("마젠타(핑크) 영역만 수정됩니다.")
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
                st.session_state["last_mask_path"] = str(mask_path.resolve())
                mask_ready = True
                st.success(f"마스크 저장 완료: {mask_path.name}")
        edit_instruction = st.text_area(
            "편집 지시문",
            value=st.session_state.get("edit_instruction_text", ""),
            placeholder="글자 부분만 밝게 바꾸고 싶어요",
        )
        st.session_state["edit_instruction_text"] = edit_instruction
        if st.button(
            "마스크 영역 편집 실행",
            disabled=not (mask_ready and edit_instruction.strip()),
        ):
            payload = {
                "brand_name": brand_name ,
                "description": brand_story or brand_slogan or brand_industry,
                "style": brand_tone,
                "user_prompt": edit_instruction,
                "base_prompt": edit_instruction,
                "edit_image_url": mask_base_source,
                "mask_image_url": st.session_state.get("last_mask_path"),
                "edit_instruction": edit_instruction,
                "image_task_mode": selected_mode,
                "logo_type": selected_logo_type or None,
                "style_preferences": None,
                "trend_highlights": TREND_HIGHLIGHTS,
            }
            result = post_to_pipeline(payload)
            if result:
                st.session_state["last_result"] = result
                st.success("마스크 편집 결과가 생성되었습니다.")
                edited_url = extract_image_url(result)
                if edited_url:
                    st.image(edited_url, caption="편집 결과 (최신)", use_column_width=True)
elif selected_mode == "replace_bg":
    st.markdown("<div class='section-spacer'></div>", unsafe_allow_html=True)
    st.header("5. 배경 교체 안내")
    if not mask_base_source:
        st.info("배경을 교체할 이미지를 준비해 주세요.")
    elif not mask_base_bytes:
        st.warning("이미지를 불러오지 못했습니다. 다시 생성해 주세요.")
    else:
        st.info("마스크 없이 배경을 교체합니다. 프롬프트만 작성하시면 됩니다.")

# 6. 결과/다운로드
st.markdown("<div class='section-spacer'></div>", unsafe_allow_html=True)
st.header("6. 결과 확인 및 다운로드")
result = st.session_state.get("last_result")
if not result:
    st.info("생성된 로고가 여기 표시됩니다.")
else:
    image_url = extract_image_url(result)
    if image_url:
        st.image(image_url, caption="최신 생성 로고", use_column_width=True)
        st.caption("생성되었습니다")
        cols = st.columns(3)
        with cols[0]:
            if st.button("더 수정", key="revise_result"):
                st.session_state["revision_notice"] = True
                st.session_state["finalized_image_url"] = ""
                st.info("다시 작업 모드를 선택하고 프롬프트를 조정해 주세요.")
        with cols[1]:
            if st.button("이 결과로 계속 수정", key="reuse_current_result"):
                if image_url:
                    st.session_state["reuse_last_image"] = image_url
                    st.success("프롬프트를 새로 입력하면 방금 결과를 기반으로 다시 Remix/Edit 모드가 결정됩니다.")
        with cols[2]:
            if st.button("이걸로 정한다", key="confirm_result"):
                st.session_state["finalized_image_url"] = image_url or ""
                st.success("이 버전을 최종안으로 확정했습니다.")
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

finalized_image_url = st.session_state.get("finalized_image_url")
if finalized_image_url:
    finalized_data = load_image_bytes(finalized_image_url)
    if finalized_data:
        st.download_button(
            "최종 버전 다운로드",
            data=finalized_data,
            file_name=f"{brand_name or 'logo'}_final.png",
            mime="image/png",
            key="download_finalized",
        )
