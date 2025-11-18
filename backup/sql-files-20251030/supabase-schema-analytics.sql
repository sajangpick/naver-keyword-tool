-- ============================================
-- 사용자 분석 시스템 테이블
-- ============================================
-- 작성일: 2025-10-29
-- 설명: 사용자 행동 추적 및 비즈니스 지표 수집
-- ============================================

-- 1. 사용자 이벤트 로그
CREATE TABLE IF NOT EXISTS user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 이벤트 정보
    event_name VARCHAR(100) NOT NULL, -- 'page_view', 'blog_created', 'signup', etc.
    event_category VARCHAR(50), -- 'user', 'blog', 'review', 'crawling', 'premium'
    
    -- 사용자 정보
    user_id UUID REFERENCES auth.users(id),
    session_id VARCHAR(50),
    is_authenticated BOOLEAN DEFAULT FALSE,
    
    -- 페이지 정보
    page_url VARCHAR(500),
    page_title VARCHAR(255),
    referrer VARCHAR(500),
    
    -- 브라우저/디바이스 정보
    browser VARCHAR(50),
    browser_version VARCHAR(20),
    os VARCHAR(50),
    device_type VARCHAR(20), -- 'Desktop', 'Mobile', 'Tablet'
    screen_resolution VARCHAR(20),
    
    -- 위치 정보
    ip_address VARCHAR(45),
    country VARCHAR(50),
    city VARCHAR(100),
    
    -- 이벤트 데이터 (JSON)
    event_data JSONB,
    
    -- 퍼널/전환 추적
    funnel_step VARCHAR(50),
    conversion_value DECIMAL(10, 2)
);

-- 인덱스 생성 (빠른 조회)
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_event_name ON user_events(event_name);
CREATE INDEX IF NOT EXISTS idx_user_events_event_category ON user_events(event_category);
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_session_id ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_user_events_page_url ON user_events(page_url);
CREATE INDEX IF NOT EXISTS idx_user_events_funnel ON user_events(funnel_step);

-- 2. 일간 통계 (매일 자정에 집계)
CREATE TABLE IF NOT EXISTS daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_date DATE NOT NULL UNIQUE,
    
    -- 사용자 지표
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    premium_users INTEGER DEFAULT 0,
    
    -- 활동 지표
    total_sessions INTEGER DEFAULT 0,
    total_page_views INTEGER DEFAULT 0,
    avg_session_duration INTEGER DEFAULT 0, -- 초
    
    -- 기능 사용
    blogs_created INTEGER DEFAULT 0,
    reviews_replied INTEGER DEFAULT 0,
    crawling_used INTEGER DEFAULT 0,
    
    -- 전환 지표
    signups INTEGER DEFAULT 0,
    premium_conversions INTEGER DEFAULT 0,
    revenue DECIMAL(10, 2) DEFAULT 0,
    
    -- 품질 지표
    bounce_rate DECIMAL(5, 2) DEFAULT 0, -- 이탈률 (%)
    avg_blogs_per_user DECIMAL(5, 2) DEFAULT 0,
    retention_rate DECIMAL(5, 2) DEFAULT 0, -- 재방문율 (%)
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(stat_date DESC);

-- 3. 사용자 퍼널 (회원가입 → 첫 사용 → 재방문 → 유료 전환)
CREATE TABLE IF NOT EXISTS user_funnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) UNIQUE,
    
    -- 퍼널 단계별 타임스탬프
    signup_at TIMESTAMPTZ,
    first_login_at TIMESTAMPTZ,
    first_blog_at TIMESTAMPTZ,
    first_review_at TIMESTAMPTZ,
    first_crawl_at TIMESTAMPTZ,
    second_visit_at TIMESTAMPTZ,
    premium_at TIMESTAMPTZ,
    
    -- 퍼널 완료 여부
    completed_signup BOOLEAN DEFAULT FALSE,
    completed_first_use BOOLEAN DEFAULT FALSE,
    completed_second_visit BOOLEAN DEFAULT FALSE,
    completed_premium BOOLEAN DEFAULT FALSE,
    
    -- 소요 시간 (초)
    time_to_first_use INTEGER,
    time_to_second_visit INTEGER,
    time_to_premium INTEGER,
    
    -- 추가 정보
    signup_source VARCHAR(100), -- 'organic', 'ad', 'referral'
    device_type VARCHAR(20),
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_funnel_user_id ON user_funnel(user_id);
CREATE INDEX IF NOT EXISTS idx_user_funnel_signup_at ON user_funnel(signup_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_funnel_completed_premium ON user_funnel(completed_premium);

-- 4. 인기 페이지/기능
CREATE TABLE IF NOT EXISTS popular_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_date DATE NOT NULL,
    
    -- 페이지/기능
    feature_type VARCHAR(50) NOT NULL, -- 'page', 'button', 'tab'
    feature_name VARCHAR(200) NOT NULL,
    
    -- 통계
    view_count INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    avg_time_spent INTEGER DEFAULT 0, -- 초
    
    -- 메타
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(stat_date, feature_type, feature_name)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_popular_features_date ON popular_features(stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_popular_features_count ON popular_features(view_count DESC);

-- ============================================
-- RLS (Row Level Security) 정책
-- ============================================

-- 사용자 이벤트 (관리자만 조회 가능)
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자만 이벤트 조회 가능"
ON user_events FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.membership_tier = 'Admin'
    )
);

CREATE POLICY "누구나 이벤트 삽입 가능"
ON user_events FOR INSERT
WITH CHECK (true);

-- 일간 통계
ALTER TABLE daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자만 일간 통계 조회 가능"
ON daily_stats FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.membership_tier = 'Admin'
    )
);

CREATE POLICY "시스템이 일간 통계 관리 가능"
ON daily_stats FOR ALL
USING (true)
WITH CHECK (true);

-- 사용자 퍼널
ALTER TABLE user_funnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자만 퍼널 조회 가능"
ON user_funnel FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.membership_tier = 'Admin'
    )
);

CREATE POLICY "시스템이 퍼널 관리 가능"
ON user_funnel FOR ALL
USING (true)
WITH CHECK (true);

-- 인기 기능
ALTER TABLE popular_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "관리자만 인기 기능 조회 가능"
ON popular_features FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.membership_tier = 'Admin'
    )
);

CREATE POLICY "시스템이 인기 기능 관리 가능"
ON popular_features FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================
-- 자동 정리 함수 (90일 이상 오래된 이벤트 삭제)
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS void AS $$
BEGIN
    -- 90일 이상 오래된 이벤트 삭제
    DELETE FROM user_events
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- 1년 이상 오래된 일간 통계 삭제
    DELETE FROM daily_stats
    WHERE stat_date < CURRENT_DATE - INTERVAL '1 year';
    
    -- 1년 이상 오래된 인기 기능 삭제
    DELETE FROM popular_features
    WHERE stat_date < CURRENT_DATE - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 통계 집계 함수들
-- ============================================

-- DAU (Daily Active Users) 조회
CREATE OR REPLACE FUNCTION get_dau(target_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(DISTINCT user_id)
        FROM user_events
        WHERE DATE(created_at) = target_date
        AND user_id IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MAU (Monthly Active Users) 조회
CREATE OR REPLACE FUNCTION get_mau(target_month DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(DISTINCT user_id)
        FROM user_events
        WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', target_month)
        AND user_id IS NOT NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기능별 사용 통계
CREATE OR REPLACE FUNCTION get_feature_usage(days INTEGER DEFAULT 7)
RETURNS TABLE (
    event_name VARCHAR,
    usage_count BIGINT,
    unique_users BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ue.event_name,
        COUNT(*) as usage_count,
        COUNT(DISTINCT ue.user_id) as unique_users
    FROM user_events ue
    WHERE ue.created_at >= NOW() - (days || ' days')::INTERVAL
    AND ue.event_category IN ('blog', 'review', 'crawling')
    GROUP BY ue.event_name
    ORDER BY usage_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 시간대별 활동 통계 (시간대별 접속자)
CREATE OR REPLACE FUNCTION get_hourly_activity(days INTEGER DEFAULT 1)
RETURNS TABLE (
    hour INTEGER,
    user_count BIGINT,
    event_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(HOUR FROM ue.created_at)::INTEGER as hour,
        COUNT(DISTINCT ue.user_id) as user_count,
        COUNT(*) as event_count
    FROM user_events ue
    WHERE ue.created_at >= NOW() - (days || ' days')::INTERVAL
    GROUP BY EXTRACT(HOUR FROM ue.created_at)
    ORDER BY hour;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 퍼널 전환율 계산
CREATE OR REPLACE FUNCTION get_funnel_conversion()
RETURNS TABLE (
    step VARCHAR,
    users_count BIGINT,
    conversion_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH total_signups AS (
        SELECT COUNT(*) as total FROM user_funnel WHERE signup_at IS NOT NULL
    )
    SELECT 
        'signup' as step,
        COUNT(*) as users_count,
        100.0 as conversion_rate
    FROM user_funnel WHERE completed_signup = TRUE
    
    UNION ALL
    
    SELECT 
        'first_use' as step,
        COUNT(*) as users_count,
        ROUND((COUNT(*)::DECIMAL / NULLIF((SELECT total FROM total_signups), 0) * 100), 2) as conversion_rate
    FROM user_funnel WHERE completed_first_use = TRUE
    
    UNION ALL
    
    SELECT 
        'second_visit' as step,
        COUNT(*) as users_count,
        ROUND((COUNT(*)::DECIMAL / NULLIF((SELECT total FROM total_signups), 0) * 100), 2) as conversion_rate
    FROM user_funnel WHERE completed_second_visit = TRUE
    
    UNION ALL
    
    SELECT 
        'premium' as step,
        COUNT(*) as users_count,
        ROUND((COUNT(*)::DECIMAL / NULLIF((SELECT total FROM total_signups), 0) * 100), 2) as conversion_rate
    FROM user_funnel WHERE completed_premium = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 퍼널 자동 업데이트 트리거
-- ============================================

CREATE OR REPLACE FUNCTION update_user_funnel()
RETURNS TRIGGER AS $$
DECLARE
    v_signup_time TIMESTAMPTZ;
BEGIN
    -- 회원가입 이벤트
    IF NEW.event_name = 'signup' THEN
        INSERT INTO user_funnel (user_id, signup_at, completed_signup, signup_source, device_type)
        VALUES (
            NEW.user_id,
            NEW.created_at,
            TRUE,
            NEW.event_data->>'source',
            NEW.device_type
        )
        ON CONFLICT (user_id) DO UPDATE
        SET signup_at = NEW.created_at,
            completed_signup = TRUE;
    
    -- 첫 로그인
    ELSIF NEW.event_name = 'login' THEN
        UPDATE user_funnel
        SET first_login_at = NEW.created_at
        WHERE user_id = NEW.user_id
        AND first_login_at IS NULL;
    
    -- 첫 블로그 생성
    ELSIF NEW.event_name = 'blog_created' THEN
        UPDATE user_funnel
        SET first_blog_at = NEW.created_at,
            completed_first_use = TRUE,
            time_to_first_use = EXTRACT(EPOCH FROM (NEW.created_at - signup_at))::INTEGER
        WHERE user_id = NEW.user_id
        AND first_blog_at IS NULL;
    
    -- 첫 리뷰 답글
    ELSIF NEW.event_name = 'review_replied' THEN
        UPDATE user_funnel
        SET first_review_at = NEW.created_at
        WHERE user_id = NEW.user_id
        AND first_review_at IS NULL;
    
    -- 첫 크롤링
    ELSIF NEW.event_name = 'crawling_used' THEN
        UPDATE user_funnel
        SET first_crawl_at = NEW.created_at
        WHERE user_id = NEW.user_id
        AND first_crawl_at IS NULL;
    
    -- 프리미엄 전환
    ELSIF NEW.event_name = 'premium_signup' THEN
        SELECT signup_at INTO v_signup_time
        FROM user_funnel
        WHERE user_id = NEW.user_id;
        
        UPDATE user_funnel
        SET premium_at = NEW.created_at,
            completed_premium = TRUE,
            time_to_premium = EXTRACT(EPOCH FROM (NEW.created_at - v_signup_time))::INTEGER
        WHERE user_id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_event_insert
AFTER INSERT ON user_events
FOR EACH ROW
EXECUTE FUNCTION update_user_funnel();

-- ============================================
-- 주석
-- ============================================

COMMENT ON TABLE user_events IS '사용자 행동 이벤트 로그 테이블';
COMMENT ON TABLE daily_stats IS '일간 통계 집계 테이블';
COMMENT ON TABLE user_funnel IS '사용자 전환 퍼널 추적 테이블';
COMMENT ON TABLE popular_features IS '인기 페이지/기능 통계 테이블';

COMMENT ON FUNCTION cleanup_old_events() IS '오래된 이벤트 자동 정리 함수';
COMMENT ON FUNCTION get_dau(DATE) IS '일간 활성 사용자 수 조회';
COMMENT ON FUNCTION get_mau(DATE) IS '월간 활성 사용자 수 조회';
COMMENT ON FUNCTION get_feature_usage(INTEGER) IS '기능별 사용 통계 조회';
COMMENT ON FUNCTION get_funnel_conversion() IS '퍼널 전환율 계산';

