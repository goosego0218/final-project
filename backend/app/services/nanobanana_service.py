from datetime import datetime
from pathlib import Path

from google import genai
from PIL import Image
from app.core.config import settings


def generate_with_nanobanana(reference_path: str, prompt: str) -> str:
    client = genai.Client(api_key=settings.google_genai_api_key)

    image_path = Path(reference_path)

    with Image.open(image_path) as pil_image:
        system_prompt = (
            "You are a brand logo designer. "
            "Use the provided reference image to keep the intended concept and feel. "
            "Reflect the user's requested colors and style."
        )

        response = client.models.generate_content(
            model=settings.google_genai_model,
            contents=[pil_image, system_prompt, prompt],
        )

    out_dir = Path(__file__).resolve().parents[2] / "data" / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M")
    out_path = out_dir / f"generated_logo_{timestamp}.png"

    for part in response.parts:
        img = part.as_image()
        if img:
            img.save(out_path)
            return str(out_path)

    raise RuntimeError("NanoBanana response did not contain an image.")
