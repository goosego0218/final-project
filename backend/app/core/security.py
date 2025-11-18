# jwt 토큰 생성 및 검증, 비밀번호 해싱 모듈
# 작성자: 황민준
# 작성일: 2025-11-17
# 수정내역
# - 2025-11-17: 초기 작성

from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict

import bcrypt
from jose import jwt, JWTError

from app.core.config import settings

# .env 파일에서 불러온 설정 값
SECRET_KEY = settings.jwt_secret_key
ALGORITHM = settings.jwt_algorithm
ACCESS_TOKEN_EXPIRE_MINUTES = settings.access_token_expire_minutes

# 비밀번호 해싱 및 검증
def get_password_hash(password: str) -> str:
    """
    평문 비밀번호를 bcrypt 해시로 변환한다.
    - 회원가입/비밀번호 변경 시에만 사용.
    - DB에는 절대 평문을 저장하지 않고, 이 함수의 결과(해시값)만 저장한다.
    """
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# 
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    입력된 평문 비밀번호와 DB에 저장된 bcrypt 해시가 일치하는지 검증한다.

    - 로그인 과정에서 사용.
    - 내부적으로 bcrypt.checkpw를 호출하여 True/False 를 반환한다.
    """
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    주어진 payload(data)에 만료 시간(exp) 등을 추가하여 JWT access token을 생성한다.

    Parameters
    ----------
    data : dict
        토큰에 넣을 클레임 데이터. 예: {"sub": user_id, "role_id": 1}
    expires_delta : timedelta, optional
        토큰 유효기간. None이면 기본값(ACCESS_TOKEN_EXPIRE_MINUTES)을 사용.

    Returns
    -------
    str
        인코딩된 JWT 문자열.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)

    if expires_delta is None:
        expires_delta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = now + expires_delta

    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    JWT access token을 디코드하고 서명/만료를 검증한다.

    - 검증에 실패하면 jose.JWTError 또는 하위 예외 발생.
    - 성공하면 payload(dict)를 그대로 반환한다.

    이 함수는 단순히 '검증 + payload 추출' 역할만 담당하고,
    권한 체크/유저 조회는 상위 레이어(auth 서비스, 의존성 함수)에서 처리한다.
    """
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload