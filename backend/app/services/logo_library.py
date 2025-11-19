from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel


BACKEND_ROOT = Path(__file__).resolve().parents[2]
WORKSPACE_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = BACKEND_ROOT / "data"
STRUCTURED_DIR = DATA_DIR / "processed" / "logos" / "structured"
LOGO_CANDIDATES = [
    BACKEND_ROOT / "logos",
    WORKSPACE_ROOT / "logos",
    WORKSPACE_ROOT / "frontend" / "logos",
]


def _resolve_logo_root() -> Path:
    for candidate in LOGO_CANDIDATES:
        if candidate.exists():
            return candidate
    return LOGO_CANDIDATES[-1]


LOGO_DIR = _resolve_logo_root()


class LogoLibraryEntry(BaseModel):
    id: str
    file_name: str
    image_path: str
    logo_type: Optional[str] = None
    style_tags: List[str] = []
    tone_descriptors: List[str] = []
    layout_orientation: Optional[str] = None


def _resolve_image_path(file_name: str, json_path: Path) -> str:
    """
    Locate the matching logo image, accounting for the nested category folders
    under `logos/`. Falls back to the root directory for legacy layouts.
    """
    # Prefer the category inferred from the JSON directory structure.
    image_path: Optional[Path] = None
    try:
        relative = json_path.relative_to(STRUCTURED_DIR)
        category = relative.parts[0] if len(relative.parts) > 1 else None
    except ValueError:
        category = None

    if category:
        candidate = LOGO_DIR / category / file_name
        if candidate.exists():
            image_path = candidate

    if image_path is None:
        # Look for matches anywhere under logos/ to handle migrated files.
        matches = list(LOGO_DIR.rglob(file_name))
        if matches:
            image_path = matches[0]

    if image_path is None:
        # Final fallback to the legacy flat layout so older installs still work.
        image_path = LOGO_DIR / file_name

    return str(image_path)


def _load_entry(path: Path) -> Optional[LogoLibraryEntry]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None

    file_name = data.get("source_image") or f"{path.stem}.png"
    image_path = _resolve_image_path(file_name, path)
    logo_type = data.get("symbol", {}).get("category")
    style_tags = data.get("style_tags") or []
    tone_descriptors = data.get("tone_descriptors") or []
    layout_orientation = data.get("layout", {}).get("orientation")

    return LogoLibraryEntry(
        id=path.stem,
        file_name=file_name,
        image_path=image_path,
        logo_type=logo_type,
        style_tags=style_tags,
        tone_descriptors=tone_descriptors,
        layout_orientation=layout_orientation,
    )


@lru_cache(maxsize=1)
def _cached_library() -> List[LogoLibraryEntry]:
    entries: List[LogoLibraryEntry] = []
    if not STRUCTURED_DIR.exists():
        return entries
    for json_path in sorted(STRUCTURED_DIR.rglob("*.json")):
        entry = _load_entry(json_path)
        if entry:
            entries.append(entry)
    return entries


def query_logo_library(
    logo_type: Optional[str] = None,
    style_tag: Optional[str] = None,
    limit: int = 24,
    refresh: bool = False,
) -> List[LogoLibraryEntry]:
    if refresh:
        _cached_library.cache_clear()
    entries = _cached_library()

    filtered = entries
    if logo_type:
        lowered = logo_type.lower()
        filtered = [
            e for e in filtered if (e.logo_type or "").lower() == lowered
        ]
    if style_tag:
        lowered_style = style_tag.lower()
        filtered = [
            e
            for e in filtered
            if any(tag.lower() == lowered_style for tag in e.style_tags)
        ]
    if limit and limit > 0:
        filtered = filtered[:limit]
    return filtered
