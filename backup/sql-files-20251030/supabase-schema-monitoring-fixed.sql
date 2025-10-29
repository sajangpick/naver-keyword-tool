-- ============================================
-- 성능 모니터링 시스템 테이블 (RLS 정책 제외)
-- ============================================
-- 작성일: 2025-10-29
-- 설명: API 성능, 페이지 로딩, 크롤링 성능 추적
-- ============================================

-- 1. API 성능 로그
CREATE TABLE IF NOT EXISTS api_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- API 정보
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    
    -- 성능 지표
    response_time_ms INTEGER NOT NULL,
    status_code INTEGER NOT NULL,
    
    -- 요청 정보
    user_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- 추가 정보
    error_message TEXT,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER
);

-- 인덱스 생성 (빠른 조회)
CREATE INDEX IF NOT EXISTS idx_api_performance_endpoint ON api_performance(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_performance_created_at ON api_performance(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_performance_response_time ON api_performance(response_time_ms DESC);
CREATE INDEX IF NOT EXISTS idx_api_performance_status ON api_performance(status_code);

-- 2. 페이지 성능 로그
CREATE TABLE IF NOT EXISTS page_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 페이지 정보
    page_url VARCHAR(500) NOT NULL,
    page_title VARCHAR(255),
    
    -- 성능 지표
    dom_content_loaded_ms INTEGER,
    load_complete_ms INTEGER,
    first_paint_ms INTEGER,
    first_contentful_paint_ms INTEGER,
    
    -- 사용자 정보
    user_id UUID,
    session_id VARCHAR(50),
    
    -- 브라우저 정보
    browser VARCHAR(50),
    browser_version VARCHAR(20),
    os VARCHAR(50),
    device_type VARCHAR(20),
    screen_resolution VARCHAR(20),
    
    -- 네트워크 정보
    connection_type VARCHAR(20),
    network_downlink DECIMAL(5,2)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_page_performance_url ON page_performance(page_url);
CREATE INDEX IF NOT EXISTS idx_page_performance_created_at ON page_performance(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_performance_load_time ON page_performance(load_complete_ms DESC);

-- 3. 크롤링 성능 로그
CREATE TABLE IF NOT EXISTS crawling_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 크롤링 정보
    crawl_type VARCHAR(50) NOT NULL,
    target_url TEXT,
    keyword VARCHAR(255),
    
    -- 성능 지표
    duration_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    items_crawled INTEGER DEFAULT 0,
    
    -- 에러 정보
    error_type VARCHAR(50),
    error_message TEXT,
    bot_detected BOOLEAN DEFAULT FALSE,
    
    -- 사용자 정보
    user_id UUID
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_crawling_performance_type ON crawling_performance(crawl_type);
CREATE INDEX IF NOT EXISTS idx_crawling_performance_created_at ON crawling_performance(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawling_performance_success ON crawling_performance(success);
CREATE INDEX IF NOT EXISTS idx_crawling_performance_keyword ON crawling_performance(keyword);

-- 4. 시스템 헬스 체크 (요약 통계)
CREATE TABLE IF NOT EXISTS system_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 시간 범위 (5분, 1시간, 1일)
    time_range VARCHAR(10) NOT NULL,
    
    -- API 통계
    api_total_requests INTEGER DEFAULT 0,
    api_error_rate DECIMAL(5,2) DEFAULT 0,
    api_avg_response_ms INTEGER DEFAULT 0,
    api_p95_response_ms INTEGER DEFAULT 0,
    api_p99_response_ms INTEGER DEFAULT 0,
    
    -- 페이지 통계
    page_total_loads INTEGER DEFAULT 0,
    page_avg_load_ms INTEGER DEFAULT 0,
    
    -- 크롤링 통계
    crawl_total_attempts INTEGER DEFAULT 0,
    crawl_success_rate DECIMAL(5,2) DEFAULT 0,
    crawl_avg_duration_ms INTEGER DEFAULT 0,
    crawl_bot_detection_rate DECIMAL(5,2) DEFAULT 0,
    
    -- 시스템 리소스
    active_users INTEGER DEFAULT 0
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_system_health_created_at ON system_health(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_time_range ON system_health(time_range);

-- ============================================
-- 통계 조회 함수
-- ============================================

-- 최근 1시간 API 성능 통계
CREATE OR REPLACE FUNCTION get_api_stats_last_hour()
RETURNS TABLE (
    endpoint VARCHAR,
    total_requests BIGINT,
    avg_response_ms NUMERIC,
    p95_response_ms NUMERIC,
    error_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ap.endpoint,
        COUNT(*) as total_requests,
        ROUND(AVG(ap.response_time_ms)::NUMERIC, 2) as avg_response_ms,
        ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ap.response_time_ms)::NUMERIC, 2) as p95_response_ms,
        ROUND((COUNT(*) FILTER (WHERE ap.status_code >= 400)::NUMERIC / COUNT(*)::NUMERIC * 100), 2) as error_rate
    FROM api_performance ap
    WHERE ap.created_at >= NOW() - INTERVAL '1 hour'
    GROUP BY ap.endpoint
    ORDER BY total_requests DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 느린 API Top 10
CREATE OR REPLACE FUNCTION get_slow_apis(minutes INTEGER DEFAULT 60)
RETURNS TABLE (
    endpoint VARCHAR,
    method VARCHAR,
    avg_response_ms NUMERIC,
    max_response_ms INTEGER,
    count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ap.endpoint,
        ap.method,
        ROUND(AVG(ap.response_time_ms)::NUMERIC, 2) as avg_response_ms,
        MAX(ap.response_time_ms) as max_response_ms,
        COUNT(*) as count
    FROM api_performance ap
    WHERE ap.created_at >= NOW() - (minutes || ' minutes')::INTERVAL
    GROUP BY ap.endpoint, ap.method
    ORDER BY avg_response_ms DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 주석
-- ============================================

COMMENT ON TABLE api_performance IS 'API 요청 성능 추적 테이블';
COMMENT ON TABLE page_performance IS '페이지 로딩 성능 추적 테이블';
COMMENT ON TABLE crawling_performance IS '크롤링 작업 성능 추적 테이블';
COMMENT ON TABLE system_health IS '시스템 전체 헬스 요약 통계 테이블';

