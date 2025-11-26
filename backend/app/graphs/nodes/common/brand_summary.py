# 쇼츠 관련 엔드포인트
# 작성자: 주후상
# 작성일: 2025-11-21
# 수정내역
# - 2025-11-21: 초기 작성 ( 브랜드요약 생성 )

from app.agents.state import BrandProfile

def summarize_brand_profile_with_llm(brand_profile: BrandProfile) -> str:
    """
    LLM을 사용해 브랜드 프로필을 자연스러운 문장으로 요약.
    
    - 로고/숏폼 에이전트 진입 시 프론트에 표시할 요약 생성
    - 시스템 메시지처럼 보이도록 자연스러운 한국어 문단으로 작성
    - 브랜드명과 업종은 무조건 있음 (브랜드 에이전트에서 먼저 수집)
    - 나머지 필드는 있는 것만 포함해서 요약
    
    재사용성:
    - 로고 에이전트, 숏폼 에이전트 둘 다 사용 가능
    - 프론트에서 시스템 메시지 스타일로 표시 가능
    """
    from langchain_core.messages import SystemMessage, HumanMessage
    from app.llm.client import get_chat_model
    
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
    llm = get_chat_model()
    
    system_prompt = """\
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
                    
                    규칙:
                    - "브랜드 정보" 섹션에는 있는 필드만 나열 (없는 필드는 생략)
                    - 필드명은 정확히 "브랜드명:", "업종:", "슬로건:", "톤앤무드:", "핵심 키워드:", "타깃 연령대:", "타깃 성별:", "선호 색상:", "기피 트렌드:" 형식 사용
                    - "브랜드 소개" 섹션은 자연스러운 한국어 문단으로 작성 (2~3문장)
                    - 불필요한 이모지나 특수문자는 사용하지 말고, 깔끔한 텍스트로만 작성
                    - 마크다운 형식의 "*"는 반드시 사용해야 함
                    """
    
    user_prompt = f"""\

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