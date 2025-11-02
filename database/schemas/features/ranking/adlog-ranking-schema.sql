-- ==========================================
-- ADLOG 네이버 플레이스 순위 추적 시스템
-- 500개 식당 데이터 관리
-- ==========================================

-- 1. 등록된 식당 마스터 테이블
CREATE TABLE IF NOT EXISTS adlog_restaurants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- 식당 기본 정보
    place_id VARCHAR(100) UNIQUE NOT NULL,  -- 네이버 플레이스 ID
    place_name VARCHAR(200) NOT NULL,       -- 식당명
    category VARCHAR(100),                  -- 카테고리 (한식, 중식, 카페 등)
    sub_category VARCHAR(100),              -- 세부 카테고리
    
    -- 위치 정보
    address VARCHAR(500),                   -- 주소
    district VARCHAR(50),                   -- 구/군
    city VARCHAR(50),                       -- 시/도
    
    -- 연락처
    phone VARCHAR(50),                      -- 전화번호
    
    -- 네이버 플레이스 URL
    place_url TEXT,                         -- 네이버 플레이스 URL
    
    -- 우리 회원과 매칭
    user_id UUID REFERENCES profiles(id),   -- 우리 서비스 회원 ID (있는 경우)
    is_our_member BOOLEAN DEFAULT FALSE,    -- 우리 회원 여부
    
    -- 추적 상태
    is_active BOOLEAN DEFAULT TRUE,         -- 추적 활성화 여부
    tracking_keywords TEXT[],               -- 추적할 키워드 목록
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 일일 순위 기록 테이블
CREATE TABLE IF NOT EXISTS daily_rankings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- 검색 정보
    search_date DATE NOT NULL,              -- 검색 날짜
    search_time TIME NOT NULL,              -- 검색 시간
    search_keyword VARCHAR(200) NOT NULL,   -- 검색 키워드
    
    -- 순위 정보
    restaurant_id UUID REFERENCES adlog_restaurants(id),
    rank INTEGER,                           -- 순위 (NULL = 순위권 밖)
    
    -- 전일 대비
    prev_rank INTEGER,                      -- 전일 순위
    rank_change INTEGER,                    -- 순위 변동 (양수: 상승, 음수: 하락)
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 중복 방지
    UNIQUE(search_date, search_keyword, restaurant_id)
);

-- 3. 순위 스냅샷 테이블 (전체 순위 한번에 저장)
CREATE TABLE IF NOT EXISTS ranking_snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- 스냅샷 정보
    snapshot_date DATE NOT NULL,
    snapshot_time TIME NOT NULL,
    search_keyword VARCHAR(200) NOT NULL,
    
    -- 순위 데이터 (JSON 배열)
    rankings JSONB NOT NULL,  -- [{rank: 1, place_id: "xxx", place_name: "xxx"}, ...]
    total_results INTEGER,
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(snapshot_date, snapshot_time, search_keyword)
);

-- 4. 주간/월간 통계 테이블
CREATE TABLE IF NOT EXISTS ranking_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- 기간
    period_type VARCHAR(20) NOT NULL,       -- 'daily', 'weekly', 'monthly'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- 식당
    restaurant_id UUID REFERENCES adlog_restaurants(id),
    
    -- 통계
    avg_rank DECIMAL(5,2),                  -- 평균 순위
    best_rank INTEGER,                      -- 최고 순위
    worst_rank INTEGER,                     -- 최저 순위
    
    -- 순위 변동
    total_searches INTEGER,                 -- 총 검색 횟수
    times_in_top10 INTEGER,                -- TOP 10 진입 횟수
    times_in_top20 INTEGER,                -- TOP 20 진입 횟수
    
    -- 키워드별 성과
    best_keyword VARCHAR(200),              -- 가장 좋은 순위 키워드
    worst_keyword VARCHAR(200),             -- 가장 나쁜 순위 키워드
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(period_type, period_start, period_end, restaurant_id)
);

-- 5. 경쟁사 비교 테이블
CREATE TABLE IF NOT EXISTS competitor_analysis (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- 우리 식당
    our_restaurant_id UUID REFERENCES adlog_restaurants(id),
    
    -- 경쟁사
    competitor_id UUID REFERENCES adlog_restaurants(id),
    
    -- 비교 날짜
    comparison_date DATE NOT NULL,
    
    -- 순위 비교
    our_rank INTEGER,
    competitor_rank INTEGER,
    rank_difference INTEGER,  -- 우리 순위 - 경쟁사 순위
    
    -- 키워드
    search_keyword VARCHAR(200),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 인덱스
-- ==========================================

-- 빠른 조회를 위한 인덱스
CREATE INDEX idx_adlog_restaurants_place_id ON adlog_restaurants(place_id);
CREATE INDEX idx_adlog_restaurants_user_id ON adlog_restaurants(user_id);
CREATE INDEX idx_adlog_restaurants_is_our_member ON adlog_restaurants(is_our_member);

CREATE INDEX idx_daily_rankings_date ON daily_rankings(search_date);
CREATE INDEX idx_daily_rankings_keyword ON daily_rankings(search_keyword);
CREATE INDEX idx_daily_rankings_restaurant ON daily_rankings(restaurant_id);
CREATE INDEX idx_daily_rankings_rank ON daily_rankings(rank);

CREATE INDEX idx_ranking_snapshots_date ON ranking_snapshots(snapshot_date);
CREATE INDEX idx_ranking_snapshots_keyword ON ranking_snapshots(search_keyword);

-- ==========================================
-- 뷰 (Views)
-- ==========================================

-- 오늘의 TOP 20
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

-- 우리 회원 순위
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

-- 가장 많이 상승한 식당 (주간)
CREATE OR REPLACE VIEW weekly_top_gainers AS
WITH week_comparison AS (
    SELECT 
        restaurant_id,
        search_keyword,
        MAX(CASE WHEN search_date = CURRENT_DATE THEN rank END) as current_rank,
        MAX(CASE WHEN search_date = CURRENT_DATE - INTERVAL '7 days' THEN rank END) as week_ago_rank
    FROM daily_rankings
    WHERE search_date IN (CURRENT_DATE, CURRENT_DATE - INTERVAL '7 days')
    GROUP BY restaurant_id, search_keyword
)
SELECT 
    ar.place_name,
    wc.search_keyword,
    wc.current_rank,
    wc.week_ago_rank,
    (wc.week_ago_rank - wc.current_rank) as rank_improvement
FROM week_comparison wc
JOIN adlog_restaurants ar ON wc.restaurant_id = ar.id
WHERE wc.current_rank IS NOT NULL 
    AND wc.week_ago_rank IS NOT NULL
    AND wc.week_ago_rank > wc.current_rank
ORDER BY rank_improvement DESC
LIMIT 10;

-- ==========================================
-- 함수
-- ==========================================

-- 순위 변동 계산 함수
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

-- 트리거 생성
CREATE TRIGGER calculate_rank_change_trigger
BEFORE INSERT ON daily_rankings
FOR EACH ROW
EXECUTE FUNCTION calculate_rank_change();

-- ==========================================
-- 샘플 데이터 (테스트용)
-- ==========================================

-- 샘플 식당 데이터
INSERT INTO adlog_restaurants (place_id, place_name, category, address, district, city)
VALUES 
    ('sample_001', 'BBQ치킨 강남점', '치킨', '서울 강남구 역삼동', '강남구', '서울'),
    ('sample_002', '교촌치킨 강남역점', '치킨', '서울 강남구 역삼동', '강남구', '서울'),
    ('sample_003', '스타벅스 강남역점', '카페', '서울 강남구 역삼동', '강남구', '서울')
ON CONFLICT (place_id) DO NOTHING;

-- ==========================================
-- 권한 설정
-- ==========================================

-- 관리자만 모든 권한
ALTER TABLE adlog_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_analysis ENABLE ROW LEVEL SECURITY;

-- 관리자 정책 (service_role 사용)
CREATE POLICY "관리자 전체 권한" ON adlog_restaurants
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "관리자 전체 권한" ON daily_rankings
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ==========================================
-- 통계 자동 생성 함수
-- ==========================================

CREATE OR REPLACE FUNCTION generate_daily_statistics()
RETURNS void AS $$
BEGIN
    -- 일일 통계 생성
    INSERT INTO ranking_statistics (
        period_type, period_start, period_end, restaurant_id,
        avg_rank, best_rank, worst_rank,
        total_searches, times_in_top10, times_in_top20
    )
    SELECT 
        'daily',
        CURRENT_DATE,
        CURRENT_DATE,
        restaurant_id,
        AVG(rank),
        MIN(rank),
        MAX(rank),
        COUNT(*),
        COUNT(CASE WHEN rank <= 10 THEN 1 END),
        COUNT(CASE WHEN rank <= 20 THEN 1 END)
    FROM daily_rankings
    WHERE search_date = CURRENT_DATE
    GROUP BY restaurant_id
    ON CONFLICT (period_type, period_start, period_end, restaurant_id) 
    DO UPDATE SET
        avg_rank = EXCLUDED.avg_rank,
        best_rank = EXCLUDED.best_rank,
        worst_rank = EXCLUDED.worst_rank,
        total_searches = EXCLUDED.total_searches,
        times_in_top10 = EXCLUDED.times_in_top10,
        times_in_top20 = EXCLUDED.times_in_top20;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE adlog_restaurants IS '500개 ADLOG 등록 식당 마스터 데이터';
COMMENT ON TABLE daily_rankings IS '일일 순위 추적 데이터';
COMMENT ON TABLE ranking_snapshots IS '순위 전체 스냅샷';
COMMENT ON TABLE ranking_statistics IS '기간별 통계 데이터';
COMMENT ON TABLE competitor_analysis IS '경쟁사 비교 분석';
