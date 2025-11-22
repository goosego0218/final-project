from typing import Optional, Dict, List

from pydantic import BaseModel


class LogoState(BaseModel):
    logo_type: Optional[str] = None
    reference_image_path: Optional[str] = None
    user_prompt: Optional[str] = None
    generated_image_url: Optional[str] = None
    brand_profile: Optional[Dict] = None
    trend_choice: Optional[str] = None
    reference_candidates: Optional[List[str]] = None
    
