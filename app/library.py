from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel


STRUCTURED_DIR = Path("data/processed/logos/structured")
LOGO_DIR = Path("logos")


class LogoLibraryEntry(BaseModel):
    id: str
    file_name: str
    image_path: str
    logo_type: Optional[str] = None
    style_tags: List[str] = []
    tone_descriptors: List[str] = []
    layout_orientation: Optional[str] = None


def _load_entry(path: Path) -> Optional[LogoLibraryEntry]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None

    file_name = data.get("source_image") or f"{path.stem}.png"
    image_path = str(LOGO_DIR / file_name)
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
    for json_path in sorted(STRUCTURED_DIR.glob("*.json")):
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
