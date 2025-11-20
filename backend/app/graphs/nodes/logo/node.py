from pathlib import Path

from app.graphs.nodes.logo.state import LogoState
from app.utils.image_loader import load_reference_images
from app.services.nanobanana_service import generate_with_nanobanana


def select_type_node(state: LogoState):
    # Streamlit에서 받는 logo_type을 그대로 사용
    return state


def load_reference_node(state: LogoState):
    # 로고 유형별로부터 4개 참조 이미지 경로 로드
    images = load_reference_images(state.logo_type)
    return {"reference_candidates": images}


def generate_node(state: LogoState):
    # Ensure we have a valid reference image path; fall back to a local sample if needed
    reference_path = state.reference_image_path
    if not reference_path or not Path(reference_path).exists():
        candidates = load_reference_images(state.logo_type)
        reference_path = str(candidates[0]) if candidates else None

    if not reference_path:
        raise FileNotFoundError("No reference image available for generation.")

    image_url = generate_with_nanobanana(
        reference_path,
        state.user_prompt
    )
    state.generated_image_url = image_url
    return state


def finalize_node(state: LogoState):
    return state
