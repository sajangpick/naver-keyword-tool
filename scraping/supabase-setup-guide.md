# 📊 ADLOG 순위 추적 시스템 - Supabase 테이블 생성 가이드

## 🚀 빠른 설정 (전체 한번에 실행)

Supabase SQL Editor에서 아래 전체 코드를 복사해서 실행하세요:

```sql
-- ==========================================
-- STEP 1: 테이블 생성
-- ==========================================

-- 1-1. 등록된 식당 마스터 테이블 (500개 식당 정보)
CREATE TABLE IF NOT EXISTS adlog_restaurants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    place_id VARCHAR(100) UNIQUE NOT NULL,
    place_name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    sub_category VARCHAR(100),
    address VARCHAR(500),
    district VARCHAR(50),
    city VARCHAR(50),
    phone VARCHAR(50),
    place_url TEXT,
    user_id UUID REFERENCES profiles(id),
    is_our_member BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    tracking_keywords TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 1-2. 일일 순위 기록 테이블
CREATE TABLE IF NOT EXISTS daily_rankings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_date DATE NOT NULL,
    search_time TIME NOT NULL,
    search_keyword VARCHAR(200) NOT NULL,
    restaurant_id UUID REFERENCES adlog_restaurants(id),
    rank INTEGER,
    prev_rank INTEGER,
    rank_change INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(search_date, search_keyword, restaurant_id)
);

-- 1-3. 순위 스냅샷 테이블
CREATE TABLE IF NOT EXISTS ranking_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    snapshot_date DATE NOT NULL,
    snapshot_time TIME NOT NULL,
    search_keyword VARCHAR(200) NOT NULL,
    rankings JSONB NOT NULL,
    total_results INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(snapshot_date, snapshot_time, search_keyword)
);

-- 1-4. 통계 테이블
CREATE TABLE IF NOT EXISTS ranking_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    period_type VARCHAR(20) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    restaurant_id UUID REFERENCES adlog_restaurants(id),
    avg_rank DECIMAL(5,2),
    best_rank INTEGER,
    worst_rank INTEGER,
    total_searches INTEGER,
    times_in_top10 INTEGER,
    times_in_top20 INTEGER,
    best_keyword VARCHAR(200),
    worst_keyword VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(period_type, period_start, period_end, restaurant_id)
);

-- ==========================================
-- STEP 2: 인덱스 생성 (빠른 검색을 위해)
-- ==========================================

CREATE INDEX idx_adlog_restaurants_place_id ON adlog_restaurants(place_id);
CREATE INDEX idx_adlog_restaurants_user_id ON adlog_restaurants(user_id);
CREATE INDEX idx_daily_rankings_date ON daily_rankings(search_date);
CREATE INDEX idx_daily_rankings_keyword ON daily_rankings(search_keyword);
CREATE INDEX idx_daily_rankings_restaurant ON daily_rankings(restaurant_id);

-- ==========================================
-- STEP 3: RLS (Row Level Security) 설정
-- ==========================================

-- 테이블 보안 활성화
ALTER TABLE adlog_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_statistics ENABLE ROW LEVEL SECURITY;

-- 관리자만 접근 가능하도록 정책 생성
CREATE POLICY "관리자만 조회" ON adlog_restaurants
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE is_admin = true
        )
    );

CREATE POLICY "관리자만 수정" ON adlog_restaurants
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE is_admin = true
        )
    );

-- daily_rankings도 동일하게
CREATE POLICY "관리자만 조회" ON daily_rankings
    FOR SELECT USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE is_admin = true
        )
    );

CREATE POLICY "관리자만 수정" ON daily_rankings
    FOR ALL USING (
        auth.uid() IN (
            SELECT id FROM profiles WHERE is_admin = true
        )
    );

-- ==========================================
-- STEP 4: 뷰(View) 생성 - 자주 사용하는 쿼리
-- ==========================================

-- 오늘의 TOP 20
CREATE OR REPLACE VIEW today_top20 AS
SELECT 
    dr.rank,
    ar.place_name,
    ar.category,
    ar.address,
    dr.rank_change,
    CASE 
        WHEN dr.rank_change > 0 THEN '↑' || dr.rank_change
        WHEN dr.rank_change < 0 THEN '↓' || ABS(dr.rank_change)
        ELSE '-'
    END as change_display,
    dr.search_keyword
FROM daily_rankings dr
JOIN adlog_restaurants ar ON dr.restaurant_id = ar.id
WHERE dr.search_date = CURRENT_DATE
    AND dr.rank <= 20
ORDER BY dr.search_keyword, dr.rank;

-- 우리 회원 순위만
CREATE OR REPLACE VIEW member_rankings AS
SELECT 
    ar.place_name,
    ar.user_id,
    dr.rank,
    dr.rank_change,
    dr.search_keyword,
    dr.search_date
FROM daily_rankings dr
JOIN adlog_restaurants ar ON dr.restaurant_id = ar.id
WHERE ar.is_our_member = TRUE
ORDER BY dr.search_date DESC, dr.rank;

-- ==========================================
-- STEP 5: 함수 생성 - 자동 계산
-- ==========================================

-- 순위 변동 자동 계산
CREATE OR REPLACE FUNCTION calculate_rank_change()
RETURNS TRIGGER AS $$
BEGIN
    -- 전일 순위 조회
    SELECT rank INTO NEW.prev_rank
    FROM daily_rankings
    WHERE restaurant_id = NEW.restaurant_id
        AND search_keyword = NEW.search_keyword
        AND search_date = NEW.search_date - INTERVAL '1 day';
    
    -- 순위 변동 계산
    IF NEW.prev_rank IS NOT NULL AND NEW.rank IS NOT NULL THEN
        NEW.rank_change = NEW.prev_rank - NEW.rank;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 연결
CREATE TRIGGER calculate_rank_change_trigger
BEFORE INSERT ON daily_rankings
FOR EACH ROW
EXECUTE FUNCTION calculate_rank_change();

-- ==========================================
-- STEP 6: 테스트 데이터 (선택사항)
-- ==========================================

-- 샘플 식당 3개 추가
INSERT INTO adlog_restaurants (place_id, place_name, category, address, district, city)
VALUES 
    ('test_001', 'BBQ치킨 강남점', '치킨', '서울 강남구 역삼동', '강남구', '서울'),
    ('test_002', '교촌치킨 강남역점', '치킨', '서울 강남구 역삼동', '강남구', '서울'),
    ('test_003', '스타벅스 강남역점', '카페', '서울 강남구 역삼동', '강남구', '서울')
ON CONFLICT (place_id) DO NOTHING;

-- 오늘 날짜 순위 테스트 데이터
INSERT INTO daily_rankings (search_date, search_time, search_keyword, restaurant_id, rank)
SELECT 
    CURRENT_DATE,
    '09:00:00',
    '강남 치킨',
    id,
    ROW_NUMBER() OVER (ORDER BY RANDOM())
FROM adlog_restaurants
WHERE place_id IN ('test_001', 'test_002')
ON CONFLICT DO NOTHING;

-- ==========================================
-- 완료 메시지
-- ==========================================
SELECT '✅ 모든 테이블 생성 완료!' as message;
```

---

## 📝 단계별 실행 방법 (문제 발생 시)

### STEP 1: 테이블 하나씩 생성

```sql
-- 1. 먼저 마스터 테이블만
CREATE TABLE adlog_restaurants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    place_id VARCHAR(100) UNIQUE NOT NULL,
    place_name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    address VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### STEP 2: 확인

```sql
-- 테이블 생성 확인
SELECT * FROM adlog_restaurants LIMIT 1;
```

### STEP 3: 나머지 테이블

```sql
-- 2. 순위 테이블
CREATE TABLE daily_rankings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_date DATE NOT NULL,
    search_keyword VARCHAR(200) NOT NULL,
    restaurant_id UUID REFERENCES adlog_restaurants(id),
    rank INTEGER
);
```

---

## 🔍 생성된 테이블 확인 방법

### Supabase 대시보드에서:
1. 왼쪽 메뉴 "Table Editor" 클릭
2. 테이블 목록에서 확인:
   - `adlog_restaurants` (500개 식당)
   - `daily_rankings` (일일 순위)
   - `ranking_snapshots` (스냅샷)
   - `ranking_statistics` (통계)

### SQL로 확인:
```sql
-- 모든 테이블 목록 보기
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'adlog%' OR table_name LIKE '%ranking%';

-- 테이블 구조 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'adlog_restaurants';
```

---

## ⚠️ 문제 해결

### 에러: "relation 'profiles' does not exist"
```sql
-- profiles 참조 제거 버전
CREATE TABLE adlog_restaurants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    place_id VARCHAR(100) UNIQUE NOT NULL,
    place_name VARCHAR(200) NOT NULL,
    category VARCHAR(100),
    user_id UUID,  -- 참조 제거
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 에러: "permission denied"
- Supabase 대시보드에서 service_role 키 사용
- SQL Editor에서는 자동으로 권한 있음

### 테이블 삭제하고 다시 만들기
```sql
-- 주의! 모든 데이터 삭제됨
DROP TABLE IF EXISTS daily_rankings CASCADE;
DROP TABLE IF EXISTS adlog_restaurants CASCADE;
-- 그 다음 다시 CREATE TABLE...
```

---

## ✅ 성공 확인

모든 게 잘 되었다면:

```sql
-- 테이블 개수 확인 (4개여야 함)
SELECT COUNT(*) 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE 'adlog%' OR table_name LIKE '%ranking%');

-- 뷰 확인 (2개여야 함)
SELECT COUNT(*)
FROM information_schema.views
WHERE table_schema = 'public'
AND (view_name LIKE '%top20%' OR view_name LIKE '%member%');
```

결과:
- 테이블 4개 ✅
- 뷰 2개 ✅
- 인덱스 생성 ✅
- RLS 정책 ✅

---

## 🚀 다음 단계

테이블 생성 완료 후:

1. **Python 스크래퍼 테스트**
   ```bash
   cd scraping
   python adlog_login_scraper.py
   ```

2. **데이터 확인**
   ```sql
   SELECT * FROM adlog_restaurants;
   SELECT * FROM daily_rankings WHERE search_date = CURRENT_DATE;
   ```

3. **어드민 대시보드 구축**
   - 순위 표시
   - 그래프 생성
   - 리포트 다운로드
