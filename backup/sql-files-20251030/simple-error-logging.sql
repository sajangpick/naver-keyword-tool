-- ============================================
-- 에러 로깅 테이블 (간단 버전)
-- ============================================

-- 1. 에러 로그
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    error_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    error_message TEXT NOT NULL,
    error_stack TEXT,
    error_code VARCHAR(50),
    source VARCHAR(20) NOT NULL,
    file_path VARCHAR(500),
    line_number INTEGER,
    function_name VARCHAR(255),
    user_id UUID,
    session_id VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    browser VARCHAR(50),
    os VARCHAR(50),
    device_type VARCHAR(20),
    page_url TEXT,
    resolved BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX idx_error_logs_type ON error_logs(error_type);
CREATE INDEX idx_error_logs_severity ON error_logs(severity);

-- 2. 에러 요약
CREATE TABLE IF NOT EXISTS error_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    time_bucket TIMESTAMPTZ NOT NULL,
    javascript_errors INTEGER DEFAULT 0,
    api_errors INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0
);

-- 3. 에러 패턴
CREATE TABLE IF NOT EXISTS error_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    error_signature TEXT NOT NULL UNIQUE,
    error_message TEXT NOT NULL,
    error_type VARCHAR(50) NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_patterns_occurrence ON error_patterns(occurrence_count DESC);

-- 통계 함수
CREATE OR REPLACE FUNCTION get_top_errors(hours INTEGER DEFAULT 24)
RETURNS TABLE (error_message TEXT, error_type VARCHAR, count BIGINT) AS $$
BEGIN
    RETURN QUERY SELECT el.error_message, el.error_type, COUNT(*) as count
    FROM error_logs el WHERE el.created_at >= NOW() - (hours || ' hours')::INTERVAL
    GROUP BY el.error_message, el.error_type ORDER BY count DESC LIMIT 10;
END; $$ LANGUAGE plpgsql;

