-- ============================================
-- 등급별 토큰 한도 업데이트
-- member-management.html의 등급 체계에 맞춘 토큰 한도 설정
-- 실행: Supabase SQL Editor에서 실행
-- ============================================

-- 토큰 계산 기준:
-- - 리뷰 답글 1개: 약 1,000 토큰 (평균)
-- - 블로그 포스팅 1개: 약 7,500 토큰 (평균)
-- 
-- 등급별 한도 계산:
-- owner:
--   - seed: review 10개 (10,000) + blog 2개 (15,000) = 25,000 토큰
--   - power: review 50개 (50,000) + blog 10개 (75,000) = 125,000 토큰
--   - big_power: review 200개 (200,000) + blog 30개 (225,000) = 425,000 토큰
--   - premium: review 무제한 + blog 100개 (750,000) = 1,000,000 토큰
--
-- agency:
--   - elite: review 100개 (100,000) + blog 50개 (375,000) = 475,000 토큰
--   - expert: review 500개 (500,000) + blog 200개 (1,500,000) = 2,000,000 토큰
--   - master: review 2000개 (2,000,000) + blog 500개 (3,750,000) = 5,750,000 토큰
--   - platinum: 무제한 = 10,000,000 토큰

-- 기존 token_config 업데이트 또는 새로 생성
DO $$
DECLARE
  existing_id uuid;
BEGIN
  -- 기존 설정 조회
  SELECT id INTO existing_id FROM public.token_config ORDER BY updated_at DESC LIMIT 1;
  
  IF existing_id IS NOT NULL THEN
    -- 기존 설정 업데이트
    UPDATE public.token_config
    SET
      -- 식당대표 등급별 토큰 한도
      owner_seed_limit = 25000,        -- 씨앗: review 10 + blog 2
      owner_power_limit = 125000,      -- 파워: review 50 + blog 10
      owner_bigpower_limit = 425000,   -- 빅파워: review 200 + blog 30
      owner_premium_limit = 1000000,   -- 프리미엄: review 무제한 + blog 100
      
      -- 대행사 등급별 토큰 한도
      agency_elite_limit = 475000,     -- 엘리트: review 100 + blog 50
      agency_expert_limit = 2000000,   -- 전문가: review 500 + blog 200
      agency_master_limit = 5750000,  -- 마스터: review 2000 + blog 500
      agency_premium_limit = 10000000, -- 플래티넘: 무제한
      
      updated_at = NOW()
    WHERE id = existing_id;
    
    RAISE NOTICE '✅ 기존 토큰 설정 업데이트 완료 (ID: %)', existing_id;
  ELSE
    -- 새 설정 생성
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
      25000,      -- 씨앗
      125000,     -- 파워
      425000,     -- 빅파워
      1000000,    -- 프리미엄
      475000,     -- 엘리트
      2000000,    -- 전문가
      5750000,    -- 마스터
      10000000    -- 플래티넘
    );
    
    RAISE NOTICE '✅ 새 토큰 설정 생성 완료';
  END IF;
END $$;

-- 업데이트된 설정 확인
SELECT 
  '토큰 한도 설정' as description,
  owner_seed_limit as "씨앗",
  owner_power_limit as "파워",
  owner_bigpower_limit as "빅파워",
  owner_premium_limit as "프리미엄",
  agency_elite_limit as "엘리트",
  agency_expert_limit as "전문가",
  agency_master_limit as "마스터",
  agency_premium_limit as "플래티넘",
  updated_at as "업데이트일"
FROM public.token_config
ORDER BY updated_at DESC
LIMIT 1;

-- 성공 메시지
SELECT '✅ 등급별 토큰 한도 업데이트 완료!' as status;

