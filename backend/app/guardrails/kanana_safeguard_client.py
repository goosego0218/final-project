"""
Kanana Safeguard HTTP 클라이언트
GPU 서버로 요청을 보내는 클라이언트
"""

import httpx
from typing import Dict, Optional
from app.core.config import settings


class KananaSafeguardClient:
    """GPU 서버로 HTTP 요청하는 클라이언트 (동기)"""
    
    def __init__(self, base_url: str):
        """
        Args:
            base_url: GPU 서버 URL (예: "http://gpu-server:8001")
        """
        self.base_url = base_url.rstrip("/")
        self.client = httpx.Client(timeout=30.0)
    
    def check(self, text: str, assistant_prompt: str = "") -> Dict[str, any]:
        """
        GPU 서버에 텍스트 안전성 검사 요청 (동기)
        
        Args:
            text: 검사할 텍스트 (사용자 입력)
            assistant_prompt: AI 응답 (선택적, Input 체크 시 빈 문자열)
            
        Returns:
            {
                "is_safe": bool,
                "risk_code": Optional[str],
                "raw_output": str
            }
        """
        try:
            response = self.client.post(
                f"{self.base_url}/guardrails/check",
                json={
                    "text": text,
                    "assistant_prompt": assistant_prompt
                }
            )
            response.raise_for_status()
            return response.json()
        except httpx.TimeoutException:
            print(f"[Kanana Safeguard Client] 타임아웃 발생 (30초 초과)")
            return self._safe_default()
        except httpx.HTTPStatusError as e:
            print(f"[Kanana Safeguard Client] HTTP 오류: {e.response.status_code} - {e.response.text}")
            return self._safe_default()
        except Exception as e:
            print(f"[Kanana Safeguard Client] 요청 실패: {e}")
            return self._safe_default()
    
    def _safe_default(self) -> Dict[str, any]:
        """실패 시 안전하다고 가정 (서비스 중단 방지)"""
        return {
            "is_safe": True,
            "risk_code": None,
            "raw_output": "<SAFE>"
        }
    
    def close(self):
        """클라이언트 종료"""
        self.client.close()


# 싱글톤 인스턴스
_client = None

def get_safeguard_client() -> KananaSafeguardClient:
    """전역 가드레일 클라이언트 인스턴스 (재사용)"""
    global _client
    if _client is None:
        base_url = getattr(settings, 'safeguard_server_url', '')
        if not base_url:
            raise ValueError(
                "safeguard_server_url이 설정되지 않았습니다. "
                ".env 파일에 SAFEGUARD_SERVER_URL을 추가하세요."
            )
        _client = KananaSafeguardClient(base_url)
    return _client

