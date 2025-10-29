-- ============================================
-- 사용자 분석 테이블 (간단 버전)
-- ============================================

-- 1. 사용자 이벤트 로그
CREATE TABLE IF NOT EXISTS user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    event_name VARCHAR(100) NOT NULL,
    event_category VARCHAR(50),
    user_id UUID,
    session_id VARCHAR(50),
    is_authenticated BOOLEAN DEFAULT FALSE,
    page_url VARCHAR(500),
    page_title VARCHAR(255),
    referrer VARCHAR(500),
    browser VARCHAR(50),
    browser_version VARCHAR(20),
    os VARCHAR(50),
    device_type VARCHAR(20),
    screen_resolution VARCHAR(20),
    event_data JSONB
);

CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_event_name ON user_events(event_name);
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_session_id ON user_events(session_id);

-- 2. 일간 통계
CREATE TABLE IF NOT EXISTS daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_date DATE NOT NULL UNIQUE,
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    total_sessions INTEGER DEFAULT 0,
    blogs_created INTEGER DEFAULT 0,
    reviews_replied INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(stat_date DESC);

-- 3. 사용자 퍼널
CREATE TABLE IF NOT EXISTS user_funnel (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE,
    signup_at TIMESTAMPTZ,
    first_blog_at TIMESTAMPTZ,
    first_review_at TIMESTAMPTZ,
    premium_at TIMESTAMPTZ,
    completed_signup BOOLEAN DEFAULT FALSE,
    completed_first_use BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_funnel_user_id ON user_funnel(user_id);

-- 4. 인기 기능
CREATE TABLE IF NOT EXISTS popular_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_date DATE NOT NULL,
    feature_name VARCHAR(200) NOT NULL,
    view_count INTEGER DEFAULT 0,
    unique_users INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(stat_date, feature_name)
);

CREATE INDEX IF NOT EXISTS idx_popular_features_date ON popular_features(stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_popular_features_name ON popular_features(feature_name);

-- 통계 함수
CREATE OR REPLACE FUNCTION get_dau(target_date DATE DEFAULT CURRENT_DATE) 
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT COUNT(DISTINCT user_id) FROM user_events 
            WHERE DATE(created_at) = target_date AND user_id IS NOT NULL);
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_feature_usage(days INTEGER DEFAULT 7)
RETURNS TABLE (event_name VARCHAR, usage_count BIGINT, unique_users BIGINT) AS $$
BEGIN
    RETURN QUERY SELECT ue.event_name, COUNT(*) as usage_count, COUNT(DISTINCT ue.user_id) as unique_users
    FROM user_events ue WHERE ue.created_at >= NOW() - (days || ' days')::INTERVAL
    GROUP BY ue.event_name ORDER BY usage_count DESC;
END; $$ LANGUAGE plpgsql;
