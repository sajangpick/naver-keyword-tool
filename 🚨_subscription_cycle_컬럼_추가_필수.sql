-- ============================================
-- 🚨 필수: subscription_cycle 테이블에 작업 크레딧 컬럼 추가
-- ============================================
-- 이 SQL을 Supabase에서 실행해야 크레딧 차감이 작동합니다!

-- 1. credits_used 컬럼 추가 (작업 크레딧 사용량)
ALTER TABLE public.subscription_cycle 
ADD COLUMN IF NOT EXISTS credits_used integer DEFAULT 0;

-- 2. credits_remaining 컬럼 추가 (남은 작업 크레딧)
ALTER TABLE public.subscription_cycle 
ADD COLUMN IF NOT EXISTS credits_remaining integer;

-- 3. included_credits 컬럼 추가 (포함된 작업 크레딧)
ALTER TABLE public.subscription_cycle 
ADD COLUMN IF NOT EXISTS included_credits integer;

-- 4. 기존 데이터 마이그레이션 (tokens_used → credits_used)
UPDATE public.subscription_cycle 
SET 
  credits_used = COALESCE(tokens_used, 0),
  credits_remaining = COALESCE(tokens_remaining, 0),
  included_credits = COALESCE(monthly_token_limit, 0)
WHERE credits_used IS NULL OR credits_remaining IS NULL OR included_credits IS NULL;

-- 5. 컬럼 설명 추가
COMMENT ON COLUMN public.subscription_cycle.credits_used IS '작업 크레딧 사용량 (작업 크레딧 시스템)';
COMMENT ON COLUMN public.subscription_cycle.credits_remaining IS '남은 작업 크레딧 (작업 크레딧 시스템)';
COMMENT ON COLUMN public.subscription_cycle.included_credits IS '포함된 작업 크레딧 (작업 크레딧 시스템)';

-- 완료 메시지
SELECT '✅ subscription_cycle 테이블에 작업 크레딧 컬럼 추가 완료!' as result;

