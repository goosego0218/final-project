from pathlib import Path

from app.graphs.nodes.logo.state import LogoState
from app.utils.image_loader import load_reference_images, list_trends
from app.services.nanobanana_service import generate_with_nanobanana


def select_type_node(state: LogoState):
    """Ensure logo_type is valid; if missing, set default and prompt selection."""
    from app.utils.image_loader import TYPE_TO_DIR

    requested = state.logo_type
    if not state.logo_type or state.logo_type not in TYPE_TO_DIR:
        state.logo_type = "symbol_plus_text"
    if not requested:
        state.reply = "로고 유형을 선택해주세요. (symbol_plus_text | wordmark | emblem 중 하나)"
    return state


def load_reference_node(state: LogoState):
    """If trend missing, ask for it. Otherwise load up to 4 references."""
    if not state.trend_choice:
        trends = list_trends(state.logo_type or "symbol_plus_text")
        trend_names = ", ".join([t["trend"] for t in trends]) if trends else "트렌드 없음"
        return {
            "reply": f"선택한 로고 유형에 맞춰 트렌드를 골라주세요: {trend_names}",
            "reference_candidates": [],
        }

    images = load_reference_images(state.logo_type, trend=state.trend_choice)
    result = {"reference_candidates": [str(p) for p in images]}

    result["reply"] = "트렌드에 맞는 참조 이미지를 골라주세요."

    return result


def generate_node(state: LogoState):
    reference_path = state.reference_image_path

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
