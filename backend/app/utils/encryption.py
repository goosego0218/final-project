# 토큰 암호화/복호화 유틸리티 (AES-256-GCM)
# 작성자: 황민준
# 작성일: 2025-12-XX
# 수정내역
# - 2025-12-XX: 초기 작성
# - 2025-12-XX: Fernet에서 AES-256-GCM으로 변경

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.backends import default_backend
import base64
import os
from typing import Optional
from app.core.config import settings


def _get_encryption_key() -> bytes:
    """
    설정에서 암호화 키를 가져오거나 생성.
    - ENCRYPTION_KEY가 설정되어 있으면 사용
    - 없으면 JWT_SECRET_KEY를 기반으로 생성 (하위 호환성)
    """
    encryption_key = getattr(settings, 'encryption_key', None)
    
    if encryption_key:
        # Base64로 인코딩된 키가 있다면 사용
        try:
            return base64.urlsafe_b64decode(encryption_key.encode())
        except:
            # Base64가 아니면 직접 사용 (32바이트여야 함)
            key_bytes = encryption_key.encode()
            if len(key_bytes) == 32:
                return key_bytes
            # 32바이트가 아니면 PBKDF2로 생성
            return _derive_key_from_secret(encryption_key)
    else:
        # JWT_SECRET_KEY를 기반으로 키 생성
        return _derive_key_from_secret(settings.jwt_secret_key)


def _derive_key_from_secret(secret: str) -> bytes:
    """비밀값을 기반으로 32바이트(256-bit) 키 생성"""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,  # AES-256은 32바이트(256-bit) 키 필요
        salt=b'makery_encryption_salt',  # 고정 salt (프로덕션에서는 랜덤 salt 사용 고려)
        iterations=100000,
        backend=default_backend()
    )
    key = kdf.derive(secret.encode())
    return key


# 싱글톤 암호화 키
_encryption_key: Optional[bytes] = None


def _get_encryption_key_bytes() -> bytes:
    """256-bit 암호화 키 반환 (싱글톤)"""
    global _encryption_key
    if _encryption_key is None:
        _encryption_key = _get_encryption_key()
        # 키 크기 검증 (AES-256은 32바이트 필요)
        if len(_encryption_key) != 32:
            raise ValueError(f"암호화 키는 32바이트(256-bit)여야 합니다. 현재: {len(_encryption_key)}바이트")
    return _encryption_key


def encrypt_token(token: str) -> str:
    """
    토큰 암호화 (AES-256-GCM)
    
    Args:
        token: 평문 토큰
        
    Returns:
        암호화된 토큰 (Base64 인코딩)
        형식: base64(IV(12바이트) + 암호문 + 태그(16바이트))
    """
    if not token:
        return token
    
    key = _get_encryption_key_bytes()
    aesgcm = AESGCM(key)
    
    # IV 생성 (12바이트, GCM 권장 크기)
    iv = os.urandom(12)
    
    # 암호화 (nonce=IV)
    plaintext = token.encode('utf-8')
    ciphertext = aesgcm.encrypt(iv, plaintext, None)
    
    # IV + 암호문 + 태그를 합쳐서 Base64 인코딩
    encrypted_data = iv + ciphertext
    return base64.urlsafe_b64encode(encrypted_data).decode('utf-8')


def decrypt_token(encrypted_token: str) -> str:
    """
    토큰 복호화 (AES-256-GCM)
    
    Args:
        encrypted_token: 암호화된 토큰 (Base64 인코딩)
        
    Returns:
        평문 토큰
    """
    if not encrypted_token:
        return encrypted_token
    
    try:
        key = _get_encryption_key_bytes()
        aesgcm = AESGCM(key)
        
        # Base64 디코딩
        encrypted_data = base64.urlsafe_b64decode(encrypted_token.encode('utf-8'))
        
        # IV 추출 (처음 12바이트)
        if len(encrypted_data) < 12:
            raise ValueError("암호화된 데이터가 너무 짧습니다")
        
        iv = encrypted_data[:12]
        ciphertext = encrypted_data[12:]
        
        # 복호화
        plaintext = aesgcm.decrypt(iv, ciphertext, None)
        return plaintext.decode('utf-8')
    except Exception as e:
        # 복호화 실패 시 원본 반환 (마이그레이션 중일 수 있음)
        print(f"[WARN] 토큰 복호화 실패, 원본 반환: {e}")
        return encrypted_token

