from fastapi import FastAPI, HTTPException

from .graph import compiled_graph
from .models import LogoRequest

app = FastAPI(title="AI Logo Maker LangGraph", version="4.2 (Localized Prompt Fusion)")


@app.post("/logo_pipeline")
def run_logo_pipeline(req: LogoRequest):
    try:
        state = compiled_graph.invoke(req.dict())
        prompt_history = []
        try:
            history = state.get("prompt_history")
            if history:
                prompt_history = list(history)
        except Exception:
            prompt_history = []

        return {
            "prompt": state.get("prompt"),
            "base_prompt": state.get("base_prompt"),
            "image_url": state.get("image_url"),
            "original_logo": state.get("original_path"),
            "final_logo": state.get("overlay_path"),
            "negative_prompt": state.get("negative_prompt"),
            "prompt_history": prompt_history,
            "color_palette": state.get("color_palette"),
            "remix_attempts": state.get("remix_attempts"),
            "image_weight": state.get("image_weight"),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/")
def root():
    return {
        "message": "🚀 AI Logo Maker LangGraph (Localized Prompt Fusion) is running!"
    }
