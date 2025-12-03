# 쇼츠 영상 생성 노드
# 작성일: 2025-11-27
# 수정내역
# - 2025-11-27: 초기 작성
# - 2025-12-02: 16초(8초+8초) 연속 생성 및 병합 로직 구현

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

def make_generate_shorts_node(genai_client: "Client | None"):
    """
    생성된 프롬프트로 Veo 3.1 쇼츠 영상 생성 노드 팩토리
    16초(Part 1 + Part 2 Extension) 스토리텔링 지원
    """
    def generate_shorts_node(state: "AppState") -> Command[Literal["__end__"]]:
        """
        shorts_state에 저장된 generated_prompts(2개)로 실제 영상 생성
        Part 1 생성 -> Part 2(Extension) 생성 순서로 진행
        """
        shorts_state = dict(state.get("shorts_state") or {})
        
        # 프롬프트 2개 (Part 1, Part 2) 가져오기
        prompts = shorts_state.get("generated_prompts", [])
        
        # 예외 처리: 프롬프트가 부족할 경우 (기존 단일 프롬프트 호환)
        if len(prompts) < 2:
            single_prompt = shorts_state.get("generated_prompt")
            if single_prompt:
                prompts = [single_prompt]
            else:
                error_msg = AIMessage(content="프롬프트가 생성되지 않았습니다.")
                return Command(update={"messages": [error_msg]}, goto=END)
        
        if genai_client is None:
            error_msg = AIMessage(
                content="영상 생성 기능을 사용할 수 없습니다. Google GenAI API 키를 설정해주세요."
            )
            return Command(update={"messages": [error_msg]}, goto=END)

        config = types.GenerateVideosConfig(
            duration_seconds=settings.veo_duration_seconds, 
            aspect_ratio=settings.veo_aspect_ratio,
            resolution=settings.veo_resolution,
        )
        
        try:
            print("Step 1: Generating Part 1 (기-승: Setup)...")
            op1 = genai_client.models.generate_videos(
                model=settings.veo_model,
                prompt=prompts[0],
                config=config,
            )

            while not op1.done:
                print("Part 1 생성 중...")
                time.sleep(10)
                op1 = genai_client.operations.get(op1)

            video1_result = op1.response.generated_videos[0]
            print("Part 1 생성 완료!")

            # --- [추가] Part 1 결과 파일이 VEO 쪽에서 'processed' 될 때까지 대기 ---
            try:
                print("Part 1 비디오 처리 상태 확인 중...")
                while True:
                    file_info = genai_client.files.get(file=video1_result.video)
                    # SDK 버전에 따라 속성명이 다를 수 있음: state / display_state / processed 등
                    state = getattr(file_info, "state", None) or getattr(
                        file_info, "display_state", None
                    )
                    print(f"Part 1 file state = {state}")
                    # ACTIVE / READY / PROCESSED 계열이면 탈출
                    if state and str(state).upper() in {"ACTIVE", "READY", "PROCESSED"}:
                        break
                    time.sleep(5)
            except Exception as e:
                # 상태 조회 실패해도 그냥 진행 (최악의 경우 예전 동작과 동일)
                print(f"Part 1 파일 상태 조회 중 경고: {e}")

            # 프롬프트가 1개뿐이면 여기서 종료 (8초 영상)
            if len(prompts) == 1:
                final_video_result = video1_result
                print("단일 8초 영상 생성 완료.")
            else:
                print("Step 2: Generating Part 2 (전-결: Resolution) via Extension...")
                op2 = genai_client.models.generate_videos(
                    model=settings.veo_model,
                    video=video1_result.video,  # 처리 완료된 VEO 비디오를 입력
                    prompt=prompts[1],
                    config=config,
                )

                while not op2.done:
                    print("Part 2 (Extension) 생성 중...")
                    time.sleep(10)
                    op2 = genai_client.operations.get(op2)

                final_video_result = op2.response.generated_videos[0]
                print("16초 연속 영상 생성 완료!")

            print("최종 영상 데이터 추출 중...")
            video_bytes = final_video_result.video.video_bytes

            if not video_bytes:
                genai_client.files.download(file=final_video_result.video)
                video_bytes = final_video_result.video.video_bytes

            if not video_bytes:
                error_msg = AIMessage(content="비디오 데이터를 가져올 수 없습니다.")
                return Command(update={"messages": [error_msg]}, goto=END)

            print(f"비디오 데이터 크기: {len(video_bytes)} bytes")

            # Base64 인코딩
            video_base64 = base64.b64encode(video_bytes).decode("utf-8")
            video_data_url = f"data:video/mp4;base64,{video_base64}"

            print(f"Base64 인코딩 완료 (길이: {len(video_base64)})")

            # 프론트로 메시지 전달
            video_duration = "16초" if len(prompts) == 2 else "8초"
            success_msg = AIMessage(
                content=(
                    f"{video_duration} 스토리 영상 생성이 완료되었습니다!\n"
                    f"재생 버튼을 눌러 확인하세요.\n"
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



#######################################꾸꺼###############################################
# def make_generate_shorts_node(genai_client: "Client | None"):
#     """
#     생성된 프롬프트로 Veo 3.1 쇼츠 영상 생성 노드 팩토리
#     """
    
#     def generate_shorts_node(state: "AppState") -> Command[Literal["__end__"]]:
#         """
#         shorts_state에 저장된 generated_prompt로 실제 영상 생성
#         Base64로 인코딩하여 프론트로 직접 전달
#         """
#         shorts_state = dict(state.get("shorts_state") or {})
#         prompt = shorts_state.get("generated_prompt")
        
#         if not prompt:
#             error_msg = AIMessage(content="프롬프트가 생성되지 않았습니다.")
#             return Command(update={"messages": [error_msg]}, goto=END)
        
#         # GenAI 클라이언트 확인
#         if genai_client is None:
#             error_msg = AIMessage(
#                 content="영상 생성 기능을 사용할 수 없습니다. Google GenAI API 키를 설정해주세요."
#             )
#             return Command(update={"messages": [error_msg]}, goto=END)
        
#         # 비디오 생성 설정
#         config = types.GenerateVideosConfig(
#             duration_seconds=settings.veo_duration_seconds,
#             aspect_ratio=settings.veo_aspect_ratio,
#             resolution=settings.veo_resolution,
#         )
        
#         try:
#             # 비디오 생성 요청
#             operation = genai_client.models.generate_videos(
#                 model=settings.veo_model,
#                 prompt=prompt,
#                 config=config,
#             )
            
#             # 비디오 생성 완료 대기
#             while not operation.done:
#                 print("쇼츠 영상 생성 중...")
#                 time.sleep(10)
#                 operation = genai_client.operations.get(operation)
            
#             # 생성된 비디오 데이터 가져오기
#             generated_video = operation.response.generated_videos[0]
#             print(f"비디오 데이터 추출 중...")
            
#             # 비디오 바이트 데이터 가져오기
#             video_bytes = generated_video.video.video_bytes
            
#             if not video_bytes:
#                 # video_bytes가 없으면 다운로드
#                 genai_client.files.download(file=generated_video.video)
#                 video_bytes = generated_video.video.video_bytes
            
#             if not video_bytes:
#                 error_msg = AIMessage(content="비디오 데이터를 가져올 수 없습니다.")
#                 return Command(update={"messages": [error_msg]}, goto=END)
            
#             print(f"비디오 데이터 크기: {len(video_bytes)} bytes")
            
#             # Base64 인코딩
#             video_base64 = base64.b64encode(video_bytes).decode('utf-8')
            
#             # Data URL 생성
#             video_data_url = f"data:video/mp4;base64,{video_base64}"
            
#             print(f"Base64 인코딩 완료 (길이: {len(video_base64)})")
            
#             # 프론트로 메시지 전달
#             success_msg = AIMessage(
#                 content=(
#                     f"쇼츠 영상이 생성되었습니다!\n"
#                     f"재생 버튼을 눌러 큰 화면으로 보거나, 저장 버튼을 눌러 보관함에 저장하세요.\n"
#                     f"[VIDEO_URL]{video_data_url}[/VIDEO_URL]"
#                 )
#             )
            
#             shorts_state["video_url"] = video_data_url
#             shorts_state["video_size_bytes"] = len(video_bytes)
#             shorts_state["video_generated_at"] = time.time()
            
#             return Command(
#                 update={"messages": [success_msg], "shorts_state": shorts_state},
#                 goto=END,
#             )
            
#         except Exception as e:
#             import traceback
#             error_detail = traceback.format_exc()
#             print(f"에러 상세:\n{error_detail}")
#             error_msg = AIMessage(content=f"비디오 생성 중 오류: {str(e)}")
#             return Command(update={"messages": [error_msg]}, goto=END)
    
#     return generate_shorts_node