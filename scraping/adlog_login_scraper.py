"""
ADLOG.KR 로그인 후 네이버 플레이스 순위 스크래핑
Selenium을 사용한 자동 로그인 및 데이터 수집
"""

import os
import time
import json
from datetime import datetime
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup
import pandas as pd
from dotenv import load_dotenv

# 환경변수 로드
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

class AdlogLoginScraper:
    def __init__(self, headless=True):
        """
        초기화
        Args:
            headless: True면 브라우저 창 안 보임 (백그라운드 실행)
        """
        self.base_url = "https://adlog.kr"
        self.login_url = "https://adlog.kr/login"
        self.rank_check_url = "https://adlog.kr/adlog/naver_place_rank_check.php"
        
        # ADLOG 로그인 정보 (환경변수에서 가져오기)
        self.username = os.getenv('ADLOG_USERNAME')
        self.password = os.getenv('ADLOG_PASSWORD')
        
        if not self.username or not self.password:
            print("⚠️ ADLOG 로그인 정보를 .env 파일에 추가해주세요!")
            print("ADLOG_USERNAME=your_username")
            print("ADLOG_PASSWORD=your_password")
        
        # Chrome 옵션 설정
        self.chrome_options = Options()
        if headless:
            self.chrome_options.add_argument('--headless')  # 백그라운드 실행
        self.chrome_options.add_argument('--no-sandbox')
        self.chrome_options.add_argument('--disable-dev-shm-usage')
        self.chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        self.chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        self.chrome_options.add_experimental_option('useAutomationExtension', False)
        
        # User-Agent 설정 (봇 감지 방지)
        self.chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
        
        self.driver = None
        self.logged_in = False
    
    def start_driver(self):
        """웹드라이버 시작"""
        try:
            # ChromeDriver 자동 설치 및 실행
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=self.chrome_options)
            self.driver.implicitly_wait(10)
            print("✅ Chrome 드라이버 시작 완료")
            return True
        except Exception as e:
            print(f"❌ 드라이버 시작 실패: {str(e)}")
            return False
    
    def login(self):
        """ADLOG 자동 로그인"""
        if not self.driver:
            if not self.start_driver():
                return False
        
        try:
            print(f"🔐 ADLOG 로그인 시도...")
            self.driver.get(self.login_url)
            time.sleep(2)
            
            # 로그인 폼 찾기 (실제 HTML 구조에 맞게 수정 필요)
            # 방법 1: ID/PW 입력 필드의 name 속성 사용
            try:
                username_input = self.driver.find_element(By.NAME, "userid")  # 또는 "id", "username" 등
                password_input = self.driver.find_element(By.NAME, "passwd")  # 또는 "password", "pw" 등
            except:
                # 방법 2: ID/PW 입력 필드의 id 속성 사용
                try:
                    username_input = self.driver.find_element(By.ID, "userid")
                    password_input = self.driver.find_element(By.ID, "passwd")
                except:
                    # 방법 3: 클래스나 타입으로 찾기
                    username_input = self.driver.find_element(By.CSS_SELECTOR, "input[type='text']")
                    password_input = self.driver.find_element(By.CSS_SELECTOR, "input[type='password']")
            
            # ID/PW 입력
            username_input.clear()
            username_input.send_keys(self.username)
            time.sleep(1)
            
            password_input.clear()
            password_input.send_keys(self.password)
            time.sleep(1)
            
            # 로그인 버튼 클릭
            try:
                # 방법 1: 버튼 텍스트로 찾기
                login_button = self.driver.find_element(By.XPATH, "//button[contains(text(), '로그인')]")
            except:
                try:
                    # 방법 2: input type=submit 찾기
                    login_button = self.driver.find_element(By.CSS_SELECTOR, "input[type='submit']")
                except:
                    # 방법 3: Enter 키 누르기
                    password_input.send_keys(Keys.RETURN)
                    time.sleep(3)
                    self.logged_in = True
                    print("✅ 로그인 성공!")
                    return True
            
            login_button.click()
            time.sleep(3)
            
            # 로그인 성공 확인 (URL 변경 또는 특정 요소 확인)
            if "login" not in self.driver.current_url.lower():
                self.logged_in = True
                print("✅ 로그인 성공!")
                return True
            else:
                print("❌ 로그인 실패 - ID/PW를 확인해주세요")
                return False
                
        except Exception as e:
            print(f"❌ 로그인 중 오류: {str(e)}")
            return False
    
    def search_place_ranking(self, keyword, place_url=None):
        """
        네이버 플레이스 순위 검색
        
        Args:
            keyword: 검색 키워드 (예: "강남 치킨")
            place_url: 네이버 플레이스 URL (옵션)
        """
        if not self.logged_in:
            if not self.login():
                return []
        
        try:
            print(f"🔍 검색 중: {keyword}")
            
            # 순위 체크 페이지로 이동
            self.driver.get(self.rank_check_url)
            time.sleep(2)
            
            # 검색 폼 입력 (실제 HTML 구조에 맞게 수정 필요)
            try:
                # 키워드 입력
                keyword_input = self.driver.find_element(By.NAME, "keyword")
                keyword_input.clear()
                keyword_input.send_keys(keyword)
                
                # 플레이스 URL 입력 (있는 경우)
                if place_url:
                    url_input = self.driver.find_element(By.NAME, "place_url")
                    url_input.clear()
                    url_input.send_keys(place_url)
                
                # 검색 버튼 클릭
                search_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
                search_button.click()
                
            except Exception as e:
                print(f"검색 폼 입력 실패: {str(e)}")
                # 대체 방법: URL 파라미터로 직접 접근
                search_url = f"{self.rank_check_url}?keyword={keyword}"
                if place_url:
                    search_url += f"&place_url={place_url}"
                self.driver.get(search_url)
            
            time.sleep(3)
            
            # 결과 파싱
            return self.parse_ranking_results()
            
        except Exception as e:
            print(f"❌ 검색 중 오류: {str(e)}")
            return []
    
    def parse_ranking_results(self):
        """검색 결과 파싱"""
        try:
            # 페이지 소스 가져오기
            page_source = self.driver.page_source
            soup = BeautifulSoup(page_source, 'html.parser')
            
            rankings = []
            
            # 테이블 찾기 (실제 HTML 구조에 맞게 수정)
            # 방법 1: 클래스명으로 찾기
            table = soup.find('table', class_='ranking-table')
            if not table:
                # 방법 2: ID로 찾기
                table = soup.find('table', id='ranking-result')
            if not table:
                # 방법 3: 첫 번째 테이블
                table = soup.find('table')
            
            if table:
                rows = table.find_all('tr')[1:]  # 헤더 제외
                
                for idx, row in enumerate(rows[:20], 1):
                    cols = row.find_all('td')
                    
                    if len(cols) >= 2:
                        # 데이터 추출 (실제 구조에 맞게 수정)
                        ranking_data = {
                            'rank': idx,
                            'place_name': cols[1].get_text(strip=True),
                            'place_id': cols[0].get_text(strip=True) if len(cols) > 0 else '',
                            'category': cols[2].get_text(strip=True) if len(cols) > 2 else '',
                            'address': cols[3].get_text(strip=True) if len(cols) > 3 else '',
                            'phone': cols[4].get_text(strip=True) if len(cols) > 4 else '',
                            'search_date': datetime.now().strftime('%Y-%m-%d'),
                            'search_time': datetime.now().strftime('%H:%M:%S')
                        }
                        rankings.append(ranking_data)
                        print(f"  {idx}위: {ranking_data['place_name']}")
            else:
                print("⚠️ 순위 테이블을 찾을 수 없습니다")
                
                # 디버깅: 페이지 내용 일부 출력
                print("페이지 내용 (처음 500자):")
                print(soup.get_text()[:500])
            
            return rankings
            
        except Exception as e:
            print(f"❌ 결과 파싱 오류: {str(e)}")
            return []
    
    def track_multiple_keywords(self, keywords_list):
        """여러 키워드 추적"""
        all_rankings = []
        
        for item in keywords_list:
            if isinstance(item, dict):
                keyword = item.get('keyword', '')
                place_url = item.get('place_url', None)
            else:
                keyword = item
                place_url = None
            
            rankings = self.search_place_ranking(keyword, place_url)
            
            # 키워드 정보 추가
            for ranking in rankings:
                ranking['search_keyword'] = keyword
            
            all_rankings.extend(rankings)
            
            # 과도한 요청 방지
            time.sleep(3)
        
        return all_rankings
    
    def save_screenshot(self, filename=None):
        """현재 페이지 스크린샷 저장 (디버깅용)"""
        if not self.driver:
            return
        
        if not filename:
            filename = f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        
        filepath = f"scraping/screenshots/{filename}"
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        self.driver.save_screenshot(filepath)
        print(f"📸 스크린샷 저장: {filepath}")
    
    def save_to_json(self, data, filename=None):
        """JSON 파일로 저장"""
        if not filename:
            filename = f"adlog_ranking_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        filepath = f"scraping/data/{filename}"
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ JSON 저장: {filepath}")
        return filepath
    
    def save_to_csv(self, data, filename=None):
        """CSV 파일로 저장"""
        if not filename:
            filename = f"adlog_ranking_{datetime.now().strftime('%Y%m%d')}.csv"
        
        filepath = f"scraping/data/{filename}"
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        df = pd.DataFrame(data)
        df.to_csv(filepath, index=False, encoding='utf-8-sig')
        
        print(f"✅ CSV 저장: {filepath}")
        return filepath
    
    def close(self):
        """브라우저 종료"""
        if self.driver:
            self.driver.quit()
            print("✅ 브라우저 종료")


# 사용 예제
if __name__ == "__main__":
    # 스크래퍼 초기화 (headless=False로 하면 브라우저 창이 보임)
    scraper = AdlogLoginScraper(headless=False)
    
    # 로그인 테스트
    if scraper.login():
        print("\n" + "=" * 50)
        print("🎯 순위 검색 테스트")
        print("=" * 50)
        
        # 단일 키워드 검색
        rankings = scraper.search_place_ranking("강남 치킨")
        
        if rankings:
            # 결과 저장
            scraper.save_to_json(rankings)
            scraper.save_to_csv(rankings)
            
            print(f"\n✅ 총 {len(rankings)}개 결과 수집 완료!")
        else:
            print("❌ 검색 결과가 없습니다")
            # 디버깅용 스크린샷
            scraper.save_screenshot("debug_no_results.png")
        
        # 여러 키워드 검색
        print("\n" + "=" * 50)
        print("📊 여러 키워드 검색")
        print("=" * 50)
        
        keywords = [
            {'keyword': '강남 치킨'},
            {'keyword': '서초 카페'},
            {'keyword': '홍대 맛집'}
        ]
        
        all_rankings = scraper.track_multiple_keywords(keywords)
        
        if all_rankings:
            scraper.save_to_json(all_rankings, "all_rankings.json")
            print(f"\n✅ 전체 {len(all_rankings)}개 데이터 수집 완료!")
    
    # 브라우저 종료
    scraper.close()
