-- 네이버 스마트플레이스 리뷰 자동화 시스템 데이터베이스 스키마
-- PostgreSQL (Supabase) 전용

-- ========== 1. 네이버 플레이스 연동 정보 테이블 ==========
CREATE TABLE IF NOT EXISTS naver_place_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 네이버 계정 정보 (암호화됨)
  naver_id_encrypted TEXT NOT NULL,              -- 암호화된 네이버 아이디
  naver_password_encrypted TEXT NOT NULL,        -- 암호화된 네이버 비밀번호
  session_cookies TEXT,                           -- 세션 쿠키 (JSON 형식)
  
  -- 플레이스 정보
  place_id VARCHAR(50) NOT NULL,                 -- 네이버 플레이스 ID
  place_name VARCHAR(200),                       -- 업소명
  place_url TEXT,                                 -- 플레이스 URL
  
  -- 답글 설정
  reply_tone VARCHAR(20) DEFAULT 'friendly',     -- 친근한/전문적인/캐주얼
  
  -- 상태
  is_active BOOLEAN DEFAULT true,                -- 활성화 여부
  last_sync_at TIMESTAMP WITH TIME ZONE,         -- 마지막 동기화 시간
  
  -- 통계
  total_reviews INTEGER DEFAULT 0,               -- 총 리뷰 개수
  pending_replies INTEGER DEFAULT 0,              -- 답글 대기중 개수
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, place_id)
);

-- ========== 2. 네이버 리뷰 테이블 ==========
CREATE TABLE IF NOT EXISTS naver_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES naver_place_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 리뷰 정보
  naver_review_id VARCHAR(100) NOT NULL,         -- 네이버 리뷰 ID
  reviewer_name VARCHAR(100),                    -- 작성자명 (마스킹됨)
  rating INTEGER NOT NULL,                        -- 별점 (1-5)
  review_text TEXT NOT NULL,                      -- 리뷰 내용
  review_date TIMESTAMP WITH TIME ZONE,           -- 작성일
  
  -- AI 답글 정보
  ai_reply_text TEXT,                             -- AI가 생성한 답글
  reply_status VARCHAR(20) DEFAULT 'pending',     -- pending/registered/failed
  registered_at TIMESTAMP WITH TIME ZONE,         -- 네이버에 등록된 시간
  error_message TEXT,                              -- 실패 시 에러 메시지
  
  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(connection_id, naver_review_id)
);

-- ========== 3. 리뷰 크롤링 로그 테이블 ==========
CREATE TABLE IF NOT EXISTS review_crawl_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES naver_place_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 크롤링 결과
  status VARCHAR(20) NOT NULL,                    -- success/failed
  new_reviews_count INTEGER DEFAULT 0,            -- 새로 발견한 리뷰 개수
  total_reviews_found INTEGER DEFAULT 0,          -- 총 발견한 리뷰 개수
  error_message TEXT,                              -- 실패 시 에러 메시지
  
  -- 실행 정보
  execution_time_ms INTEGER,                       -- 실행 시간 (밀리초)
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========== 인덱스 생성 ==========
CREATE INDEX IF NOT EXISTS idx_naver_place_connections_user_id ON naver_place_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_naver_place_connections_place_id ON naver_place_connections(place_id);
CREATE INDEX IF NOT EXISTS idx_naver_place_connections_is_active ON naver_place_connections(is_active);

CREATE INDEX IF NOT EXISTS idx_naver_reviews_connection_id ON naver_reviews(connection_id);
CREATE INDEX IF NOT EXISTS idx_naver_reviews_user_id ON naver_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_naver_reviews_reply_status ON naver_reviews(reply_status);
CREATE INDEX IF NOT EXISTS idx_naver_reviews_created_at ON naver_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_naver_reviews_naver_review_id ON naver_reviews(naver_review_id);

CREATE INDEX IF NOT EXISTS idx_review_crawl_logs_connection_id ON review_crawl_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_review_crawl_logs_user_id ON review_crawl_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_review_crawl_logs_started_at ON review_crawl_logs(started_at DESC);

-- ========== RLS (Row Level Security) 정책 설정 ==========

-- naver_place_connections 테이블
ALTER TABLE naver_place_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own connections"
  ON naver_place_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connections"
  ON naver_place_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connections"
  ON naver_place_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connections"
  ON naver_place_connections FOR DELETE
  USING (auth.uid() = user_id);

-- naver_reviews 테이블
ALTER TABLE naver_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reviews"
  ON naver_reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reviews"
  ON naver_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON naver_reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- 서버는 모든 리뷰를 볼 수 있어야 함 (크롤링용)
CREATE POLICY "Service role can manage all reviews"
  ON naver_reviews FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- review_crawl_logs 테이블
ALTER TABLE review_crawl_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own crawl logs"
  ON review_crawl_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all crawl logs"
  ON review_crawl_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ========== 트리거: updated_at 자동 업데이트 ==========
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_naver_place_connections_updated_at
  BEFORE UPDATE ON naver_place_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_naver_reviews_updated_at
  BEFORE UPDATE ON naver_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

