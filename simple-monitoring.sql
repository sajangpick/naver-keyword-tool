-- ============================================
-- 성능 모니터링 테이블 (간단 버전)
-- ============================================

-- 1. API 성능 로그
CREATE TABLE IF NOT EXISTS api_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    response_time_ms INTEGER NOT NULL,
    status_code INTEGER NOT NULL,
    user_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    error_message TEXT,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER
);

CREATE INDEX idx_api_performance_endpoint ON api_performance(endpoint);
CREATE INDEX idx_api_performance_created_at ON api_performance(created_at DESC);
CREATE INDEX idx_api_performance_response_time ON api_performance(response_time_ms DESC);

-- 2. 페이지 성능 로그
CREATE TABLE IF NOT EXISTS page_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    page_url VARCHAR(500) NOT NULL,
    page_title VARCHAR(255),
    dom_content_loaded_ms INTEGER,
    load_complete_ms INTEGER,
    first_paint_ms INTEGER,
    first_contentful_paint_ms INTEGER,
    user_id UUID,
    session_id VARCHAR(50),
    browser VARCHAR(50),
    browser_version VARCHAR(20),
    os VARCHAR(50),
    device_type VARCHAR(20),
    screen_resolution VARCHAR(20),
    connection_type VARCHAR(20),
    network_downlink DECIMAL(5,2)
);

CREATE INDEX idx_page_performance_url ON page_performance(page_url);
CREATE INDEX idx_page_performance_created_at ON page_performance(created_at DESC);

-- 3. 크롤링 성능 로그
CREATE TABLE IF NOT EXISTS crawling_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    crawl_type VARCHAR(50) NOT NULL,
    target_url TEXT,
    keyword VARCHAR(255),
    duration_ms INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    items_crawled INTEGER DEFAULT 0,
    error_type VARCHAR(50),
    error_message TEXT,
    bot_detected BOOLEAN DEFAULT FALSE,
    user_id UUID
);

CREATE INDEX idx_crawling_performance_type ON crawling_performance(crawl_type);
CREATE INDEX idx_crawling_performance_created_at ON crawling_performance(created_at DESC);

-- 4. 시스템 헬스
CREATE TABLE IF NOT EXISTS system_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    time_range VARCHAR(10) NOT NULL,
    api_total_requests INTEGER DEFAULT 0,
    api_error_rate DECIMAL(5,2) DEFAULT 0,
    api_avg_response_ms INTEGER DEFAULT 0,
    page_total_loads INTEGER DEFAULT 0,
    crawl_total_attempts INTEGER DEFAULT 0
);

-- 통계 함수
CREATE OR REPLACE FUNCTION get_api_stats_last_hour()
RETURNS TABLE (endpoint VARCHAR, total_requests BIGINT, avg_response_ms NUMERIC, error_rate NUMERIC) AS $$
BEGIN
    RETURN QUERY SELECT ap.endpoint, COUNT(*) as total_requests,
        ROUND(AVG(ap.response_time_ms)::NUMERIC, 2) as avg_response_ms,
        ROUND((COUNT(*) FILTER (WHERE ap.status_code >= 400)::NUMERIC / COUNT(*)::NUMERIC * 100), 2) as error_rate
    FROM api_performance ap WHERE ap.created_at >= NOW() - INTERVAL '1 hour'
    GROUP BY ap.endpoint ORDER BY total_requests DESC;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_slow_apis(minutes INTEGER DEFAULT 60)
RETURNS TABLE (endpoint VARCHAR, method VARCHAR, avg_response_ms NUMERIC, max_response_ms INTEGER, count BIGINT) AS $$
BEGIN
    RETURN QUERY SELECT ap.endpoint, ap.method, ROUND(AVG(ap.response_time_ms)::NUMERIC, 2) as avg_response_ms,
        MAX(ap.response_time_ms) as max_response_ms, COUNT(*) as count
    FROM api_performance ap WHERE ap.created_at >= NOW() - (minutes || ' minutes')::INTERVAL
    GROUP BY ap.endpoint, ap.method ORDER BY avg_response_ms DESC LIMIT 10;
END; $$ LANGUAGE plpgsql;

