"""
Kanana Safeguard 가드레일 모듈
로컬 models 폴더에 모델 저장 및 로드
"""

import os
from pathlib import Path
from typing import Dict, Optional
import torch
from transformers import pipeline

from app.core.config import settings


class KananaSafeguard:
    """
    Kanana Safeguard 모델을 사용한 가드레일 체크
    
    모델은 backend/models/ 폴더에 저장됨
    """
    
    # 모델 매핑
    MODEL_MAP = {
        "general": {
            "hf_name": "kakaocorp/kanana-safeguard-8b",
            "local_name": "kanana-safeguard-8b"
        },
        "siren": {
            "hf_name": "kakaocorp/kanana-safeguard-siren-8b",
            "local_name": "kanana-safeguard-siren-8b"
        },
        "prompt": {
            "hf_name": "kakaocorp/kanana-safeguard-prompt-2.1b",
            "local_name": "kanana-safeguard-prompt-2.1b"
        }
    }
    
    def __init__(
        self,
        model_type: str = "general",
        device: Optional[str] = None
    ):
        """
        Args:
            model_type: "general", "siren", "prompt"
            device: "cuda", "cpu", None (자동 선택)
        """
        self.model_type = model_type
        model_info = self.MODEL_MAP.get(model_type)
        if not model_info:
            raise ValueError(f"Unknown model_type: {model_type}")
        
        # 로컬 모델 경로 (backend/models/)
        backend_dir = Path(__file__).parent.parent.parent
        models_dir = backend_dir / "models"
        local_model_path = models_dir / model_info["local_name"]
        
        # 디바이스 설정
        if device is None:
            self.device = 0 if torch.cuda.is_available() else -1
        else:
            self.device = 0 if device == "cuda" else -1
        
        # 모델이 로컬에 없으면 다운로드
        if not local_model_path.exists():
            print(f"[Kanana Safeguard] 모델이 로컬에 없습니다. 다운로드 시작: {model_info['hf_name']}")
            print(f"[Kanana Safeguard] 저장 위치: {local_model_path}")
            model_path = model_info["hf_name"]
        else:
            print(f"[Kanana Safeguard] 로컬 모델 사용: {local_model_path}")
            model_path = str(local_model_path)
        
        # Pipeline 로드
        try:
            self.pipe = pipeline(
                "text-generation",
                model=model_path,
                device=self.device,
                torch_dtype=torch.float16 if self.device >= 0 else torch.float32,
                return_full_text=False,
                model_kwargs={
                    "cache_dir": str(models_dir)  # 다운로드 시 로컬 경로에 저장
                }
            )
            print(f"[Kanana Safeguard] 모델 로딩 완료 ({model_type})")
        except Exception as e:
            print(f"[Kanana Safeguard] 모델 로딩 실패: {e}")
            raise
    
    def check(self, text: str) -> Dict[str, any]:
        """
        텍스트를 검사하여 안전성 판단
        
        Args:
            text: 검사할 텍스트
            
        Returns:
            {
                "is_safe": bool,
                "risk_code": Optional[str],
                "raw_output": str
            }
        """
        try:
            outputs = self.pipe(
                text,
                max_new_tokens=10,
                do_sample=False,
                return_full_text=False
            )
            
            generated_text = outputs[0]["generated_text"].strip()
            
            # 결과 파싱
            is_safe = generated_text == "<SAFE>"
            risk_code = None
            
            if not is_safe and generated_text.startswith("<UNSAFE-"):
                risk_code = generated_text.replace("<UNSAFE-", "").replace(">", "")
            
            return {
                "is_safe": is_safe,
                "risk_code": risk_code,
                "raw_output": generated_text
            }
        except Exception as e:
            print(f"[Kanana Safeguard] 검사 중 오류: {e}")
            # 오류 발생 시 안전하다고 가정 (서비스 중단 방지)
            return {
                "is_safe": True,
                "risk_code": None,
                "raw_output": "<SAFE>"
            }


# 싱글톤 인스턴스 (선택적, 메모리 효율)
_safeguard_instances = {}

def get_safeguard_instance(model_type: str = "general") -> KananaSafeguard:
    """전역 가드레일 인스턴스 (재사용)"""
    if model_type not in _safeguard_instances:
        _safeguard_instances[model_type] = KananaSafeguard(model_type=model_type)
    return _safeguard_instances[model_type]

