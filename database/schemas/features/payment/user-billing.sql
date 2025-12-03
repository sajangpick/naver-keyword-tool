-- ============================================
-- 사용자 카드 등록 테이블
-- 작성일: 2025-11-25
-- 버전: 1.0
-- ============================================

-- 사용자 빌링 정보 (카드 등록)
CREATE TABLE IF NOT EXISTS public.user_billing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 회원 정보
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 카드 정보 (토스페이먼츠 등 PG사에서 제공)
  billing_key text UNIQUE,              -- PG사에서 발급한 빌링키
  customer_key text,                    -- 고객 키
  card_number text,                     -- 마스킹된 카드번호 (예: 1234-****-****-5678)
  card_company text,                    -- 카드사 (예: 신한카드, KB카드)
  card_type text,                       -- 카드 타입 (신용카드, 체크카드)
  
  -- 카드 별칭 (사용자가 설정)
  card_alias text,                      -- 예: "주 카드", "회사 카드"
  
  -- 상태
  is_active boolean DEFAULT true,       -- 활성화 여부
  is_default boolean DEFAULT false,     -- 기본 카드 여부
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.user_billing IS '사용자 등록 카드 정보';
COMMENT ON COLUMN public.user_billing.billing_key IS 'PG사에서 발급한 빌링키 (자동 결제용)';
COMMENT ON COLUMN public.user_billing.card_number IS '마스킹된 카드번호 (보안)';
COMMENT ON COLUMN public.user_billing.card_alias IS '사용자가 설정한 카드 별칭';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_billing_user_id ON public.user_billing(user_id);
CREATE INDEX IF NOT EXISTS idx_user_billing_active ON public.user_billing(user_id, is_active) WHERE is_active = true;

-- 기본 카드는 한 개만 허용 (트리거 또는 애플리케이션 레벨에서 처리)
