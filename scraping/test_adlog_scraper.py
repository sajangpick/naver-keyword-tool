"""
ADLOG 스크래핑 테스트
실제로 로그인하고 데이터를 가져올 수 있는지 확인
"""

import os
import sys
import time
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from dotenv import load_dotenv
import json

# 환경변수 로드
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
    print(f"✅ .env 파일 로드 완료")

# ADLOG 로그인 정보
ADLOG_USERNAME = os.getenv('ADLOG_USERNAME')
ADLOG_PASSWORD = os.getenv('ADLOG_PASSWORD')

if not ADLOG_USERNAME or not ADLOG_PASSWORD:
    print("❌ ADLOG 로그인 정보가 없습니다!")
    sys.exit(1)

print(f"👤 로그인 계정: {ADLOG_USERNAME}")

def test_adlog_scraping():
    """ADLOG 스크래핑 테스트"""
    
    # Chrome 옵션 설정
    chrome_options = Options()
    # chrome_options.add_argument('--headless')  # 테스트 시에는 주석 처리
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
    
    driver = None
    
    try:
        print("\n🚀 Chrome 드라이버 시작...")
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)
        driver.implicitly_wait(10)
        print("✅ 드라이버 시작 완료")
        
        # 1. ADLOG 메인 페이지 접속
        print("\n📍 ADLOG 접속 중...")
        driver.get("https://adlog.kr")
        time.sleep(2)
        
        # 현재 페이지 확인
        print(f"현재 URL: {driver.current_url}")
        print(f"페이지 제목: {driver.title}")
        
        # 2. 로그인 페이지로 이동
        print("\n🔐 로그인 시도...")
        
        # 로그인 버튼 찾기 (여러 방법 시도)
        login_methods = [
            # 방법 1: 로그인 링크 텍스트로
            lambda: driver.find_element(By.LINK_TEXT, "로그인"),
            # 방법 2: 부분 텍스트로
            lambda: driver.find_element(By.PARTIAL_LINK_TEXT, "로그인"),
            # 방법 3: 클래스명으로
            lambda: driver.find_element(By.CLASS_NAME, "login"),
            # 방법 4: href 속성으로
            lambda: driver.find_element(By.CSS_SELECTOR, "a[href*='login']"),
        ]
        
        login_clicked = False
        for method in login_methods:
            try:
                login_btn = method()
                login_btn.click()
                login_clicked = True
                print("✅ 로그인 페이지로 이동")
                break
            except:
                continue
        
        # 직접 로그인 URL로 이동
        if not login_clicked:
            print("로그인 버튼을 찾을 수 없어 직접 이동")
            driver.get("https://adlog.kr/login")
        
        time.sleep(2)
        
        # 3. 로그인 폼 입력
        print("\n📝 로그인 정보 입력...")
        
        # ID 입력 (여러 방법 시도)
        id_methods = [
            lambda: driver.find_element(By.NAME, "userid"),
            lambda: driver.find_element(By.NAME, "id"),
            lambda: driver.find_element(By.NAME, "username"),
            lambda: driver.find_element(By.ID, "userid"),
            lambda: driver.find_element(By.ID, "id"),
            lambda: driver.find_element(By.CSS_SELECTOR, "input[type='text']"),
        ]
        
        for method in id_methods:
            try:
                id_input = method()
                id_input.clear()
                id_input.send_keys(ADLOG_USERNAME)
                print("✅ ID 입력 완료")
                break
            except:
                continue
        
        # PW 입력
        pw_methods = [
            lambda: driver.find_element(By.NAME, "passwd"),
            lambda: driver.find_element(By.NAME, "password"),
            lambda: driver.find_element(By.NAME, "pw"),
            lambda: driver.find_element(By.ID, "passwd"),
            lambda: driver.find_element(By.ID, "password"),
            lambda: driver.find_element(By.CSS_SELECTOR, "input[type='password']"),
        ]
        
        for method in pw_methods:
            try:
                pw_input = method()
                pw_input.clear()
                pw_input.send_keys(ADLOG_PASSWORD)
                print("✅ PW 입력 완료")
                # Enter 키로 로그인
                pw_input.send_keys(Keys.RETURN)
                break
            except:
                continue
        
        time.sleep(3)
        
        # 4. 로그인 성공 확인
        print("\n🔍 로그인 상태 확인...")
        current_url = driver.current_url
        print(f"현재 URL: {current_url}")
        
        if "login" not in current_url.lower():
            print("✅ 로그인 성공!")
        else:
            print("⚠️ 로그인 페이지에 머물러 있음")
            
        # 5. 순위 체크 페이지로 이동
        print("\n📊 순위 체크 페이지로 이동...")
        driver.get("https://adlog.kr/adlog/naver_place_rank_check.php")
        time.sleep(2)
        
        # 6. 페이지 내용 확인
        print("\n📄 페이지 분석 중...")
        
        # 테이블 찾기
        tables = driver.find_elements(By.TAG_NAME, "table")
        print(f"테이블 개수: {len(tables)}")
        
        # 입력 폼 찾기
        inputs = driver.find_elements(By.TAG_NAME, "input")
        print(f"입력 필드 개수: {len(inputs)}")
        
        # 스크린샷 저장
        screenshot_path = f"scraping/screenshots/adlog_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        os.makedirs(os.path.dirname(screenshot_path), exist_ok=True)
        driver.save_screenshot(screenshot_path)
        print(f"📸 스크린샷 저장: {screenshot_path}")
        
        # 7. 간단한 검색 테스트
        print("\n🔍 검색 테스트...")
        
        # 검색 입력 필드 찾기
        search_input = None
        for input_field in inputs:
            input_type = input_field.get_attribute("type")
            input_name = input_field.get_attribute("name")
            if input_type == "text" and input_name:
                search_input = input_field
                break
        
        if search_input:
            search_input.clear()
            search_input.send_keys("강남 맛집")
            print("✅ 검색어 입력: 강남 맛집")
            
            # 검색 버튼 찾기
            buttons = driver.find_elements(By.TAG_NAME, "button")
            submit_inputs = driver.find_elements(By.CSS_SELECTOR, "input[type='submit']")
            
            if buttons:
                buttons[0].click()
            elif submit_inputs:
                submit_inputs[0].click()
            else:
                search_input.send_keys(Keys.RETURN)
            
            time.sleep(3)
            
            # 결과 확인
            page_source = driver.page_source
            if "순위" in page_source or "rank" in page_source.lower():
                print("✅ 순위 데이터 발견!")
            else:
                print("⚠️ 순위 데이터를 찾을 수 없음")
        
        print("\n✅ 테스트 완료!")
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        
    finally:
        if driver:
            print("\n🔚 브라우저 종료...")
            driver.quit()

if __name__ == "__main__":
    print("=" * 60)
    print("🧪 ADLOG 스크래핑 테스트")
    print("=" * 60)
    test_adlog_scraping()
