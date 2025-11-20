from pydantic import BaseModel

class LogoRequest(BaseModel):
    logo_type: str
    reference_image: str
    prompt: str

class LogoResponse(BaseModel):
    generated_image_url: str
