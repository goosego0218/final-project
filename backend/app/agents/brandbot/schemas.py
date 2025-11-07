# src/brandbot/schemas.py
from __future__ import annotations
from typing import List, Optional, Literal, Dict, Any, Union
from pydantic import BaseModel, Field

UpdateField = Literal[
    "name","industry","tone","keywords","colors",
    "target_age","target_gender","avoid_trends","slogan"
]

class FieldUpdate(BaseModel):
    name: UpdateField
    value: Union[str, List[str]]
    confidence: float = Field(ge=0.0, le=1.0)
    explicit: bool
    source_span: Optional[str] = None

class BrandSignals(BaseModel):
    name: Optional[str] = Field(None, description="브랜드명")
    industry: Optional[str] = Field(None, description="업종/카테고리")
    tone: Optional[str] = Field(None, description="톤/분위기")
    colors: Optional[List[str]] = Field(None, description="선호 색상")
    keywords: Optional[List[str]] = Field(None, description="핵심 키워드")
    target_age: Optional[str] = None
    target_gender: Optional[str] = None
    avoid_trends: Optional[List[str]] = None
    slogan: Optional[str] = None
    
class TrendBrief(BaseModel):
    colors: List[str] = Field(default_factory=list)
    fonts: List[str] = Field(default_factory=list)
    copy_tone: Optional[str] = None
    logo_style: Optional[str] = None
    notes: List[str] = Field(default_factory=list)

class WebItem(BaseModel):
    title: str
    snippet: Optional[str] = None
    url: Optional[str] = None
    published: Optional[str] = None
    source: Optional[str] = None

# 분류 태그
IntentTag = Literal["collect", "trend", "confirm", "review"]
ScopeTag = Literal["in", "out"]
