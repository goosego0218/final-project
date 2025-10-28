"""
Ad-hoc script to exercise Ideogram's /v1/ideogram-v3/edit endpoint with a local image.

Requirements:
    - .env containing IDEOGRAM_API_KEY
    - An input image under data/outputs to edit
    - Pillow (PIL) installed

The script builds a simple mask that protects the central logo while allowing the
background to change and sends an edit request asking for a starry background.
"""

from __future__ import annotations

import os
from io import BytesIO
from pathlib import Path

import requests
from dotenv import load_dotenv
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

IDEOGRAM_API_KEY = os.getenv("IDEOGRAM_API_KEY")
if not IDEOGRAM_API_KEY:
    raise SystemExit("IDEOGRAM_API_KEY not configured in environment.")

INPUT_IMAGE = ROOT / "data" / "outputs" / "서민고기_edited.png"
if not INPUT_IMAGE.exists():
    raise SystemExit(f"Input image not found: {INPUT_IMAGE}")

OUTPUT_IMAGE = ROOT / "data" / "outputs" / "서민고기_edit_starlit.png"


def build_background_mask(image_path: Path) -> BytesIO:
    """Create a binary mask (0/255) that keeps the inner logo untouched."""
    with Image.open(image_path) as img:
        mask = Image.new("L", img.size, color=0)
        draw = ImageDraw.Draw(mask)
        inset = int(min(img.size) * 0.05)
        draw.rectangle(
            [inset, inset, img.width - inset, img.height - inset],
            fill=0,
            outline=0,
        )
        draw.rectangle(
            [0, 0, img.width, int(img.height * 0.7)],
            fill=255,
        )
    buffer = BytesIO()
    mask.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer


def edit_image(prompt: str) -> None:
    mask_bytes = build_background_mask(INPUT_IMAGE)
    files = {
        "image": (INPUT_IMAGE.name, INPUT_IMAGE.read_bytes(), "image/png"),
        "mask": ("mask.png", mask_bytes.read(), "image/png"),
    }
    data = {
        "prompt": prompt,
        "rendering_speed": "DEFAULT",
        "style_type": "GENERAL",
    }
    headers = {"Api-Key": IDEOGRAM_API_KEY}

    response = requests.post(
        "https://api.ideogram.ai/v1/ideogram-v3/edit",
        headers=headers,
        data=data,
        files=files,
        timeout=120,
    )
    if response.status_code != 200:
        raise SystemExit(f"Edit failed: {response.status_code} {response.text}")

    payload = response.json()
    image_url = payload["data"][0]["url"]
    image_bytes = requests.get(image_url, timeout=120).content
    OUTPUT_IMAGE.write_bytes(image_bytes)
    print(f"Edited image saved to {OUTPUT_IMAGE}")


if __name__ == "__main__":
    edit_image(
        (
            "Preserve the 서민고기 logo exactly as is, but replace the background with a vibrant "
            "night sky full of glowing constellations and soft blue-purple starlight."
        )
    )
