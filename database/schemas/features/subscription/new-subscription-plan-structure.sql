-- ============================================
-- 새로운 월 정액제 요금제 구조 적용
-- 작성일: 2025-11-25
-- 버전: 2.0
-- ============================================

-- ==================== 1. 가격 설정 업데이트 ====================

-- 새로운 요금제 구조:
-- Light (seed): 0원/월, 30,000 토큰
-- Standard (power): 30,000원/월, 350,000 토큰
-- Pro (bigpower): 50,000원/월, 650,000 토큰
-- Premium (premium): 100,000원/월, 1,500,000 토큰
-- 초과분: 1,000토큰당 1,000원

-- 기존 pricing_config 업데이트
UPDATE public.pricing_config
SET 
  owner_seed_price = 0,
  owner_power_price = 30000,
  owner_bigpower_price = 50000,
  owner_premium_price = 100000,
  updated_at = now()
WHERE id IN (SELECT id FROM public.pricing_config LIMIT 1);

-- 데이터가 없으면 새로 생성
INSERT INTO public.pricing_config (
  owner_seed_price,
  owner_power_price,
  owner_bigpower_price,
  owner_premium_price,
  agency_elite_price,
  agency_expert_price,
  agency_master_price,
  agency_premium_price
)
SELECT 0, 30000, 50000, 100000, 100000, 300000, 500000, 1000000
WHERE NOT EXISTS (SELECT 1 FROM public.pricing_config);

-- ==================== 2. 토큰 한도 설정 업데이트 ====================

-- 새로운 토큰 한도:
-- Light (seed): 30,000 토큰
-- Standard (power): 350,000 토큰
-- Pro (bigpower): 650,000 토큰
-- Premium (premium): 1,500,000 토큰

UPDATE public.token_config
SET 
  owner_seed_limit = 30000,
  owner_power_limit = 350000,
  owner_bigpower_limit = 650000,
  owner_premium_limit = 1500000,
  updated_at = now()
WHERE id IN (SELECT id FROM public.token_config LIMIT 1);

-- 데이터가 없으면 새로 생성
INSERT INTO public.token_config (
  owner_seed_limit,
  owner_power_limit,
  owner_bigpower_limit,
  owner_premium_limit,
  agency_elite_limit,
  agency_expert_limit,
  agency_master_limit,
  agency_premium_limit
)
SELECT 30000, 350000, 650000, 1500000, 1000, 3000, 5000, 10000
WHERE NOT EXISTS (SELECT 1 FROM public.token_config);

-- ==================== 3. 사용자 구독 정보 테이블 추가 ====================

CREATE TABLE IF NOT EXISTS public.user_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 회원 정보
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 구독 정보
  plan_type text NOT NULL, -- 'light', 'standard', 'pro', 'premium'
  monthly_fee integer NOT NULL, -- 월 정액: 0, 30000, 50000, 100000
  base_tokens integer NOT NULL, -- 기본 제공 토큰: 30000, 350000, 650000, 1500000
  excess_token_rate integer DEFAULT 1000, -- 초과 토큰 단가: 1,000토큰당 1,000원 (1원/토큰)
  
  -- 구독 기간
  subscription_start_date date NOT NULL DEFAULT CURRENT_DATE,
  subscription_end_date date, -- NULL이면 자동 갱신
  is_active boolean DEFAULT true,
  auto_renew boolean DEFAULT true, -- 자동 갱신 여부
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.user_subscription IS '사용자별 구독 정보 (월 정액제)';
COMMENT ON COLUMN public.user_subscription.plan_type IS 'light, standard, pro, premium';
COMMENT ON COLUMN public.user_subscription.excess_token_rate IS '초과 토큰 단가 (1,000토큰당 1,000원 = 1원/토큰)';

CREATE INDEX IF NOT EXISTS idx_user_subscription_user ON public.user_subscription(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscription_active ON public.user_subscription(is_active);

-- ==================== 4. billing_history 테이블 확장 ====================

-- billing_history 테이블에 초과 토큰 관련 필드가 이미 있는지 확인 후 추가
DO $$
BEGIN
  -- excess_tokens 컬럼이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'excess_tokens'
  ) THEN
    ALTER TABLE public.billing_history ADD COLUMN excess_tokens integer DEFAULT 0;
    COMMENT ON COLUMN public.billing_history.excess_tokens IS '초과 사용한 토큰 (total_tokens_used - base_tokens)';
  END IF;

  -- excess_fee 컬럼이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'excess_fee'
  ) THEN
    ALTER TABLE public.billing_history ADD COLUMN excess_fee integer DEFAULT 0;
    COMMENT ON COLUMN public.billing_history.excess_fee IS '초과 요금 (excess_tokens ÷ 1000 × 1000)';
  END IF;

  -- invoice_issued_date 컬럼이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'invoice_issued_date'
  ) THEN
    ALTER TABLE public.billing_history ADD COLUMN invoice_issued_date date;
    COMMENT ON COLUMN public.billing_history.invoice_issued_date IS '청구서 발행일 (익월 초 1~5일)';
  END IF;

  -- billing_month 컬럼이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'billing_history' 
    AND column_name = 'billing_month'
  ) THEN
    ALTER TABLE public.billing_history ADD COLUMN billing_month text;
    COMMENT ON COLUMN public.billing_history.billing_month IS '청구 월 (YYYY-MM 형식)';
  END IF;
END $$;

-- ==================== 5. 토큰 사용 내역 테이블 확장 ====================

-- token_usage 테이블에 service_type과 ai_model 필드 추가
DO $$
BEGIN
  -- service_type 컬럼이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'token_usage' 
    AND column_name = 'service_type'
  ) THEN
    ALTER TABLE public.token_usage ADD COLUMN service_type text;
    COMMENT ON COLUMN public.token_usage.service_type IS '서비스 유형: 블로그, 영상, 리뷰 등';
  END IF;

  -- ai_model 컬럼이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'token_usage' 
    AND column_name = 'ai_model'
  ) THEN
    ALTER TABLE public.token_usage ADD COLUMN ai_model text;
    COMMENT ON COLUMN public.token_usage.ai_model IS 'AI 모델: ChatGPT, Gemini, Claude 등';
  END IF;

  -- usage_date 컬럼이 없으면 추가 (used_at과 별도로 월별 집계용)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'token_usage' 
    AND column_name = 'usage_date'
  ) THEN
    ALTER TABLE public.token_usage ADD COLUMN usage_date date;
    COMMENT ON COLUMN public.token_usage.usage_date IS '사용일 (월별 집계용, used_at의 날짜 부분)';
  END IF;
END $$;

-- usage_date 자동 업데이트 트리거 (used_at 기반)
CREATE OR REPLACE FUNCTION update_token_usage_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.usage_date = DATE(NEW.used_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거가 없으면 생성
DROP TRIGGER IF EXISTS trigger_update_token_usage_date ON public.token_usage;
CREATE TRIGGER trigger_update_token_usage_date
BEFORE INSERT OR UPDATE ON public.token_usage
FOR EACH ROW
EXECUTE FUNCTION update_token_usage_date();

-- ==================== 6. 사용량 알림 테이블 추가 ====================

CREATE TABLE IF NOT EXISTS public.usage_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 회원 정보
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 알림 정보
  notification_type text NOT NULL, -- '80_percent', '100_percent', 'excess_usage'
  notification_message text NOT NULL,
  is_read boolean DEFAULT false,
  
  -- 관련 데이터
  current_usage integer, -- 현재 사용량
  base_tokens integer, -- 기본 제공량
  excess_tokens integer DEFAULT 0, -- 초과 토큰
  estimated_charge integer DEFAULT 0, -- 예상 추가 요금
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  read_at timestamp with time zone
);

COMMENT ON TABLE public.usage_notifications IS '토큰 사용량 알림 (80%, 100%, 초과 사용)';
COMMENT ON COLUMN public.usage_notifications.notification_type IS '80_percent, 100_percent, excess_usage';

CREATE INDEX IF NOT EXISTS idx_usage_notifications_user ON public.usage_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_notifications_read ON public.usage_notifications(is_read);

-- ==================== 7. 사용자별 월간 사용 한도 설정 테이블 ====================

CREATE TABLE IF NOT EXISTS public.user_usage_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 회원 정보
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 한도 설정
  monthly_max_tokens integer, -- NULL이면 제한 없음
  action_on_limit text DEFAULT 'notify', -- 'notify' (알림만), 'pause' (서비스 일시 중지)
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.user_usage_limits IS '사용자별 월간 사용 한도 설정 (선택사항)';
COMMENT ON COLUMN public.user_usage_limits.action_on_limit IS '한도 도달 시 동작: notify 또는 pause';

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_usage_limits_user ON public.user_usage_limits(user_id);

-- ==================== 완료 ====================
SELECT '✅ 새로운 월 정액제 요금제 구조 적용 완료!' as result;

