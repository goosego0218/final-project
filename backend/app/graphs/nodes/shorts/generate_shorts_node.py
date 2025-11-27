# 쇼츠 영상 생성 노드
# 작성일: 2025-11-27
# 수정내역
# - 2025-11-27: 초기 작성

from __future__ import annotations
from typing import TYPE_CHECKING, Literal
import time
import base64

from google.genai import types
from langgraph.types import Command
from langgraph.graph import END
from langchain_core.messages import AIMessage

from app.core.config import settings

if TYPE_CHECKING:
    from app.agents.state import AppState
    from google.genai import Client

def make_generate_shorts_node(genai_client: "Client"):
    """
    생성된 프롬프트로 Veo 3.1 쇼츠 영상 생성 노드 팩토리
    """
    
    def generate_shorts_node(state: "AppState") -> Command[Literal["__end__"]]:
        """
        shorts_state에 저장된 generated_prompt로 실제 영상 생성
        Base64로 인코딩하여 프론트로 직접 전달
        """
        shorts_state = dict(state.get("shorts_state") or {})
        prompt = shorts_state.get("generated_prompt")
        
        if not prompt:
            error_msg = AIMessage(content="프롬프트가 생성되지 않았습니다.")
            return Command(update={"messages": [error_msg]}, goto=END)
        
        # 비디오 생성 설정
        config = types.GenerateVideosConfig(
            duration_seconds=settings.veo_duration_seconds,
            aspect_ratio=settings.veo_aspect_ratio,
            resolution=settings.veo_resolution,
        )
        
        try:
            # 비디오 생성 요청
            operation = genai_client.models.generate_videos(
                model=settings.veo_model,
                prompt=prompt,
                config=config,
            )
            
            # 비디오 생성 완료 대기
            while not operation.done:
                print("쇼츠 영상 생성 중...")
                time.sleep(10)
                operation = genai_client.operations.get(operation)
            
            # 생성된 비디오 데이터 가져오기
            generated_video = operation.response.generated_videos[0]
            print(f"비디오 데이터 추출 중...")
            
            # 비디오 바이트 데이터 가져오기
            video_bytes = generated_video.video.video_bytes
            
            if not video_bytes:
                # video_bytes가 없으면 다운로드
                genai_client.files.download(file=generated_video.video)
                video_bytes = generated_video.video.video_bytes
            
            if not video_bytes:
                error_msg = AIMessage(content="비디오 데이터를 가져올 수 없습니다.")
                return Command(update={"messages": [error_msg]}, goto=END)
            
            print(f"비디오 데이터 크기: {len(video_bytes)} bytes")
            
            # Base64 인코딩
            video_base64 = base64.b64encode(video_bytes).decode('utf-8')
            
            # Data URL 생성
            video_data_url = f"data:video/mp4;base64,{video_base64}"
            
            print(f"Base64 인코딩 완료 (길이: {len(video_base64)})")
            
            # 프론트로 메시지 전달
            success_msg = AIMessage(
                content=(
                    f"쇼츠 영상이 생성되었습니다!\n"
                    f"재생 버튼을 눌러 큰 화면으로 보거나, 저장 버튼을 눌러 보관함에 저장하세요.\n"
                    f"[VIDEO_URL]{video_data_url}[/VIDEO_URL]"
                )
            )
            
            shorts_state["video_url"] = video_data_url
            shorts_state["video_size_bytes"] = len(video_bytes)
            shorts_state["video_generated_at"] = time.time()
            
            return Command(
                update={"messages": [success_msg], "shorts_state": shorts_state},
                goto=END,
            )
            
        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            print(f"에러 상세:\n{error_detail}")
            error_msg = AIMessage(content=f"비디오 생성 중 오류: {str(e)}")
            return Command(update={"messages": [error_msg]}, goto=END)
    
    return generate_shorts_node