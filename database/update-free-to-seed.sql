-- 기존 'free' 등급 회원들을 'seed'로 변경
UPDATE profiles 
SET membership_level = 'seed' 
WHERE membership_level = 'free' OR membership_level IS NULL;

-- 확인
SELECT 
  user_type,
  membership_level,
  COUNT(*) as count
FROM profiles
GROUP BY user_type, membership_level
ORDER BY user_type, membership_level;

