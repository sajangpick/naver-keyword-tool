from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv('.env')

# 실제 Supabase URL 사용
url = 'https://ptuzlubgggbgsophfcna.supabase.co'
key = os.getenv('SUPABASE_ANON_KEY')

print(f"Supabase URL: {url}")
print(f"Key exists: {bool(key)}")

supabase = create_client(url, key)

# 실제 데이터 카운트
try:
    restaurants = supabase.table('adlog_restaurants').select('*', count='exact').execute()
    print(f"\n식당 데이터: {len(restaurants.data)}개")
    
    # 실제 식당 (테스트 제외)
    real_restaurants = [r for r in restaurants.data if not r.get('place_id', '').startswith('test_')]
    print(f"실제 식당: {len(real_restaurants)}개")
    
    # 샘플 출력
    print("\n실제 식당 샘플:")
    for r in real_restaurants[:5]:
        print(f"  - {r.get('place_name', 'N/A')} (ID: {r.get('place_id', 'N/A')})")
except Exception as e:
    print(f"식당 조회 오류: {e}")

try:
    keywords = supabase.table('tracking_keywords').select('*', count='exact').execute()
    print(f"\n키워드 데이터: {len(keywords.data)}개")
    
    # 샘플 출력
    print("\n키워드 샘플:")
    for k in keywords.data[:5]:
        print(f"  - {k.get('keyword', 'N/A')}")
except Exception as e:
    print(f"키워드 조회 오류: {e}")

# 오늘 순위 데이터
try:
    from datetime import datetime
    today = datetime.now().strftime('%Y-%m-%d')
    rankings = supabase.table('daily_rankings').select('*', count='exact').eq('search_date', today).execute()
    print(f"\n오늘 순위 데이터: {len(rankings.data)}개")
except Exception as e:
    print(f"순위 조회 오류: {e}")
