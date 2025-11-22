from pathlib import Path

from app.graphs.nodes.logo.state import LogoState
from app.utils.image_loader import load_reference_images
from app.services.nanobanana_service import generate_with_nanobanana


def select_type_node(state: LogoState):
    # 기본 타입을 미지정/미지원 시 symbol_plus_text로 설정
    from app.utils.image_loader import TYPE_TO_DIR

    if not state.logo_type or state.logo_type not in TYPE_TO_DIR:
        state.logo_type = "symbol_plus_text"
    return state


def load_reference_node(state: LogoState):
    images = load_reference_images(state.logo_type, trend=state.trend_choice)
    result = {"reference_candidates": [str(p) for p in images]}

    # 기본 참조 이미지로 첫 번째 후보를 설정
    if images and not state.reference_image_path:
        result["reference_image_path"] = str(images[0])

    return result


def generate_node(state: LogoState):
    reference_path = state.reference_image_path

    # 브랜드 프로필을 이용해 프롬프트를 보강
    brand_profile = state.brand_profile or {}
    if state.brand_profile and isinstance(state.brand_profile, dict):
        brand_profile = state.brand_profile

    parts = []
    if brand_profile.get("brand_name"):
        parts.append(f"Brand name: {brand_profile.get('brand_name')}")
    if brand_profile.get("category"):
        parts.append(f"Category: {brand_profile.get('category')}")
    if brand_profile.get("tone_mood"):
        parts.append(f"Tone/Mood: {brand_profile.get('tone_mood')}")
    if brand_profile.get("core_keywords"):
        parts.append(f"Keywords: {brand_profile.get('core_keywords')}")
    if brand_profile.get("slogan"):
        parts.append(f"Slogan: {brand_profile.get('slogan')}")
    if brand_profile.get("target_age"):
        parts.append(f"Audience age: {brand_profile.get('target_age')}")
    if brand_profile.get("target_gender"):
        parts.append(f"Audience gender: {brand_profile.get('target_gender')}")
    if brand_profile.get("preferred_colors"):
        parts.append(f"Preferred colors: {brand_profile.get('preferred_colors')}")
    if brand_profile.get("avoided_trends"):
        parts.append(f"Avoided trends: {brand_profile.get('avoided_trends')}")

    user_prompt = state.user_prompt or ""
    if user_prompt:
        parts.append(f"User edits: {user_prompt}")

    prompt = "\n".join(parts) if parts else user_prompt

    image_url = generate_with_nanobanana(
        reference_path,
        prompt,
    )
    state.generated_image_url = image_url
    return state


def finalize_node(state: LogoState):
    return state
