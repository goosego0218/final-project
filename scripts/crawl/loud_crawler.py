import os
import time
import requests
from bs4 import BeautifulSoup
from urllib.parse import quote
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

# ========= 설정 ==========
SEARCH_TERMS = ["빵", "커피", "카페", "베이커리"]
BASE_URL = "https://www.loud.kr/portfolio?category=%EB%A1%9C%EA%B3%A0%2F%EB%B8%8C%EB%9E%9C%EB%94%A9&search="
SAVE_ROOT = "logos"
os.makedirs(SAVE_ROOT, exist_ok=True)

# ========= Selenium 설정 ==========
options = Options()
options.add_argument("--headless")  # 브라우저 안 띄움
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
options.add_argument("--window-size=1920,1080")

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

def scroll_to_bottom(driver, pause=3, max_wait=120):
    """LOUD는 무한스크롤 구조이므로 끝까지 내려가는 함수"""
    last_height = driver.execute_script("return document.body.scrollHeight")
    start_time = time.time()

    while True:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(pause)
        new_height = driver.execute_script("return document.body.scrollHeight")

        # 더 이상 변화가 없거나 너무 오래 걸리면 종료
        if new_height == last_height or (time.time() - start_time > max_wait):
            break
        last_height = new_height


def download_images(search_term):
    """검색어별 썸네일 이미지 다운로드"""
    encoded = quote(search_term)
    url = BASE_URL + encoded
    folder = os.path.join(SAVE_ROOT, search_term)
    os.makedirs(folder, exist_ok=True)

    print(f"\n🔍 '{search_term}' 페이지 접속 중...")
    driver.get(url)
    time.sleep(5)  # 초기 렌더링 대기
    scroll_to_bottom(driver, pause=3.5, max_wait=150)
    time.sleep(5)  # 스크롤 후 이미지 로딩 대기

    # 페이지 HTML 파싱
    soup = BeautifulSoup(driver.page_source, "html.parser")
    imgs = soup.find_all("img")
    print(f"📸 감지된 이미지 수: {len(imgs)}")

    count = 0
    for idx, img in enumerate(imgs):
        src = img.get("src") or img.get("data-src")
        if not src or not src.startswith("http"):
            continue

        alt_text = img.get("alt", "")

        # ======== ✅ 최신 LOUD 구조 대응 필터링 ========
        # 1️⃣ 진짜 포트폴리오 썸네일만 (stunning.kr 경로)
        if "stunning.kr/prod/portfolios" not in src:
            continue

        # 2️⃣ UI/아이콘/배너 등 제외
        if any(x in src for x in ["icon", "badge", "banner", "default", "thumb"]):
            continue

        # 3️⃣ alt에 '로고' 또는 '브랜딩' 단어 포함된 경우만
        if "로고" not in alt_text and "브랜딩" not in alt_text:
            continue
        # ======== ✅ 필터링 끝 ========

        try:
            res = requests.get(src, timeout=10)
            if res.status_code == 200:
                fname = os.path.join(folder, f"{search_term}_{idx+1}.jpg")
                with open(fname, "wb") as f:
                    f.write(res.content)
                count += 1
        except Exception as e:
            print(f"⚠️ {src[:60]}... 실패: {e}")

    print(f"✅ '{search_term}' 완료: {count}개 이미지 저장 ({folder})")


# ========= 실행 ==========
for term in SEARCH_TERMS:
    download_images(term)

driver.quit()
print("\n🎉 모든 검색어 크롤링 완료!")
