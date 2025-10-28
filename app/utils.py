from io import BytesIO
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

from .config import FONT_DIR, SAVE_DIR


def contains_korean(text: str) -> bool:
    return any("\uac00" <= c <= "\ud7a3" for c in text)


def overlay_korean_font(image_bytes: bytes, brand_name: str) -> Optional[str]:
    try:
        img = Image.open(BytesIO(image_bytes)).convert("RGBA")
        draw = ImageDraw.Draw(img)

        font_candidates = [
            FONT_DIR / "Pretendard-Bold.ttf",
            FONT_DIR / "BMHANNAPro.ttf",
            FONT_DIR / "NanumGothic.ttf",
        ]
        font_path = next((p for p in font_candidates if p.exists()), None)
        if not font_path:
            return None

        font = ImageFont.truetype(str(font_path), size=120)
        text_w, text_h = draw.textsize(brand_name, font=font)
        pos = ((img.width - text_w) // 2, img.height - text_h - 60)
        draw.rectangle(
            [(pos[0] - 30, pos[1] - 20), (pos[0] + text_w + 30, pos[1] + text_h + 20)],
            fill=(255, 255, 255, 180),
        )
        draw.text(pos, brand_name, font=font, fill=(30, 30, 30, 255))

        output_path = SAVE_DIR / f"{brand_name}_final.png"
        img.save(output_path)
        return str(output_path)
    except Exception as exc:
        print(f"[Overlay Error] {exc}")
        return None
