"""
Quick remix test against Ideogram's /v1/ideogram-v3/remix endpoint.

Purpose:
    - Keeps the base logo concept prompt fixed
    - Appends an additional modification prompt (e.g., color or texture change)
    - Sends both together for a controlled Remix request

Requires:
    - .env with IDEOGRAM_API_KEY
    - Local image under data/outputs to use as the remix base
"""

import os
from pathlib import Path
import requests
from dotenv import load_dotenv

# -------------------------------
# 1️⃣ Setup
# -------------------------------
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

IDEOGRAM_API_KEY = os.getenv("IDEOGRAM_API_KEY")
if not IDEOGRAM_API_KEY:
    raise SystemExit("IDEOGRAM_API_KEY not configured in environment.")

INPUT_IMAGE = ROOT / "data" / "outputs" / "서민고기_original.png"
if not INPUT_IMAGE.exists():
    raise SystemExit(f"Input image not found: {INPUT_IMAGE}")

OUTPUT_IMAGE = ROOT / "data" / "outputs" / "서민고기_remix_starlit.png"


# -------------------------------
# 2️⃣ Function to remix image
# -------------------------------
def remix_image(base_prompt: str, extra_prompt: str) -> None:
    """
    Remix the existing logo image with an extended prompt.
    The base prompt defines the brand concept;
    the extra prompt specifies targeted visual changes.
    """

    # ✅ Merge prompts clearly into two sections for Ideogram understanding
    full_prompt = (
        f"### Existing Logo Concept\n{base_prompt.strip()}\n\n"
        f"### Modification Request\n{extra_prompt.strip()}"
    )

    files = {
        "image": (INPUT_IMAGE.name, INPUT_IMAGE.read_bytes(), "image/png"),
    }

    data = {
        "prompt": full_prompt,
        "rendering_speed": "DEFAULT",  # Options: FLASH, TURBO, DEFAULT, QUALITY
        "style_type": "DESIGN",  # DESIGN style keeps visual coherence
        "aspect_ratio": "1x1",
    }

    headers = {"Api-Key": IDEOGRAM_API_KEY}

    print("🎨 Sending Remix request to Ideogram...")
    response = requests.post(
        "https://api.ideogram.ai/v1/ideogram-v3/remix",
        headers=headers,
        data=data,
        files=files,
        timeout=120,
    )

    if response.status_code != 200:
        raise SystemExit(f"Remix failed: {response.status_code} {response.text}")

    payload = response.json()
    image_url = payload["data"][0]["url"]

    # Download image result
    image_bytes = requests.get(image_url, timeout=120).content
    OUTPUT_IMAGE.write_bytes(image_bytes)

    print(f"✅ Remixed image saved to {OUTPUT_IMAGE}")
    print(f"🖼️ Image URL: {image_url}")


# -------------------------------
# 3️⃣ Run as main
# -------------------------------
if __name__ == "__main__":
    BASE_PROMPT = """
'서민고기' translates to "Common People's Meat," and the logo reflects the warmth and honesty of a direct-grill specialty store.
It embraces a minimalistic aesthetic inspired by Korean calligraphy, ensuring a friendly and inviting look.

Typography:
- Elegant, rounded Korean calligraphy that conveys warmth and comfort.
- May subtly incorporate flame or grill elements within the letterforms.

Color Palette:
- Warm earthy tones: deep red, soft brown, gentle orange.
- Gradual gradient from rich red to warm golden-brown, symbolizing the cooking process.

Layout & Composition:
- Balanced and easy to read, emphasizing the brand name '서민고기' with supporting iconography.
- Light neutral background to enhance visibility.

Overall feel:
Approachable, cozy, and evokes the warmth of home-cooked meals, appealing to customers seeking comfort and sincerity.
    """

    EXTRA_PROMPT = """

Only adjust the small flame icon inside the logo — the one above the Korean text.
Change only its color and shape:
- Make the flame a deeper, vivid blue color, glowing softly like embers.
-sharpen the tips of the flame to create a more dynamic, lively appearance.
Do NOT add new flames or backgrounds.
Keep everything else perfectly identical.
    """

    remix_image(BASE_PROMPT, EXTRA_PROMPT)
