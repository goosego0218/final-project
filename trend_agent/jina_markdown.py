import os
import json
import requests
from dotenv import load_dotenv
load_dotenv()



def load_urls_from_file(filepath: str) -> list:
    """텍스트 파일에서 URL 리스트 읽기"""
    with open(filepath, "r", encoding="utf-8") as f:
        urls = [line.strip() for line in f if line.strip() and line.strip().startswith("http")]
    
    print(f"✅ {len(urls)}개 URL 로드")
    for i, url in enumerate(urls):
        print(f"  [{i+1}] {url}")
    
    return urls

# URL 로드
urls = load_urls_from_file("url.txt")


def crawl_with_jina(urls: list, save_dir: str = "./markdown_files"):
    """Jina Reader로 URL을 마크다운으로 변환"""
    
    os.makedirs(save_dir, exist_ok=True)
    url_mapping = {}
    
    for i, url in enumerate(urls):
        print(f"\n[{i+1}/{len(urls)}] 크롤링: {url}")
        
        jina_url = f"https://r.jina.ai/{url}"
        
        try:
            response = requests.get(
                jina_url,
                headers={"Accept": "text/markdown"},
                timeout=90
            )
            
            if response.status_code == 200:
                filename = f"article_{i+1}.md"
                filepath = os.path.join(save_dir, filename)
                
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(response.text)
                
                url_mapping[filename] = url
                print(f"  ✓ 저장: {filename}")
            else:
                print(f"  ✗ 실패: {response.status_code}")
        except Exception as e:
            print(f"  ✗ 에러: {e}")
    
    # URL 매핑 저장
    mapping_path = os.path.join(save_dir, "url_mapping.json")
    with open(mapping_path, "w", encoding="utf-8") as f:
        json.dump(url_mapping, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 완료: {len(url_mapping)}개 파일")
    print(f"✅ 매핑 저장: {mapping_path}")
    
    return url_mapping


if __name__ == "__main__":
    urls = load_urls_from_file("url.txt")
    url_mapping = crawl_with_jina(urls, save_dir="./markdown_files")

    print("\n=== 요약 ===")
    print(f"총 {len(url_mapping)}개 마크다운 생성 완료")
    for filename, url in url_mapping.items():
        print(f"  {filename} ← {url}")