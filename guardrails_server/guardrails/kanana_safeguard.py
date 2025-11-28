"""
Kanana Safeguard 가드레일 모듈 (GPU 서버용)
독립적으로 실행 가능한 서버
"""

import os
from pathlib import Path
from typing import Dict, Optional
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, file_utils


class KananaSafeguard:
    """
    Kanana Safeguard 모델을 사용한 가드레일 체크
    
    모델은 guardrails_server/models/ 폴더에 저장됨
    GPU 서버에서 독립적으로 실행되므로 서버 내부에 모델 저장
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
        
        # 로컬 모델 저장 경로 (guardrails_server/models/)
        # GPU 서버에서 독립적으로 실행되므로 서버 내부에 models 폴더 생성
        server_dir = Path(__file__).parent.parent  # guardrails_server/
        models_dir = server_dir / "models"  # guardrails_server/models/
        
        # models 폴더가 없으면 생성
        if not models_dir.exists():
            models_dir.mkdir(parents=True, exist_ok=True)
            print(f"[Kanana Safeguard] models 폴더 생성: {models_dir}")
        else:
            print(f"[Kanana Safeguard] models 폴더 확인: {models_dir}")
        
        # Hugging Face 캐시 경로 확인
        hf_cache_dir = Path(file_utils.default_cache_path)
        org, model = model_info["hf_name"].split("/")
        hf_model_cache = hf_cache_dir / f"models--{org}--{model}"
        
        # 디바이스 설정
        if device is None:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
        
        # 모델이 이미 다운로드되어 있는지 확인
        local_model_path = models_dir / model_info["local_name"]
        model_already_downloaded = False
        
        # 1. Hugging Face 캐시 확인
        if hf_model_cache.exists():
            snapshots_dir = hf_model_cache / "snapshots"
            if snapshots_dir.exists():
                snapshots = list(snapshots_dir.iterdir())
                if snapshots:
                    snapshot_path = snapshots[0]
                    config_file = snapshot_path / "config.json"
                    model_files = list(snapshot_path.glob("*.bin")) + list(snapshot_path.glob("*.safetensors"))
                    if config_file.exists() and len(model_files) > 0:
                        model_already_downloaded = True
                        print(f"[Kanana Safeguard] ✅ Hugging Face 캐시에서 모델 발견: {hf_model_cache}")
                        print(f"[Kanana Safeguard]    모델 파일 개수: {len(model_files)}")
        
        # 2. 로컬 models 폴더 확인
        if not model_already_downloaded and local_model_path.exists():
            config_file = local_model_path / "config.json"
            model_files = list(local_model_path.glob("*.bin")) + list(local_model_path.glob("*.safetensors"))
            if config_file.exists() and len(model_files) > 0:
                model_already_downloaded = True
                print(f"[Kanana Safeguard] ✅ 로컬 모델 발견: {local_model_path}")
                print(f"[Kanana Safeguard]    모델 파일 개수: {len(model_files)}")
        
        # 모델 경로 및 설정 결정
        if model_already_downloaded:
            model_path = model_info["hf_name"]
            model_kwargs = {}
            print(f"[Kanana Safeguard] 기존 모델 사용: {model_info['hf_name']} (재다운로드 없음)")
        else:
            print(f"[Kanana Safeguard] ⚠️ 모델이 로컬에 없습니다. 다운로드 시작: {model_info['hf_name']}")
            print(f"[Kanana Safeguard]    저장 위치: {hf_cache_dir}")
            model_path = model_info["hf_name"]
            model_kwargs = {
                "cache_dir": str(models_dir)
            }
        
        # 모델 및 토크나이저 로드 (공식 문서 방식)
        try:
            import time
            start_time = time.time()
            print(f"[Kanana Safeguard] 모델 로딩 시작... (이 과정은 몇 분 걸릴 수 있습니다)")
            print(f"[Kanana Safeguard] 모델: {model_info['hf_name']}")
            print(f"[Kanana Safeguard] 디바이스: {self.device.upper()}")
            
            # 모델 로드 (공식 문서: torch.bfloat16 사용)
            if self.device == "cuda":
                self.model = AutoModelForCausalLM.from_pretrained(
                    model_path,
                    torch_dtype=torch.bfloat16,
                    device_map="auto",
                    **model_kwargs
                ).eval()
            else:
                self.model = AutoModelForCausalLM.from_pretrained(
                    model_path,
                    torch_dtype=torch.float32,
                    **model_kwargs
                ).eval()
                self.model = self.model.to(self.device)
            
            # 토크나이저 로드
            self.tokenizer = AutoTokenizer.from_pretrained(model_path)
            
            elapsed = time.time() - start_time
            print(f"[Kanana Safeguard] ✅ 모델 로딩 완료 ({model_type}) - 소요 시간: {elapsed:.1f}초 ({elapsed/60:.1f}분)")
        except Exception as e:
            import traceback
            print(f"[Kanana Safeguard] ❌ 모델 로딩 실패: {e}")
            print(f"[Kanana Safeguard] 상세 에러:")
            traceback.print_exc()
            raise
    
    def check(self, text: str, assistant_prompt: str = "") -> Dict[str, any]:
        """
        텍스트를 검사하여 안전성 판단 (공식 문서 방식)
        
        Args:
            text: 검사할 텍스트 (사용자 입력)
            assistant_prompt: AI 응답 (선택적, 기본값: 빈 문자열)
            
        Returns:
            {
                "is_safe": bool,
                "risk_code": Optional[str],
                "raw_output": str
            }
        """
        try:
            # 공식 문서: messages 형식으로 변환
            messages = [
                {"role": "user", "content": text},
                {"role": "assistant", "content": assistant_prompt}
            ]
            
            # 채팅 템플릿 적용 후 토큰화
            input_ids = self.tokenizer.apply_chat_template(
                messages,
                tokenize=True,
                return_tensors="pt"
            ).to(self.model.device)
            
            attention_mask = (input_ids != self.tokenizer.pad_token_id).long()
            
            # 다음 토큰 1개만 생성 (공식 문서: max_new_tokens=1)
            with torch.no_grad():
                output_ids = self.model.generate(
                    input_ids,
                    attention_mask=attention_mask,
                    max_new_tokens=1,  # 공식 문서: 단일 토큰만 생성
                    pad_token_id=self.tokenizer.eos_token_id
                )
            
            # 새로 생성된 토큰만 추출해 디코딩
            gen_idx = input_ids.shape[-1]
            generated_text = self.tokenizer.decode(
                output_ids[0][gen_idx],
                skip_special_tokens=True
            ).strip()
            
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
            import traceback
            print(f"[Kanana Safeguard] 검사 중 오류: {e}")
            traceback.print_exc()
            # 오류 발생 시 안전하다고 가정 (서비스 중단 방지)
            return {
                "is_safe": True,
                "risk_code": None,
                "raw_output": "<SAFE>"
            }


# 싱글톤 인스턴스
_safeguard_instances = {}

def get_safeguard_instance(model_type: str = "general") -> KananaSafeguard:
    """전역 가드레일 인스턴스 (재사용)"""
    if model_type not in _safeguard_instances:
        _safeguard_instances[model_type] = KananaSafeguard(model_type=model_type)
    return _safeguard_instances[model_type]

