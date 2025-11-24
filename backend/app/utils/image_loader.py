import random
from pathlib import Path
from typing import Optional

# Absolute path to the images folder (avoids issues when working dir changes)
BASE_DIR = Path(__file__).resolve().parents[2] / "data/images"

# Map logical logo types to the current folder structure under data/images
TYPE_TO_DIR = {
    "wordmark": "1_wordmark",
    "symbol_plus_text": "2_symbol",
    "emblem": "3_emblem",
}

# Previews will be resolved dynamically so they stay valid after renames.
TYPE_PREVIEW: dict[str, Optional[str]] = {}

IMAGE_EXTENSIONS = ["*.png", "*.jpg", "*.jpeg", "*.webp"]


def load_reference_images(logo_type: str, trend: str | None = None):
    """
    Return up to 4 reference images for the requested logo_type (and optional trend).
    Falls back to the default type when an invalid value is provided.
    """
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


def _first_image_in_tree(folder: Path) -> Optional[str]:
    """
    Return the first image found in the folder, checking the folder itself
    first and then its immediate subdirectories (alphabetical order).
    """
    direct = _first_image_in(folder)
    if direct:
        return direct
    for sub in sorted([p for p in folder.iterdir() if p.is_dir()], key=lambda p: p.name.lower()):
        found = _first_image_in(sub)
        if found:
            return found
    return None


# Build previews dynamically so renamed folders/files stay in sync.
for _logo_type, _dir in TYPE_TO_DIR.items():
    preview = _first_image_in_tree(BASE_DIR / _dir)
    TYPE_PREVIEW[_logo_type] = preview


def list_types():
    """
    Return available logo types with a preview image path for each.
    """
    items = []
    for t in ("symbol_plus_text", "wordmark", "emblem"):
        preview = TYPE_PREVIEW.get(t)
        items.append({"logo_type": t, "preview_image": preview})
    return items


def list_trends(logo_type: str):
    """
    Return available trend folders under the selected logo type with a preview per trend.
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
