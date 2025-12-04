# 로고 관련 엔드포인트
# 작성자: 황민준
# 작성일: 2025-11-20
# 수정내역
# - 2025-11-20: 초기 작성
# - 2025-11-24: intro 엔드포인트 추가
# - 2025-11-29: 다운로드 프록시 엔드포인트 추가
# - 2025-12-04: 레퍼런스 이미지 처리 추가

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import List
from sqlalchemy.orm import Session
import boto3
from botocore.client import Config
from io import BytesIO

from app.schemas.chat import LogoChatRequest, LogoChatResponse
from app.db.orm import get_orm_session
from app.core.deps import get_current_user
from app.core.config import settings
from app.models.auth import UserInfo
from app.models.project import GenerationProd
from app.schemas.logo import SaveLogoRequest, SaveLogoResponse, LogoListItemResponse, UpdateLogoPubYnRequest, UpdateLogoPubYnResponse
from app.services.logo_service import save_logo_to_storage_and_db, get_logo_list, delete_logo, update_logo_pub_yn
from app.utils.file_utils import get_file_url, get_file_path_from_url
from langchain_core.messages import HumanMessage
from app.agents.state import AppState 
from app.agents.logo_agent import build_logo_graph
from app.graphs.nodes.common.brand_summary import summarize_brand_profile_with_llm

from uuid import uuid4

router = APIRouter(
    prefix="/logo",
    tags=["logo"],
)

# 그래프를 지연 로딩 (필요할 때만 빌드)
_logo_graph = None

def get_logo_graph():
    """그래프를 지연 로딩 (필요할 때만 빌드)"""
    global _logo_graph
    if _logo_graph is None:
        _logo_graph = build_logo_graph()
    return _logo_graph

@router.post("/intro", response_model=LogoChatResponse, summary="로고 진입 시 브랜드 정보 요약")
def get_logo_intro(
    req: LogoChatRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    로고 에이전트 진입 시 브랜드 정보 요약을 반환하는 엔드포인트.
    
    - 프론트에서 "로고 만들기" 클릭 후 컴포넌트 마운트 시 호출
    - 브랜드 프로필을 LLM으로 요약하여 시스템 메시지처럼 반환
    - project_id만 필요하고 message는 사용하지 않음
    """
    if req.project_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="logo intro 호출 시 project_id 는 필수입니다.",
        )
    
    from app.services.project_service import load_brand_profile_for_agent
    
    try:
        brand_profile = load_brand_profile_for_agent(db, req.project_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    
    # 브랜드 프로필이 비어있거나 필수 정보가 없는 경우
    if not brand_profile or not brand_profile.get("brand_name") or not brand_profile.get("category"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="브랜드 정보가 충분하지 않습니다. 브랜드명과 업종이 필요합니다.",
        )
    
    try:
        brand_summary = summarize_brand_profile_with_llm(brand_profile, mode="logo")
    except Exception as e:
        # LLM 호출 실패 시 기본 요약 생성
        brand_name = brand_profile.get("brand_name", "브랜드")
        category = brand_profile.get("category", "")
        brand_summary = f"{brand_name}은(는) {category} 업종의 브랜드입니다. 로고를 만들어볼까요?"
        # 로그는 남기되 사용자에게는 기본 메시지 반환
        import logging
        logging.error(f"브랜드 요약 생성 실패: {e}")
    
    logo_session_id = req.logo_session_id or str(uuid4())

    return LogoChatResponse(
        reply=brand_summary,
        project_id=req.project_id,
        logo_session_id=logo_session_id,
    )

@router.post("/chat", response_model=LogoChatResponse)
def chat_logo(
    req: LogoChatRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    로고 브리프/생성을 위한 챗봇 엔드포인트.

    - 반드시 project_id 가 있어야 한다.
      (브랜드 챗봇을 통해 이미 생성된 프로젝트/브랜드를 대상으로 하기 때문)
    - 브랜드 챗봇에서 project_id 가 생성된 후,
      같은 화면에서 '로고 만들기'를 선택하면 그 project_id 를 들고 이 엔드포인트를 친다.
    """
    
    # 프로젝트 id 확인
    if req.project_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="logo 챗봇 호출 시 project_id 는 필수입니다.",
        )
    
    # message 확인 (chat 엔드포인트에서는 필수)
    if not req.message or not req.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="logo 챗봇 호출 시 message 는 필수입니다.",
        )
#----------------------------------------25-12-04 레퍼런스 이미지 처리--------------------------------
    reference_images = req.reference_images or []
    if len(reference_images) > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="레퍼런스 이미지는 최대 6개까지 가능합니다."
        )
#------------------------------------------------------------------------
    
    # TODO: logo 에이전트 호출
    from app.services.project_service import load_brand_profile_for_agent
    brand_profile = load_brand_profile_for_agent(db, req.project_id)

    logo_session_id = req.logo_session_id or str(uuid4())

    state: AppState = {
        "messages": [HumanMessage(content=req.message)],
        "mode": "logo",
        "project_id": req.project_id,
        "project_draft": {},         
        "brand_profile": brand_profile,
        "trend_context": {},
        #----------------------------------------25-12-04 레퍼런스 이미지 처리--------------------------------
        "logo_state": {
            "reference_images": reference_images,
        },
        #------------------------------------------------------------------------
        "meta": {},
    }

    new_state = get_logo_graph().invoke(
        state,
        config={"configurable": {
            "thread_id": f"user-{current_user.id}-project-{req.project_id}-logo-{logo_session_id}"
        }},
    )

    messages = new_state["messages"]
    last_msg = messages[-1]
    reply_text = getattr(last_msg, "content", str(last_msg))

    return LogoChatResponse(
        reply=reply_text,
        project_id=req.project_id,
        logo_session_id=logo_session_id,
    )

@router.post("/save", response_model=SaveLogoResponse, summary="로고 저장")
def save_logo_endpoint(
    req: SaveLogoRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    생성된 로고를 NCP Object Storage에 업로드하고 DB에 저장
    """
    if not req.project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="project_id는 필수입니다."
        )
    
    try:
        prod = save_logo_to_storage_and_db(
            db=db,
            base64_image=req.base64_image,
            project_id=req.project_id,
            prod_type_id=req.prod_type_id or 1,
            user_id=current_user.id,
        )
        
        from app.utils.file_utils import get_file_url
        file_url = get_file_url(prod.file_path)
        
        return SaveLogoResponse(
            success=True,
            message="로고가 성공적으로 저장되었습니다.",
            prod_id=prod.prod_id,
            file_path=prod.file_path,
            file_url=file_url,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"로고 저장 실패: {str(e)}"
        )

@router.get("/list", response_model=List[LogoListItemResponse], summary="로고 목록 조회")
def get_logo_list_endpoint(
    project_id: int,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    프로젝트의 저장된 로고 목록 조회
    
    - project_id: 프로젝트 그룹 ID (query parameter)
    - 현재 로그인한 사용자가 생성한 프로젝트의 로고만 조회 가능
    """
    # 프로젝트 접근 권한 확인
    from app.services.project_service import load_project_group_entity
    
    project = load_project_group_entity(db, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="프로젝트를 찾을 수 없습니다.",
        )
    
    # 본인이 생성한 프로젝트인지 확인
    if project.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="접근 권한이 없습니다.",
        )
    
    # 로고 목록 조회
    logo_list = get_logo_list(db=db, project_id=project_id, prod_type_id=1)
    
    # 응답 모델로 변환
    result = []
    for prod in logo_list:
        file_url = get_file_url(prod.file_path)
        result.append(LogoListItemResponse(
            prod_id=prod.prod_id,
            file_path=prod.file_path,
            file_url=file_url,
            create_dt=prod.create_dt.isoformat() if prod.create_dt else None,
            pub_yn=prod.pub_yn,
        ))
    
    return result

@router.delete("/{prod_id}", summary="로고 삭제")
def delete_logo_endpoint(
    prod_id: int,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    로고 삭제 (소프트 삭제)
    
    - prod_id: 삭제할 로고의 생성물 ID (path parameter)
    - 본인이 생성한 로고만 삭제 가능
    """
    try:
        delete_logo(
            db=db,
            prod_id=prod_id,
            user_id=current_user.id,
        )
        
        return {
            "success": True,
            "message": "로고가 삭제되었습니다."
        }
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"로고 삭제 실패: {str(e)}"
        )


@router.patch("/{prod_id}/pub-yn", response_model=UpdateLogoPubYnResponse, summary="로고 공개 여부 업데이트")
def update_logo_pub_yn_endpoint(
    prod_id: int,
    req: UpdateLogoPubYnRequest,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    로고 공개 여부 업데이트 (PUB_YN)
    
    - prod_id: 업데이트할 로고의 생성물 ID (path parameter)
    - pub_yn: 공개 여부 ('Y' 또는 'N') (body)
    - 본인이 생성한 로고만 수정 가능
    """
    try:
        updated_prod = update_logo_pub_yn(
            db=db,
            prod_id=prod_id,
            pub_yn=req.pub_yn,
            user_id=current_user.id,
        )
        
        return UpdateLogoPubYnResponse(
            success=True,
            message="공개 여부가 업데이트되었습니다.",
            prod_id=updated_prod.prod_id,
            pub_yn=updated_prod.pub_yn,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"공개 여부 업데이트 실패: {str(e)}"
        )


@router.get("/{prod_id}/download", summary="로고 다운로드")
def download_logo(
    prod_id: int,
    db: Session = Depends(get_orm_session),
    current_user: UserInfo = Depends(get_current_user),
):
    """
    로고 파일 다운로드 (CORS 우회를 위한 프록시)
    - NCP Object Storage에서 파일을 가져와서 프론트엔드로 전달
    """
    try:
        # DB에서 로고 정보 조회
        prod = (
            db.query(GenerationProd)
            .filter(
                GenerationProd.prod_id == prod_id,
                GenerationProd.type_id == 1,  # 로고 타입
                GenerationProd.del_yn == 'N'
            )
            .first()
        )
        
        if not prod:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="로고를 찾을 수 없습니다."
            )
        
        # 권한 확인 (본인이 생성한 로고만 다운로드 가능)
        if prod.create_user != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="다운로드 권한이 없습니다."
            )
        
        # 파일 경로 가져오기
        file_path = prod.file_path
        if not file_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="파일 경로를 찾을 수 없습니다."
            )
        
        # URL에서 상대 경로 추출 (이미 상대 경로면 그대로 사용)
        relative_path = get_file_path_from_url(file_path) or file_path
        
        # NCP Object Storage에서 파일 다운로드
        try:
            s3_client = boto3.client(
                's3',
                aws_access_key_id=settings.ncp_access_key,
                aws_secret_access_key=settings.ncp_secret_key,
                endpoint_url=settings.ncp_endpoint,
                region_name=settings.ncp_region,
                config=Config(signature_version='s3v4')
            )
            
            # S3 키 생성 (앞의 "/" 제거)
            s3_key = relative_path.lstrip("/")
            
            # 파일 다운로드
            response = s3_client.get_object(
                Bucket=settings.ncp_bucket_name,
                Key=s3_key
            )
            
            # 파일 내용을 BytesIO로 변환
            file_content = response['Body'].read()
            file_stream = BytesIO(file_content)
            
            # 파일명 추출
            filename = s3_key.split("/")[-1] if "/" in s3_key else s3_key
            if not filename.endswith(".png"):
                filename = f"{filename}.png"
            
            # StreamingResponse로 반환
            return StreamingResponse(
                iter([file_content]),
                media_type="image/png",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"'
                }
            )
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"파일 다운로드 실패: {str(e)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"다운로드 처리 중 오류가 발생했습니다: {str(e)}"
        )    