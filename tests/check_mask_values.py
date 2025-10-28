from io import BytesIO
from pathlib import Path
from PIL import Image

img_path = Path("data/outputs/서민고기_edited.png")
with Image.open(img_path) as img:
    mask = Image.new("L", img.size, 255)
    buf = BytesIO()
    mask.save(buf, format="PNG")
    buf.seek(0)
    mask_loaded = Image.open(buf)
    print(mask_loaded.mode)
    print(set(mask_loaded.getdata()))
