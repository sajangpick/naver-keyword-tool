-- ==========================================
-- 키워드 관리 시스템
-- 어떤 키워드로 검색할지 관리
-- ==========================================

-- 1. 추적할 키워드 마스터 테이블
CREATE TABLE IF NOT EXISTS tracking_keywords (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- 키워드 정보
    keyword VARCHAR(200) UNIQUE NOT NULL,  -- 검색 키워드 (예: "부산 고기집")
    category VARCHAR(50),                  -- 카테고리 (지역, 음식, 브랜드 등)
    priority INTEGER DEFAULT 1,            -- 우선순위 (1=높음, 5=낮음)
    
    -- 추적 설정
    is_active BOOLEAN DEFAULT TRUE,        -- 활성화 여부
    tracking_frequency VARCHAR(20) DEFAULT 'daily',  -- 추적 빈도 (daily, weekly, monthly)
    
    -- 통계
    total_searches INTEGER DEFAULT 0,      -- 총 검색 횟수
    last_searched_at TIMESTAMP WITH TIME ZONE,  -- 마지막 검색 시간
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. 키워드별 식당 매핑 테이블 (어떤 키워드에 어떤 식당이 나타나는지)
CREATE TABLE IF NOT EXISTS keyword_restaurant_mapping (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    keyword_id UUID REFERENCES tracking_keywords(id),
    restaurant_id UUID REFERENCES adlog_restaurants(id),
    
    -- 출현 정보
    first_seen_date DATE,                  -- 처음 발견된 날짜
    last_seen_date DATE,                   -- 마지막으로 본 날짜
    appearance_count INTEGER DEFAULT 0,    -- 총 출현 횟수
    
    -- 최고/최저 순위
    best_rank INTEGER,
    worst_rank INTEGER,
    avg_rank DECIMAL(5,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(keyword_id, restaurant_id)
);

-- 3. 키워드 그룹 테이블 (관련 키워드 묶음)
CREATE TABLE IF NOT EXISTS keyword_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    group_name VARCHAR(100) NOT NULL,      -- 그룹명 (예: "부산 맛집")
    description TEXT,                       -- 설명
    
    -- 그룹 설정
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. 키워드-그룹 연결 테이블
CREATE TABLE IF NOT EXISTS keyword_group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    group_id UUID REFERENCES keyword_groups(id),
    keyword_id UUID REFERENCES tracking_keywords(id),
    
    UNIQUE(group_id, keyword_id)
);

-- ==========================================
-- 기본 키워드 삽입
-- ==========================================

-- 지역별 키워드
INSERT INTO tracking_keywords (keyword, category, priority) VALUES
    -- 서울 주요 지역
    ('강남 맛집', '지역', 1),
    ('강남 치킨', '지역+음식', 1),
    ('강남 카페', '지역+음식', 2),
    ('강남 한식', '지역+음식', 2),
    ('강남 중식', '지역+음식', 3),
    ('강남 일식', '지역+음식', 3),
    ('서초 맛집', '지역', 1),
    ('송파 맛집', '지역', 2),
    ('역삼 맛집', '지역', 2),
    ('선릉 맛집', '지역', 3),
    
    -- 부산 주요 지역  
    ('해운대 맛집', '지역', 1),
    ('해운대 고기집', '지역+음식', 1),
    ('해운대 횟집', '지역+음식', 1),
    ('서면 맛집', '지역', 2),
    ('광안리 맛집', '지역', 2),
    ('남포동 맛집', '지역', 3),
    
    -- 음식 카테고리별
    ('치킨 맛집', '음식', 1),
    ('피자 맛집', '음식', 2),
    ('한우 맛집', '음식', 1),
    ('삼겹살 맛집', '음식', 1),
    ('초밥 맛집', '음식', 2),
    ('파스타 맛집', '음식', 3),
    
    -- 브랜드/프랜차이즈
    ('BBQ치킨', '브랜드', 1),
    ('교촌치킨', '브랜드', 1),
    ('스타벅스', '브랜드', 2),
    ('이디야커피', '브랜드', 3)
ON CONFLICT (keyword) DO NOTHING;

-- 키워드 그룹 생성
INSERT INTO keyword_groups (group_name, description) VALUES
    ('서울 강남권', '강남, 서초, 송파 지역 키워드'),
    ('부산 주요지역', '해운대, 서면, 광안리 등'),
    ('치킨 프랜차이즈', 'BBQ, 교촌 등 치킨 브랜드'),
    ('인기 음식', '치킨, 피자, 한우 등')
ON CONFLICT DO NOTHING;

-- ==========================================
-- 유용한 뷰 생성
-- ==========================================

-- 오늘 검색할 키워드 목록
CREATE OR REPLACE VIEW today_keywords AS
SELECT 
    keyword,
    category,
    priority,
    last_searched_at,
    CASE 
        WHEN last_searched_at IS NULL THEN '미검색'
        WHEN last_searched_at::date < CURRENT_DATE THEN '검색필요'
        ELSE '검색완료'
    END as status
FROM tracking_keywords
WHERE is_active = TRUE
ORDER BY priority, keyword;

-- 키워드별 TOP 식당
CREATE OR REPLACE VIEW keyword_top_restaurants AS
SELECT 
    tk.keyword,
    ar.place_name,
    dr.rank,
    dr.search_date
FROM daily_rankings dr
JOIN adlog_restaurants ar ON dr.restaurant_id = ar.id
JOIN tracking_keywords tk ON dr.search_keyword = tk.keyword
WHERE dr.search_date = CURRENT_DATE
    AND dr.rank <= 10
ORDER BY tk.keyword, dr.rank;

-- ==========================================
-- 함수: 키워드 검색 기록
-- ==========================================

CREATE OR REPLACE FUNCTION log_keyword_search(p_keyword VARCHAR)
RETURNS void AS $$
BEGIN
    UPDATE tracking_keywords
    SET 
        total_searches = total_searches + 1,
        last_searched_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE keyword = p_keyword;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 인덱스
-- ==========================================

CREATE INDEX idx_tracking_keywords_active ON tracking_keywords(is_active);
CREATE INDEX idx_tracking_keywords_priority ON tracking_keywords(priority);
CREATE INDEX idx_keyword_restaurant_mapping_keyword ON keyword_restaurant_mapping(keyword_id);
CREATE INDEX idx_keyword_restaurant_mapping_restaurant ON keyword_restaurant_mapping(restaurant_id);

-- ==========================================
-- 완료 확인
-- ==========================================

SELECT 
    '키워드 관리 시스템 생성 완료!' as message,
    COUNT(*) as total_keywords
FROM tracking_keywords;
