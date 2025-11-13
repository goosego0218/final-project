from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Iterable, List, Tuple

from openai import OpenAI, OpenAIError

try:
    from app.config import OPENAI_API_KEY
except ImportError:  # pragma: no cover - fallback for direct script use
    OPENAI_API_KEY = None


SUPPORTED_EXTS = {".png", ".jpg", ".jpeg", ".webp"}
DEFAULT_MODEL = "gpt-4o"
STRUCTURED_CATEGORIES = [
    "wordmark_lettermark",
    "symbol_centric",
    "symbol_plus_text",
    "emblem",
    "other",
]
EMBLEM_STYLE_KEYWORDS = {"emblem", "badge", "crest", "shield", "seal", "insignia"}
EMBLEM_DESC_KEYWORDS = {
    "emblem",
    "badge",
    "crest",
    "shield",
    "seal",
    "coat of arms",
    "medallion",
    "insignia",
}
WORDMARK_CATEGORIES = {"lettermark", "wordmark", "logotype", "monogram", "text"}
WORDMARK_DESC_KEYWORDS = {
    "text-based",
    "text only",
    "wordmark",
    "lettermark",
    "typographic",
    "lettering",
}
SYSTEM_PROMPT = (
    "You are a senior brand analyst specializing in logo breakdowns."
    " You must output strict JSON that matches the requested schema."
    " Be concise but precise, prefer arrays over prose, and include confidence values 0.0-1.0."
)
ANALYSIS_INSTRUCTIONS = """Analyze the provided logo and respond with JSON using the following template:
{
  "source_image": "<original file name>",
  "text_elements": {
    "primary_text": "<exact lettering or null>",
    "secondary_text": "<taglines or null>",
    "language": "<dominant writing system>",
    "font_style": "<stylistic description>",
    "typography_notes": "<readability comments>",
    "confidence": 0.0-1.0
  },
  "symbol": {
    "description": "<plain description>",
    "category": "<animal|lettermark|abstract|emblem|other>",
    "meanings": ["<semantic cue>", "..."],
    "confidence": 0.0-1.0
  },
  "color_palette": {
    "primary": [{"hex": "#RRGGBB", "common_name": "<name>", "usage": "<foreground/background>"}],
    "secondary": [{"hex": "#RRGGBB", "common_name": "<name>", "usage": "<accent>"}],
    "contrast_notes": "<contrast comment>",
    "confidence": 0.0-1.0
  },
  "style_tags": ["modern", "minimal", "..."],
  "tone_descriptors": ["luxury", "friendly", "..."],
  "layout": {
    "orientation": "horizontal|vertical|square|mixed",
    "aspect_ratio_estimate": "<e.g. 4:3>",
    "balance_notes": "<composition comment>",
    "spacing_notes": "<white space comment>",
    "confidence": 0.0-1.0
  },
  "brand_message": {
    "keywords": ["<keyword>", "..."],
    "values": ["<value>", "..."],
    "audience_hint": "<audience guess>",
    "confidence": 0.0-1.0
  },
  "detected_channels": ["digital", "print", "packaging"],
  "complexity_rating": "low|medium|high",
  "issues": [
    {"type": "<contrast|legibility|symbol|color|layout|other>", "description": "<short note>", "severity": "low|medium|high"}
  ],
  "improvement_cues": [
    {"focus": "<theme>", "suggestion": "<actionable change>", "priority": "high|medium|low"}
  ],
  "trend_alignment": {
    "tags": ["retro", "futuristic", "..."],
    "score": 0.0-1.0,
    "notes": "<how it aligns with current trends>"
  },
  "rag_summary": "2-3 sentence natural language summary combining strengths, tone, and possible upgrades."
}
Use null for unknown scalar fields and [] for arrays with no data. Keep JSON on a single object, no extra commentary.
"""


def classify_logo_structure(payload: dict) -> str:
    """Derive the output subdirectory based on logo composition cues."""
    symbol = payload.get("symbol") or {}
    text_elements = payload.get("text_elements") or {}
    style_tags = [tag.lower() for tag in (payload.get("style_tags") or [])]
    desc = (symbol.get("description") or "").lower()
    category = (symbol.get("category") or "").lower()
    has_text = bool((text_elements.get("primary_text") or "").strip())

    if (
        category == "emblem"
        or any(keyword in style_tags for keyword in EMBLEM_STYLE_KEYWORDS)
        or any(keyword in desc for keyword in EMBLEM_DESC_KEYWORDS)
    ):
        return "emblem"

    if category in WORDMARK_CATEGORIES or any(keyword in desc for keyword in WORDMARK_DESC_KEYWORDS):
        return "wordmark_lettermark"

    if has_text and not desc:
        return "wordmark_lettermark"

    if desc and not has_text:
        return "symbol_centric"

    if desc and has_text:
        return "symbol_plus_text"

    return "other"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Batch analyze logo images with GPT-4o vision.")
    parser.add_argument("--logo-dir", type=Path, default=Path("logos"), help="Directory containing logo images.")
    parser.add_argument(
        "--structured-dir",
        type=Path,
        default=Path("data/processed/logos/structured"),
        help="Directory to store structured JSON outputs.",
    )
    parser.add_argument(
        "--summary-dir",
        type=Path,
        default=Path("data/processed/logos/rag"),
        help="Directory to store plain-text summaries for RAG ingestion.",
    )
    parser.add_argument("--model", default=DEFAULT_MODEL, help="OpenAI model to use for analysis.")
    parser.add_argument("--limit", type=int, help="Optional cap on number of images to process.")
    parser.add_argument("--overwrite", action="store_true", help="Re-run analysis even if outputs exist.")
    parser.add_argument("--sleep", type=float, default=0.5, help="Delay between requests to avoid rate spikes.")
    return parser.parse_args()


def iter_logo_files(root: Path) -> List[Path]:
    if not root.exists():
        raise FileNotFoundError(f"Logo directory not found: {root}")
    files = sorted(p for p in root.iterdir() if p.suffix.lower() in SUPPORTED_EXTS)
    if not files:
        raise FileNotFoundError(f"No supported logo images in {root}")
    return files


def encode_image(path: Path) -> Tuple[str, str]:
    data = path.read_bytes()
    encoded = base64.b64encode(data).decode("utf-8")
    mime, _ = mimetypes.guess_type(path.name)
    mime = mime or "image/png"
    return encoded, mime


def clean_json_payload(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def gpt_logo_analysis(client: OpenAI, image_b64: str, mime: str, model: str) -> dict:
    messages = [
        {"role": "system", "content": [{"type": "text", "text": SYSTEM_PROMPT}]},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": ANALYSIS_INSTRUCTIONS},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
            ],
        },
    ]
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            completion = client.chat.completions.create(
                model=model,
                temperature=0.2,
                response_format={"type": "json_object"},
                messages=messages,
            )
            content = completion.choices[0].message.content or "{}"
            payload = json.loads(clean_json_payload(content))
            return payload
        except (OpenAIError, json.JSONDecodeError) as exc:
            last_error = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Analysis failed after retries: {last_error}")


def ensure_output_dirs(dirs: Iterable[Path]) -> None:
    for directory in dirs:
        directory.mkdir(parents=True, exist_ok=True)


def ensure_structured_categories(root: Path) -> None:
    for category in STRUCTURED_CATEGORIES:
        (root / category).mkdir(parents=True, exist_ok=True)


def find_existing_structured_file(root: Path, stem: str) -> Path | None:
    for category in STRUCTURED_CATEGORIES:
        candidate = root / category / f"{stem}.json"
        if candidate.exists():
            return candidate
    legacy = root / f"{stem}.json"
    if legacy.exists():
        return legacy
    return None


def save_outputs(structured: dict, summary_path: Path, json_path: Path) -> None:
    rag_summary = structured.pop("rag_summary", "").strip()
    timestamp = datetime.utcnow().isoformat() + "Z"
    structured["analysis_timestamp"] = timestamp
    json_path.write_text(json.dumps(structured, ensure_ascii=False, indent=2), encoding="utf-8")
    summary_content = rag_summary or "No summary returned."
    summary_path.write_text(summary_content + f"\n\n#timestamp={timestamp}", encoding="utf-8")


def main() -> int:
    args = parse_args()
    ensure_output_dirs([args.structured_dir, args.summary_dir])
    ensure_structured_categories(args.structured_dir)

    files = iter_logo_files(args.logo_dir)
    if args.limit:
        files = files[: args.limit]

    api_key = OPENAI_API_KEY or None
    client = OpenAI(api_key=api_key)

    processed = 0
    for idx, logo_path in enumerate(files, start=1):
        stem = logo_path.stem
        summary_path = args.summary_dir / f"{stem}.txt"
        existing_json = find_existing_structured_file(args.structured_dir, stem)
        if not args.overwrite and existing_json and summary_path.exists():
            print(f"[skip] {stem} already analyzed.")
            continue

        image_b64, mime = encode_image(logo_path)
        try:
            result = gpt_logo_analysis(client, image_b64, mime, args.model)
        except Exception as exc:  # pylint: disable=broad-except
            print(f"[error] {stem}: {exc}")
            continue

        result["source_image"] = logo_path.name
        category = classify_logo_structure(result)
        category_dir = args.structured_dir / category
        category_dir.mkdir(parents=True, exist_ok=True)
        json_path = category_dir / f"{stem}.json"
        if existing_json and existing_json != json_path and existing_json.exists():
            existing_json.unlink()
        save_outputs(result, summary_path, json_path)
        processed += 1
        print(f"[ok] {stem} ({idx}/{len(files)})")
        if args.sleep:
            time.sleep(args.sleep)

    print(f"Completed structured analyses for {processed} logos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
