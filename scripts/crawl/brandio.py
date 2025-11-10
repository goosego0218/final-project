import os, time, requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

SAVE_DIR = "notsun_logos"
os.makedirs(SAVE_DIR, exist_ok=True)

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

CATEGORIES = {
    "심볼분리형": "https://www.notsun.net/pf/?c=pf&group1=2&group2=23&bs=",
    "서체형": "https://www.notsun.net/pf/?c=pf&group1=2&group2=24&bs=",
    "캘리그라피": "https://www.notsun.net/pf/?c=pf&group1=2&group2=25&bs=",
    "그림형": "https://www.notsun.net/pf/?c=pf&group1=2&group2=26&bs=",
    "심볼형": "https://www.notsun.net/pf/?c=pf&group1=2&group2=27&bs=",
    "엠블럼": "https://www.notsun.net/pf/?c=pf&group1=2&group2=28&bs=",
    "캐릭터": "https://www.notsun.net/pf/?c=pf&group1=2&group2=29&bs=",
}

options = Options()
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
options.add_argument("--no-sandbox")
options.add_argument("--window-size=1920,1080")

driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
wait = WebDriverWait(driver, 10)


def scroll_to_bottom():
    """스크롤 내려 lazyload 강제 로딩"""
    last_height = driver.execute_script("return document.body.scrollHeight")
    while True:
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(1.0)
        new_height = driver.execute_script("return document.body.scrollHeight")
        if new_height == last_height:
            break
        last_height = new_height


def download_image(url, path):
    if not url.startswith("http"):
        url = "https://www.notsun.net" + url
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code == 200:
            with open(path, "wb") as f:
                f.write(r.content)
            print(f"    ✅ {os.path.basename(path)}")
        else:
            print(f"    ⚠️ 상태코드 {r.status_code}")
    except Exception as e:
        print(f"    ❌ {e}")


for cat_name, cat_url in CATEGORIES.items():
    print(f"\n🚀 카테고리: {cat_name}")
    driver.get(cat_url)
    time.sleep(2)

    # “더보기” 최대 5번만 클릭
    click_count = 0
    while click_count < 5:
        try:
            more_btn = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".portfolio_btn .more")))
            driver.execute_script("arguments[0].scrollIntoView(true);", more_btn)
            time.sleep(0.6)
            driver.execute_script("arguments[0].click();", more_btn)
            click_count += 1
            print(f"  🔄 더보기 클릭 {click_count}/5")
            time.sleep(1.2)
        except Exception:
            print("  ⛔ 더보기 버튼 없음 (또는 더 이상 로딩 불가)")
            break

    scroll_to_bottom()
    time.sleep(1)

    # 로고 div 추출
    boxes = driver.find_elements(By.CSS_SELECTOR, "div.box_content")
    print(f"  🎨 로고 {len(boxes)}개 발견")

    cat_dir = os.path.join(SAVE_DIR, cat_name)
    os.makedirs(cat_dir, exist_ok=True)

    for i, box in enumerate(boxes, 1):
        try:
            img_tag = box.find_element(By.TAG_NAME, "img")
            name_tag = box.find_element(By.TAG_NAME, "p")

            img_url = img_tag.get_attribute("src")
            name = name_tag.text.strip() if name_tag else f"logo_{i}"
            safe_name = "".join(c if c.isalnum() else "_" for c in name)
            path = os.path.join(cat_dir, f"{i:03d}_{safe_name}.jpg")

            download_image(img_url, path)
        except Exception as e:
            print(f"    ⚠️ 스킵 ({e})")

print("\n🎉 모든 카테고리 크롤링 완료!")
driver.quit()
