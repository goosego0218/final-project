# 쇼츠 영상 생성 노드
# 작성일: 2025-11-27
# 수정내역
# - 2025-11-27: 초기 작성
# - 2025-12-02: 16초(8초+8초) 연속 생성 및 병합 로직 구현
# - 2025-12-04: image-to-video 입력을 Files.upload 대신 Part.from_bytes().as_image() 사용하도록 수정

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

    def _parse_data_url_to_bytes(input_image_data: str) -> tuple[bytes, str]:
        """
        data URL 또는 순수 base64 문자열을 (image_bytes, mime_type)로 변환.
        """
        mime_type = "image/jpeg"  # 기본값

        if "," in input_image_data:
            header, image_data = input_image_data.split(",", 1)
            # 예: header = "data:image/png;base64"
            if header.startswith("data:"):
                # "data:image/png;base64" -> "image/png"
                mime_part = header.split(";")[0]  # "data:image/png"
                _, _, maybe_mime = mime_part.partition(":")  # ("data", ":", "image/png")
                if maybe_mime:
                    mime_type = maybe_mime
        else:
            # "pure base64"라고 보고 jpeg로 가정
            image_data = input_image_data

        image_bytes = base64.b64decode(image_data)
        return image_bytes, mime_type

    def generate_shorts_node(state: "AppState") -> Command[Literal["__end__"]]:
        """
        shorts_state에 저장된 generated_prompts(2개)로 실제 영상 생성
        Part 1 생성 -> Part 2(Extension) 생성 순서로 진행
        """
        shorts_state = dict(state.get("shorts_state") or {})

        input_mode = shorts_state.get("input_mode", "profile_to_video")
        input_image_data = shorts_state.get("input_image_data")  # Base64 또는 data URL

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

        # 공통 config (기본 8초)
        config = types.GenerateVideosConfig(
            duration_seconds=settings.veo_duration_seconds,
            aspect_ratio=settings.veo_aspect_ratio,
            resolution=settings.veo_resolution,
        )

        try:
            print("Step 1: Generating Part 1 (기-승: Setup)...")

            # Part 2에서 last_frame 용으로 재사용할 이미지
            first_image = None

            # ─────────────────────────────
            # 1) 이미지가 있는 경우: image-to-video
            # ─────────────────────────────
            if input_mode == "image_to_video" and input_image_data:
                image_bytes, mime_type = _parse_data_url_to_bytes(input_image_data)
                print(f"[Shorts] image_to_video 모드, mime_type={mime_type}")

                image_part = types.Part.from_bytes(
                    data=image_bytes,
                    mime_type=mime_type,
                )
                first_image = image_part.as_image()

                op1 = genai_client.models.generate_videos(
                    model=settings.veo_model,
                    prompt=prompts[0],
                    image=first_image,
                    config=config,
                )
            else:
                # ──────────────────────
                # 2) 이미지 없는 경우: 텍스트 기반 생성
                # ──────────────────────
                op1 = genai_client.models.generate_videos(
                    model=settings.veo_model,
                    prompt=prompts[0],
                    config=config,
                )

            # Part 1 완료까지 polling
            while not op1.done:
                print("Part 1 생성 중...")
                time.sleep(10)
                op1 = genai_client.operations.get(op1)

            video1_result = op1.response.generated_videos[0]
            print("Part 1 생성 완료!")

            # 프롬프트가 1개뿐이면 여기서 종료 (8초 영상)
            if len(prompts) == 1:
                final_video_result = video1_result
                print("단일 8초 영상 생성 완료.")
            else:
                # ──────────────────────
                # Part 2: Extension (전-결)
                # ──────────────────────
                print("Step 2: Generating Part 2 (전-결: Resolution) via Extension...")

                # 기본 config는 Part 1과 동일
                config_part2 = types.GenerateVideosConfig(
                    duration_seconds=settings.veo_duration_seconds,
                    aspect_ratio=settings.veo_aspect_ratio,
                    resolution=settings.veo_resolution,
                )

                op2 = genai_client.models.generate_videos(
                    model=settings.veo_model,
                    video=video1_result.video,
                    prompt=prompts[1],
                    config=config_part2,
                )

                while not op2.done:
                    print("Part 2 (Extension) 생성 중...")
                    time.sleep(10)
                    op2 = genai_client.operations.get(op2)

                final_video_result = op2.response.generated_videos[0]
                print("16초 연속 영상 생성 완료!")

            # ──────────────────────
            # 최종 비디오 바이트 추출
            # ──────────────────────
            print("최종 영상 데이터 추출 중...")
            video_bytes = final_video_result.video.video_bytes

            if not video_bytes:
                # 파일이 서버에만 있을 때는 download 후 video_bytes 사용
                genai_client.files.download(file=final_video_result.video)
                video_bytes = final_video_result.video.video_bytes

            if not video_bytes:
                error_msg = AIMessage(content="비디오 데이터를 가져올 수 없습니다.")
                return Command(update={"messages": [error_msg]}, goto=END)

            print(f"비디오 데이터 크기: {len(video_bytes)} bytes")

            # Base64 인코딩해서 프론트 전달
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
