-- ============================================
-- 사용자 이벤트 추적 테이블
-- ============================================
-- 사용자 행동 분석을 위한 이벤트 로그 저장

-- user_events 테이블 생성
CREATE TABLE IF NOT EXISTS user_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성 (쿼리 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_session_id ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_user_events_event_name ON user_events(event_name);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_user_created ON user_events(user_id, created_at DESC);

-- RLS (Row Level Security) 활성화
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 관리자는 모든 이벤트 조회 가능
CREATE POLICY "관리자는 모든 이벤트 조회 가능"
  ON user_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.user_type = 'admin' OR profiles.membership_level = 'admin')
    )
  );

-- RLS 정책: 사용자는 자신의 이벤트만 조회 가능
CREATE POLICY "사용자는 자신의 이벤트 조회 가능"
  ON user_events
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS 정책: 인증된 사용자는 이벤트 생성 가능
CREATE POLICY "인증된 사용자는 이벤트 생성 가능"
  ON user_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS 정책: 익명 사용자도 이벤트 생성 가능 (세션 추적용)
CREATE POLICY "익명 사용자도 이벤트 생성 가능"
  ON user_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 코멘트 추가
COMMENT ON TABLE user_events IS '사용자 행동 이벤트 추적 테이블';
COMMENT ON COLUMN user_events.event_name IS '이벤트 유형 (예: signup, blog_created, review_replied, crawling_used)';
COMMENT ON COLUMN user_events.event_data IS '이벤트 상세 정보 (JSON)';
COMMENT ON COLUMN user_events.session_id IS '세션 식별자';
