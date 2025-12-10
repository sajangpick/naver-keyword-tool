-- ========================================
-- 🔐 사장픽 로그인 기록 시스템 데이터베이스 스키마
-- ========================================
-- 생성일: 2025년 11월 25일
-- 버전: 1.0.0
-- 설명: 회원들의 전체 로그인 기록 저장
-- ========================================

-- 로그인 기록 테이블
CREATE TABLE IF NOT EXISTS public.login_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 로그인 정보
  login_type TEXT NOT NULL, -- 'auto' (간편 로그인), 'manual' (수동 로그인)
  provider TEXT NOT NULL DEFAULT 'kakao', -- 'kakao', 'email', 'google' 등
  login_success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT, -- 로그인 실패 시 에러 메시지
  
  -- 사용자 정보
  user_email TEXT,
  user_name TEXT,
  
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
  
  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 인덱스 생성 (쿼리 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON public.login_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON public.login_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_user_created ON public.login_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_logs_login_type ON public.login_logs(login_type);
CREATE INDEX IF NOT EXISTS idx_login_logs_provider ON public.login_logs(provider);
CREATE INDEX IF NOT EXISTS idx_login_logs_login_success ON public.login_logs(login_success);
CREATE INDEX IF NOT EXISTS idx_login_logs_ip_address ON public.login_logs(ip_address);

-- RLS (Row Level Security) 활성화
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (이미 존재하는 경우)
DROP POLICY IF EXISTS "관리자는 모든 로그인 기록 조회 가능" ON public.login_logs;
DROP POLICY IF EXISTS "사용자는 자신의 로그인 기록 조회 가능" ON public.login_logs;
DROP POLICY IF EXISTS "인증된 사용자는 로그인 기록 생성 가능" ON public.login_logs;
DROP POLICY IF EXISTS "익명 사용자도 로그인 기록 생성 가능" ON public.login_logs;

-- RLS 정책: 관리자는 모든 로그인 기록 조회 가능
CREATE POLICY "관리자는 모든 로그인 기록 조회 가능"
  ON public.login_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.user_type = 'admin' OR profiles.membership_level = 'admin')
    )
  );

-- RLS 정책: 사용자는 자신의 로그인 기록만 조회 가능
CREATE POLICY "사용자는 자신의 로그인 기록 조회 가능"
  ON public.login_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS 정책: 인증된 사용자는 로그인 기록 생성 가능
CREATE POLICY "인증된 사용자는 로그인 기록 생성 가능"
  ON public.login_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS 정책: 익명 사용자도 로그인 기록 생성 가능 (로그인 시도 추적용)
CREATE POLICY "익명 사용자도 로그인 기록 생성 가능"
  ON public.login_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 코멘트 추가
COMMENT ON TABLE public.login_logs IS '회원 로그인 기록 저장 테이블';
COMMENT ON COLUMN public.login_logs.login_type IS 'auto: 간편 로그인, manual: 수동 로그인';
COMMENT ON COLUMN public.login_logs.provider IS '로그인 제공자 (kakao, email, google 등)';
COMMENT ON COLUMN public.login_logs.login_success IS '로그인 성공 여부';
COMMENT ON COLUMN public.login_logs.device_type IS '접속 기기 유형 (desktop, mobile, tablet)';

