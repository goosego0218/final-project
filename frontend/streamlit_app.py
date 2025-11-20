import streamlit as st
import requests

st.title("소상공인 로고 생성 서비스")

logo_type = st.selectbox("로고 유형", ["wordmark", "symbol_plus_text", "emblem"])

if st.button("유형 선택"):
    st.session_state["logo_type"] = logo_type
    st.success("다음 단계로 진행!")

# 2) reference 4개 받아오기
if "logo_type" in st.session_state:
    res = requests.post("http://localhost:8000/logo/references", json={"logo_type": logo_type})
    refs = res.json()["references"]

    selected = None
    cols = st.columns(4)
    for i, img in enumerate(refs):
        cols[i].image(img)
        if cols[i].button(f"이거 선택 {i+1}"):
            selected = img

    user_prompt = st.text_input("추가 느낌 설명")

    if st.button("로고 생성하기"):
        payload = {
            "logo_type": logo_type,
            "reference_image": selected,
            "prompt": user_prompt
        }
        out = requests.post("http://localhost:8000/logo/generate-logo", json=payload).json()
        st.image(out["generated_image_url"])
