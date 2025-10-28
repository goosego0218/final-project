import streamlit as st
import requests
from pathlib import Path

API_URL = "http://localhost:8000/logo_pipeline"
OUTPUT_DIR = Path("data/outputs")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

st.set_page_config(page_title="AI Logo Maker", page_icon="🎨", layout="wide")

st.title("🎨 AI Logo Maker")
st.caption("LLM Prompt Fusion + Ideogram + LangGraph + Korean Font Overlay")

st.markdown("---")

# --- 1️⃣ 로고 생성 ---
st.subheader("1️⃣ 로고 생성")
col1, col2 = st.columns([2, 1])
with col1:
    brand = st.text_input("브랜드명", "서민고기")
    description = st.text_area("브랜드 설명", "직화구이 전문점, 따뜻하고 정직한 이미지")
    style = st.text_input("디자인 스타일", "warm, minimal, Korean calligraphy inspired")
    negative = st.text_input("네거티브 프롬프트 (선택)", "")
with col2:
    st.markdown("#### 생성 옵션")
    seed = st.text_input("시드 값 (선택)", "")
    style_type = st.text_input("스타일 타입 (선택)", "")

if st.button("🚀 로고 생성하기"):
    with st.spinner("로고 생성 중..."):
        payload = {
            "brand_name": brand,
            "description": description,
            "style": style,
            "negative_prompt": negative or None,
        }
        if seed:
            payload["seed"] = int(seed)
        if style_type:
            payload["style_type"] = style_type

        res = requests.post(API_URL, json=payload)
        if res.status_code == 200:
            data = res.json()
            st.session_state["base_prompt"] = data.get("base_prompt") or data.get("prompt")
            st.session_state["generated_logo"] = data
            st.success("✅ 로고 생성 완료!")
        else:
            st.error(f"❌ API 오류: {res.text}")

st.markdown("---")

# --- 2️⃣ 생성 결과 ---
if "generated_logo" in st.session_state:
    data = st.session_state["generated_logo"]
    col1, col2 = st.columns([2, 1])
    with col1:
        st.image(data["image_url"], caption="AI 생성 로고", use_container_width=True)
        if data.get("final_logo"):
            st.image(data["final_logo"], caption="한글 폰트 적용 버전", use_container_width=True)
    with col2:
        st.markdown("#### 🧠 현재 프롬프트")
        st.code(data.get("prompt") or "No prompt returned.", language="markdown")

    st.markdown("---")
    st.subheader("✏️ 로고 수정 (Prompt Fusion 기반)")
    edit_instruction = st.text_area(
        "수정 지시문",
        "배경에 은은한 불빛 효과를 추가하고 텍스트를 더 선명하게 만들어 주세요.",
    )

    if st.button("🔄 수정된 로고 생성"):
        if not edit_instruction.strip():
            st.error("수정 지시문을 입력해주세요.")
            st.stop()
        with st.spinner("수정된 로고 생성 중..."):
            payload = {
                "brand_name": brand,
                "description": description,
                "style": style,
                "edit_instruction": edit_instruction.strip(),
                "edit_image_url": data.get("original_logo") or data.get("image_url"),
                "base_prompt": st.session_state.get("base_prompt"),
                "negative_prompt": negative or None,
            }
            if seed:
                payload["seed"] = int(seed)
            if style_type:
                payload["style_type"] = style_type

            res = requests.post(API_URL, json=payload)
            if res.status_code == 200:
                edited = res.json()
                st.session_state["edited_logo"] = edited
                st.success("✨ 수정된 로고 생성 완료!")
            else:
                st.error(f"❌ 수정 실패: {res.text}")

# --- 3️⃣ 수정 결과 비교 ---
if "edited_logo" in st.session_state:
    st.markdown("---")
    st.subheader("🆚 수정 전 / 후 비교 (Prompt Fusion)")
    original = st.session_state["generated_logo"]
    edited = st.session_state["edited_logo"]

    col1, col2 = st.columns(2)
    with col1:
        st.image(original["image_url"], caption="원본 로고", use_container_width=True)
    with col2:
        st.image(edited["image_url"], caption="수정된 로고", use_container_width=True)

    st.markdown("#### 🔍 프롬프트 비교")
    st.markdown("**기존(base_prompt)**")
    st.code(original.get("base_prompt") or original.get("prompt"), language="markdown")
    st.markdown("**강화(remix_prompt)**")
    st.code(edited.get("prompt") or "No remix prompt returned.", language="markdown")
