from fastapi import APIRouter
from .workflow import build_logo_workflow
from app.schemas.logo_schema import LogoRequest, LogoResponse

router = APIRouter()
graph = build_logo_workflow()

@router.post("/generate-logo", response_model=LogoResponse)
def generate_logo(request: LogoRequest):
    result = graph.invoke({
        "logo_type": request.logo_type,
        "reference_image_path": request.reference_image,
        "user_prompt": request.prompt,
    })
    return LogoResponse(
        generated_image_url=result["generated_image_url"]
    )
