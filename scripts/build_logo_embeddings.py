"""
Offline utility to build semantic embeddings for every logo using the existing
structured JSON + RAG text. By default this script calls OpenAI Embeddings
(`text-embedding-3-large`).  When the `--mock` flag is provided, it falls back
to a lightweight bag-of-words hashing routine so the pipeline can be tested
without external API calls.

Usage:
    python scripts/build_logo_embeddings.py --output data/cache/logo_embeddings.jsonl
"""

from __future__ import annotations

import argparse
import json
import math
import os
from collections import Counter
from pathlib import Path
from typing import Iterable, List, Sequence

try:
    from openai import OpenAI
except ImportError:  # pragma: no cover - optional dependency
    OpenAI = None
try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - optional dependency
    load_dotenv = None


ROOT = Path(__file__).resolve().parents[1]
STRUCTURED_DIR = ROOT / "data" / "processed" / "logos" / "structured"
RAG_DIR = ROOT / "data" / "processed" / "logos" / "rag"
LOGO_DIR = ROOT / "logos"
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}

# Load environment variables from .env if present so OPENAI_API_KEY is available.
ENV_PATH = ROOT / ".env"
if load_dotenv is not None:
    load_dotenv(ENV_PATH)
elif ENV_PATH.exists():
    for line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def normalize_stem(value: str) -> str:
    cleaned = (
        value.lower()
        .replace(" ", "_")
        .replace("-", "_")
        .replace("__", "_")
    )
    return "".join(ch for ch in cleaned if ch.isalnum() or ch == "_")


def resolve_image_path(file_name: str) -> str:
    stem = normalize_stem(Path(file_name).stem)
    matches = [p for p in LOGO_DIR.rglob("*") if p.is_file() and normalize_stem(p.stem) == stem]
    if matches:
        return str(matches[0])
    fallback = LOGO_DIR / file_name
    return str(fallback)


def gather_records() -> List[dict]:
    records: List[dict] = []
    for json_path in STRUCTURED_DIR.rglob("*.json"):
        entry_id = json_path.stem
        data = json.loads(json_path.read_text(encoding="utf-8"))
        rag_path = RAG_DIR / f"{entry_id}.txt"
        rag_text = rag_path.read_text(encoding="utf-8") if rag_path.exists() else ""
        chunks = [
            data.get("brand_message", {}),
            data.get("symbol", {}),
            data.get("color_palette", {}),
            {
                "layout": data.get("layout"),
                "style_tags": data.get("style_tags"),
                "tone_descriptors": data.get("tone_descriptors"),
            },
        ]
        json_chunks = "\n".join(json.dumps(chunk, ensure_ascii=False) for chunk in chunks)
        text_blob = f"{json_chunks}\n\n{rag_text}".strip()
        records.append(
            {
                "id": entry_id,
                "text": text_blob,
                "logo_type": data.get("symbol", {}).get("category"),
                "style_tags": data.get("style_tags") or [],
                "tone_descriptors": data.get("tone_descriptors") or [],
                "layout_orientation": data.get("layout", {}).get("orientation"),
                "image_path": resolve_image_path(data.get("source_image") or f"{entry_id}.png"),
            }
        )
    return records


def chunked(iterable: Sequence[str], size: int) -> Iterable[List[str]]:
    for idx in range(0, len(iterable), size):
        yield list(iterable[idx : idx + size])


def mock_embed(text: str, dim: int = 256) -> List[float]:
    tokens = [token for token in text.split() if token]
    vec = [0.0] * dim
    for token in tokens:
        bucket = hash(token) % dim
        vec[bucket] += 1.0
    norm = math.sqrt(sum(value * value for value in vec)) or 1.0
    return [value / norm for value in vec]


def embed_texts(texts: List[str], model: str, mock: bool) -> List[List[float]]:
    if mock or not OpenAI:
        return [mock_embed(text) for text in texts]
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    embeddings: List[List[float]] = []
    for chunk in chunked(texts, 32):
        response = client.embeddings.create(model=model, input=chunk)
        embeddings.extend(item.embedding for item in response.data)
    return embeddings


def main() -> None:
    parser = argparse.ArgumentParser(description="Build logo embeddings from JSON + RAG text.")
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "cache" / "logo_embeddings.jsonl")
    parser.add_argument("--model", default="text-embedding-3-large")
    parser.add_argument("--mock", action="store_true", help="Use deterministic hashing instead of OpenAI API.")
    args = parser.parse_args()

    args.output.parent.mkdir(parents=True, exist_ok=True)
    records = gather_records()
    texts = [record["text"] for record in records]
    embeddings = embed_texts(texts, model=args.model, mock=args.mock)
    with args.output.open("w", encoding="utf-8") as handle:
        for record, vector in zip(records, embeddings):
            payload = {
                "id": record["id"],
                "image_path": record["image_path"],
                "logo_type": record["logo_type"],
                "style_tags": record["style_tags"],
                "tone_descriptors": record["tone_descriptors"],
                "layout_orientation": record["layout_orientation"],
                "embedding": vector,
            }
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")
    print(f"Wrote {len(records)} embeddings to {args.output}")


if __name__ == "__main__":
    main()
