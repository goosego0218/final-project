from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.logo import LogoRequest
from app.services.logo_library import query_logo_library
from app.services.logo_pipeline import run_logo_pipeline as execute_logo_pipeline
from app.services.logo_recommendation import recommend_logos

router = APIRouter()


@router.post("/logo_pipeline")
def run_logo_pipeline(req: LogoRequest):
    """Wrap the v2 graph in the legacy response shape the frontend already expects."""
    try:
        return execute_logo_pipeline(req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/logo_library")
def logo_library(
    logo_type: Optional[str] = Query(None, description="Filter by symbol/category"),
    style_tag: Optional[str] = Query(None, description="Filter by style tag"),
    limit: int = Query(24, ge=1, le=200),
    refresh: bool = Query(False, description="Force reload from disk"),
):
    entries = query_logo_library(
        logo_type=logo_type, style_tag=style_tag, limit=limit, refresh=refresh
    )
    return {"items": [entry.model_dump() for entry in entries]}


@router.get("/logo_recommendations")
def logo_recommendations(
    seed_id: str = Query(..., description="ID or filename stem of the reference logo"),
    limit: int = Query(8, ge=1, le=40),
    offset: int = Query(0, ge=0),
):
    result = recommend_logos(seed_id=seed_id, limit=limit, offset=offset)
    return result
