from pydantic import BaseModel


class LogoRequest(BaseModel):
    reference_image: str
    prompt: str
    brand_profile: dict | None = None


class LogoResponse(BaseModel):
    generated_image_url: str
