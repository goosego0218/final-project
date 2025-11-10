import os, time, requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

SAVE_DIR = "logos"
os.makedirs(SAVE_DIR, exist_ok=True)

BASE_URL = "https://kmong.com/%40%EC%97%AC%EA%B8%B0%EA%B0%80%EB%94%94%EC%9E%90%EC%9D%B8%EB%A7%9B%EC%A7%91/portfolios?category_id=1&page="
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

# ⚙️ Selenium 설정
options = Options()
options.add_argument("--headless")  # 창 안 띄우기
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
options.add_argument("--window-size=1920,1080")

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

for page in range(1, 8):
    url = f"{BASE_URL}{page}"
    print(f"\n[렌더링 중] {url}")
    driver.get(url)
    time.sleep(3)  # JS 로딩 대기 (필요시 2~5초 조절)

    soup = BeautifulSoup(driver.page_source, "html.parser")
    imgs = soup.select("article.group img")

    print(f"  ▶ {len(imgs)}개의 로고 발견")

    for i, img in enumerate(imgs, 1):
        img_url = img.get("src")
        if not img_url or "cloudfront" not in img_url:
            continue

        file_name = f"page{page}_{i}.jpg"
        path = os.path.join(SAVE_DIR, file_name)

        try:
            r = requests.get(img_url, headers={"Referer": url, **HEADERS}, timeout=10)
            if r.status_code == 200:
                with open(path, "wb") as f:
                    f.write(r.content)
                print(f"    ✅ {file_name} 저장 완료")
            else:
                print(f"    ⚠️ {file_name} 저장 실패 ({r.status_code})")
        except Exception as e:
            print(f"    ❌ 오류: {e}")

driver.quit()
print("\n🎨 모든 페이지 로고 크롤링 완료!")
