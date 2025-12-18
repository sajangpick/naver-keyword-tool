-- ============================================
-- 플랫폼 연동 통합 스키마 (장사닥터 방식 RPA)
-- 네이버, 배달의민족, 요기요, 쿠팡이츠 지원
-- ============================================

-- 1. 플랫폼 연동 정보 테이블
CREATE TABLE IF NOT EXISTS platform_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- 플랫폼 정보
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('naver', 'baemin', 'yogiyo', 'coupangeats')),
    store_id VARCHAR(100),           -- 플랫폼별 매장 ID (네이버: place_id, 배민: store_id 등)
    store_name VARCHAR(200),         -- 매장명
    
    -- 세션 정보 (네이버용 - 세션 미러링)
    session_cookies TEXT,            -- JSON 형태의 쿠키 배열
    session_expires_at TIMESTAMP WITH TIME ZONE, -- 세션 만료 시간
    session_refresh_token TEXT,      -- 세션 갱신용 토큰 (있는 경우)
    
    -- 계정 정보 (배달 플랫폼용 - 암호화 저장)
    account_id_encrypted TEXT,       -- 암호화된 계정 ID
    account_password_encrypted TEXT, -- 암호화된 비밀번호
    two_factor_enabled BOOLEAN DEFAULT FALSE, -- 2단계 인증 사용 여부
    
    -- 프로필 정보 (플랫폼에서 가져온 매장 정보)
    profile_image TEXT,              -- 매장 프로필 이미지 URL
    address TEXT,                    -- 주소
    phone VARCHAR(50),               -- 전화번호
    business_hours TEXT,             -- 영업시간
    category VARCHAR(100),          -- 카테고리
    
    -- 설정
    reply_tone VARCHAR(20) DEFAULT 'friendly' CHECK (reply_tone IN ('friendly', 'professional', 'casual')),
    auto_reply_enabled BOOLEAN DEFAULT FALSE, -- 자동 답글 활성화 여부
    is_active BOOLEAN DEFAULT TRUE,
    
    -- 동기화 정보
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_review_collected_at TIMESTAMP WITH TIME ZONE,
    total_reviews INTEGER DEFAULT 0,
    pending_replies INTEGER DEFAULT 0,
    sync_frequency_minutes INTEGER DEFAULT 10, -- 동기화 주기 (분)
    
    -- 에러 추적
    last_error TEXT,                 -- 마지막 에러 메시지
    error_count INTEGER DEFAULT 0,    -- 연속 에러 횟수
    last_error_at TIMESTAMP WITH TIME ZONE,
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, platform, store_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_platform_connections_user ON platform_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_platform ON platform_connections(platform);
CREATE INDEX IF NOT EXISTS idx_platform_connections_active ON platform_connections(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_platform_connections_sync ON platform_connections(last_sync_at) WHERE is_active = true;

-- 2. 통합 리뷰 테이블 (모든 플랫폼)
CREATE TABLE IF NOT EXISTS platform_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID REFERENCES platform_connections(id) ON DELETE CASCADE NOT NULL,
    
    -- 리뷰 정보
    review_id VARCHAR(100) NOT NULL,  -- 플랫폼별 리뷰 ID
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('naver', 'baemin', 'yogiyo', 'coupangeats')),
    
    -- 리뷰 내용
    reviewer_name VARCHAR(100),
    reviewer_id VARCHAR(100),         -- 리뷰어 ID (있는 경우)
    rating DECIMAL(2,1) CHECK (rating >= 1.0 AND rating <= 5.0), -- 평점
    content TEXT,                     -- 리뷰 내용
    review_date TIMESTAMP WITH TIME ZONE, -- 리뷰 작성일
    review_url TEXT,                  -- 리뷰 URL (있는 경우)
    
    -- 이미지/첨부파일
    review_images TEXT[],             -- 리뷰 이미지 URL 배열
    
    -- 답글 정보
    reply_status VARCHAR(20) DEFAULT 'pending' CHECK (reply_status IN ('pending', 'posted', 'failed', 'skipped')),
    ai_reply TEXT,                    -- AI 생성 답글
    posted_reply TEXT,                -- 실제 등록된 답글
    posted_at TIMESTAMP WITH TIME ZONE, -- 답글 등록 시간
    reply_error TEXT,                 -- 답글 등록 실패 시 에러 메시지
    
    -- 분석 정보
    sentiment VARCHAR(20),            -- 감정 분석 ('positive', 'negative', 'neutral')
    keywords TEXT[],                  -- 추출된 키워드
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(connection_id, review_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_reviews_connection ON platform_reviews(connection_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON platform_reviews(reply_status) WHERE reply_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reviews_platform ON platform_reviews(platform);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON platform_reviews(review_date DESC);

-- 3. RPA 작업 로그 테이블 (디버깅 및 모니터링용)
CREATE TABLE IF NOT EXISTS rpa_job_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID REFERENCES platform_connections(id) ON DELETE CASCADE,
    
    -- 작업 정보
    job_type VARCHAR(50) NOT NULL,   -- 'login', 'collect_reviews', 'post_reply', 'sync_profile'
    platform VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed')),
    
    -- 작업 내용
    request_data JSONB,              -- 요청 데이터
    response_data JSONB,              -- 응답 데이터
    error_message TEXT,               -- 에러 메시지
    
    -- 성능 정보
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,             -- 소요 시간 (밀리초)
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_rpa_logs_connection ON rpa_job_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_rpa_logs_status ON rpa_job_logs(status);
CREATE INDEX IF NOT EXISTS idx_rpa_logs_created ON rpa_job_logs(created_at DESC);

-- 4. 세션 갱신 이력 테이블
CREATE TABLE IF NOT EXISTS session_refresh_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID REFERENCES platform_connections(id) ON DELETE CASCADE NOT NULL,
    
    -- 갱신 정보
    refresh_type VARCHAR(20) NOT NULL CHECK (refresh_type IN ('auto', 'manual', 'expired')),
    success BOOLEAN NOT NULL,
    error_message TEXT,
    
    -- 세션 정보
    old_session_expires_at TIMESTAMP WITH TIME ZONE,
    new_session_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_session_refresh_connection ON session_refresh_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_session_refresh_created ON session_refresh_logs(created_at DESC);

-- ============================================
-- 뷰 (View) 생성
-- ============================================

-- 연동 정보 요약 뷰
CREATE OR REPLACE VIEW platform_connections_summary AS
SELECT 
    pc.id,
    pc.user_id,
    pc.platform,
    pc.store_name,
    pc.is_active,
    pc.last_sync_at,
    pc.total_reviews,
    pc.pending_replies,
    COUNT(pr.id) FILTER (WHERE pr.reply_status = 'pending') as pending_count,
    COUNT(pr.id) FILTER (WHERE pr.reply_status = 'posted') as posted_count,
    MAX(pr.review_date) as latest_review_date
FROM platform_connections pc
LEFT JOIN platform_reviews pr ON pr.connection_id = pc.id
GROUP BY pc.id, pc.user_id, pc.platform, pc.store_name, pc.is_active, 
         pc.last_sync_at, pc.total_reviews, pc.pending_replies;

-- ============================================
-- 함수 (Functions)
-- ============================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_platform_connections_updated_at 
    BEFORE UPDATE ON platform_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_platform_reviews_updated_at 
    BEFORE UPDATE ON platform_reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 초기 데이터 (선택사항)
-- ============================================

-- 주석: 필요시 초기 설정 데이터 삽입

