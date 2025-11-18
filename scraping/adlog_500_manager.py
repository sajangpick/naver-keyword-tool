"""
ADLOG 500개 식당 통합 관리 시스템
모든 등록 식당의 순위를 추적하고 분석
"""

import os
import time
import json
from datetime import datetime, timedelta
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from bs4 import BeautifulSoup
import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

# 환경변수 로드
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)

class Adlog500Manager:
    def __init__(self):
        """500개 식당 관리자 초기화"""
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
            print("⚠️ Supabase 연결 실패")
        
        # 추적할 키워드 목록
        self.keywords = [
            "강남 맛집",
            "강남 치킨",
            "강남 카페",
            "서초 맛집",
            "송파 맛집",
            "역삼 맛집",
            "선릉 맛집",
            "삼성 맛집"
        ]
        
        self.all_restaurants = []  # 500개 식당 정보
        self.today_rankings = []   # 오늘의 순위 데이터
    
    def sync_restaurants_to_db(self, restaurants_data):
        """
        500개 식당 정보를 DB에 동기화
        
        Args:
            restaurants_data: 식당 정보 리스트
        """
        if not self.supabase:
            print("❌ Supabase 연결이 필요합니다")
            return False
        
        try:
            for restaurant in restaurants_data:
                # adlog_restaurants 테이블에 upsert
                self.supabase.table('adlog_restaurants').upsert({
                    'place_id': restaurant.get('place_id'),
                    'place_name': restaurant.get('place_name'),
                    'category': restaurant.get('category'),
                    'address': restaurant.get('address'),
                    'phone': restaurant.get('phone'),
                    'place_url': restaurant.get('place_url'),
                    'is_active': True,
                    'updated_at': datetime.now().isoformat()
                }).execute()
            
            print(f"✅ {len(restaurants_data)}개 식당 정보 동기화 완료")
            return True
            
        except Exception as e:
            print(f"❌ DB 동기화 실패: {str(e)}")
            return False
    
    def save_daily_rankings(self, rankings_data):
        """
        일일 순위 데이터 저장
        
        Args:
            rankings_data: 순위 데이터 리스트
        """
        if not self.supabase:
            return False
        
        try:
            today = datetime.now().strftime('%Y-%m-%d')
            current_time = datetime.now().strftime('%H:%M:%S')
            
            for ranking in rankings_data:
                # 식당 ID 조회
                restaurant = self.supabase.table('adlog_restaurants')\
                    .select("id")\
                    .eq('place_name', ranking['place_name'])\
                    .execute()
                
                if restaurant.data:
                    restaurant_id = restaurant.data[0]['id']
                    
                    # 순위 데이터 저장
                    self.supabase.table('daily_rankings').upsert({
                        'search_date': today,
                        'search_time': current_time,
                        'search_keyword': ranking['search_keyword'],
                        'restaurant_id': restaurant_id,
                        'rank': ranking['rank']
                    }).execute()
            
            print(f"✅ {len(rankings_data)}개 순위 데이터 저장 완료")
            return True
            
        except Exception as e:
            print(f"❌ 순위 저장 실패: {str(e)}")
            return False
    
    def generate_daily_report(self):
        """일일 리포트 생성"""
        if not self.supabase:
            return None
        
        try:
            today = datetime.now().strftime('%Y-%m-%d')
            
            # 오늘의 TOP 20 조회
            top20 = self.supabase.table('today_top20')\
                .select("*")\
                .execute()
            
            # 가장 많이 상승한 식당
            top_gainers = self.supabase.table('daily_rankings')\
                .select("*, adlog_restaurants(place_name)")\
                .eq('search_date', today)\
                .order('rank_change', desc=True)\
                .limit(10)\
                .execute()
            
            # 우리 회원 순위
            member_rankings = self.supabase.table('member_rankings')\
                .select("*")\
                .eq('search_date', today)\
                .execute()
            
            report = {
                'date': today,
                'total_restaurants': 500,
                'tracked_keywords': len(self.keywords),
                'top20': top20.data if top20 else [],
                'top_gainers': top_gainers.data if top_gainers else [],
                'member_rankings': member_rankings.data if member_rankings else [],
                'summary': {
                    'new_entries': 0,  # 신규 진입
                    'big_movers': 0,   # 큰 변동
                    'stable': 0        # 변동 없음
                }
            }
            
            return report
            
        except Exception as e:
            print(f"❌ 리포트 생성 실패: {str(e)}")
            return None
    
    def analyze_competition(self, our_restaurant_name):
        """
        경쟁사 분석
        
        Args:
            our_restaurant_name: 우리 식당 이름
        """
        if not self.supabase:
            return None
        
        try:
            # 우리 식당 정보 조회
            our_restaurant = self.supabase.table('adlog_restaurants')\
                .select("*")\
                .eq('place_name', our_restaurant_name)\
                .execute()
            
            if not our_restaurant.data:
                print(f"❌ '{our_restaurant_name}'을 찾을 수 없습니다")
                return None
            
            our_id = our_restaurant.data[0]['id']
            our_category = our_restaurant.data[0]['category']
            
            # 같은 카테고리 경쟁사 조회
            competitors = self.supabase.table('adlog_restaurants')\
                .select("*")\
                .eq('category', our_category)\
                .neq('id', our_id)\
                .limit(10)\
                .execute()
            
            # 순위 비교
            today = datetime.now().strftime('%Y-%m-%d')
            
            comparison = []
            for competitor in competitors.data:
                # 각 키워드별 순위 비교
                for keyword in self.keywords:
                    our_rank = self.supabase.table('daily_rankings')\
                        .select("rank")\
                        .eq('restaurant_id', our_id)\
                        .eq('search_keyword', keyword)\
                        .eq('search_date', today)\
                        .execute()
                    
                    comp_rank = self.supabase.table('daily_rankings')\
                        .select("rank")\
                        .eq('restaurant_id', competitor['id'])\
                        .eq('search_keyword', keyword)\
                        .eq('search_date', today)\
                        .execute()
                    
                    if our_rank.data and comp_rank.data:
                        comparison.append({
                            'competitor_name': competitor['place_name'],
                            'keyword': keyword,
                            'our_rank': our_rank.data[0]['rank'],
                            'competitor_rank': comp_rank.data[0]['rank'],
                            'we_win': our_rank.data[0]['rank'] < comp_rank.data[0]['rank']
                        })
            
            return comparison
            
        except Exception as e:
            print(f"❌ 경쟁사 분석 실패: {str(e)}")
            return None
    
    def get_trending_restaurants(self, days=7):
        """
        최근 며칠간 가장 핫한 식당 찾기
        
        Args:
            days: 분석 기간 (기본 7일)
        """
        if not self.supabase:
            return None
        
        try:
            start_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
            end_date = datetime.now().strftime('%Y-%m-%d')
            
            # 기간 내 순위 상승률이 높은 식당
            trending = self.supabase.table('ranking_statistics')\
                .select("*, adlog_restaurants(place_name, category)")\
                .eq('period_type', 'weekly')\
                .gte('period_start', start_date)\
                .lte('period_end', end_date)\
                .order('times_in_top10', desc=True)\
                .limit(20)\
                .execute()
            
            return trending.data if trending else []
            
        except Exception as e:
            print(f"❌ 트렌딩 분석 실패: {str(e)}")
            return None
    
    def export_to_excel(self, filename=None):
        """
        전체 데이터를 엑셀로 내보내기
        """
        if not filename:
            filename = f"adlog_500_report_{datetime.now().strftime('%Y%m%d')}.xlsx"
        
        filepath = f"scraping/reports/{filename}"
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        try:
            with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
                # 1. 전체 식당 목록
                if self.all_restaurants:
                    df_restaurants = pd.DataFrame(self.all_restaurants)
                    df_restaurants.to_excel(writer, sheet_name='전체식당', index=False)
                
                # 2. 오늘의 순위
                if self.today_rankings:
                    df_rankings = pd.DataFrame(self.today_rankings)
                    df_rankings.to_excel(writer, sheet_name='오늘순위', index=False)
                
                # 3. 일일 리포트
                report = self.generate_daily_report()
                if report:
                    df_report = pd.DataFrame(report['top20'])
                    df_report.to_excel(writer, sheet_name='TOP20', index=False)
                    
                    df_gainers = pd.DataFrame(report['top_gainers'])
                    df_gainers.to_excel(writer, sheet_name='급상승', index=False)
            
            print(f"✅ 엑셀 파일 생성: {filepath}")
            return filepath
            
        except Exception as e:
            print(f"❌ 엑셀 내보내기 실패: {str(e)}")
            return None


# 사용 예제
if __name__ == "__main__":
    # 매니저 초기화
    manager = Adlog500Manager()
    
    print("=" * 60)
    print("🏢 ADLOG 500개 식당 관리 시스템")
    print("=" * 60)
    
    # 1. 일일 리포트 생성
    print("\n📊 일일 리포트 생성 중...")
    report = manager.generate_daily_report()
    if report:
        print(f"  - TOP 20 식당: {len(report['top20'])}개")
        print(f"  - 급상승 식당: {len(report['top_gainers'])}개")
        print(f"  - 회원 식당: {len(report['member_rankings'])}개")
    
    # 2. 경쟁사 분석 (예시)
    print("\n🔍 경쟁사 분석...")
    competition = manager.analyze_competition("BBQ치킨 강남점")
    if competition:
        wins = sum(1 for c in competition if c['we_win'])
        losses = len(competition) - wins
        print(f"  - 승리: {wins}개 키워드")
        print(f"  - 패배: {losses}개 키워드")
    
    # 3. 트렌딩 식당
    print("\n🔥 최근 7일 핫한 식당...")
    trending = manager.get_trending_restaurants()
    if trending:
        for idx, restaurant in enumerate(trending[:5], 1):
            print(f"  {idx}. {restaurant['adlog_restaurants']['place_name']}")
    
    # 4. 엑셀 내보내기
    print("\n📁 엑셀 파일 생성 중...")
    excel_file = manager.export_to_excel()
    
    print("\n✅ 500개 식당 관리 완료!")
