# src/brandbot/vector/indexers.py
"""
벡터 DB 인덱싱 (FAISS/Chroma)
"""
import json
import os
from typing import List, Dict, Any, Optional
from brandbot.config import SETTINGS

def upsert_vector(
    namespace: str,
    documents: List[Dict[str, Any]],
    backend: str = "faiss",
    embedding_model: str = "text-embedding-3-small",
) -> None:
    """
    벡터 DB에 문서 업서트 (기존 함수 호환)
    """
    if backend == "chroma":
        upsert_to_chroma(namespace, documents, embedding_model)
    elif backend == "faiss":
        upsert_to_faiss(namespace, documents, embedding_model)
    else:
        raise ValueError(f"Unknown backend: {backend}")

def upsert_to_chroma(
    namespace: str,
    documents: List[Dict[str, Any]],
    embedding_model: str = "text-embedding-3-small",
) -> None:
    """Chroma에 문서 저장"""
    try:
        import chromadb
        from chromadb.config import Settings
        
        # Chroma 클라이언트 초기화
        client = chromadb.PersistentClient(
            path="./vectordb/chroma",
            settings=Settings(anonymized_telemetry=False)
        )
        
        # 컬렉션 가져오기 또는 생성
        collection = client.get_or_create_collection(
            name=namespace,
            metadata={"embedding_model": embedding_model}
        )
        
        # 문서 변환 및 저장
        ids = []
        texts = []
        metadatas = []
        
        for doc in documents:
            doc_id = doc.get("doc_id") or f"{namespace}_{len(ids)}"
            text = doc.get("text") or ""
            metadata = doc.get("metadata") or {}
            
            # project_id를 metadata에 추가
            if "project_id" in doc:
                metadata["project_id"] = doc["project_id"]
            
            ids.append(doc_id)
            texts.append(text)
            metadatas.append(metadata)
        
        if ids:
            collection.upsert(
                ids=ids,
                documents=texts,
                metadatas=metadatas
            )
            
    except ImportError:
        raise ImportError("chromadb가 설치되지 않았습니다. pip install chromadb")
    except Exception as e:
        raise RuntimeError(f"Chroma 저장 실패: {e}")

def upsert_to_faiss(
    namespace: str,
    documents: List[Dict[str, Any]],
    embedding_model: str = "text-embedding-3-small",
) -> None:
    """FAISS에 문서 저장 (기존 호환)"""
    # FAISS 구현은 필요시 추가
    pass

def save_state_to_chroma(
    project_id: str,
    state: Dict[str, Any],
    embedding_model: str = "text-embedding-3-small",
) -> None:
    """
    확정된 state를 Chroma 벡터 DB에 저장합니다.
    state를 JSON으로 직렬화하여 비정형 데이터로 벡터화하여 저장합니다.
    
    Chroma는 자동으로 임베딩을 생성하지만, 명시적으로 OpenAI embedding을 사용하려면
    Chroma의 OpenAIEmbeddingFunction을 사용할 수 있습니다.
    """
    print(f"[DBG][save_state_to_chroma:start] project_id={project_id}, embedding_model={embedding_model}")
    try:
        import chromadb
        from chromadb.config import Settings
        
        # Chroma 클라이언트 초기화
        client = chromadb.PersistentClient(
            path="./vectordb/chroma",
            settings=Settings(anonymized_telemetry=False)
        )
        
        # state를 필요한 필드만 포함하여 직렬화
        draft = state.get("brand_draft") or {}
        state_to_save = {
            "brand": {
                "name": draft.get("name"),
                "industry": draft.get("industry"),
                "tone": draft.get("tone"),
                "keywords": draft.get("keywords"),
                "target_age": draft.get("target_age"),
                "target_gender": draft.get("target_gender"),
                "avoid_trends": draft.get("avoid_trends"),
                "slogan": draft.get("slogan"),
                "colors": draft.get("colors"),
            },
            "created_at": state.get("created_at"),
        }
        state_text = json.dumps(state_to_save, ensure_ascii=False, default=str)
        
        # OpenAI embedding function 사용
        from chromadb.utils import embedding_functions
        
        embedding_function = embedding_functions.OpenAIEmbeddingFunction(
            api_key=SETTINGS.openai_api_key,
            model_name=embedding_model
        )
        
        # 프로젝트별 컬렉션 가져오기 또는 생성
        collection_name = f"project_state_{project_id}"
        collection = client.get_or_create_collection(
            name=collection_name,
            embedding_function=embedding_function,  # OpenAI embedding 사용
            metadata={"embedding_model": embedding_model, "type": "project_state"}
        )
        
        # 프로젝트 state를 하나의 문서로 저장
        # Chroma가 자동으로 state_text를 벡터로 변환하여 저장
        doc_id = f"{project_id}_state"
        state_size = len(state_text)
        collection.upsert(
            ids=[doc_id],
            documents=[state_text],  # 비정형 JSON 텍스트가 벡터로 변환됨
            metadatas=[{
                "project_id": project_id,
                "type": "project_state",
                "confirmed": str(state.get("confirmed", False)),
            }]
        )
        
        print(f"[DBG][save_state_to_chroma:success] project_id={project_id}, doc_id={doc_id}, "
              f"state_size={state_size}, collection={collection_name}")
        
    except ImportError:
        print(f"[DBG][save_state_to_chroma:error] project_id={project_id}, error=ImportError")
        raise ImportError("chromadb가 설치되지 않았습니다. pip install chromadb")
    except Exception as e:
        print(f"[DBG][save_state_to_chroma:error] project_id={project_id}, error={type(e).__name__}, message={str(e)}")
        raise RuntimeError(f"Chroma state 저장 실패: {e}")

def load_state_from_chroma(
    project_id: str,
    embedding_model: str = "text-embedding-3-small",
) -> Optional[Dict[str, Any]]:
    """
    Chroma 벡터 DB에서 확정된 state를 불러옵니다.
    """
    print(f"[DBG][load_state_from_chroma:start] project_id={project_id}, embedding_model={embedding_model}")
    try:
        import chromadb
        from chromadb.config import Settings
        from chromadb.utils import embedding_functions
        
        # Chroma 클라이언트 초기화
        client = chromadb.PersistentClient(
            path="./vectordb/chroma",
            settings=Settings(anonymized_telemetry=False)
        )
        
        # 프로젝트별 컬렉션 가져오기 (같은 embedding function 사용)
        collection_name = f"project_state_{project_id}"
        try:
            # 저장 시 사용한 것과 동일한 embedding function 사용
            embedding_function = embedding_functions.OpenAIEmbeddingFunction(
                api_key=SETTINGS.openai_api_key,
                model_name=embedding_model
            )
            collection = client.get_collection(
                name=collection_name,
                embedding_function=embedding_function
            )
        except Exception as e:
            print(f"[DBG][load_state_from_chroma:collection_not_found] project_id={project_id}, error={type(e).__name__}")
            return None
        
        # state 문서 불러오기
        doc_id = f"{project_id}_state"
        results = collection.get(
            ids=[doc_id],
            include=["documents", "metadatas"]
        )
        
        if not results["documents"]:
            print(f"[DBG][load_state_from_chroma:not_found] project_id={project_id}")
            return None
        
        # JSON 역직렬화
        state_text = results["documents"][0]
        state = json.loads(state_text)
        
        print(f"[DBG][load_state_from_chroma:success] project_id={project_id}, "
              f"state_size={len(state_text)}, has_brand_draft={'brand_draft' in state}")
        
        return state
        
    except ImportError:
        print(f"[DBG][load_state_from_chroma:error] project_id={project_id}, error=ImportError")
        raise ImportError("chromadb가 설치되지 않았습니다. pip install chromadb")
    except Exception as e:
        print(f"[DBG][load_state_from_chroma:error] project_id={project_id}, error={type(e).__name__}, message={str(e)}")
        raise RuntimeError(f"Chroma state 불러오기 실패: {e}")

