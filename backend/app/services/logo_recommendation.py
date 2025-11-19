from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
from fastapi import HTTPException

from app.services.logo_library import _resolve_image_path  # reuse existing helper

STRUCTURED_DIR = Path("data/processed/logos/structured")
RAG_DIR = Path("data/processed/logos/rag")
LOGO_DIR = Path("logos")
EMBEDDING_PATH = Path("data/cache/logo_embeddings.jsonl")
TOKEN_PATTERN = re.compile(r"[0-9a-zA-Z가-힣_]+")
ROOT = Path(__file__).resolve().parents[2]


class RecommendationIndex:
    def __init__(self, records: List[dict], vectors: np.ndarray):
        self.records = records
        self.vectors = vectors.astype(np.float32)
        norms = np.linalg.norm(self.vectors, axis=1)
        self.norms = np.where(norms == 0, 1e-9, norms)
        self.id_to_idx = {record["id"]: idx for idx, record in enumerate(records)}


def _normalize(value: str) -> str:
    value = value.lower().replace(" ", "_").replace("-", "_")
    value = re.sub(r"[^0-9a-z가-힣_]+", "_", value)
    return re.sub(r"_+", "_", value).strip("_")


def _presentable_path(raw_path: str) -> str:
    """
    Convert absolute filesystem paths into workspace-relative POSIX strings so
    API consumers don't depend on the server's mount layout.
    """
    path = Path(raw_path)
    if not path.is_absolute():
        return path.as_posix()
    try:
        rel = path.relative_to(ROOT)
        return rel.as_posix()
    except ValueError:
        return path.as_posix()


def _load_semantic_text(entry_id: str, data: dict) -> str:
    json_path = data.get("_json_path")
    content = []
    if json_path and json_path.exists():
        payload = json.loads(json_path.read_text(encoding="utf-8"))
        content.append(json.dumps(payload, ensure_ascii=False))
    rag_path = RAG_DIR / f"{entry_id}.txt"
    if rag_path.exists():
        content.append(rag_path.read_text(encoding="utf-8"))
    meta_bits = [
        data.get("logo_type") or "",
        " ".join(data.get("style_tags") or []),
        " ".join(data.get("tone_descriptors") or []),
        (data.get("layout_orientation") or ""),
    ]
    content.append(" ".join(bit for bit in meta_bits if bit))
    return "\n\n".join(part for part in content if part)


def _text_to_vector(text: str) -> Tuple[np.ndarray, float]:
    tokens = TOKEN_PATTERN.findall(text.lower())
    if not tokens:
        return np.zeros(1, dtype=np.float32), 1e-9
    counts: Dict[str, int] = {}
    for token in tokens:
        counts[token] = counts.get(token, 0) + 1
    vec = np.array(list(counts.values()), dtype=np.float32)
    norm = np.linalg.norm(vec) or 1e-9
    return vec, norm


@lru_cache(maxsize=1)
def load_semantic_index() -> RecommendationIndex:
    if EMBEDDING_PATH.exists():
        records: List[dict] = []
        vectors: List[List[float]] = []
        with EMBEDDING_PATH.open("r", encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                payload = json.loads(line)
                records.append(
                    {
                        "id": payload["id"],
                        "image_path": _presentable_path(payload["image_path"]),
                        "logo_type": payload.get("logo_type"),
                        "style_tags": payload.get("style_tags") or [],
                        "tone_descriptors": payload.get("tone_descriptors") or [],
                        "layout_orientation": payload.get("layout_orientation"),
                    }
                )
                vectors.append(payload["embedding"])
        if not records:
            raise RuntimeError("Embedding file is empty.")
        matrix = np.array(vectors, dtype=np.float32)
        return RecommendationIndex(records, matrix)

    # Fallback: build lightweight vectors directly from JSON+RAG text.
    records = []
    vectors = []
    for json_path in STRUCTURED_DIR.rglob("*.json"):
        entry_id = json_path.stem
        payload = json.loads(json_path.read_text(encoding="utf-8"))
        # Attach helper key for text builder
        payload["_json_path"] = json_path
        semantic_text = _load_semantic_text(entry_id, payload)
        vec, norm = _text_to_vector(semantic_text)
        records.append(
            {
                "id": entry_id,
                "image_path": _presentable_path(
                    _resolve_image_path(
                        payload.get("source_image") or f"{entry_id}.png", json_path
                    )
                ),
                "logo_type": payload.get("symbol", {}).get("category"),
                "style_tags": payload.get("style_tags") or [],
                "tone_descriptors": payload.get("tone_descriptors") or [],
                "layout_orientation": payload.get("layout", {}).get("orientation"),
                "semantic_norm": norm,
                "semantic_vector": vec,
            }
        )
        vectors.append(vec)
    if not records:
        raise RuntimeError("No structured logo records were found.")
    # Pad vectors to same length
    max_len = max(vec.shape[0] for vec in vectors)
    padded = np.zeros((len(vectors), max_len), dtype=np.float32)
    norms = np.zeros(len(vectors), dtype=np.float32)
    for idx, record in enumerate(records):
        vec = record["semantic_vector"]
        padded[idx, : vec.shape[0]] = vec
        norms[idx] = record["semantic_norm"]
    index = RecommendationIndex(records, padded)
    index.norms = np.where(norms == 0, 1e-9, norms)
    for idx, record in enumerate(records):
        record.pop("semantic_vector", None)
        record.pop("semantic_norm", None)
    return index


def _lookup_record(index: RecommendationIndex, seed_id: str) -> int:
    normalized = _normalize(seed_id)
    if normalized in index.id_to_idx:
        return index.id_to_idx[normalized]
    for record_id, idx in index.id_to_idx.items():
        if normalized == _normalize(record_id):
            return idx
    raise HTTPException(status_code=404, detail=f"Logo '{seed_id}' not found in semantic index.")


def recommend_logos(seed_id: str, limit: int, offset: int) -> dict:
    try:
        index = load_semantic_index()
    except RuntimeError as err:
        raise HTTPException(status_code=503, detail=str(err)) from err

    try:
        seed_idx = _lookup_record(index, seed_id)
    except HTTPException:
        raise

    seed_vector = index.vectors[seed_idx]
    seed_norm = index.norms[seed_idx]
    sims = np.dot(index.vectors, seed_vector) / (index.norms * seed_norm)
    sims = np.nan_to_num(sims, nan=0.0, posinf=0.0, neginf=0.0)
    sims[seed_idx] = -np.inf  # exclude self
    ranked_indices = [idx for idx in np.argsort(-sims) if idx != seed_idx]
    total = len(ranked_indices)
    start = min(offset, total)
    end = min(start + limit, total)
    items = []
    for idx in ranked_indices[start:end]:
        record = index.records[idx]
        items.append(
            {
                "id": record["id"],
                "score": float(round(sims[idx], 6)),
                "image_path": _presentable_path(record["image_path"]),
                "logo_type": record.get("logo_type"),
                "style_tags": record.get("style_tags"),
                "tone_descriptors": record.get("tone_descriptors"),
                "layout_orientation": record.get("layout_orientation"),
            }
        )
    return {
        "seed_id": index.records[seed_idx]["id"],
        "total": total,
        "offset": start,
        "limit": limit,
        "items": items,
    }