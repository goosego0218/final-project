# 트렌드 테스트 요청/응답 스키마
# 작성일: 2025-11-19
# 수정내역
# - 2025-11-19: 초기 작성

from pydantic import BaseModel, Field


class TrendTestRequest(BaseModel):
    query: str = Field(
        default="베이커리 브랜드를 위한 2025년 커피/디저트 트렌드 알려줘",
        description="트렌드 에이전트에 전달할 자연어 질문",
    )
    brand_name: str | None = Field(
        default="봉봉 베이커리리",
        description="브랜드명 (선택)",
    )
    category: str | None = Field(
        default="베이커리리",
        description="업종/카테고리 (선택)",
    )

    class Config:
        json_schema_extra = {
            "example": {
                "query": "베이커리 브랜드를 위한 2025년 커피/디저트 트렌드 알려줘",
                "brand_name": "봉봉 베이커리",
                "category": "베이커리",
            }
        }


class TrendTestResponse(BaseModel):
    answer: str = Field(
        description="트렌드 에이전트가 생성한 답변",
    )
