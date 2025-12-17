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

-- 4. 기존 데이터 마이그레이션 (안전하게 처리)
-- 모든 컬럼이 존재하는지 확인하고 마이그레이션
DO $$
DECLARE
  has_tokens_used BOOLEAN;
  has_tokens_remaining BOOLEAN;
  has_monthly_token_limit BOOLEAN;
BEGIN
  -- 컬럼 존재 여부 확인
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'tokens_used'
  ) INTO has_tokens_used;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'tokens_remaining'
  ) INTO has_tokens_remaining;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'monthly_token_limit'
  ) INTO has_monthly_token_limit;
  
  -- 안전하게 업데이트 (동적 SQL 사용)
  IF has_tokens_used AND has_tokens_remaining AND has_monthly_token_limit THEN
    -- 모든 컬럼이 있으면 기존 값 사용
    EXECUTE format('
      UPDATE public.subscription_cycle 
      SET 
        credits_used = COALESCE(tokens_used, 0),
        credits_remaining = COALESCE(tokens_remaining, 0),
        included_credits = COALESCE(monthly_token_limit, 100)
      WHERE credits_used IS NULL OR credits_remaining IS NULL OR included_credits IS NULL
    ');
  ELSIF has_monthly_token_limit THEN
    -- monthly_token_limit만 있으면
    EXECUTE format('
      UPDATE public.subscription_cycle 
      SET 
        credits_used = 0,
        credits_remaining = COALESCE(monthly_token_limit, 100),
        included_credits = COALESCE(monthly_token_limit, 100)
      WHERE credits_used IS NULL OR credits_remaining IS NULL OR included_credits IS NULL
    ');
  ELSE
    -- 아무 컬럼도 없으면 기본값으로 설정
    UPDATE public.subscription_cycle 
    SET 
      credits_used = 0,
      credits_remaining = 100,
      included_credits = 100
    WHERE credits_used IS NULL OR credits_remaining IS NULL OR included_credits IS NULL;
  END IF;
END $$;

-- 5. 컬럼 설명 추가
COMMENT ON COLUMN public.subscription_cycle.credits_used IS '작업 크레딧 사용량 (작업 크레딧 시스템)';
COMMENT ON COLUMN public.subscription_cycle.credits_remaining IS '남은 작업 크레딧 (작업 크레딧 시스템)';
COMMENT ON COLUMN public.subscription_cycle.included_credits IS '포함된 작업 크레딧 (작업 크레딧 시스템)';

-- 완료 메시지
SELECT '✅ subscription_cycle 테이블에 작업 크레딧 컬럼 추가 완료!' as result;

