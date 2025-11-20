from pydantic import BaseModel
from typing import Optional

class LogoState(BaseModel):
    logo_type: Optional[str] = None
    reference_image_path: Optional[str] = None
    user_prompt: Optional[str] = None
    generated_image_url: Optional[str] = None
