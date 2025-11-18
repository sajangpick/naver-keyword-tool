"""
ADLOG 전체 데이터 수집 시스템
500개 식당 정보 및 순위 데이터 수집
"""

import os
import sys
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
from supabase import create_client

# 환경변수 로드
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
    print(f"✅ .env 파일 로드 완료")

class AdlogFullScraper:
    def __init__(self, headless=False):
        """초기화"""
        # ADLOG 로그인 정보
        self.username = os.getenv('ADLOG_USERNAME')
        self.password = os.getenv('ADLOG_PASSWORD')
        
        # Supabase 연결
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_ANON_KEY')
        
        if self.supabase_url and self.supabase_key:
            self.supabase = create_client(self.supabase_url, self.supabase_key)
            print("✅ Supabase 연결 성공")
        else:
            self.supabase = None
            print("⚠️ Supabase 연결 실패 - 로컬 저장만 수행")
        
        # Chrome 옵션
        self.chrome_options = Options()
        if headless:
            self.chrome_options.add_argument('--headless')
        self.chrome_options.add_argument('--no-sandbox')
        self.chrome_options.add_argument('--disable-dev-shm-usage')
        self.chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        self.chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        self.chrome_options.add_experimental_option('useAutomationExtension', False)
        self.chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
        
        self.driver = None
        self.logged_in = False
        
        # 수집 데이터
        self.restaurants = []
        self.rankings = []
        
    def start_driver(self):
        """드라이버 시작"""
        try:
            print("🚀 Chrome 드라이버 시작...")
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=self.chrome_options)
            self.driver.implicitly_wait(10)
            print("✅ 드라이버 시작 완료")
            return True
        except Exception as e:
            print(f"❌ 드라이버 시작 실패: {str(e)}")
            return False
    
    def login(self):
        """ADLOG 로그인"""
        if not self.driver:
            if not self.start_driver():
                return False
        
        try:
            print("\n🔐 ADLOG 로그인 중...")
            
            # 1. 메인 페이지 접속
            self.driver.get("https://adlog.kr")
            time.sleep(2)
            
            # 2. 로그인 페이지로 이동
            try:
                login_link = self.driver.find_element(By.LINK_TEXT, "로그인")
                login_link.click()
            except:
                self.driver.get("https://adlog.kr/login")
            
            time.sleep(2)
            
            # 3. 로그인 정보 입력
            # ID 입력
            id_input = None
            for name in ['userid', 'id', 'username']:
                try:
                    id_input = self.driver.find_element(By.NAME, name)
                    break
                except:
                    continue
            
            if not id_input:
                id_input = self.driver.find_element(By.CSS_SELECTOR, "input[type='text']")
            
            id_input.clear()
            id_input.send_keys(self.username)
            
            # PW 입력
            pw_input = None
            for name in ['passwd', 'password', 'pw']:
                try:
                    pw_input = self.driver.find_element(By.NAME, name)
                    break
                except:
                    continue
            
            if not pw_input:
                pw_input = self.driver.find_element(By.CSS_SELECTOR, "input[type='password']")
            
            pw_input.clear()
            pw_input.send_keys(self.password)
            pw_input.send_keys(Keys.RETURN)
            
            time.sleep(3)
            
            # 4. 로그인 성공 확인
            if "login" not in self.driver.current_url.lower():
                self.logged_in = True
                print("✅ 로그인 성공!")
                return True
            else:
                print("❌ 로그인 실패")
                return False
                
        except Exception as e:
            print(f"❌ 로그인 중 오류: {str(e)}")
            return False
    
    def get_restaurant_list(self):
        """500개 식당 목록 가져오기 (페이지네이션 처리)"""
        if not self.logged_in:
            if not self.login():
                return []
        
        try:
            print("\n📊 식당 목록 수집 중 (500개 목표)...")
            
            # 순위 체크 페이지로 이동
            self.driver.get("https://adlog.kr/adlog/naver_place_rank_check.php")
            time.sleep(3)
            
            restaurants = []
            page_num = 1
            max_pages = 10  # 최대 10페이지까지 확인
            
            while page_num <= max_pages:
                print(f"\n📄 {page_num}페이지 수집 중...")
                
                # 현재 페이지 파싱
                soup = BeautifulSoup(self.driver.page_source, 'html.parser')
                
                # 테이블에서 식당 정보 추출
                tables = soup.find_all('table')
                page_restaurants = 0
                
                for table in tables:
                    rows = table.find_all('tr')[1:]  # 헤더 제외
                    for row in rows:
                        cols = row.find_all('td')
                        if len(cols) >= 2:
                            # place URL 추출
                            place_link = row.find('a', href=lambda x: x and 'place.naver.com' in x)
                            if place_link:
                                place_url = place_link.get('href')
                                # place_id 추출
                                if '/restaurant/' in place_url:
                                    place_id = place_url.split('/restaurant/')[-1].split('?')[0]
                                else:
                                    place_id = place_url.split('/')[-1].split('?')[0]
                                
                                # 중복 체크
                                if not any(r['place_id'] == place_id for r in restaurants):
                                # 블로그 수와 방문자리뷰 수 추출
                                blog_count = 0
                                visitor_count = 0
                                n1_score = 0.0
                                n2_score = 0.0
                                n3_score = 0.0
                                
                                # 테이블 컴럼에서 데이터 찾기
                                for idx, col in enumerate(cols):
                                    col_text = col.get_text(strip=True)
                                    
                                    # 블로그/방문자 수 (숫자,숫자 형태)
                                    if ',' in col_text and col_text.replace(',', '').isdigit():
                                        try:
                                            num = int(col_text.replace(',', ''))
                                            if blog_count == 0:
                                                blog_count = num
                                            elif visitor_count == 0:
                                                visitor_count = num
                                        except:
                                            pass
                                    
                                    # N1, N2, N3 점수 (0.XXXXXX 형태)
                                    elif '0.' in col_text:
                                        try:
                                            score = float(col_text)
                                            if 0.56 <= score <= 0.58 and n1_score == 0:  # N1 범위
                                                n1_score = score
                                            elif 0.79 <= score <= 0.83 and n2_score == 0:  # N2 범위
                                                n2_score = score
                                            elif 0.43 <= score <= 0.44 and n3_score == 0:  # N3 범위
                                                n3_score = score
                                        except:
                                            pass
                                
                                restaurant = {
                                    'place_id': place_id,
                                    'place_name': cols[1].get_text(strip=True),
                                    'place_url': f"https://m.place.naver.com/restaurant/{place_id}",
                                    'category': cols[2].get_text(strip=True) if len(cols) > 2 else '',
                                    'address': cols[3].get_text(strip=True) if len(cols) > 3 else '',
                                    'blog_count': blog_count,
                                    'visitor_review_count': visitor_count,
                                    'n1_score': n1_score if n1_score > 0 else None,
                                    'n2_score': n2_score if n2_score > 0 else None,
                                    'n3_score': n3_score if n3_score > 0 else None,
                                    'collected_at': datetime.now().isoformat()
                                }
                                    restaurants.append(restaurant)
                                    page_restaurants += 1
                                    print(f"  📍 {len(restaurants)}. {restaurant['place_name']} (ID: {place_id})")
                
                print(f"  ✅ {page_num}페이지: {page_restaurants}개 식당 수집")
                
                # 500개 도달 시 중단
                if len(restaurants) >= 500:
                    print(f"\n🎯 목표 500개 달성! (현재: {len(restaurants)}개)")
                    break
                
                # 다음 페이지로 이동
                try:
                    # 페이지 번호 클릭 시도
                    next_page = None
                    
                    # 방법 1: 숫자 버튼 찾기
                    page_links = self.driver.find_elements(By.CSS_SELECTOR, "a.page-link, button.page-link")
                    for link in page_links:
                        if link.text.strip() == str(page_num + 1):
                            next_page = link
                            break
                    
                    # 방법 2: "다음" 또는 "더보기" 버튼
                    if not next_page:
                        for text in ['다음', '더보기', 'Next', '>', '>>', '다음 페이지']:
                            try:
                                next_page = self.driver.find_element(By.LINK_TEXT, text)
                                break
                            except:
                                try:
                                    next_page = self.driver.find_element(By.PARTIAL_LINK_TEXT, text)
                                    break
                                except:
                                    continue
                    
                    # 방법 3: 페이지네이션 영역에서 찾기
                    if not next_page:
                        pagination = self.driver.find_element(By.CSS_SELECTOR, ".pagination, .paging, .page-navigation")
                        links = pagination.find_elements(By.TAG_NAME, "a")
                        for link in links:
                            if str(page_num + 1) in link.text:
                                next_page = link
                                break
                    
                    if next_page:
                        self.driver.execute_script("arguments[0].scrollIntoView(true);", next_page)
                        time.sleep(1)
                        next_page.click()
                        time.sleep(3)
                        page_num += 1
                    else:
                        print(f"\n⚠️ 더 이상 페이지가 없습니다. (마지막 페이지: {page_num})")
                        break
                        
                except Exception as e:
                    print(f"\n⚠️ 페이지 이동 실패: {str(e)}")
                    # 더보기 버튼 시도
                    try:
                        more_btn = self.driver.find_element(By.CSS_SELECTOR, "button:contains('더보기'), a:contains('더보기')")
                        more_btn.click()
                        time.sleep(3)
                        page_num += 1
                    except:
                        print("더 이상 페이지를 불러올 수 없습니다.")
                        break
            
            # 추가 방법: Select 박스나 드롭다운에서 식당 목록 추출
            if len(restaurants) < 500:
                try:
                    # select 박스 찾기
                    select_elements = self.driver.find_elements(By.TAG_NAME, "select")
                    for select in select_elements:
                        options = select.find_elements(By.TAG_NAME, "option")
                        for option in options:
                            value = option.get_attribute('value')
                            if value and 'place.naver.com' in value:
                                if '/restaurant/' in value:
                                    place_id = value.split('/restaurant/')[-1].split('?')[0]
                                    if not any(r['place_id'] == place_id for r in restaurants):
                                        restaurants.append({
                                            'place_id': place_id,
                                            'place_name': option.text.strip(),
                                            'place_url': f"https://m.place.naver.com/restaurant/{place_id}",
                                            'collected_at': datetime.now().isoformat()
                                        })
                                        print(f"  📍 {len(restaurants)}. {option.text.strip()} (ID: {place_id})")
                except:
                    pass
            
            self.restaurants = restaurants
            print(f"✅ 총 {len(restaurants)}개 식당 발견")
            
            # 로컬 저장
            self.save_to_json(restaurants, "restaurants_list.json")
            
            return restaurants
            
        except Exception as e:
            print(f"❌ 식당 목록 수집 실패: {str(e)}")
            return []
    
    def search_keyword_ranking(self, keyword):
        """특정 키워드로 순위 검색"""
        if not self.logged_in:
            if not self.login():
                return []
        
        try:
            print(f"\n🔍 '{keyword}' 검색 중...")
            
            # 순위 체크 페이지로 이동
            self.driver.get("https://adlog.kr/adlog/naver_place_rank_check.php")
            time.sleep(2)
            
            # 검색어 입력
            search_input = None
            
            # 여러 방법으로 검색 입력 필드 찾기
            for selector in [
                "input[name='keyword']",
                "input[name='search']",
                "input[name='query']",
                "input[type='text']"
            ]:
                try:
                    search_input = self.driver.find_element(By.CSS_SELECTOR, selector)
                    if search_input.is_displayed():
                        break
                except:
                    continue
            
            if search_input:
                search_input.clear()
                search_input.send_keys(keyword)
                
                # 검색 실행
                try:
                    # Enter 키로 검색
                    search_input.send_keys(Keys.RETURN)
                except:
                    # 버튼 클릭
                    submit_btn = self.driver.find_element(By.CSS_SELECTOR, "input[type='submit']")
                    submit_btn.click()
                
                time.sleep(3)
                
                # 결과 파싱
                soup = BeautifulSoup(self.driver.page_source, 'html.parser')
                
                rankings = []
                rank = 1
                
                # 순위 테이블 파싱
                result_table = soup.find('table', class_='ranking') or soup.find('table')
                if result_table:
                    rows = result_table.find_all('tr')[1:]
                    for row in rows[:20]:  # 상위 20개만
                        cols = row.find_all('td')
                        if len(cols) >= 2:
                            place_name = cols[1].get_text(strip=True)
                            
                            # place_id 찾기
                            place_link = row.find('a', href=lambda x: x and 'place.naver.com' in x)
                            place_id = None
                            if place_link:
                                href = place_link.get('href')
                                if '/restaurant/' in href:
                                    place_id = href.split('/restaurant/')[-1].split('?')[0]
                            
                            # 블로그 수와 방문자리뷰 수 추출
                            blog_count = 0
                            visitor_count = 0
                            
                            # 컴럼에서 숫자 데이터 찾기
                            for idx, col in enumerate(cols):
                                if idx > 2:  # 순위, 이름 이후 컴럼
                                    col_text = col.get_text(strip=True)
                                    if ',' in col_text:
                                        try:
                                            num = int(col_text.replace(',', ''))
                                            if blog_count == 0:
                                                blog_count = num
                                            elif visitor_count == 0:
                                                visitor_count = num
                                        except:
                                            pass
                            
                            ranking_data = {
                                'search_keyword': keyword,
                                'rank': rank,
                                'place_name': place_name,
                                'place_id': place_id,
                                'blog_count': blog_count,
                                'visitor_review_count': visitor_count,
                                'search_date': datetime.now().strftime('%Y-%m-%d'),
                                'search_time': datetime.now().strftime('%H:%M:%S')
                            }
                            rankings.append(ranking_data)
                            print(f"    {rank}위: {place_name}")
                            rank += 1
                
                return rankings
            else:
                print("❌ 검색 입력 필드를 찾을 수 없음")
                return []
                
        except Exception as e:
            print(f"❌ 키워드 검색 실패: {str(e)}")
            return []
    
    def collect_all_rankings(self):
        """모든 키워드로 순위 수집"""
        # Supabase에서 키워드 목록 가져오기
        keywords = []
        
        if self.supabase:
            try:
                result = self.supabase.table('tracking_keywords').select("keyword").eq('is_active', True).execute()
                keywords = [item['keyword'] for item in result.data]
                print(f"📋 {len(keywords)}개 키워드 로드")
            except:
                pass
        
        # 기본 키워드
        if not keywords:
            keywords = [
                "강남 맛집", "강남 치킨", "강남 카페",
                "해운대 맛집", "해운대 고기집",
                "서초 맛집", "송파 맛집"
            ]
        
        all_rankings = []
        
        for keyword in keywords:
            rankings = self.search_keyword_ranking(keyword)
            all_rankings.extend(rankings)
            time.sleep(3)  # API 부하 방지
        
        self.rankings = all_rankings
        print(f"\n✅ 총 {len(all_rankings)}개 순위 데이터 수집 완료")
        
        # 로컬 저장
        self.save_to_json(all_rankings, "rankings_data.json")
        
        return all_rankings
    
    def save_to_database(self):
        """Supabase에 데이터 저장"""
        if not self.supabase:
            print("⚠️ Supabase 연결 없음 - 로컬 저장만 완료")
            return
        
        try:
            print("\n💾 데이터베이스 저장 중...")
            
            # 1. 식당 정보 저장
            if self.restaurants:
                for restaurant in self.restaurants:
                    self.supabase.table('adlog_restaurants').upsert({
                        'place_id': restaurant['place_id'],
                        'place_name': restaurant.get('place_name', ''),
                        'category': restaurant.get('category', ''),
                        'address': restaurant.get('address', ''),
                        'place_url': restaurant.get('place_url', ''),
                        'is_active': True,
                        'updated_at': datetime.now().isoformat()
                    }).execute()
                print(f"  ✅ {len(self.restaurants)}개 식당 저장")
            
            # 2. 순위 데이터 저장
            if self.rankings:
                today = datetime.now().strftime('%Y-%m-%d')
                current_time = datetime.now().strftime('%H:%M:%S')
                
                for ranking in self.rankings:
                    # 식당 ID 조회
                    if ranking.get('place_id'):
                        restaurant = self.supabase.table('adlog_restaurants')\
                            .select("id")\
                            .eq('place_id', ranking['place_id'])\
                            .execute()
                        
                        if restaurant.data:
                            restaurant_id = restaurant.data[0]['id']
                            
                            self.supabase.table('daily_rankings').upsert({
                                'search_date': today,
                                'search_time': current_time,
                                'search_keyword': ranking['search_keyword'],
                                'restaurant_id': restaurant_id,
                                'rank': ranking['rank'],
                                'blog_count': ranking.get('blog_count', 0),
                                'visitor_review_count': ranking.get('visitor_review_count', 0),
                                'reservation_count': ranking.get('reservation_count', 0),
                                'n1_score': ranking.get('n1_score'),
                                'n2_score': ranking.get('n2_score'),
                                'n3_score': ranking.get('n3_score')
                            }).execute()
                
                print(f"  ✅ {len(self.rankings)}개 순위 저장")
            
            print("✅ 데이터베이스 저장 완료!")
            
        except Exception as e:
            print(f"❌ DB 저장 실패: {str(e)}")
    
    def save_to_json(self, data, filename):
        """JSON 파일로 저장"""
        filepath = f"data/{filename}"
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"  💾 로컬 저장: {filepath}")
    
    def save_to_csv(self):
        """CSV 파일로 저장"""
        if self.restaurants:
            df_restaurants = pd.DataFrame(self.restaurants)
            df_restaurants.to_csv('data/restaurants.csv', index=False, encoding='utf-8-sig')
            print(f"  💾 식당 CSV 저장: data/restaurants.csv")
        
        if self.rankings:
            df_rankings = pd.DataFrame(self.rankings)
            df_rankings.to_csv('data/rankings.csv', index=False, encoding='utf-8-sig')
            print(f"  💾 순위 CSV 저장: data/rankings.csv")
    
    def close(self):
        """브라우저 종료"""
        if self.driver:
            self.driver.quit()
            print("✅ 브라우저 종료")
    
    def run_full_collection(self):
        """전체 수집 프로세스 실행"""
        print("\n" + "="*60)
        print("🚀 ADLOG 전체 데이터 수집 시작")
        print("="*60)
        
        # 1. 로그인
        if not self.login():
            print("❌ 로그인 실패로 중단")
            return
        
        # 2. 식당 목록 수집
        self.get_restaurant_list()
        
        # 3. 순위 데이터 수집
        self.collect_all_rankings()
        
        # 4. 데이터 저장
        self.save_to_database()
        self.save_to_csv()
        
        # 5. 요약
        print("\n" + "="*60)
        print("📊 수집 완료 요약")
        print("="*60)
        print(f"  • 식당: {len(self.restaurants)}개")
        print(f"  • 순위 데이터: {len(self.rankings)}개")
        print(f"  • 수집 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*60)


# 실행
if __name__ == "__main__":
    scraper = AdlogFullScraper(headless=False)  # 테스트 시 화면 보기
    
    try:
        scraper.run_full_collection()
    finally:
        scraper.close()
