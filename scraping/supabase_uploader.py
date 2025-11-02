"""
Supabase 데이터베이스 연동 스크립트
ADLOG 스크래핑 데이터를 Supabase에 저장
"""

import os
from datetime import datetime
from supabase import create_client, Client
from dotenv import load_dotenv
import json

# 환경변수 로드
load_dotenv()

class SupabaseUploader:
    def __init__(self):
        """Supabase 클라이언트 초기화"""
        # 프로젝트 루트의 .env 파일 로드
        env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
        if os.path.exists(env_path):
            load_dotenv(env_path)
            print(f"✅ .env 파일 로드: {env_path}")
        
        self.supabase_url = os.getenv('SUPABASE_URL')
        # SERVICE_KEY 또는 ANON_KEY 사용
        self.supabase_key = os.getenv('SUPABASE_SERVICE_KEY') or os.getenv('SUPABASE_ANON_KEY')
        
        if not self.supabase_url or not self.supabase_key:
            print("⚠️ Supabase 환경변수를 .env 파일에서 확인해주세요!")
            print("필요한 변수: SUPABASE_URL, SUPABASE_ANON_KEY (또는 SUPABASE_SERVICE_KEY)")
            self.supabase = None
        else:
            self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
            print("✅ Supabase 연결 성공!")
    
    def create_ranking_table(self):
        """
        순위 추적 테이블 생성 SQL
        (Supabase SQL Editor에서 실행)
        """
        sql = """
        -- 네이버 플레이스 순위 추적 테이블
        CREATE TABLE IF NOT EXISTS place_rankings (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            
            -- 검색 정보
            search_keyword VARCHAR(100) NOT NULL,
            search_location VARCHAR(50),
            search_date DATE NOT NULL,
            search_time TIME NOT NULL,
            
            -- 순위 정보
            rank INTEGER NOT NULL,
            place_id VARCHAR(50),
            place_name VARCHAR(200) NOT NULL,
            category VARCHAR(100),
            
            -- 메타데이터
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            -- 인덱스용
            UNIQUE(search_keyword, search_location, search_date, rank)
        );
        
        -- 인덱스 생성
        CREATE INDEX idx_place_rankings_keyword ON place_rankings(search_keyword);
        CREATE INDEX idx_place_rankings_date ON place_rankings(search_date);
        CREATE INDEX idx_place_rankings_place_name ON place_rankings(place_name);
        
        -- 내 식당 순위 추적 테이블
        CREATE TABLE IF NOT EXISTS my_restaurant_rankings (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            
            -- 식당 정보
            restaurant_name VARCHAR(200) NOT NULL,
            user_id UUID REFERENCES profiles(id),
            
            -- 순위 정보
            keyword VARCHAR(100) NOT NULL,
            location VARCHAR(50),
            rank INTEGER NOT NULL,
            rank_change INTEGER, -- 전일 대비 변동
            
            -- 날짜
            tracked_date DATE NOT NULL,
            
            -- 메타데이터
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            UNIQUE(restaurant_name, keyword, location, tracked_date)
        );
        
        -- 순위 변동 히스토리 뷰
        CREATE OR REPLACE VIEW ranking_trends AS
        SELECT 
            place_name,
            search_keyword,
            search_location,
            search_date,
            rank,
            LAG(rank) OVER (
                PARTITION BY place_name, search_keyword, search_location 
                ORDER BY search_date
            ) as previous_rank,
            rank - LAG(rank) OVER (
                PARTITION BY place_name, search_keyword, search_location 
                ORDER BY search_date
            ) as rank_change
        FROM place_rankings
        ORDER BY search_date DESC, rank;
        """
        
        print("📋 위 SQL을 Supabase SQL Editor에서 실행해주세요!")
        return sql
    
    def upload_rankings(self, rankings_data):
        """
        순위 데이터를 Supabase에 업로드
        
        Args:
            rankings_data: 스크래핑한 순위 데이터 리스트
        """
        if not self.supabase:
            print("❌ Supabase 연결이 필요합니다!")
            return False
        
        try:
            # 데이터 정제
            for ranking in rankings_data:
                # location 분리
                keyword_parts = ranking['keyword'].split()
                location = keyword_parts[0] if len(keyword_parts) > 1 else None
                keyword = ' '.join(keyword_parts[1:]) if len(keyword_parts) > 1 else ranking['keyword']
                
                ranking['search_keyword'] = keyword
                ranking['search_location'] = location
                
                # 불필요한 필드 제거
                if 'keyword' in ranking:
                    del ranking['keyword']
            
            # Supabase에 삽입
            result = self.supabase.table('place_rankings').insert(rankings_data).execute()
            
            print(f"✅ {len(rankings_data)}개 데이터 업로드 완료!")
            return True
            
        except Exception as e:
            print(f"❌ 업로드 실패: {str(e)}")
            return False
    
    def track_my_restaurant(self, restaurant_name, user_id=None):
        """
        내 식당 순위 추적
        
        Args:
            restaurant_name: 식당 이름
            user_id: 사용자 ID (옵션)
        """
        if not self.supabase:
            return []
        
        try:
            # 오늘 날짜
            today = datetime.now().strftime('%Y-%m-%d')
            
            # 내 식당 순위 조회
            result = self.supabase.table('place_rankings')\
                .select("*")\
                .ilike('place_name', f'%{restaurant_name}%')\
                .eq('search_date', today)\
                .execute()
            
            my_rankings = []
            for ranking in result.data:
                # 전일 순위 조회
                yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
                prev_result = self.supabase.table('place_rankings')\
                    .select("rank")\
                    .eq('place_name', ranking['place_name'])\
                    .eq('search_keyword', ranking['search_keyword'])\
                    .eq('search_date', yesterday)\
                    .execute()
                
                prev_rank = prev_result.data[0]['rank'] if prev_result.data else None
                rank_change = (prev_rank - ranking['rank']) if prev_rank else None
                
                # 내 식당 순위 저장
                my_rank_data = {
                    'restaurant_name': restaurant_name,
                    'user_id': user_id,
                    'keyword': ranking['search_keyword'],
                    'location': ranking['search_location'],
                    'rank': ranking['rank'],
                    'rank_change': rank_change,
                    'tracked_date': today
                }
                
                # DB에 저장
                self.supabase.table('my_restaurant_rankings')\
                    .upsert(my_rank_data)\
                    .execute()
                
                my_rankings.append(my_rank_data)
                
                # 순위 변동 출력
                if rank_change:
                    if rank_change > 0:
                        print(f"📈 {ranking['search_keyword']}: {ranking['rank']}위 (↑{rank_change})")
                    elif rank_change < 0:
                        print(f"📉 {ranking['search_keyword']}: {ranking['rank']}위 (↓{abs(rank_change)})")
                    else:
                        print(f"➡️ {ranking['search_keyword']}: {ranking['rank']}위 (→)")
                else:
                    print(f"🆕 {ranking['search_keyword']}: {ranking['rank']}위 (신규)")
            
            return my_rankings
            
        except Exception as e:
            print(f"❌ 조회 실패: {str(e)}")
            return []
    
    def get_weekly_report(self, restaurant_name):
        """
        주간 순위 리포트 생성
        """
        if not self.supabase:
            return None
        
        try:
            # 최근 7일 데이터 조회
            result = self.supabase.table('my_restaurant_rankings')\
                .select("*")\
                .eq('restaurant_name', restaurant_name)\
                .gte('tracked_date', (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d'))\
                .order('tracked_date', desc=False)\
                .execute()
            
            if not result.data:
                return None
            
            # 리포트 생성
            report = {
                'restaurant_name': restaurant_name,
                'period': f"{(datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')} ~ {datetime.now().strftime('%Y-%m-%d')}",
                'keywords': {},
                'summary': {
                    'total_keywords': 0,
                    'improved': 0,
                    'declined': 0,
                    'stable': 0
                }
            }
            
            # 키워드별 분석
            for ranking in result.data:
                key = f"{ranking['location']} {ranking['keyword']}" if ranking['location'] else ranking['keyword']
                
                if key not in report['keywords']:
                    report['keywords'][key] = {
                        'ranks': [],
                        'dates': [],
                        'best_rank': 999,
                        'worst_rank': 0,
                        'trend': None
                    }
                
                report['keywords'][key]['ranks'].append(ranking['rank'])
                report['keywords'][key]['dates'].append(ranking['tracked_date'])
                report['keywords'][key]['best_rank'] = min(report['keywords'][key]['best_rank'], ranking['rank'])
                report['keywords'][key]['worst_rank'] = max(report['keywords'][key]['worst_rank'], ranking['rank'])
            
            # 트렌드 분석
            for key, data in report['keywords'].items():
                if len(data['ranks']) > 1:
                    first_rank = data['ranks'][0]
                    last_rank = data['ranks'][-1]
                    
                    if last_rank < first_rank:
                        data['trend'] = 'improved'
                        report['summary']['improved'] += 1
                    elif last_rank > first_rank:
                        data['trend'] = 'declined'
                        report['summary']['declined'] += 1
                    else:
                        data['trend'] = 'stable'
                        report['summary']['stable'] += 1
            
            report['summary']['total_keywords'] = len(report['keywords'])
            
            return report
            
        except Exception as e:
            print(f"❌ 리포트 생성 실패: {str(e)}")
            return None


# 사용 예제
if __name__ == "__main__":
    from datetime import timedelta
    
    # Uploader 초기화
    uploader = SupabaseUploader()
    
    # 테이블 생성 SQL 출력
    print("\n" + "=" * 50)
    print("📋 테이블 생성 SQL")
    print("=" * 50)
    sql = uploader.create_ranking_table()
    
    # 샘플 데이터 업로드 테스트
    print("\n" + "=" * 50)
    print("📤 데이터 업로드 테스트")
    print("=" * 50)
    
    sample_data = [
        {
            'rank': 1,
            'place_name': 'BBQ치킨 강남점',
            'place_id': '12345',
            'category': '치킨',
            'keyword': '강남 치킨',
            'search_date': datetime.now().strftime('%Y-%m-%d'),
            'search_time': datetime.now().strftime('%H:%M:%S')
        },
        {
            'rank': 2,
            'place_name': '교촌치킨 강남역점',
            'place_id': '12346',
            'category': '치킨',
            'keyword': '강남 치킨',
            'search_date': datetime.now().strftime('%Y-%m-%d'),
            'search_time': datetime.now().strftime('%H:%M:%S')
        }
    ]
    
    # uploader.upload_rankings(sample_data)
    
    # 내 식당 추적
    print("\n" + "=" * 50)
    print("🎯 내 식당 순위 추적")
    print("=" * 50)
    # my_rankings = uploader.track_my_restaurant('BBQ치킨')
    
    # 주간 리포트
    print("\n" + "=" * 50)
    print("📊 주간 리포트")
    print("=" * 50)
    # report = uploader.get_weekly_report('BBQ치킨')
    # if report:
    #     print(json.dumps(report, ensure_ascii=False, indent=2))
