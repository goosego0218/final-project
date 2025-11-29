# 쇼츠 관련 엔드포인트
# 작성자: 주후상
# 작성일: 2025-11-21
# 수정내역
# - 2025-11-21: 초기 작성 ( 브랜드요약 생성 )

# backend/app/graphs/nodes/common/brand_summary.py

from app.agents.state import BrandProfile

def summarize_brand_profile_with_llm(
    brand_profile: BrandProfile,
    mode: str = "logo"  # "logo" 또는 "shorts"
) -> str:
    """
    LLM을 사용해 브랜드 프로필을 자연스러운 문장으로 요약.
    
    - 로고/숏폼 에이전트 진입 시 프론트에 표시할 요약 생성
    - mode가 "logo"일 때는 로고 트렌드 섹션 포함
    - mode가 "shorts"일 때는 숏폼 트렌드 섹션 포함
    - 브랜드명과 업종은 무조건 있음 (브랜드 에이전트에서 먼저 수집)
    - 나머지 필드는 있는 것만 포함해서 요약
    
    재사용성:
    - 로고 에이전트, 숏폼 에이전트 둘 다 사용 가능
    - 프론트에서 시스템 메시지 스타일로 표시 가능
    """
    from langchain_core.messages import SystemMessage, HumanMessage
    from app.llm.client import get_fast_chat_model
    
    # 브랜드 프로필을 텍스트로 포맷팅
    # 브랜드명과 업종은 무조건 있음
    profile_lines = [
        f"브랜드명: {brand_profile['brand_name']}",
        f"업종: {brand_profile['category']}",
    ]
    
    # 나머지 필드는 있는 것만 추가
    if brand_profile.get("slogan"):
        profile_lines.append(f"슬로건: {brand_profile['slogan']}")
    
    if brand_profile.get("tone_mood"):
        profile_lines.append(f"톤앤무드: {brand_profile['tone_mood']}")
    
    if brand_profile.get("core_keywords"):
        profile_lines.append(f"핵심 키워드: {brand_profile['core_keywords']}")
    
    if brand_profile.get("target_age"):
        profile_lines.append(f"타깃 연령대: {brand_profile['target_age']}")
    
    if brand_profile.get("target_gender"):
        profile_lines.append(f"타깃 성별: {brand_profile['target_gender']}")
    
    if brand_profile.get("preferred_colors"):
        profile_lines.append(f"선호 색상: {brand_profile['preferred_colors']}")
    
    if brand_profile.get("avoided_trends"):
        profile_lines.append(f"기피 트렌드: {brand_profile['avoided_trends']}")
    
    profile_text = "\n".join(profile_lines)
    
    # LLM을 사용해 요약 생성
    llm = get_fast_chat_model()
    
    # 공통 부분: 브랜드 정보 구조화 및 소개
    common_prompt = """
                    너는 브랜드 정보를 구조화된 형식으로 정리해주는 전문가야.

                    주어진 브랜드 프로필 정보를 바탕으로, 명확하고 읽기 쉬운 구조화된 형식으로 정리해줘.

                    출력 형식:
                    - 반드시 다음 형식을 따라야 함:

                    * 브랜드 정보

                    브랜드명: [브랜드명]
                    업종: [업종]
                    [다른 필드가 있으면 각각 한 줄씩 추가]

                    * 브랜드 소개

                    [브랜드의 정체성과 핵심 특징을 2~3문장으로 자연스럽게 설명]
                    """
    
    # mode에 따라 트렌드 섹션 추가
    if mode == "logo":
        trend_section = """
                    
                    아래는 2024~2025 로고 디자인 트렌드 기준이다.
                    로고 트렌드 섹션을 생성할 때 반드시 이 기준을 참고해라. 
                    기준을 그대로 복사하지 말고, 브랜드 업종/톤/키워드에 맞게 선택적으로 적용해 해석해야 한다.

                    [로고 디자인 트렌드 기준]
                    1) 미니멀 심볼 트렌드
                    - 복잡한 장식 제거, 키 비주얼 중심 구성
                    - 단색 또는 2톤 컬러 조합
                    - 선(line) 기반 아이콘 증가

                    2) 플랫 & 제로 그라데이션
                    - 디지털 환경에서 선명한 플랫 스타일 선호
                    - 무거운 그라데이션과 3D 입체감 지양

                    3) 업종 기반 컬러 코딩
                    - 카페/푸드: 브라운, 크림, 올리브, 테라코타
                    - IT/스타트업: 블루, 퍼플, 네온 포인트
                    - 뷰티/라이프스타일: 로즈, 라벤더, 누드톤

                    4) 모노그램 & 이니셜 활용 증가
                    - 브랜드 이니셜 기반 로고 증가
                    - 간결하고 균형 잡힌 구성 강조

                    5) 세리프 타이포의 부상
                    - 고급스러움 강조를 위한 세리프 타이포 확산
                    - 클래식·모던 조합 선호

                    6) 씬 라인(Thin Line) 스타일
                    - 섬세하고 프리미엄한 인상을 주는 얇은 라인 스타일
                    - 카페, 편집숍, 라이프스타일 브랜드에 적합

                    * 로고 트렌드

                    [브랜드 업종/톤/키워드에 맞는 로고 디자인 트렌드를 3~4개 제안.
                    위의 트렌드 기준을 바탕으로 구체적인 색상, 심벌 형태, 타이포 스타일, 구성 방식 등을 설명.
                    기준 전체를 나열하거나 복사하지 말고 브랜드에 적합한 요소만 선택해 설명.]
                    """
    else:  # mode == "shorts"
        trend_section = """
                    
                    아래는 2024~2025 쇼츠/숏폼 영상 트렌드 기준이다.
                    숏폼 트렌드 섹션을 생성할 때 반드시 이 기준을 참고해라.
                    기준을 그대로 복사하지 말고, 브랜드 업종/톤/키워드와 타깃에 맞게 선택적으로 적용해 해석해야 한다.

                    [숏폼 트렌드 기준]

                    1) 짧고 핵심이 먼저 나오는 HOOK 구조
                    - 1~3초 안에 시선을 끄는 장면, 문구, 사운드를 배치
                    - 문제 제기 → 해결, 전/후 비교, 궁금증 유발형 훅 선호
                    - 스킵 방지를 위해 초반 3초 내에 브랜드 맥락을 암시

                    2) 세로형 풀스크린 & 모바일 최적화
                    - 9:16 비율, 풀스크린 구도를 기본으로 설계
                    - 텍스트는 중앙/상단에 크게, 하단은 자막과 CTA 배치
                    - 소리를 끄고 보더라도 이해 가능한 자막/텍스트 구성

                    3) 진짜 같은 로우파이(Lo-fi) & 브이로그 감성
                    - 과도한 광고 느낌보다, 실제 사용 후기·하루 브이로그 톤 선호
                    - 인물 시점, 손샷(POV), 일상 공간을 활용한 자연스러운 구도
                    - 과한 이펙트보다 자연광, 실제 공간, 현실적인 상황 연출

                    4) 마이크로 튜토리얼 & 꿀팁 포맷
                    - 15~30초 안에 끝나는 How-to, Before/After, 체크리스트 포맷
                    - "3가지", "이렇게만 해도", "이 한 가지로" 같은 리스트형 구조
                    - 브랜드 제품/서비스를 자연스럽게 해결책에 녹여 넣기

                    5) 밈(Meme)·트렌드 사운드 활용 (브랜드 톤에 맞는 선별 사용)
                    - TikTok/Reels/쇼츠에서 유행하는 사운드, 밈 포맷을 변형 활용
                    - 브랜드 이미지와 맞지 않는 과도한 밈·자극적 유행은 피함
                    - 타깃 연령대에 맞는 레퍼런스를 선택해 과하지 않게 적용

                    6) 반복 시청을 유도하는 리듬감 있는 편집
                    - 비트에 맞춘 컷 전환, 루프 가능한 엔딩 구성
                    - 짧은 텍스트 + 빠른 장면 전환으로 정보 밀도를 높임
                    - 10~20초 내에 한 번에 이해 가능하지만, 두 번 이상 보게 만드는 구조

                    * 숏폼 트렌드

                    [브랜드 업종/톤/키워드/타깃 연령대에 맞는 숏폼 영상 트렌드를 3~4개 제안.
                    플랫폼(YouTube 쇼츠 / 인스타 릴스 / TikTok 등)과 어울리는 길이, 훅 구조, 연출 방식,
                    텍스트/자막 스타일, 음악/사운드 방향, 촬영 구도 등을 구체적으로 설명.
                    위의 트렌드 기준을 바탕으로 브랜드에 적합한 요소만 선별해 제안하고,
                    단순 나열이 아니라 "콘텐츠 콘셉트 제안"처럼 풀어서 설명.]
                    """
    
    # 공통 프롬프트 + mode별 트렌드 섹션 결합
    system_prompt = common_prompt + trend_section + """
                    
                    규칙:
                    - "브랜드 정보" 섹션에는 있는 필드만 나열 (없는 필드는 생략)
                    - 필드명은 정확히 지정된 형식 사용
                    - "브랜드 소개"는 자연스러운 한국어 문단으로 작성 (2~3문장)
                    """ + ("""
                    - "로고 트렌드"는 구체적이고 실제 디자이너 제안처럼 작성
                    """ if mode == "logo" else """
                    - "숏폼 트렌드"는 실제 마케터/영상 디렉터의 제안처럼 구체적으로 작성
                    """) + """
                    - 기준 텍스트를 그대로 복사하지 말고, 브랜드에 맞춰 재해석할 것
                    - 불필요한 이모지나 특수문자는 사용하지 말고 깔끔한 텍스트로만 작성
                    - 마크다운 형식의 "*"는 반드시 사용해야 함
                    """
    
    user_prompt = f"""

                    다음 브랜드 프로필 정보를 요약해줘:

                    {profile_text}
                    """
    
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]
    
    ai_msg = llm.invoke(messages)
    summary = ai_msg.content.strip()
    
    return summary