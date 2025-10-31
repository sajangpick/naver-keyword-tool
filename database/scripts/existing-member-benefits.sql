-- ============================================
-- 기존 회원 특별 혜택 제공 스크립트
-- 실행일: 2025-10-31
-- ============================================

-- 1. 오래된 회원 조회 (예: 2025-10-01 이전 가입)
SELECT 
    id,
    email,
    name,
    created_at,
    membership_level,
    CASE 
        WHEN created_at < '2025-01-01' THEN '창립 멤버'
        WHEN created_at < '2025-06-01' THEN '초기 멤버'
        WHEN created_at < '2025-10-01' THEN '기존 멤버'
        ELSE '신규 멤버'
    END as member_grade
FROM public.profiles
ORDER BY created_at;

-- ==================== 옵션 1: 기존 회원 무료 업그레이드 ====================
-- 1개월 이상된 회원은 power 등급으로 업그레이드

UPDATE public.profiles 
SET membership_level = 'power'
WHERE created_at < CURRENT_DATE - INTERVAL '30 days'
AND membership_level = 'seed';

-- ==================== 옵션 2: 기존 회원 보너스 토큰 ====================
-- 가입일에 따라 차등 토큰 지급

-- 3개월 이상 회원: +500 토큰
INSERT INTO public.member_custom_token_limit (
    member_id,
    custom_limit,
    reason,
    applied_from,
    applied_until
)
SELECT 
    id,
    600,  -- 기본 100 + 보너스 500 = 600
    '기존 회원 감사 보너스 토큰',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '90 days'  -- 3개월간 유효
FROM public.profiles
WHERE created_at < CURRENT_DATE - INTERVAL '90 days'
AND NOT EXISTS (
    SELECT 1 FROM public.member_custom_token_limit 
    WHERE member_id = profiles.id
);

-- 1개월 이상 회원: +300 토큰
INSERT INTO public.member_custom_token_limit (
    member_id,
    custom_limit,
    reason,
    applied_from,
    applied_until
)
SELECT 
    id,
    400,  -- 기본 100 + 보너스 300 = 400
    '기존 회원 감사 보너스 토큰',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '60 days'  -- 2개월간 유효
FROM public.profiles
WHERE created_at < CURRENT_DATE - INTERVAL '30 days'
AND created_at >= CURRENT_DATE - INTERVAL '90 days'
AND NOT EXISTS (
    SELECT 1 FROM public.member_custom_token_limit 
    WHERE member_id = profiles.id
);

-- ==================== 옵션 3: 기존 회원 할인 혜택 ====================
-- 첫 결제 시 50% 할인

INSERT INTO public.member_custom_pricing (
    member_id,
    custom_price,
    discount_reason,
    applied_from,
    applied_until
)
SELECT 
    id,
    15000,  -- 파워 등급 30,000원의 50%
    '기존 회원 첫 결제 50% 할인',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days'  -- 한달간 유효
FROM public.profiles
WHERE created_at < CURRENT_DATE - INTERVAL '7 days'
AND NOT EXISTS (
    SELECT 1 FROM public.member_custom_pricing 
    WHERE member_id = profiles.id
);

-- ==================== 실제 적용할 쿼리 선택 ====================
-- 위 3가지 옵션 중 하나를 선택해서 실행하세요

-- 권장: 옵션 2 (보너스 토큰)
-- 이유: 
-- - 즉시 혜택을 체감할 수 있음
-- - 서비스를 경험하고 유료 전환 유도
-- - 기존 회원 이탈 방지

-- ==================== 적용 후 확인 ====================
SELECT 
    p.email,
    p.name,
    p.created_at,
    p.membership_level,
    mct.custom_limit as bonus_tokens,
    mct.reason,
    mcp.custom_price as special_price,
    mcp.discount_reason
FROM public.profiles p
LEFT JOIN public.member_custom_token_limit mct ON p.id = mct.member_id
LEFT JOIN public.member_custom_pricing mcp ON p.id = mcp.member_id
WHERE p.created_at < CURRENT_DATE - INTERVAL '7 days'
ORDER BY p.created_at;
