"""
ADLOG.KR 네이버 플레이스 순위 스크래핑 스크립트
매일 자동으로 순위 데이터를 수집하여 Supabase에 저장
"""

import requests
from bs4 import BeautifulSoup
import json
import os
from datetime import datetime
from dotenv import load_dotenv
import time
import pandas as pd

# 환경변수 로드
load_dotenv()

class AdlogScraper:
    def __init__(self):
        self.base_url = "https://m.place.naver.com/"
        self.adlog_url = "https://adlog.kr/adlog/naver_place_rank_check.php"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }
        
    def search_place_ranking(self, keyword, location=""):
        """
        특정 키워드로 네이버 플레이스 순위 검색
        
        Args:
            keyword: 검색 키워드 (예: "치킨", "카페")
            location: 지역 (예: "강남", "홍대")
        
        Returns:
            순위 데이터 리스트
        """
        try:
            # ADLOG 검색 파라미터
            search_query = f"{location} {keyword}" if location else keyword
            
            params = {
                'keyword': search_query,
                'type': 'place'  # 플레이스 검색
            }
            
            print(f"🔍 검색중: {search_query}")
            
            # ADLOG API 호출 (실제 URL과 파라미터는 사이트 분석 후 수정 필요)
            response = requests.get(
                self.adlog_url,
                params=params,
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                
                # 순위 데이터 파싱 (실제 HTML 구조에 맞게 수정 필요)
                rankings = []
                
                # 테이블 찾기 (ADLOG 실제 구조에 맞게 수정)
                ranking_table = soup.find('table', class_='ranking-table')
                if not ranking_table:
                    ranking_table = soup.find('table')  # 클래스명 없을 경우
                
                if ranking_table:
                    rows = ranking_table.find_all('tr')[1:]  # 헤더 제외
                    
                    for idx, row in enumerate(rows[:20], 1):  # 상위 20개만
                        cols = row.find_all('td')
                        if len(cols) >= 3:
                            ranking_data = {
                                'rank': idx,
                                'place_name': cols[1].get_text(strip=True),
                                'place_id': cols[0].get_text(strip=True),  # 플레이스 ID
                                'category': cols[2].get_text(strip=True) if len(cols) > 2 else '',
                                'keyword': search_query,
                                'search_date': datetime.now().strftime('%Y-%m-%d'),
                                'search_time': datetime.now().strftime('%H:%M:%S')
                            }
                            rankings.append(ranking_data)
                            print(f"  {idx}위: {ranking_data['place_name']}")
                
                return rankings
            else:
                print(f"❌ 요청 실패: {response.status_code}")
                return []
                
        except Exception as e:
            print(f"❌ 스크래핑 오류: {str(e)}")
            return []
    
    def save_to_json(self, data, filename=None):
        """
        데이터를 JSON 파일로 저장
        """
        if not filename:
            filename = f"adlog_ranking_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        filepath = f"scraping/data/{filename}"
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 저장 완료: {filepath}")
        return filepath
    
    def save_to_csv(self, data, filename=None):
        """
        데이터를 CSV 파일로 저장
        """
        if not filename:
            filename = f"adlog_ranking_{datetime.now().strftime('%Y%m%d')}.csv"
        
        filepath = f"scraping/data/{filename}"
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        df = pd.DataFrame(data)
        df.to_csv(filepath, index=False, encoding='utf-8-sig')
        
        print(f"✅ CSV 저장 완료: {filepath}")
        return filepath
    
    def track_multiple_keywords(self, keywords_list):
        """
        여러 키워드의 순위를 한번에 추적
        
        Args:
            keywords_list: 키워드 리스트
            예: [
                {'keyword': '치킨', 'location': '강남'},
                {'keyword': '카페', 'location': '홍대'},
                {'keyword': '한식', 'location': '서초'}
            ]
        """
        all_rankings = []
        
        for item in keywords_list:
            keyword = item.get('keyword', '')
            location = item.get('location', '')
            
            # 각 키워드 검색
            rankings = self.search_place_ranking(keyword, location)
            all_rankings.extend(rankings)
            
            # API 부하 방지를 위한 딜레이
            time.sleep(2)
        
        return all_rankings
    
    def find_my_restaurant(self, restaurant_name, rankings):
        """
        내 식당의 순위 찾기
        
        Args:
            restaurant_name: 내 식당 이름
            rankings: 전체 순위 데이터
        
        Returns:
            내 식당의 순위 정보
        """
        my_rankings = []
        
        for ranking in rankings:
            if restaurant_name in ranking['place_name']:
                my_rankings.append({
                    'keyword': ranking['keyword'],
                    'rank': ranking['rank'],
                    'date': ranking['search_date']
                })
                print(f"🎯 '{ranking['keyword']}' 검색 시 {ranking['rank']}위!")
        
        if not my_rankings:
            print(f"😢 '{restaurant_name}'을(를) 순위에서 찾을 수 없습니다.")
        
        return my_rankings


# 사용 예제
if __name__ == "__main__":
    # 스크래퍼 초기화
    scraper = AdlogScraper()
    
    # 1. 단일 키워드 검색
    print("=" * 50)
    print("1️⃣ 단일 키워드 검색")
    print("=" * 50)
    rankings = scraper.search_place_ranking("치킨", "강남")
    
    # 2. 여러 키워드 추적
    print("\n" + "=" * 50)
    print("2️⃣ 여러 키워드 추적")
    print("=" * 50)
    keywords_to_track = [
        {'keyword': '치킨', 'location': '강남'},
        {'keyword': '카페', 'location': '홍대'},
        {'keyword': '한식', 'location': '서초'}
    ]
    all_rankings = scraper.track_multiple_keywords(keywords_to_track)
    
    # 3. 데이터 저장
    if all_rankings:
        scraper.save_to_json(all_rankings)
        scraper.save_to_csv(all_rankings)
    
    # 4. 내 식당 순위 찾기
    print("\n" + "=" * 50)
    print("3️⃣ 내 식당 순위 찾기")
    print("=" * 50)
    my_restaurant = "BBQ치킨"  # 예시
    my_ranks = scraper.find_my_restaurant(my_restaurant, all_rankings)
    
    # 5. 결과 요약
    print("\n" + "=" * 50)
    print("📊 오늘의 순위 요약")
    print("=" * 50)
    if my_ranks:
        for rank_info in my_ranks:
            print(f"  • {rank_info['keyword']}: {rank_info['rank']}위")
    
    print(f"\n✅ 총 {len(all_rankings)}개 데이터 수집 완료!")
