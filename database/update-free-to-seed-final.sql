-- 기존 'free' 등급 회원들을 'seed'로 변경 (최종)
-- 실행일: 2025-11-12

UPDATE profiles 
SET membership_level = 'seed',
    updated_at = now()
WHERE membership_level = 'free' OR membership_level IS NULL;

-- 확인 쿼리
SELECT 
  user_type,
  membership_level,
  COUNT(*) as count
FROM profiles
GROUP BY user_type, membership_level
ORDER BY user_type, membership_level;

