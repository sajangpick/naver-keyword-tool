-- 사용자의 membership_level 확인 쿼리
-- 이메일로 검색: ohdaejun@naver.com

SELECT 
  id,
  email,
  name,
  user_type,
  membership_level,
  created_at,
  updated_at
FROM profiles
WHERE email = 'ohdaejun@naver.com';

-- 모든 관리자 계정 확인
SELECT 
  id,
  email,
  name,
  user_type,
  membership_level,
  created_at
FROM profiles
WHERE user_type = 'admin' OR membership_level = 'admin'
ORDER BY created_at DESC;

