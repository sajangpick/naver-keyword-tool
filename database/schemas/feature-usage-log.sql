-- ============================================
-- 기능 사용 기록 테이블
-- ============================================
-- 블로그, 리뷰, 키워드검색, 레시피, 영상 기능 사용 기록 저장

CREATE TABLE IF NOT EXISTS feature_usage_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- 사용자 정보
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_name TEXT,
  
  -- 기능 정보
  feature_type TEXT NOT NULL, -- 'blog', 'review', 'keyword', 'recipe', 'video'
  feature_name TEXT NOT NULL, -- '블로그', '리뷰', '키워드검색', '레시피', '영상'
  
  -- 사용 상세 정보
  action_type TEXT, -- 'create', 'search', 'generate', 'edit' 등
  action_details JSONB DEFAULT '{}'::jsonb, -- 추가 상세 정보
  
  -- 페이지 정보
  page_url TEXT,
  page_title TEXT,
  
  -- 기기 정보
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  browser TEXT,
  browser_version TEXT,
  user_agent TEXT,
  ip_address TEXT,
  
  -- 시간 정보
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 생성 (쿼리 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_feature_usage_log_user_id ON feature_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_log_feature_type ON feature_usage_log(feature_type);
CREATE INDEX IF NOT EXISTS idx_feature_usage_log_created_at ON feature_usage_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feature_usage_log_user_feature ON feature_usage_log(user_id, feature_type, created_at DESC);

-- RLS (Row Level Security) 활성화
ALTER TABLE feature_usage_log ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 관리자는 모든 기록 조회 가능
CREATE POLICY "관리자는 모든 기능 사용 기록 조회 가능"
  ON feature_usage_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.user_type = 'admin' OR profiles.membership_level = 'admin' OR profiles.role = 'admin')
    )
  );

-- RLS 정책: 사용자는 자신의 기록만 조회 가능
CREATE POLICY "사용자는 자신의 기능 사용 기록 조회 가능"
  ON feature_usage_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS 정책: 인증된 사용자는 기록 생성 가능
CREATE POLICY "인증된 사용자는 기능 사용 기록 생성 가능"
  ON feature_usage_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS 정책: 익명 사용자도 기록 생성 가능 (세션 추적용)
CREATE POLICY "익명 사용자는 기능 사용 기록 생성 가능"
  ON feature_usage_log
  FOR INSERT
  TO anon
  WITH CHECK (true);

COMMENT ON TABLE feature_usage_log IS '블로그, 리뷰, 키워드검색, 레시피, 영상 기능 사용 기록';
COMMENT ON COLUMN feature_usage_log.feature_type IS '기능 타입: blog, review, keyword, recipe, video';
COMMENT ON COLUMN feature_usage_log.feature_name IS '기능 이름: 블로그, 리뷰, 키워드검색, 레시피, 영상';
COMMENT ON COLUMN feature_usage_log.action_type IS '액션 타입: create, search, generate, edit 등';
COMMENT ON COLUMN feature_usage_log.action_details IS '추가 상세 정보 (JSON)';

