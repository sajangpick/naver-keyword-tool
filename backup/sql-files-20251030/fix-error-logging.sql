-- ============================================
-- 에러 로깅 시스템 테이블 (수정본)
-- ============================================
-- 수정: profiles.user_id → profiles.id
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
    column_number INTEGER,
    function_name VARCHAR(255),
    user_id UUID,
    session_id VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    browser VARCHAR(50),
    browser_version VARCHAR(20),
    os VARCHAR(50),
    device_type VARCHAR(20),
    request_method VARCHAR(10),
    request_url TEXT,
    request_body TEXT,
    page_url TEXT,
    additional_data JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);

-- 2. 에러 요약
CREATE TABLE IF NOT EXISTS error_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    time_bucket TIMESTAMPTZ NOT NULL,
    javascript_errors INTEGER DEFAULT 0,
    api_errors INTEGER DEFAULT 0,
    database_errors INTEGER DEFAULT 0,
    auth_errors INTEGER DEFAULT 0,
    crawling_errors INTEGER DEFAULT 0,
    low_severity INTEGER DEFAULT 0,
    medium_severity INTEGER DEFAULT 0,
    high_severity INTEGER DEFAULT 0,
    critical_severity INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    unique_errors INTEGER DEFAULT 0,
    affected_users INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_error_summary_time_bucket ON error_summary(time_bucket DESC);

-- 3. 에러 패턴
CREATE TABLE IF NOT EXISTS error_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    error_signature TEXT NOT NULL UNIQUE,
    error_message TEXT NOT NULL,
    error_type VARCHAR(50) NOT NULL,
    file_path VARCHAR(500),
    function_name VARCHAR(255),
    occurrence_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    affected_users_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active',
    priority VARCHAR(20) DEFAULT 'medium',
    fixed_in_version VARCHAR(50),
    fix_notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_error_patterns_signature ON error_patterns(error_signature);
CREATE INDEX IF NOT EXISTS idx_error_patterns_occurrence ON error_patterns(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_error_patterns_status ON error_patterns(status);
CREATE INDEX IF NOT EXISTS idx_error_patterns_updated_at ON error_patterns(updated_at DESC);

-- RLS 정책
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "관리자만 조회" ON error_logs FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.membership_tier = 'Admin'));
CREATE POLICY "누구나 삽입" ON error_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "관리자만 업데이트" ON error_logs FOR UPDATE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.membership_tier = 'Admin'));

ALTER TABLE error_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "관리자만 조회" ON error_summary FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.membership_tier = 'Admin'));
CREATE POLICY "시스템 삽입" ON error_summary FOR INSERT WITH CHECK (true);

ALTER TABLE error_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "관리자만 조회" ON error_patterns FOR SELECT
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.membership_tier = 'Admin'));
CREATE POLICY "시스템 관리" ON error_patterns FOR ALL USING (true) WITH CHECK (true);

-- 통계 함수
CREATE OR REPLACE FUNCTION get_top_errors(hours INTEGER DEFAULT 24)
RETURNS TABLE (error_message TEXT, error_type VARCHAR, count BIGINT, last_occurrence TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY SELECT el.error_message, el.error_type, COUNT(*) as count, MAX(el.created_at) as last_occurrence
    FROM error_logs el WHERE el.created_at >= NOW() - (hours || ' hours')::INTERVAL
    GROUP BY el.error_message, el.error_type ORDER BY count DESC LIMIT 10;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_error_trend(hours INTEGER DEFAULT 24)
RETURNS TABLE (hour TIMESTAMPTZ, total_errors BIGINT, critical_errors BIGINT, high_errors BIGINT) AS $$
BEGIN
    RETURN QUERY SELECT DATE_TRUNC('hour', el.created_at) as hour, COUNT(*) as total_errors,
        COUNT(*) FILTER (WHERE el.severity = 'critical') as critical_errors,
        COUNT(*) FILTER (WHERE el.severity = 'high') as high_errors
    FROM error_logs el WHERE el.created_at >= NOW() - (hours || ' hours')::INTERVAL
    GROUP BY DATE_TRUNC('hour', el.created_at) ORDER BY hour ASC;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 에러 패턴 업데이트 함수
CREATE OR REPLACE FUNCTION upsert_error_pattern(
    p_error_message TEXT, p_error_type VARCHAR, p_file_path VARCHAR, p_function_name VARCHAR, p_user_id UUID
) RETURNS UUID AS $$
DECLARE v_signature TEXT; v_pattern_id UUID;
BEGIN
    v_signature := MD5(COALESCE(p_error_message, '') || '|' || COALESCE(p_file_path, '') || '|' || COALESCE(p_function_name, ''));
    INSERT INTO error_patterns (error_signature, error_message, error_type, file_path, function_name, occurrence_count, last_seen_at)
    VALUES (v_signature, p_error_message, p_error_type, p_file_path, p_function_name, 1, NOW())
    ON CONFLICT (error_signature) DO UPDATE SET occurrence_count = error_patterns.occurrence_count + 1, last_seen_at = NOW(), updated_at = NOW()
    RETURNING id INTO v_pattern_id;
    IF p_user_id IS NOT NULL THEN
        UPDATE error_patterns SET affected_users_count = (
            SELECT COUNT(DISTINCT user_id) FROM error_logs
            WHERE error_logs.error_message = p_error_message AND error_logs.file_path = p_file_path AND user_id IS NOT NULL
        ) WHERE id = v_pattern_id;
    END IF;
    RETURN v_pattern_id;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거
CREATE OR REPLACE FUNCTION trigger_update_error_pattern() RETURNS TRIGGER AS $$
BEGIN
    PERFORM upsert_error_pattern(NEW.error_message, NEW.error_type, NEW.file_path, NEW.function_name, NEW.user_id);
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER on_error_log_insert AFTER INSERT ON error_logs
FOR EACH ROW EXECUTE FUNCTION trigger_update_error_pattern();

