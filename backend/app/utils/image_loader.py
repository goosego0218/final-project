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


def load_reference_images(logo_type: str):
    folder = BASE_DIR / TYPE_TO_DIR[logo_type]
    files = []
    for ext in IMAGE_EXTENSIONS:
        files.extend(folder.glob(ext))
    return random.sample(files, k=min(len(files), 4))