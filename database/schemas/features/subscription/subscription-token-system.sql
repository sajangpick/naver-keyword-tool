-- ============================================
-- 토큰 기반 구독 시스템 스키마
-- 작성일: 2025-10-31
-- 버전: 1.0
-- ============================================

-- ==================== 확장 기능 활성화 ====================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==================== 1. 가격 설정 (일괄) ====================

CREATE TABLE IF NOT EXISTS public.pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 식당대표 기본 가격
  owner_seed_price integer DEFAULT 0,
  owner_power_price integer DEFAULT 30000,
  owner_bigpower_price integer DEFAULT 50000,
  owner_premium_price integer DEFAULT 70000,
  
  -- 대행사 기본 가격
  agency_elite_price integer DEFAULT 100000,
  agency_expert_price integer DEFAULT 300000,
  agency_master_price integer DEFAULT 500000,
  agency_premium_price integer DEFAULT 1000000,
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.pricing_config IS '구독 등급별 기본 가격 설정 (어드민만 수정)';
COMMENT ON COLUMN public.pricing_config.owner_seed_price IS '식당대표 씨앗 (무료)';
COMMENT ON COLUMN public.pricing_config.owner_power_price IS '식당대표 파워 (기본 30,000원)';

-- ==================== 2. 토큰 한도 설정 (일괄) ====================

CREATE TABLE IF NOT EXISTS public.token_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 식당대표 기본 토큰 한도
  owner_seed_limit integer DEFAULT 100,
  owner_power_limit integer DEFAULT 500,
  owner_bigpower_limit integer DEFAULT 833,
  owner_premium_limit integer DEFAULT 1166,
  
  -- 대행사 기본 토큰 한도
  agency_elite_limit integer DEFAULT 1000,
  agency_expert_limit integer DEFAULT 3000,
  agency_master_limit integer DEFAULT 5000,
  agency_premium_limit integer DEFAULT 10000,
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.token_config IS '구독 등급별 기본 월 토큰 한도 (어드민만 수정)';
COMMENT ON COLUMN public.token_config.owner_seed_limit IS '식당대표 씨앗 월 토큰 (기본 100)';
COMMENT ON COLUMN public.token_config.owner_power_limit IS '식당대표 파워 월 토큰 (기본 500)';

-- ==================== 3. 구독 주기 관리 ====================

CREATE TABLE IF NOT EXISTS public.subscription_cycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 회원 정보
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_type text NOT NULL, -- 'owner' 또는 'agency'
  
  -- 구독 주기
  cycle_start_date date NOT NULL,
  cycle_end_date date NOT NULL,
  days_in_cycle integer DEFAULT 30,
  
  -- 토큰 정보
  monthly_token_limit integer NOT NULL,
  tokens_used integer DEFAULT 0,
  tokens_remaining integer,
  
  -- 상태
  status text DEFAULT 'active', -- 'active', 'exceeded', 'expired'
  is_exceeded boolean DEFAULT false,
  exceeded_at timestamp with time zone,
  
  -- 결제 정보
  billing_amount integer NOT NULL,
  payment_date date,
  payment_status text DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.subscription_cycle IS '사용자별 구독 주기 관리 (사용 시작일 기준 약 30일)';
COMMENT ON COLUMN public.subscription_cycle.cycle_start_date IS '구독 시작일 (사용 시작일)';
COMMENT ON COLUMN public.subscription_cycle.tokens_remaining IS '남은 토큰 (자동 계산)';
COMMENT ON COLUMN public.subscription_cycle.is_exceeded IS '토큰 한도 초과 여부';

CREATE INDEX IF NOT EXISTS idx_subscription_cycle_user ON public.subscription_cycle(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_cycle_status ON public.subscription_cycle(status);

-- ==================== 4. 개인별 맞춤 가격 ====================

CREATE TABLE IF NOT EXISTS public.member_custom_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 회원 정보
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 맞춤 가격
  custom_price integer, -- NULL이면 기본 가격 사용
  discount_reason text, -- 할인/인상 사유 (선택)
  
  -- 적용 기간
  applied_from date DEFAULT CURRENT_DATE,
  applied_until date, -- NULL이면 계속 적용
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.member_custom_pricing IS '특정 회원의 맞춤 가격 (어드민이 개별 설정)';
COMMENT ON COLUMN public.member_custom_pricing.custom_price IS 'NULL이면 기본 가격, 지정하면 그 가격 사용';

CREATE INDEX IF NOT EXISTS idx_member_custom_pricing_member ON public.member_custom_pricing(member_id);

-- ==================== 5. 개인별 맞춤 토큰 한도 ====================

CREATE TABLE IF NOT EXISTS public.member_custom_token_limit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 회원 정보
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 맞춤 토큰 한도
  custom_limit integer, -- NULL이면 기본 한도 사용
  reason text, -- 사유 (이벤트, 프로모션 등)
  
  -- 적용 기간
  applied_from date DEFAULT CURRENT_DATE,
  applied_until date, -- NULL이면 계속 적용
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.member_custom_token_limit IS '특정 회원의 맞춤 토큰 한도 (어드민이 개별 설정)';
COMMENT ON COLUMN public.member_custom_token_limit.custom_limit IS 'NULL이면 기본 한도, 지정하면 그 한도 사용';

CREATE INDEX IF NOT EXISTS idx_member_custom_token_member ON public.member_custom_token_limit(member_id);

-- ==================== 6. 토큰 사용 기록 ====================

CREATE TABLE IF NOT EXISTS public.token_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 사용자 정보
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id uuid, -- 대행사 관리 식당인 경우만 사용
  
  -- 토큰 사용
  tokens_used integer NOT NULL,
  api_type text NOT NULL, -- 'chatgpt-blog', 'generate-reply', 'ai-news' 등
  
  -- 사용 상세
  input_tokens integer,
  output_tokens integer,
  
  -- 메타데이터
  used_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.token_usage IS '각 API 호출 시 토큰 사용 기록';
COMMENT ON COLUMN public.token_usage.store_id IS '대행사 관리 식당인 경우에만 값 설정';

CREATE INDEX IF NOT EXISTS idx_token_usage_user ON public.token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_store ON public.token_usage(store_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_date ON public.token_usage(used_at);

-- ==================== 7. 월별 청구 이력 ====================

CREATE TABLE IF NOT EXISTS public.billing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 회원 정보
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_type text NOT NULL, -- 'owner' 또는 'agency'
  membership_level text NOT NULL,
  
  -- 구독 주기
  billing_period_start date NOT NULL,
  billing_period_end date NOT NULL,
  
  -- 토큰 정보
  monthly_limit integer NOT NULL,
  tokens_used integer NOT NULL,
  is_exceeded boolean DEFAULT false,
  exceeded_amount integer DEFAULT 0, -- 초과한 토큰
  
  -- 요금
  base_price integer NOT NULL, -- 기본 가격
  discount_price integer DEFAULT 0, -- 할인가 (음수로 표시)
  extra_charge integer DEFAULT 0, -- 초과 요금
  total_price integer NOT NULL, -- 최종 청구액
  
  -- 결제 상태
  payment_date date,
  payment_status text DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  payment_method text, -- 'auto', 'manual' 등
  
  -- 남은 토큰 처리
  leftover_tokens integer DEFAULT 0,
  leftover_action text DEFAULT 'expired', -- 'expired' (소멸) 또는 'carried_over' (이월)
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.billing_history IS '매월 자동 청구 기록';
COMMENT ON COLUMN public.billing_history.leftover_action IS '현재는 항상 expired (이월 없음)';

CREATE INDEX IF NOT EXISTS idx_billing_history_user ON public.billing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_period ON public.billing_history(billing_period_start, billing_period_end);

-- ==================== 8. 대행사 관리 식당 ====================

CREATE TABLE IF NOT EXISTS public.agency_managed_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 대행사 정보
  agency_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 식당 기본 정보
  store_name varchar(200) NOT NULL,
  store_phone varchar(20),
  store_address text,
  naver_place_url text,
  
  -- 계정 정보 (암호화 저장)
  naver_id text, -- pgcrypto로 암호화
  naver_password_encrypted text, -- 암호화된 비밀번호
  google_id text,
  google_password_encrypted text, -- 암호화된 비밀번호
  
  -- 상태
  is_active boolean DEFAULT true,
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.agency_managed_stores IS '대행사가 관리하는 카카오 계정 없는 식당들';
COMMENT ON COLUMN public.agency_managed_stores.naver_password_encrypted IS 'pgcrypto로 암호화된 비밀번호 (복호화 가능)';
COMMENT ON COLUMN public.agency_managed_stores.google_password_encrypted IS 'pgcrypto로 암호화된 비밀번호 (복호화 가능)';

CREATE INDEX IF NOT EXISTS idx_agency_managed_stores_agency ON public.agency_managed_stores(agency_id);

-- ==================== 9. 업그레이드 요청 ====================

CREATE TABLE IF NOT EXISTS public.upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 회원 정보
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 현재/요청 등급
  current_membership_level text NOT NULL,
  requested_membership_level text NOT NULL,
  
  -- 요청 사유
  reason text,
  
  -- 상태
  status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  approved_at timestamp with time zone,
  approved_by_admin_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- 추가 결제
  additional_charge integer DEFAULT 0,
  
  -- 메타데이터
  requested_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.upgrade_requests IS '토큰 초과 시 사용자의 업그레이드 요청';
COMMENT ON COLUMN public.upgrade_requests.additional_charge IS '업그레이드 시 추가로 청구되는 금액';

CREATE INDEX IF NOT EXISTS idx_upgrade_requests_user ON public.upgrade_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status ON public.upgrade_requests(status);

-- ==================== 10. 자동 업데이트 트리거 ====================

CREATE OR REPLACE FUNCTION update_pricing_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pricing_config_updated_at
BEFORE UPDATE ON public.pricing_config
FOR EACH ROW
EXECUTE FUNCTION update_pricing_config_timestamp();

CREATE TRIGGER token_config_updated_at
BEFORE UPDATE ON public.token_config
FOR EACH ROW
EXECUTE FUNCTION update_pricing_config_timestamp();

CREATE TRIGGER subscription_cycle_updated_at
BEFORE UPDATE ON public.subscription_cycle
FOR EACH ROW
EXECUTE FUNCTION update_pricing_config_timestamp();

CREATE TRIGGER member_custom_pricing_updated_at
BEFORE UPDATE ON public.member_custom_pricing
FOR EACH ROW
EXECUTE FUNCTION update_pricing_config_timestamp();

CREATE TRIGGER member_custom_token_limit_updated_at
BEFORE UPDATE ON public.member_custom_token_limit
FOR EACH ROW
EXECUTE FUNCTION update_pricing_config_timestamp();

CREATE TRIGGER agency_managed_stores_updated_at
BEFORE UPDATE ON public.agency_managed_stores
FOR EACH ROW
EXECUTE FUNCTION update_pricing_config_timestamp();

-- ==================== 완료 ====================
SELECT '✅ 토큰 기반 구독 시스템 스키마 생성 완료!' as result;
