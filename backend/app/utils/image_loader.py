import random
from pathlib import Path
from typing import Optional

# Absolute path to the images folder (avoids issues when working dir changes)
BASE_DIR = Path(__file__).resolve().parents[2] / "data/images"

TYPE_TO_DIR = {
    "wordmark": "wordmark_lettermark",
    "symbol_plus_text": "symbol_plus_text",
    "emblem": "emblem",
}
# 대표 예시 이미지 (타입 선택 시 미리보기용)
TYPE_PREVIEW = {
    "wordmark": str(
        BASE_DIR
        / "wordmark_lettermark"
        / "designed_korean_type"
        / "한글3.png"
    ),
    "symbol_plus_text": str(
        BASE_DIR
        / "symbol_plus_text"
        / "playful_kitsch_character"
        / "베이커리_45.jpg"
    ),
    "emblem": str(
        BASE_DIR
        / "emblem"
        / "kitsch"
        / "베이커리_126.jpg"
    ),
}
IMAGE_EXTENSIONS = ["*.png", "*.jpg", "*.jpeg", "*.webp"]


def load_reference_images(logo_type: str, trend: str | None = None):
    """
    로고 타입(필수) + 트렌드(옵션)로 참조 이미지를 최대 4개 반환.
    트렌드별 하위 폴더가 없으면 타입 폴더 전체에서 선택.
    """
    # 안전하게 기본값/미지원 처리
    if not logo_type or logo_type not in TYPE_TO_DIR:
        logo_type = "symbol_plus_text"
    folder = BASE_DIR / TYPE_TO_DIR[logo_type]
    if trend:
        trend_folder = folder / trend
        if trend_folder.exists():
            folder = trend_folder

    files: list[Path] = []
    for ext in IMAGE_EXTENSIONS:
        files.extend(folder.glob(ext))

    return random.sample(files, k=min(len(files), 4))


def _first_image_in(folder: Path) -> Optional[str]:
    for ext in IMAGE_EXTENSIONS:
        files = sorted(folder.glob(ext))
        if files:
            return str(files[0])
    return None


def list_types():
    """
    로고 타입 목록과 대표 예시 이미지를 반환.
    """
    items = []
    for t in ("symbol_plus_text", "wordmark", "emblem"):
        preview = TYPE_PREVIEW.get(t)
        items.append({"logo_type": t, "preview_image": preview})
    return items


def list_trends(logo_type: str):
    """
    주어진 로고 타입의 트렌드(하위 폴더) 목록과 각 폴더의 첫 이미지 경로를 반환.
    """
    if logo_type not in TYPE_TO_DIR:
        logo_type = "symbol_plus_text"
    folder = BASE_DIR / TYPE_TO_DIR[logo_type]
    if not folder.exists():
        return []

    trends = []
    for sub in sorted([p for p in folder.iterdir() if p.is_dir()], key=lambda p: p.name.lower()):
        trends.append(
            {
                "trend": sub.name,
                "preview_image": _first_image_in(sub),
            }
        )
    return trends
