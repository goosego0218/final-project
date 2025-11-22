import random
from pathlib import Path

# Absolute path to the images folder (avoids issues when working dir changes)
BASE_DIR = Path(__file__).resolve().parents[2] / "data/images"

TYPE_TO_DIR = {
    "wordmark": "wordmark_lettermark",
    "symbol_plus_text": "symbol_plus_text",
    "emblem": "emblem",
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
