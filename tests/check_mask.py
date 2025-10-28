from PIL import Image
from pathlib import Path
from io import BytesIO

img = Image.open(Path("data/outputs/서민고기_edited.png"))
mask = Image.new("L", img.size, 255)
buffer = BytesIO()
mask.save(buffer, format="PNG")
buffer.seek(0)
print(len(buffer.getvalue()))
print(mask.mode)
