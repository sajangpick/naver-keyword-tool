"""
매일 자동 실행 스크립트
특정 시간에 ADLOG 데이터를 스크래핑하고 Supabase에 저장
"""

import schedule
import time
from datetime import datetime
from adlog_scraper import AdlogScraper
from supabase_uploader import SupabaseUploader
import os
from dotenv import load_dotenv

# 프로젝트 루트의 .env 파일 로드
env_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
    print(f"✅ 환경변수 로드: {env_path}")

# 추적할 키워드 설정
KEYWORDS_TO_TRACK = [
    {'keyword': '치킨', 'location': '강남'},
    {'keyword': '치킨', 'location': '서초'},
    {'keyword': '치킨', 'location': '송파'},
    {'keyword': '카페', 'location': '강남'},
    {'keyword': '한식', 'location': '강남'},
    {'keyword': '중식', 'location': '강남'},
]

# 내 식당 이름 (환경변수에서 가져오기)
MY_RESTAURANT_NAME = os.getenv('MY_RESTAURANT_NAME', 'BBQ치킨')

def daily_scraping_job():
    """매일 실행할 스크래핑 작업"""
    print("=" * 60)
    print(f"🚀 일일 스크래핑 시작: {datetime.now()}")
    print("=" * 60)
    
    try:
        # 1. 스크래퍼 초기화
        scraper = AdlogScraper()
        uploader = SupabaseUploader()
        
        # 2. 키워드별 순위 수집
        print("\n📊 순위 데이터 수집 중...")
        all_rankings = scraper.track_multiple_keywords(KEYWORDS_TO_TRACK)
        
        if not all_rankings:
            print("⚠️ 수집된 데이터가 없습니다.")
            return
        
        # 3. 데이터 저장 (로컬 백업)
        print("\n💾 로컬 백업 저장 중...")
        json_file = scraper.save_to_json(all_rankings)
        csv_file = scraper.save_to_csv(all_rankings)
        
        # 4. Supabase 업로드
        print("\n☁️ Supabase 업로드 중...")
        upload_success = uploader.upload_rankings(all_rankings)
        
        if upload_success:
            # 5. 내 식당 순위 추적
            print(f"\n🎯 '{MY_RESTAURANT_NAME}' 순위 확인 중...")
            my_rankings = uploader.track_my_restaurant(MY_RESTAURANT_NAME)
            
            if my_rankings:
                print(f"\n✅ {MY_RESTAURANT_NAME} 오늘의 순위:")
                for rank in my_rankings:
                    keyword = f"{rank['location']} {rank['keyword']}" if rank['location'] else rank['keyword']
                    change = ""
                    if rank['rank_change']:
                        if rank['rank_change'] > 0:
                            change = f" ↑{rank['rank_change']}"
                        elif rank['rank_change'] < 0:
                            change = f" ↓{abs(rank['rank_change'])}"
                    print(f"  • {keyword}: {rank['rank']}위{change}")
            
            # 6. 주간 리포트 (매주 월요일)
            if datetime.now().weekday() == 0:  # 월요일
                print("\n📈 주간 리포트 생성 중...")
                report = uploader.get_weekly_report(MY_RESTAURANT_NAME)
                if report:
                    print(f"\n📊 {MY_RESTAURANT_NAME} 주간 리포트:")
                    print(f"  기간: {report['period']}")
                    print(f"  추적 키워드: {report['summary']['total_keywords']}개")
                    print(f"  상승: {report['summary']['improved']}개")
                    print(f"  하락: {report['summary']['declined']}개")
                    print(f"  유지: {report['summary']['stable']}개")
        
        print("\n" + "=" * 60)
        print(f"✅ 일일 스크래핑 완료: {datetime.now()}")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 스크래핑 실패: {str(e)}")
        print("=" * 60)

def test_run():
    """테스트 실행"""
    print("🧪 테스트 모드로 실행합니다...")
    daily_scraping_job()

def start_scheduler():
    """스케줄러 시작"""
    # 매일 오전 6시에 실행
    schedule.every().day.at("06:00").do(daily_scraping_job)
    
    # 매일 오후 6시에도 실행 (선택사항)
    schedule.every().day.at("18:00").do(daily_scraping_job)
    
    print("🕐 스케줄러 시작")
    print("  • 오전 6시 실행 예약")
    print("  • 오후 6시 실행 예약")
    print("\n대기 중... (Ctrl+C로 종료)")
    
    while True:
        schedule.run_pending()
        time.sleep(60)  # 1분마다 체크

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        # 테스트 실행
        test_run()
    else:
        # 스케줄러 실행
        start_scheduler()
