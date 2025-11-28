# 로고 이미지 생성 노드
# 작성일: 2025-11-27
# 수정내역
# - 2025-11-27: 초기 작성

from __future__ import annotations
from typing import TYPE_CHECKING, Literal
import time
import base64

from langgraph.types import Command
from langgraph.graph import END
from langchain_core.messages import AIMessage
from google.genai import types 

from app.core.config import settings

if TYPE_CHECKING:
    from app.agents.state import AppState
    from google.genai import Client


def make_generate_logo_node(genai_client: "Client"):  
    """
    생성된 프롬프트로 Gemini 로고 생성 노드 팩토리
    """
    
    def generate_logo_node(state: "AppState") -> Command[Literal["__end__"]]:
        """
        logo_state에 저장된 generated_prompt로 실제 로고 생성
        Base64로 인코딩하여 프론트로 직접 전달 (쇼츠와 동일)
        """
        logo_state = dict(state.get("logo_state") or {})
        prompt = logo_state.get("generated_prompt")
        
        if not prompt:
            error_msg = AIMessage(content="프롬프트가 생성되지 않았습니다.")
            return Command(update={"messages": [error_msg]}, goto=END)
        
        try:
            print(f"로고 생성 중... (API Key 방식)")
            
            generate_content_config = types.GenerateContentConfig(
                temperature=1,
                top_p=0.95,
                response_modalities=["IMAGE"],
                image_config=types.ImageConfig(
                    aspect_ratio="1:1",
                    image_size="1K",
                    output_mime_type="image/png",
                ),
            )
            
            # Gemini 이미지 생성 호출
            response = genai_client.models.generate_content(
                model=settings.google_genai_model,
                contents=prompt,  
                config=generate_content_config,
            )
            
            print(f"이미지 데이터 추출 중...")
            
            image_bytes = None
            for part in response.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    image_bytes = part.inline_data.data
                    break
                elif hasattr(part, 'file_data') and part.file_data:
                    # 파일 데이터인 경우 다운로드 필요
                    print(f"파일 URI: {part.file_data.file_uri}")
                    # TODO: 파일 다운로드 로직
                else:
                    # as_image() 시도 (PIL Image일 경우)
                    try:
                        import io
                        from PIL import Image
                        img = part.as_image()
                        if img and isinstance(img, Image.Image):
                            img_bytes_io = io.BytesIO()
                            img.save(img_bytes_io, format='PNG')
                            image_bytes = img_bytes_io.getvalue()
                            break
                    except Exception as e:
                        print(f"이미지 변환 실패: {e}")
                        continue
            
            if not image_bytes:
                error_msg = AIMessage(content="이미지 데이터를 가져올 수 없습니다.")
                return Command(update={"messages": [error_msg]}, goto=END)
            
            print(f"이미지 데이터 크기: {len(image_bytes)} bytes")
            
            # Base64 인코딩 
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            
            # Data URL 생성
            logo_data_url = f"data:image/png;base64,{image_base64}"
            
            print(f"Base64 인코딩 완료 (길이: {len(image_base64)})")
            
            # 프론트로 메시지 전달 
            success_msg = AIMessage(
                content=(
                    f"로고가 생성되었습니다!\n\n"
                    f"[LOGO_URL]{logo_data_url}[/LOGO_URL]\n\n"
                    f"저장 버튼을 눌러 보관함에 저장하세요."
                )
            )
            
            logo_state["logo_url"] = logo_data_url
            logo_state["logo_size_bytes"] = len(image_bytes)
            logo_state["logo_generated_at"] = time.time()
            
            return Command(
                update={"messages": [success_msg], "logo_state": logo_state},
                goto=END,
            )
            
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            print(f"로고 생성 오류:\n{error_detail}")
            error_msg = AIMessage(content=f"로고 생성 중 오류: {str(e)}")
            return Command(update={"messages": [error_msg]}, goto=END)
    
    return generate_logo_node