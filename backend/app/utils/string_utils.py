def list_to_comma_string(items: list[str]) -> str:
    """
    리스트 → 'a,b,c' 형태의 문자열로 변환
    """
    return ",".join(items)


def comma_string_to_list(s: str) -> list[str]:
    """
    'a,b,c' 형태 문자열 → 리스트로 변환
    공백 자동 제거 포함
    """
    if not s:
        return []
    return [x.strip() for x in s.split(",")]