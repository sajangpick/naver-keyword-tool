-- ============================================
-- 모든 'free' 등급을 'seed'로 변경
-- 대소문자 구분 없이 처리 (FREE, Free, free 모두)
-- ============================================

-- 1. 모든 'free' 등급을 'seed'로 변경 (대소문자 구분 없음)
UPDATE profiles 
SET 
  membership_level = 'seed',
  updated_at = NOW()
WHERE 
  LOWER(membership_level) = 'free' 
  OR membership_level IS NULL
  OR membership_level = '';

-- 2. 변경 전 확인 (몇 명이 변경될지 확인)
SELECT 
  '변경 전' as status,
  user_type,
  membership_level,
  COUNT(*) as count
FROM profiles
WHERE 
  LOWER(membership_level) = 'free' 
  OR membership_level IS NULL
  OR membership_level = ''
GROUP BY user_type, membership_level
ORDER BY user_type, membership_level;

-- 3. 변경 후 확인 (모든 등급 분포)
SELECT 
  '변경 후' as status,
  user_type,
  membership_level,
  COUNT(*) as count
FROM profiles
GROUP BY user_type, membership_level
ORDER BY user_type, membership_level;

-- 4. 'free'가 남아있는지 최종 확인 (결과가 없어야 함)
SELECT 
  id,
  email,
  name,
  membership_level,
  user_type
FROM profiles
WHERE LOWER(membership_level) = 'free'
LIMIT 10;

