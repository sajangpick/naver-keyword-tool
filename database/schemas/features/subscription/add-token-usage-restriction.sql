-- ============================================
-- 토큰 사용 제한 기능 추가
-- 작성일: 2025-11-25
-- 버전: 1.0
-- ============================================

-- token_config 테이블에 각 등급별 토큰 사용 활성화/비활성화 필드 추가
ALTER TABLE public.token_config 
ADD COLUMN IF NOT EXISTS owner_seed_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS owner_power_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS owner_bigpower_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS owner_premium_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS agency_elite_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS agency_expert_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS agency_master_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS agency_premium_enabled boolean DEFAULT true;

-- 전체 토큰 사용 제어 필드 추가 (모든 등급 일괄 제어)
ALTER TABLE public.token_config 
ADD COLUMN IF NOT EXISTS token_usage_enabled boolean DEFAULT true;

-- 코멘트 추가
COMMENT ON COLUMN public.token_config.owner_seed_enabled IS '식당대표 씨앗 등급 토큰 사용 활성화 여부';
COMMENT ON COLUMN public.token_config.owner_power_enabled IS '식당대표 파워 등급 토큰 사용 활성화 여부';
COMMENT ON COLUMN public.token_config.owner_bigpower_enabled IS '식당대표 빅파워 등급 토큰 사용 활성화 여부';
COMMENT ON COLUMN public.token_config.owner_premium_enabled IS '식당대표 프리미엄 등급 토큰 사용 활성화 여부';
COMMENT ON COLUMN public.token_config.agency_elite_enabled IS '대행사 엘리트 등급 토큰 사용 활성화 여부';
COMMENT ON COLUMN public.token_config.agency_expert_enabled IS '대행사 전문가 등급 토큰 사용 활성화 여부';
COMMENT ON COLUMN public.token_config.agency_master_enabled IS '대행사 마스터 등급 토큰 사용 활성화 여부';
COMMENT ON COLUMN public.token_config.agency_premium_enabled IS '대행사 프리미엄 등급 토큰 사용 활성화 여부';
COMMENT ON COLUMN public.token_config.token_usage_enabled IS '전체 토큰 사용 활성화 여부 (false면 모든 등급 토큰 사용 불가)';

