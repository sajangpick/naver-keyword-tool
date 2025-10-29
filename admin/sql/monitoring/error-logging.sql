-- ============================================
-- 에러 로깅 시스템 테이블
-- ============================================
-- 작성일: 2025-10-29
-- 설명: 프론트엔드 및 백엔드 에러 추적
-- ============================================

-- 1. 에러 로그 테이블
CREATE TABLE IF NOT EXISTS error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 에러 분류
    error_type VARCHAR(50) NOT NULL, -- 'javascript', 'api', 'database', 'auth', 'crawling'
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    
    -- 에러 정보
    error_message TEXT NOT NULL,
    error_stack TEXT,
    error_code VARCHAR(50),
    
    -- 발생 위치
    source VARCHAR(20) NOT NULL, -- 'frontend', 'backend'
    file_path VARCHAR(500),
    line_number INTEGER,
    column_number INTEGER,
    function_name VARCHAR(255),
    
    -- 사용자 정보
    user_id UUID REFERENCES auth.users(id),
    session_id VARCHAR(50),
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- 브라우저 정보 (프론트엔드 에러)
    browser VARCHAR(50),
    browser_version VARCHAR(20),
    os VARCHAR(50),
    device_type VARCHAR(20),
    
    -- 요청 정보 (백엔드 에러)
    request_method VARCHAR(10),
    request_url TEXT,
    request_body TEXT,
    
    -- 컨텍스트 정보
    page_url TEXT,
    additional_data JSONB,
    
    -- 해결 상태
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id),
    resolution_notes TEXT
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_source ON error_logs(source);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_message ON error_logs USING gin(to_tsvector('korean', error_message));

-- 2. 에러 통계 요약 (매시간 집계)
CREATE TABLE IF NOT EXISTS error_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 시간 범위
    time_bucket TIMESTAMPTZ NOT NULL,
    
    -- 에러 타입별 카운트
    javascript_errors INTEGER DEFAULT 0,
    api_errors INTEGER DEFAULT 0,
    database_errors INTEGER DEFAULT 0,
    auth_errors INTEGER DEFAULT 0,
    crawling_errors INTEGER DEFAULT 0,
    
    -- 심각도별 카운트
    low_severity INTEGER DEFAULT 0,
    medium_severity INTEGER DEFAULT 0,
    high_severity INTEGER DEFAULT 0,
    critical_severity INTEGER DEFAULT 0,
    
    -- 총계
    total_errors INTEGER DEFAULT 0,
    unique_errors INTEGER DEFAULT 0,
    affected_users INTEGER DEFAULT 0
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_error_summary_time_bucket ON error_summary(time_bucket DESC);

-- 3. 에러 패턴 (자주 발생하는 에러 추적)
CREATE TABLE IF NOT EXISTS error_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 패턴 식별
    error_signature TEXT NOT NULL UNIQUE, -- 에러 메시지 + 파일 경로 + 라인 번호의 해시
    error_message TEXT NOT NULL,
    error_type VARCHAR(50) NOT NULL,
    
    -- 발생 위치
    file_path VARCHAR(500),
    function_name VARCHAR(255),
    
    -- 통계
    occurrence_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    affected_users_count INTEGER DEFAULT 0,
    
    -- 상태
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'investigating', 'fixed', 'ignored'
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    
    -- 해결
    fixed_in_version VARCHAR(50),
    fix_notes TEXT
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_error_patterns_signature ON error_patterns(error_signature);
CREATE INDEX IF NOT EXISTS idx_error_patterns_occurrence ON error_patterns(occurrence_count DESC);
CREATE INDEX IF NOT EXISTS idx_error_patterns_status ON error_patterns(status);
CREATE INDEX IF NOT EXISTS idx_error_patterns_updated_at ON error_patterns(updated_at DESC);

-- ============================================
-- RLS (Row Level Security) 정책
-- ============================================

-- 에러 로그 (관리자만 조회 가능)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자만 에러 로그 조회 가능"
ON error_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.membership_tier = 'Admin'
    )
);

CREATE POLICY "누구나 에러 로그 삽입 가능"
ON error_logs FOR INSERT
WITH CHECK (true);

CREATE POLICY "관리자만 에러 로그 업데이트 가능"
ON error_logs FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.membership_tier = 'Admin'
    )
);

-- 에러 요약
ALTER TABLE error_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자만 에러 요약 조회 가능"
ON error_summary FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.membership_tier = 'Admin'
    )
);

CREATE POLICY "시스템이 에러 요약 삽입 가능"
ON error_summary FOR INSERT
WITH CHECK (true);

-- 에러 패턴
ALTER TABLE error_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자만 에러 패턴 조회 가능"
ON error_patterns FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.membership_tier = 'Admin'
    )
);

CREATE POLICY "시스템이 에러 패턴 관리 가능"
ON error_patterns FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- 자동 정리 함수
-- ============================================

-- 오래된 에러 로그 자동 정리 (해결된 에러는 90일, 미해결은 180일)
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS void AS $$
BEGIN
    -- 90일 이상 오래된 해결된 에러 삭제
    DELETE FROM error_logs
    WHERE resolved = TRUE
    AND created_at < NOW() - INTERVAL '90 days';
    
    -- 180일 이상 오래된 미해결 저심각도 에러 삭제
    DELETE FROM error_logs
    WHERE resolved = FALSE
    AND severity IN ('low', 'medium')
    AND created_at < NOW() - INTERVAL '180 days';
    
    -- 1년 이상 오래된 에러 요약 삭제
    DELETE FROM error_summary
    WHERE created_at < NOW() - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 에러 패턴 업데이트 함수
-- ============================================

CREATE OR REPLACE FUNCTION upsert_error_pattern(
    p_error_message TEXT,
    p_error_type VARCHAR,
    p_file_path VARCHAR,
    p_function_name VARCHAR,
    p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_signature TEXT;
    v_pattern_id UUID;
BEGIN
    -- 에러 시그니처 생성 (MD5 해시)
    v_signature := MD5(
        COALESCE(p_error_message, '') || '|' ||
        COALESCE(p_file_path, '') || '|' ||
        COALESCE(p_function_name, '')
    );
    
    -- 기존 패턴 확인 및 업데이트
    INSERT INTO error_patterns (
        error_signature,
        error_message,
        error_type,
        file_path,
        function_name,
        occurrence_count,
        last_seen_at
    )
    VALUES (
        v_signature,
        p_error_message,
        p_error_type,
        p_file_path,
        p_function_name,
        1,
        NOW()
    )
    ON CONFLICT (error_signature)
    DO UPDATE SET
        occurrence_count = error_patterns.occurrence_count + 1,
        last_seen_at = NOW(),
        updated_at = NOW()
    RETURNING id INTO v_pattern_id;
    
    -- 영향받은 사용자 수 업데이트 (중복 제거)
    IF p_user_id IS NOT NULL THEN
        UPDATE error_patterns
        SET affected_users_count = (
            SELECT COUNT(DISTINCT user_id)
            FROM error_logs
            WHERE error_logs.error_message = p_error_message
            AND error_logs.file_path = p_file_path
            AND user_id IS NOT NULL
        )
        WHERE id = v_pattern_id;
    END IF;
    
    RETURN v_pattern_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 통계 조회 함수
-- ============================================

-- 최근 에러 Top 10
CREATE OR REPLACE FUNCTION get_top_errors(hours INTEGER DEFAULT 24)
RETURNS TABLE (
    error_message TEXT,
    error_type VARCHAR,
    count BIGINT,
    last_occurrence TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        el.error_message,
        el.error_type,
        COUNT(*) as count,
        MAX(el.created_at) as last_occurrence
    FROM error_logs el
    WHERE el.created_at >= NOW() - (hours || ' hours')::INTERVAL
    GROUP BY el.error_message, el.error_type
    ORDER BY count DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 시간대별 에러 추이
CREATE OR REPLACE FUNCTION get_error_trend(hours INTEGER DEFAULT 24)
RETURNS TABLE (
    hour TIMESTAMPTZ,
    total_errors BIGINT,
    critical_errors BIGINT,
    high_errors BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE_TRUNC('hour', el.created_at) as hour,
        COUNT(*) as total_errors,
        COUNT(*) FILTER (WHERE el.severity = 'critical') as critical_errors,
        COUNT(*) FILTER (WHERE el.severity = 'high') as high_errors
    FROM error_logs el
    WHERE el.created_at >= NOW() - (hours || ' hours')::INTERVAL
    GROUP BY DATE_TRUNC('hour', el.created_at)
    ORDER BY hour ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 트리거: 에러 로그 삽입 시 패턴 업데이트
-- ============================================

CREATE OR REPLACE FUNCTION trigger_update_error_pattern()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM upsert_error_pattern(
        NEW.error_message,
        NEW.error_type,
        NEW.file_path,
        NEW.function_name,
        NEW.user_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_error_log_insert
AFTER INSERT ON error_logs
FOR EACH ROW
EXECUTE FUNCTION trigger_update_error_pattern();

-- ============================================
-- 주석
-- ============================================

COMMENT ON TABLE error_logs IS '시스템 에러 로그 테이블';
COMMENT ON TABLE error_summary IS '시간대별 에러 통계 요약 테이블';
COMMENT ON TABLE error_patterns IS '자주 발생하는 에러 패턴 추적 테이블';

COMMENT ON FUNCTION cleanup_old_error_logs() IS '오래된 에러 로그 자동 정리 함수';
COMMENT ON FUNCTION upsert_error_pattern(TEXT, VARCHAR, VARCHAR, VARCHAR, UUID) IS '에러 패턴 업데이트 함수';
COMMENT ON FUNCTION get_top_errors(INTEGER) IS '최근 Top 10 에러 조회';
COMMENT ON FUNCTION get_error_trend(INTEGER) IS '시간대별 에러 발생 추이 조회';

