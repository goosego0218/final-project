from pathlib import Path

from google import genai
from PIL import Image
from app.core.config import settings

def generate_with_nanobanana(reference_path: str, prompt: str) -> str:
    client_kwargs = {}
    if settings.google_genai_api_key:
        client_kwargs["api_key"] = settings.google_genai_api_key

    client = genai.Client(
        vertexai=True,
        project=settings.google_genai_project,
        location=settings.google_genai_location,
        **client_kwargs,
    )

    image_path = Path(reference_path)

    with Image.open(image_path) as pil_image:
        chat = client.chats.create(model=settings.google_genai_model)

        system_prompt = (
            "너는 시니어 브랜드 로고 디자이너다. "
            "사용자가 제공한 참조 이미지를 신중히 검토하고, "
            "요청한 스타일/컬러/폰트를 최대한 반영하며, "
            "과도한 왜곡 없이 일관된 브랜드 톤을 유지하라."
        )
        chat.send_message(system_prompt)

        # 이미지와 수정 요청을 한 번에 전달
        response = chat.send_message([pil_image, prompt])

    # Save under backend/data/outputs (relative to backend directory)
    out_dir = Path(__file__).resolve().parents[2] / "data" / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "generated_logo.png"

    for part in response.parts:
        img = part.as_image()
        if img:
            img.save(out_path)
            return str(out_path)

    raise RuntimeError("NanoBanana response did not contain an image.")
