-- ============================================
-- 구독 시스템 초기 데이터 설정
-- 실행: Supabase SQL Editor에서 실행
-- ============================================

-- 1. 기존 데이터 삭제 (있을 경우)
TRUNCATE TABLE public.pricing_config CASCADE;
TRUNCATE TABLE public.token_config CASCADE;

-- 2. 가격 설정 초기 데이터 삽입
INSERT INTO public.pricing_config (
  owner_seed_price,
  owner_power_price,
  owner_bigpower_price,
  owner_premium_price,
  agency_elite_price,
  agency_expert_price,
  agency_master_price,
  agency_premium_price
) VALUES (
  0,        -- 씨앗 (무료)
  30000,    -- 파워
  50000,    -- 빅파워
  70000,    -- 프리미엄
  100000,   -- 엘리트
  300000,   -- 전문가
  500000,   -- 마스터
  1000000   -- 프리미엄
);

-- 3. 토큰 한도 초기 데이터 삽입
INSERT INTO public.token_config (
  owner_seed_limit,
  owner_power_limit,
  owner_bigpower_limit,
  owner_premium_limit,
  agency_elite_limit,
  agency_expert_limit,
  agency_master_limit,
  agency_premium_limit
) VALUES (
  100,      -- 씨앗
  500,      -- 파워
  833,      -- 빅파워
  1166,     -- 프리미엄
  1000,     -- 엘리트
  3000,     -- 전문가
  5000,     -- 마스터
  10000     -- 프리미엄
);

-- 4. 데이터 확인
SELECT 'pricing_config' as table_name, * FROM public.pricing_config;
SELECT 'token_config' as table_name, * FROM public.token_config;

-- 성공 메시지
SELECT '✅ 초기 데이터 설정 완료!' as status;
