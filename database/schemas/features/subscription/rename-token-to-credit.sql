-- ============================================
-- 토큰 → 크레딧 테이블 이름 변경 마이그레이션
-- 실행: Supabase SQL Editor에서 실행
-- ============================================

-- 1. token_config 테이블을 credit_config로 이름 변경
ALTER TABLE IF EXISTS public.token_config 
RENAME TO credit_config;

-- 2. 트리거 이름 변경
DROP TRIGGER IF EXISTS token_config_updated_at ON public.credit_config;
CREATE TRIGGER credit_config_updated_at
BEFORE UPDATE ON public.credit_config
FOR EACH ROW
EXECUTE FUNCTION update_pricing_config_timestamp();

-- 3. 코멘트 업데이트
COMMENT ON TABLE public.credit_config IS '구독 등급별 기본 월 크레딧 한도 (어드민만 수정)';
COMMENT ON COLUMN public.credit_config.owner_seed_limit IS '식당대표 씨앗 월 크레딧 (기본 100)';
COMMENT ON COLUMN public.credit_config.owner_power_limit IS '식당대표 파워 월 크레딧 (기본 500)';

-- 4. token_usage 테이블을 credit_usage로 이름 변경 (있는 경우)
ALTER TABLE IF EXISTS public.token_usage 
RENAME TO credit_usage;

-- 5. member_custom_token_limit 테이블을 member_custom_credit_limit로 이름 변경 (있는 경우)
ALTER TABLE IF EXISTS public.member_custom_token_limit 
RENAME TO member_custom_credit_limit;

-- 6. subscription_cycle 테이블의 컬럼명 변경 (있는 경우)
DO $$ 
BEGIN
  -- monthly_token_limit → monthly_credit_limit
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'monthly_token_limit'
  ) THEN
    ALTER TABLE public.subscription_cycle 
    RENAME COLUMN monthly_token_limit TO monthly_credit_limit;
  END IF;

  -- tokens_used → credits_used
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'tokens_used'
  ) THEN
    ALTER TABLE public.subscription_cycle 
    RENAME COLUMN tokens_used TO credits_used;
  END IF;

  -- tokens_remaining → credits_remaining
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'tokens_remaining'
  ) THEN
    ALTER TABLE public.subscription_cycle 
    RENAME COLUMN tokens_remaining TO credits_remaining;
  END IF;
END $$;

-- 7. credit_usage 테이블의 컬럼명 변경 (있는 경우)
DO $$ 
BEGIN
  -- tokens_used → credits_used
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'credit_usage' 
    AND column_name = 'tokens_used'
  ) THEN
    ALTER TABLE public.credit_usage 
    RENAME COLUMN tokens_used TO credits_used;
  END IF;
END $$;

-- 8. billing_history 테이블의 컬럼명 변경 (있는 경우)
DO $$ 
BEGIN
  -- monthly_limit → monthly_credit_limit (이미 monthly_limit일 수도 있음)
  -- tokens_used → credits_used
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'tokens_used'
  ) THEN
    ALTER TABLE public.billing_history 
    RENAME COLUMN tokens_used TO credits_used;
  END IF;
END $$;

-- 성공 메시지
SELECT '✅ 토큰 → 크레딧 테이블 이름 변경 완료!' as result;

