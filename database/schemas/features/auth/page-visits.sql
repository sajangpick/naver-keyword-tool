-- ========================================
-- 📊 사장픽 페이지 접속 기록 시스템 데이터베이스 스키마
-- ========================================
-- 생성일: 2025년 11월 25일
-- 버전: 1.0.0
-- 설명: 회원들의 페이지 접속 기록 저장
-- ========================================

-- 페이지 접속 기록 테이블
CREATE TABLE IF NOT EXISTS public.page_visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 페이지 정보
  page_url TEXT NOT NULL,
  page_title TEXT,
  page_path TEXT, -- 경로만 (쿼리 파라미터 제외)
  referrer TEXT, -- 이전 페이지 URL
  
  -- 접속 정보
  ip_address TEXT,
  user_agent TEXT,
  device_type TEXT, -- 'desktop', 'mobile', 'tablet'
  browser TEXT, -- 'Chrome', 'Safari', 'Firefox' 등
  browser_version TEXT,
  os TEXT, -- 'Windows', 'macOS', 'iOS', 'Android' 등
  os_version TEXT,
  
  -- 세션 정보
  session_id TEXT,
  
  -- 체류 시간 (초) - 다음 페이지 방문 시 업데이트
  duration_seconds INTEGER,
  
  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 생성 (쿼리 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_page_visits_user_id ON public.page_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_page_visits_created_at ON public.page_visits(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_visits_user_created ON public.page_visits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_visits_page_path ON public.page_visits(page_path);
CREATE INDEX IF NOT EXISTS idx_page_visits_session_id ON public.page_visits(session_id);
CREATE INDEX IF NOT EXISTS idx_page_visits_ip_address ON public.page_visits(ip_address);

-- RLS (Row Level Security) 활성화
ALTER TABLE public.page_visits ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 관리자는 모든 접속 기록 조회 가능
CREATE POLICY "관리자는 모든 접속 기록 조회 가능"
  ON public.page_visits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.user_type = 'admin' OR profiles.membership_level = 'admin')
    )
  );

-- RLS 정책: 사용자는 자신의 접속 기록만 조회 가능
CREATE POLICY "사용자는 자신의 접속 기록 조회 가능"
  ON public.page_visits
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS 정책: 인증된 사용자는 접속 기록 생성 가능
CREATE POLICY "인증된 사용자는 접속 기록 생성 가능"
  ON public.page_visits
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS 정책: 익명 사용자도 접속 기록 생성 가능 (방문 추적용)
CREATE POLICY "익명 사용자도 접속 기록 생성 가능"
  ON public.page_visits
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 코멘트 추가
COMMENT ON TABLE public.page_visits IS '회원 페이지 접속 기록 저장 테이블';
COMMENT ON COLUMN public.page_visits.page_path IS '페이지 경로 (쿼리 파라미터 제외)';
COMMENT ON COLUMN public.page_visits.referrer IS '이전 페이지 URL (유입 경로)';
COMMENT ON COLUMN public.page_visits.duration_seconds IS '페이지 체류 시간 (초) - 다음 페이지 방문 시 업데이트';

