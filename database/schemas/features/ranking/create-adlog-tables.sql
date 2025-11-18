-- ==========================================
-- ADLOG 순위 추적 시스템 - 전체 테이블 생성
-- 이 파일 내용 전체를 복사해서 Supabase SQL Editor에 붙여넣고 RUN
-- ==========================================

-- 1. 등록된 식당 마스터 테이블 (500개 식당 정보)
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
    user_id UUID,
    is_our_member BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    tracking_keywords TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 일일 순위 기록 테이블 (블로그, 방문자리뷰 포함)
CREATE TABLE IF NOT EXISTS daily_rankings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_date DATE NOT NULL,
    search_time TIME NOT NULL,
    search_keyword VARCHAR(200) NOT NULL,
    restaurant_id UUID REFERENCES adlog_restaurants(id),
    rank INTEGER,
    prev_rank INTEGER,
    rank_change INTEGER,
    blog_count INTEGER DEFAULT 0,  -- 블로그 포스팅 수
    visitor_review_count INTEGER DEFAULT 0,  -- 방문자 영수증 리뷰 수
    reservation_count INTEGER DEFAULT 0,  -- 예약 건수
    n1_score DECIMAL(10,6),  -- N1 점수 (유사도 기준)
    n2_score DECIMAL(10,6),  -- N2 점수 (관련성 기준 - 가장 중요)
    n3_score DECIMAL(10,6),  -- N3 점수 (평판 기준)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(search_date, search_keyword, restaurant_id)
);

-- 3. 순위 스냅샷 테이블
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

-- 4. 통계 테이블
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

-- 5. 인덱스 생성 (빠른 검색)
CREATE INDEX IF NOT EXISTS idx_adlog_restaurants_place_id ON adlog_restaurants(place_id);
CREATE INDEX IF NOT EXISTS idx_adlog_restaurants_user_id ON adlog_restaurants(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_rankings_date ON daily_rankings(search_date);
CREATE INDEX IF NOT EXISTS idx_daily_rankings_keyword ON daily_rankings(search_keyword);
CREATE INDEX IF NOT EXISTS idx_daily_rankings_restaurant ON daily_rankings(restaurant_id);

-- 6. 오늘의 TOP 20 뷰
CREATE OR REPLACE VIEW today_top20 AS
SELECT 
    dr.rank,
    ar.place_name,
    ar.category,
    ar.address,
    dr.rank_change,
    dr.search_keyword
FROM daily_rankings dr
JOIN adlog_restaurants ar ON dr.restaurant_id = ar.id
WHERE dr.search_date = CURRENT_DATE
    AND dr.rank <= 20
ORDER BY dr.search_keyword, dr.rank;

-- 7. 우리 회원 순위 뷰
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

-- 8. 순위 변동 자동 계산 함수
CREATE OR REPLACE FUNCTION calculate_rank_change()
RETURNS TRIGGER AS $$
BEGIN
    SELECT rank INTO NEW.prev_rank
    FROM daily_rankings
    WHERE restaurant_id = NEW.restaurant_id
        AND search_keyword = NEW.search_keyword
        AND search_date = NEW.search_date - INTERVAL '1 day';
    
    IF NEW.prev_rank IS NOT NULL AND NEW.rank IS NOT NULL THEN
        NEW.rank_change = NEW.prev_rank - NEW.rank;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 9. 트리거 생성
CREATE TRIGGER calculate_rank_change_trigger
BEFORE INSERT ON daily_rankings
FOR EACH ROW
EXECUTE FUNCTION calculate_rank_change();

-- 10. 테스트 데이터 3개 (선택사항 - 지워도 됨)
INSERT INTO adlog_restaurants (place_id, place_name, category, address, district, city)
VALUES 
    ('test_001', 'BBQ치킨 강남점', '치킨', '서울 강남구 역삼동', '강남구', '서울'),
    ('test_002', '교촌치킨 강남역점', '치킨', '서울 강남구 역삼동', '강남구', '서울'),
    ('test_003', '스타벅스 강남역점', '카페', '서울 강남구 역삼동', '강남구', '서울')
ON CONFLICT (place_id) DO NOTHING;
