-- ============================================
-- 작업 크레딧 기반 빌링 시스템 (토스페이먼츠 심사용)
-- 작성일: 2025-11-25
-- 버전: 3.0
-- ============================================

-- ==================== 1. 작업 크레딧 설정 테이블 ====================

CREATE TABLE IF NOT EXISTS public.work_credit_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 기능별 작업 크레딧 가중치
  review_reply_credit integer DEFAULT 1,        -- 리뷰 답글: 1 크레딧
  blog_writing_credit integer DEFAULT 5,        -- 블로그 작성: 5 크레딧
  video_generation_credit integer DEFAULT 20,   -- 영상 생성: 20 크레딧
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.work_credit_config IS '기능별 작업 크레딧 가중치 설정';
COMMENT ON COLUMN public.work_credit_config.review_reply_credit IS '리뷰 답글 작업 크레딧 (기본 단위)';
COMMENT ON COLUMN public.work_credit_config.blog_writing_credit IS '블로그 작성 작업 크레딧 (리뷰 답글의 5배)';
COMMENT ON COLUMN public.work_credit_config.video_generation_credit IS '영상 생성 작업 크레딧 (리뷰 답글의 20배)';

-- 기본값 삽입
INSERT INTO public.work_credit_config (review_reply_credit, blog_writing_credit, video_generation_credit)
VALUES (1, 5, 20)
ON CONFLICT DO NOTHING;

-- ==================== 2. 등급별 가격 및 크레딧 설정 ====================

-- pricing_config 테이블 수정
DO $$
BEGIN
  -- 월 최소 이용료 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pricing_config' 
    AND column_name = 'owner_seed_minimum_fee'
  ) THEN
    ALTER TABLE public.pricing_config ADD COLUMN owner_seed_minimum_fee integer DEFAULT 0;
    ALTER TABLE public.pricing_config ADD COLUMN owner_power_minimum_fee integer DEFAULT 30000;
    ALTER TABLE public.pricing_config ADD COLUMN owner_bigpower_minimum_fee integer DEFAULT 50000;
    ALTER TABLE public.pricing_config ADD COLUMN owner_premium_minimum_fee integer DEFAULT 100000;
    
    ALTER TABLE public.pricing_config ADD COLUMN agency_starter_minimum_fee integer DEFAULT 100000;
    ALTER TABLE public.pricing_config ADD COLUMN agency_pro_minimum_fee integer DEFAULT 300000;
    ALTER TABLE public.pricing_config ADD COLUMN agency_enterprise_minimum_fee integer DEFAULT 500000;
  END IF;

  -- 포함된 작업 크레딧 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pricing_config' 
    AND column_name = 'owner_seed_included_credits'
  ) THEN
    ALTER TABLE public.pricing_config ADD COLUMN owner_seed_included_credits integer DEFAULT 0;
    ALTER TABLE public.pricing_config ADD COLUMN owner_power_included_credits integer DEFAULT 37500;
    ALTER TABLE public.pricing_config ADD COLUMN owner_bigpower_included_credits integer DEFAULT 83333;
    ALTER TABLE public.pricing_config ADD COLUMN owner_premium_included_credits integer DEFAULT 200000;
    
    ALTER TABLE public.pricing_config ADD COLUMN agency_starter_included_credits integer DEFAULT 100000;
    ALTER TABLE public.pricing_config ADD COLUMN agency_pro_included_credits integer DEFAULT 600000;
    ALTER TABLE public.pricing_config ADD COLUMN agency_enterprise_included_credits integer DEFAULT 1666666;
  END IF;

  -- 초과 작업 크레딧당 단가 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'pricing_config' 
    AND column_name = 'owner_seed_excess_rate'
  ) THEN
    ALTER TABLE public.pricing_config ADD COLUMN owner_seed_excess_rate numeric(10,2) DEFAULT 1.2;
    ALTER TABLE public.pricing_config ADD COLUMN owner_power_excess_rate numeric(10,2) DEFAULT 0.8;
    ALTER TABLE public.pricing_config ADD COLUMN owner_bigpower_excess_rate numeric(10,2) DEFAULT 0.6;
    ALTER TABLE public.pricing_config ADD COLUMN owner_premium_excess_rate numeric(10,2) DEFAULT 0.5;
    
    ALTER TABLE public.pricing_config ADD COLUMN agency_starter_excess_rate numeric(10,2) DEFAULT 1.0;
    ALTER TABLE public.pricing_config ADD COLUMN agency_pro_excess_rate numeric(10,2) DEFAULT 0.5;
    ALTER TABLE public.pricing_config ADD COLUMN agency_enterprise_excess_rate numeric(10,2) DEFAULT 0.3;
  END IF;
END $$;

COMMENT ON COLUMN public.pricing_config.owner_seed_minimum_fee IS '라이트 등급 월 최소 이용료 (0원)';
COMMENT ON COLUMN public.pricing_config.owner_power_minimum_fee IS '스탠다드 등급 월 최소 이용료 (30,000원)';
COMMENT ON COLUMN public.pricing_config.owner_seed_included_credits IS '라이트 등급 포함된 작업 크레딧 (0 크레딧)';
COMMENT ON COLUMN public.pricing_config.owner_power_included_credits IS '스탠다드 등급 포함된 작업 크레딧 (37,500 크레딧)';
COMMENT ON COLUMN public.pricing_config.owner_seed_excess_rate IS '라이트 등급 초과 작업 크레딧당 단가 (1.2원/크레딧)';
COMMENT ON COLUMN public.pricing_config.owner_power_excess_rate IS '스탠다드 등급 초과 작업 크레딧당 단가 (0.8원/크레딧)';

-- ==================== 3. 작업 크레딧 사용 기록 테이블 ====================

CREATE TABLE IF NOT EXISTS public.work_credit_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 사용자 정보
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id uuid, -- 대행사 관리 식당인 경우만 사용
  
  -- 작업 정보
  service_type text NOT NULL, -- 'review_reply', 'blog_writing', 'video_generation'
  work_credits_used integer NOT NULL, -- 사용한 작업 크레딧
  
  -- 상세 정보
  input_tokens integer, -- 내부 추적용 (선택)
  output_tokens integer, -- 내부 추적용 (선택)
  ai_model text, -- 'chatgpt', 'gemini', 'claude' 등
  
  -- 사용일
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  used_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.work_credit_usage IS '작업 크레딧 사용 기록 (토큰 대체)';
COMMENT ON COLUMN public.work_credit_usage.service_type IS '서비스 유형: review_reply, blog_writing, video_generation';
COMMENT ON COLUMN public.work_credit_usage.work_credits_used IS '사용한 작업 크레딧 (가중치 적용)';

CREATE INDEX IF NOT EXISTS idx_work_credit_usage_user ON public.work_credit_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_work_credit_usage_date ON public.work_credit_usage(usage_date);
CREATE INDEX IF NOT EXISTS idx_work_credit_usage_service ON public.work_credit_usage(service_type);

-- usage_date 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_work_credit_usage_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.usage_date = DATE(NEW.used_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_work_credit_usage_date ON public.work_credit_usage;
CREATE TRIGGER trigger_update_work_credit_usage_date
BEFORE INSERT OR UPDATE ON public.work_credit_usage
FOR EACH ROW
EXECUTE FUNCTION update_work_credit_usage_date();

-- ==================== 4. user_subscription 테이블 수정 ====================

DO $$
BEGIN
  -- base_tokens → included_credits로 변경
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_subscription' 
    AND column_name = 'base_tokens'
  ) THEN
    -- 기존 base_tokens가 있으면 included_credits로 이름 변경
    ALTER TABLE public.user_subscription RENAME COLUMN base_tokens TO included_credits;
  END IF;

  -- included_credits 컬럼이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_subscription' 
    AND column_name = 'included_credits'
  ) THEN
    ALTER TABLE public.user_subscription ADD COLUMN included_credits integer DEFAULT 0;
  END IF;

  -- excess_token_rate → excess_credit_rate로 변경
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_subscription' 
    AND column_name = 'excess_token_rate'
  ) THEN
    ALTER TABLE public.user_subscription RENAME COLUMN excess_token_rate TO excess_credit_rate;
  END IF;

  -- excess_credit_rate 컬럼이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'user_subscription' 
    AND column_name = 'excess_credit_rate'
  ) THEN
    ALTER TABLE public.user_subscription ADD COLUMN excess_credit_rate numeric(10,2) DEFAULT 1.2;
  END IF;
END $$;

COMMENT ON COLUMN public.user_subscription.included_credits IS '포함된 작업 크레딧 (월 최소 이용료에 포함)';
COMMENT ON COLUMN public.user_subscription.excess_credit_rate IS '초과 작업 크레딧당 단가 (원/크레딧)';

-- ==================== 5. billing_history 테이블 수정 ====================

DO $$
BEGIN
  -- 토큰 관련 컬럼을 작업 크레딧으로 변경
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'monthly_limit'
  ) THEN
    ALTER TABLE public.billing_history RENAME COLUMN monthly_limit TO included_credits;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'tokens_used'
  ) THEN
    ALTER TABLE public.billing_history RENAME COLUMN tokens_used TO credits_used;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'exceeded_amount'
  ) THEN
    ALTER TABLE public.billing_history RENAME COLUMN exceeded_amount TO excess_credits;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'excess_tokens'
  ) THEN
    ALTER TABLE public.billing_history RENAME COLUMN excess_tokens TO excess_credits;
  END IF;

  -- 새 컬럼 추가 (없는 경우)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'included_credits'
  ) THEN
    ALTER TABLE public.billing_history ADD COLUMN included_credits integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'credits_used'
  ) THEN
    ALTER TABLE public.billing_history ADD COLUMN credits_used integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'excess_credits'
  ) THEN
    ALTER TABLE public.billing_history ADD COLUMN excess_credits integer DEFAULT 0;
  END IF;

  -- excess_fee → excess_charge로 통일 (이미 있을 수 있음)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'excess_fee'
  ) THEN
    ALTER TABLE public.billing_history ADD COLUMN excess_fee integer DEFAULT 0;
  END IF;

  -- 실제 청구 금액 컬럼 추가 (최소 이용료와 실제 사용 금액 중 큰 값)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'actual_usage_amount'
  ) THEN
    ALTER TABLE public.billing_history ADD COLUMN actual_usage_amount integer DEFAULT 0;
    COMMENT ON COLUMN public.billing_history.actual_usage_amount IS '실제 사용 금액 (credits_used × excess_rate)';
  END IF;
END $$;

COMMENT ON COLUMN public.billing_history.included_credits IS '포함된 작업 크레딧';
COMMENT ON COLUMN public.billing_history.credits_used IS '실제 사용한 작업 크레딧';
COMMENT ON COLUMN public.billing_history.excess_credits IS '초과 사용한 작업 크레딧 (credits_used - included_credits)';

-- ==================== 6. subscription_cycle 테이블 수정 ====================

DO $$
BEGIN
  -- 토큰 관련 컬럼을 작업 크레딧으로 변경
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'monthly_token_limit'
  ) THEN
    ALTER TABLE public.subscription_cycle RENAME COLUMN monthly_token_limit TO included_credits;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'tokens_used'
  ) THEN
    ALTER TABLE public.subscription_cycle RENAME COLUMN tokens_used TO credits_used;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'tokens_remaining'
  ) THEN
    ALTER TABLE public.subscription_cycle RENAME COLUMN tokens_remaining TO credits_remaining;
  END IF;

  -- 새 컬럼 추가 (없는 경우)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'included_credits'
  ) THEN
    ALTER TABLE public.subscription_cycle ADD COLUMN included_credits integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'credits_used'
  ) THEN
    ALTER TABLE public.subscription_cycle ADD COLUMN credits_used integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'credits_remaining'
  ) THEN
    ALTER TABLE public.subscription_cycle ADD COLUMN credits_remaining integer;
  END IF;
END $$;

COMMENT ON COLUMN public.subscription_cycle.included_credits IS '포함된 작업 크레딧 (월 최소 이용료에 포함)';
COMMENT ON COLUMN public.subscription_cycle.credits_used IS '사용한 작업 크레딧';
COMMENT ON COLUMN public.subscription_cycle.credits_remaining IS '남은 작업 크레딧 (자동 계산)';

-- ==================== 7. 기존 token_usage 테이블과의 호환성 유지 ====================

-- token_usage 테이블은 내부 추적용으로 유지하되, work_credit_usage가 메인 테이블
-- 기존 데이터 마이그레이션은 별도 스크립트로 처리

-- ==================== 완료 ====================
SELECT '✅ 작업 크레딧 기반 빌링 시스템 스키마 생성 완료!' as result;

