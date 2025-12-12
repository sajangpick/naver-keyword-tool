-- ============================================
-- 관리자 권한 설정 스크립트
-- 사용법: Supabase SQL Editor에서 실행
-- ============================================

-- 1. 이메일로 관리자 권한 설정 (user_type 또는 membership_level을 'admin'으로)
UPDATE public.profiles
SET 
  user_type = 'admin',
  membership_level = 'admin',
  updated_at = now()
WHERE email = 'ohdaejun@naver.com';  -- 여기에 본인 이메일 주소 입력

-- 2. 확인: 설정된 프로필 조회
SELECT 
  id,
  email,
  name,
  user_type,
  membership_level,
  created_at,
  updated_at
FROM public.profiles
WHERE email = 'ohdaejun@naver.com';  -- 여기에 본인 이메일 주소 입력

-- 3. (선택) 모든 관리자 목록 확인
SELECT 
  id,
  email,
  name,
  user_type,
  membership_level
FROM public.profiles
WHERE user_type = 'admin' 
   OR membership_level = 'admin';

-- ============================================
-- 참고: user_id로도 설정 가능
-- ============================================
-- UPDATE public.profiles
-- SET 
--   user_type = 'admin',
--   membership_level = 'admin',
--   role = 'admin',
--   updated_at = now()
-- WHERE id = '여기에-user-id-입력';

