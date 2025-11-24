from pydantic import BaseModel


class LogoRequest(BaseModel):
    reference_image: str
    prompt: str
    brand_profile: dict | None = None


class LogoResponse(BaseModel):
    generated_image_url: str


class LogoTypeItem(BaseModel):
    logo_type: str
    preview_image: str | None = None


class LogoTypesResponse(BaseModel):
    types: list[LogoTypeItem]


class LogoTrendItem(BaseModel):
    trend: str
    preview_image: str | None = None


class LogoTrendsResponse(BaseModel):
    logo_type: str
    trends: list[LogoTrendItem]


class LogoReferenceListResponse(BaseModel):
    logo_type: str
    trend: str | None = None
    images: list[str]


class LogoFlowRequest(BaseModel):
    project_id: int
    logo_type: str | None = None
    trend_choice: str | None = None
    logo_session_id: str | None = None


class LogoFlowResponse(BaseModel):
    project_id: int
    logo_session_id: str
    logo_type: str
    trend_choice: str | None = None
    types: list[LogoTypeItem]
    trends: list[LogoTrendItem]
    references: list[str]
    reference_image: str | None = None
