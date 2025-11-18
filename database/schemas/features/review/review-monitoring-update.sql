-- ============================================
-- 리뷰 모니터링 - 발송 제한 기능 추가
-- 작성일: 2025-10-30
-- 설명: 어드민에서 회원별 1일 알림 발송 횟수 제어
-- ============================================

-- review_monitoring 테이블에 컬럼 추가
ALTER TABLE public.review_monitoring
ADD COLUMN IF NOT EXISTS daily_alert_limit integer DEFAULT 2,  -- 1일 발송 제한 (0=끄기, 1=1회, 2=2회)
ADD COLUMN IF NOT EXISTS alert_count_today integer DEFAULT 0,  -- 오늘 발송한 횟수
ADD COLUMN IF NOT EXISTS last_alert_date date;  -- 마지막 알림 발송 날짜 (자정 초기화용)

-- 컬럼 설명
COMMENT ON COLUMN public.review_monitoring.daily_alert_limit IS '1일 최대 알림 발송 횟수 (0=알림끄기, 1=1회, 2=2회)';
COMMENT ON COLUMN public.review_monitoring.alert_count_today IS '오늘 발송한 알림 횟수 (자정에 0으로 초기화)';
COMMENT ON COLUMN public.review_monitoring.last_alert_date IS '마지막 알림 발송 날짜 (날짜 변경 시 alert_count_today 자동 초기화)';

-- 인덱스 추가 (발송 가능한 회원 빠르게 찾기)
CREATE INDEX IF NOT EXISTS idx_review_monitoring_alert_limit 
  ON public.review_monitoring(daily_alert_limit) 
  WHERE daily_alert_limit > 0;

-- 기존 데이터에 기본값 적용
UPDATE public.review_monitoring
SET daily_alert_limit = 2,
    alert_count_today = 0
WHERE daily_alert_limit IS NULL;

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ 발송 제한 컬럼 추가 완료!';
  RAISE NOTICE '   - daily_alert_limit: 1일 최대 발송 횟수';
  RAISE NOTICE '   - alert_count_today: 오늘 발송 횟수';
  RAISE NOTICE '   - last_alert_date: 마지막 발송 날짜';
END $$;

