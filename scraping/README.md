# 📊 ADLOG 네이버 플레이스 순위 스크래핑 시스템

매일 자동으로 네이버 플레이스 순위를 추적하고 분석하는 시스템입니다.

## 🚀 주요 기능

1. **매일 자동 순위 추적** - 설정한 키워드의 순위를 자동 수집
2. **내 식당 순위 모니터링** - 우리 식당이 몇 위인지 추적
3. **순위 변동 분석** - 전일 대비 상승/하락 표시
4. **주간 리포트 생성** - 매주 월요일 자동 리포트
5. **Supabase 연동** - 데이터베이스에 자동 저장

## 📦 설치 방법

### 1. 필요한 패키지 설치
```bash
cd scraping
pip install -r requirements.txt
```

### 2. 환경변수 설정
`.env` 파일을 생성하고 다음 내용을 추가:
```env
# Supabase 설정
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# 내 식당 정보
MY_RESTAURANT_NAME=BBQ치킨 강남점
```

### 3. Supabase 테이블 생성
Supabase SQL Editor에서 다음 명령 실행:
```sql
-- place_rankings 테이블 생성
CREATE TABLE IF NOT EXISTS place_rankings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_keyword VARCHAR(100) NOT NULL,
    search_location VARCHAR(50),
    search_date DATE NOT NULL,
    search_time TIME NOT NULL,
    rank INTEGER NOT NULL,
    place_id VARCHAR(50),
    place_name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(search_keyword, search_location, search_date, rank)
);

-- my_restaurant_rankings 테이블 생성
CREATE TABLE IF NOT EXISTS my_restaurant_rankings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    restaurant_name VARCHAR(200) NOT NULL,
    user_id UUID,
    keyword VARCHAR(100) NOT NULL,
    location VARCHAR(50),
    rank INTEGER NOT NULL,
    rank_change INTEGER,
    tracked_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_name, keyword, location, tracked_date)
);
```

## 🎯 사용 방법

### 테스트 실행
```bash
# 한 번만 실행해보기
python daily_tracker.py test
```

### 자동 실행 설정
```bash
# 매일 오전 6시, 오후 6시 자동 실행
python daily_tracker.py
```

### Windows 작업 스케줄러 설정
1. 작업 스케줄러 열기
2. "기본 작업 만들기" 클릭
3. 이름: "ADLOG 순위 추적"
4. 트리거: 매일
5. 동작: 프로그램 시작
   - 프로그램: `python`
   - 인수: `C:\경로\scraping\daily_tracker.py`
6. 완료

### Linux Cron 설정
```bash
# crontab 편집
crontab -e

# 매일 오전 6시 실행
0 6 * * * /usr/bin/python3 /home/user/scraping/daily_tracker.py

# 매일 오후 6시 실행
0 18 * * * /usr/bin/python3 /home/user/scraping/daily_tracker.py
```

## 📊 데이터 구조

### place_rankings 테이블
| 필드 | 설명 |
|------|------|
| search_keyword | 검색 키워드 (예: "치킨") |
| search_location | 지역 (예: "강남") |
| search_date | 검색 날짜 |
| rank | 순위 (1~20) |
| place_name | 식당 이름 |
| category | 카테고리 |

### my_restaurant_rankings 테이블
| 필드 | 설명 |
|------|------|
| restaurant_name | 내 식당 이름 |
| keyword | 검색 키워드 |
| location | 지역 |
| rank | 현재 순위 |
| rank_change | 전일 대비 변동 |
| tracked_date | 추적 날짜 |

## 🔧 커스터마이징

### 추적할 키워드 변경
`daily_tracker.py` 파일에서 수정:
```python
KEYWORDS_TO_TRACK = [
    {'keyword': '치킨', 'location': '강남'},
    {'keyword': '피자', 'location': '서초'},  # 추가
    # 원하는 키워드 추가...
]
```

### 실행 시간 변경
`daily_tracker.py` 파일에서 수정:
```python
# 원하는 시간으로 변경
schedule.every().day.at("09:00").do(daily_scraping_job)
```

## 📈 활용 방법

1. **대시보드 연동**
   - Supabase 데이터를 읽어 웹 대시보드에 표시
   - 순위 변동 그래프 생성

2. **알림 설정**
   - 순위가 크게 변동했을 때 이메일/SMS 발송
   - 상위 10위 진입 시 축하 메시지

3. **리포트 생성**
   - 주간/월간 리포트 자동 생성
   - PDF로 저장하여 이메일 발송

## ⚠️ 주의사항

1. **ADLOG 사이트 구조 변경**
   - 사이트 HTML 구조가 바뀌면 파싱 코드 수정 필요
   - `adlog_scraper.py`의 BeautifulSoup 선택자 확인

2. **요청 제한**
   - 너무 자주 요청하면 차단될 수 있음
   - 키워드 간 2초 딜레이 설정됨

3. **데이터 정확성**
   - 실제 네이버 순위와 약간의 차이가 있을 수 있음
   - ADLOG의 업데이트 주기에 따라 달라짐

## 🐛 문제 해결

### "No module named 'requests'" 에러
```bash
pip install -r requirements.txt
```

### Supabase 연결 실패
- `.env` 파일의 SUPABASE_URL과 SUPABASE_SERVICE_KEY 확인
- Supabase 대시보드에서 API 키 재확인

### 스크래핑 실패
- 인터넷 연결 확인
- ADLOG 사이트 접속 가능 여부 확인
- HTML 구조 변경 여부 확인

## 📞 지원

문제가 있으면 다음을 확인해주세요:
1. `scraping/data/` 폴더에 저장된 JSON/CSV 파일
2. 에러 메시지 전체
3. `.env` 파일 설정 (키는 제외하고)

---

**만든이**: 사장픽 개발팀  
**버전**: 1.0.0  
**최종 업데이트**: 2025-11-02
