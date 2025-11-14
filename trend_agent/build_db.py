import os
import re
import json
from typing import List, Tuple

from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from dotenv import load_dotenv


load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MARKDOWN_DIR = r"C:\Users\user\Desktop\trend\markdown_files"
CHROMA_PERSIST_DIR = "./chroma_db_test"

def extract_urls_from_markdown(markdown_text: str) -> Tuple[str, List[dict], List[dict]]:
    """
    마크다운에서 이미지 URL과 링크 URL 추출
    
    Returns:
        (정리된 텍스트, 이미지 리스트, 링크 리스트)
    """
    
    images = []
    links = []
    
    # 이미지: ![설명](URL)
    image_pattern = r'!\[(.*?)\]\((.*?)\)'
    for match in re.finditer(image_pattern, markdown_text):
        images.append({
            "description": match.group(1),
            "url": match.group(2)
        })
    
    # 링크: [텍스트](URL)
    link_pattern = r'(?<!!)\[([^\]]+)\]\(([^\)]+)\)'
    for match in re.finditer(link_pattern, markdown_text):
        links.append({
            "text": match.group(1),
            "url": match.group(2)
        })
    
    # 텍스트 정리
    cleaned = markdown_text
    cleaned = re.sub(r'!\[(.*?)\]\((.*?)\)', r'[이미지: \1]', cleaned)
    cleaned = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'[참고: \1]', cleaned)
    
    return cleaned, images, links


from langchain_community.vectorstores import Chroma

def create_vectorstore(markdown_dir: str, save_path: str = "./chroma_db_test"):
    """마크다운 파일들을 Chroma 벡터 DB로 변환"""
    
    print("\n" + "="*60)
    print("Chroma 벡터 DB 생성")
    print("="*60)
    
    # URL 매핑 로드
    mapping_file = os.path.join(markdown_dir, "url_mapping.json")
    with open(mapping_file, "r", encoding="utf-8") as f:
        url_mapping = json.load(f)
    
    # 파일 로드
    print("\n📂 STEP 1: 파일 로딩...")
    loader = DirectoryLoader(
        markdown_dir,
        glob="*.md",
        loader_cls=TextLoader,
        loader_kwargs={"encoding": "utf-8"}
    )
    documents = loader.load()
    print(f"   ✓ {len(documents)}개 파일")
    
    # 이미지/링크 추출
    print("\n🔗 STEP 2: URL 추출...")
    for doc in documents:
        filename = os.path.basename(doc.metadata.get("source", ""))
        
        # URL 추출 및 텍스트 정리
        cleaned, images, links = extract_urls_from_markdown(doc.page_content)
        doc.page_content = cleaned
        
        # 메타데이터 저장
        doc.metadata.update({
            "filename": filename,
            "source_url": url_mapping.get(filename, ""),
            "images": json.dumps(images, ensure_ascii=False),
            "links": json.dumps(links, ensure_ascii=False),
            "image_count": len(images),
            "link_count": len(links),
        })
        
        print(f"   - {filename}: 이미지 {len(images)}개, 링크 {len(links)}개")
    
    # 헤더 분할
    print("\n✂️  STEP 3: 헤더 분할...")
    headers_to_split_on = [
        ("#", "Header 1"),
        ("##", "Header 2"),
        ("###", "Header 3"),
    ]
    markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on)
    
    md_splits = []
    for doc in documents:
        splits = markdown_splitter.split_text(doc.page_content)
        for split in splits:
            split.metadata.update(doc.metadata)
        md_splits.extend(splits)
    
    print(f"   ✓ {len(md_splits)}개 섹션")
    
    # 크기 조정 + Overlap
    print("\n✂️  STEP 4: 크기 조정 + Overlap...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
    )
    all_splits = text_splitter.split_documents(md_splits) 
    # chunk_id 추가
    for idx, split in enumerate(all_splits):
        split.metadata["chunk_id"] = idx
    
    print(f"   ✓ {len(all_splits)}개 청크")
    
    # Chroma 벡터 DB 생성
    print("\n🔄 STEP 5: Chroma DB 생성...")
    embeddings = OpenAIEmbeddings()
    vectorstore = Chroma.from_documents(
        documents=all_splits,
        embedding=embeddings,
        persist_directory=save_path  # 저장 경로
    )
    
    print(f"   ✓ 저장: {save_path}/")
    print("\n✅ 완료!")
    
    return vectorstore

print("✅ 벡터 DB 생성 함수 정의 완료 (Chroma)")

if __name__ == "__main__":
    vectorstore = create_vectorstore(MARKDOWN_DIR, save_path=CHROMA_PERSIST_DIR)