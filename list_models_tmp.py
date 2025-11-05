import os
from dotenv import load_dotenv
import google.generativeai as genai
load_dotenv()
key = os.getenv("GOOGLE_API_KEY")
if not key:
    raise SystemExit("GOOGLE_API_KEY not set")
genai.configure(api_key=key)
models = [m for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
for m in models:
    print(f"{m.name} -> {m.supported_generation_methods}")
