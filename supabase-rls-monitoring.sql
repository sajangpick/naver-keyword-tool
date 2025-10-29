-- ============================================
-- RLS 보안 정책 (모니터링 시스템)
-- ============================================
-- 목적: 관리자만 모니터링 데이터에 접근 가능하도록 설정
-- 작성일: 2025-10-29
-- 사용법: Supabase SQL Editor에서 전체 실행
-- ============================================

-- ============================================
-- 1단계: RLS 활성화
-- ============================================

-- 분석 테이블
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_funnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.popular_features ENABLE ROW LEVEL SECURITY;

-- 에러 로그 테이블
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_patterns ENABLE ROW LEVEL SECURITY;

-- 성능 모니터링 테이블
ALTER TABLE public.api_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawling_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2단계: 관리자 권한 체크 함수
-- ============================================

-- 현재 사용자가 관리자인지 확인하는 함수
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- 방법 1: profiles 테이블에서 user_type 확인
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND user_type = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3단계: RLS 정책 생성 (관리자만 접근)
-- ============================================

-- === 분석 테이블 정책 ===

-- user_events: 관리자만 SELECT, service_role은 INSERT/SELECT 가능
CREATE POLICY "관리자는 사용자 이벤트를 조회할 수 있습니다"
  ON public.user_events FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "서버는 사용자 이벤트를 삽입할 수 있습니다"
  ON public.user_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- daily_stats: 관리자만 조회
CREATE POLICY "관리자는 일간 통계를 조회할 수 있습니다"
  ON public.daily_stats FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "서버는 일간 통계를 관리할 수 있습니다"
  ON public.daily_stats FOR ALL
  TO service_role
  USING (true);

-- user_funnel: 관리자만 조회
CREATE POLICY "관리자는 사용자 퍼널을 조회할 수 있습니다"
  ON public.user_funnel FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "서버는 사용자 퍼널을 관리할 수 있습니다"
  ON public.user_funnel FOR ALL
  TO service_role
  USING (true);

-- popular_features: 관리자만 조회
CREATE POLICY "관리자는 인기 기능을 조회할 수 있습니다"
  ON public.popular_features FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "서버는 인기 기능을 관리할 수 있습니다"
  ON public.popular_features FOR ALL
  TO service_role
  USING (true);

-- === 에러 로그 정책 ===

-- error_logs: 관리자만 SELECT, service_role은 INSERT/SELECT 가능
CREATE POLICY "관리자는 에러 로그를 조회할 수 있습니다"
  ON public.error_logs FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "서버는 에러 로그를 삽입할 수 있습니다"
  ON public.error_logs FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "관리자는 에러 해결 상태를 업데이트할 수 있습니다"
  ON public.error_logs FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- error_summary: 관리자만 조회
CREATE POLICY "관리자는 에러 요약을 조회할 수 있습니다"
  ON public.error_summary FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "서버는 에러 요약을 관리할 수 있습니다"
  ON public.error_summary FOR ALL
  TO service_role
  USING (true);

-- error_patterns: 관리자만 조회
CREATE POLICY "관리자는 에러 패턴을 조회할 수 있습니다"
  ON public.error_patterns FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "서버는 에러 패턴을 관리할 수 있습니다"
  ON public.error_patterns FOR ALL
  TO service_role
  USING (true);

-- === 성능 모니터링 정책 ===

-- api_performance: 관리자만 SELECT, service_role은 INSERT/SELECT 가능
CREATE POLICY "관리자는 API 성능을 조회할 수 있습니다"
  ON public.api_performance FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "서버는 API 성능을 기록할 수 있습니다"
  ON public.api_performance FOR INSERT
  TO service_role
  WITH CHECK (true);

-- page_performance: 관리자만 SELECT, service_role은 INSERT/SELECT 가능
CREATE POLICY "관리자는 페이지 성능을 조회할 수 있습니다"
  ON public.page_performance FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "서버는 페이지 성능을 기록할 수 있습니다"
  ON public.page_performance FOR INSERT
  TO service_role
  WITH CHECK (true);

-- crawling_performance: 관리자만 SELECT, service_role은 INSERT/SELECT 가능
CREATE POLICY "관리자는 크롤링 성능을 조회할 수 있습니다"
  ON public.crawling_performance FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "서버는 크롤링 성능을 기록할 수 있습니다"
  ON public.crawling_performance FOR INSERT
  TO service_role
  WITH CHECK (true);

-- system_health: 관리자만 조회
CREATE POLICY "관리자는 시스템 헬스를 조회할 수 있습니다"
  ON public.system_health FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "서버는 시스템 헬스를 관리할 수 있습니다"
  ON public.system_health FOR ALL
  TO service_role
  USING (true);

-- ============================================
-- 4단계: 완료 확인
-- ============================================

-- RLS가 활성화된 테이블 확인
SELECT 
  schemaname, 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'user_events', 'daily_stats', 'user_funnel', 'popular_features',
  'error_logs', 'error_summary', 'error_patterns',
  'api_performance', 'page_performance', 'crawling_performance', 'system_health'
)
ORDER BY tablename;

-- 생성된 정책 확인
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN (
  'user_events', 'daily_stats', 'user_funnel', 'popular_features',
  'error_logs', 'error_summary', 'error_patterns',
  'api_performance', 'page_performance', 'crawling_performance', 'system_health'
)
ORDER BY tablename, policyname;

-- ============================================
-- 완료 메시지
-- ============================================

DO $$ 
BEGIN
  RAISE NOTICE '====================================';
  RAISE NOTICE '✅ RLS 보안 정책 설정 완료!';
  RAISE NOTICE '====================================';
  RAISE NOTICE '📋 설정된 테이블: 11개';
  RAISE NOTICE '🔒 생성된 정책: 약 25개';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 보안 정책:';
  RAISE NOTICE '  - 관리자(user_type=admin)만 모든 데이터 조회 가능';
  RAISE NOTICE '  - 서버(service_role_key)는 데이터 삽입 가능';
  RAISE NOTICE '  - 일반 사용자는 접근 불가';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 다음 단계:';
  RAISE NOTICE '  1. profiles 테이블에 관리자 계정이 있는지 확인';
  RAISE NOTICE '  2. 관리자로 로그인하여 admin 페이지 접근 테스트';
  RAISE NOTICE '  3. 추적 스크립트를 주요 페이지에 추가';
  RAISE NOTICE '====================================';
END $$;

