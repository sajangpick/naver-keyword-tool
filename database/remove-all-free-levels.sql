-- ============================================
-- 모든 'free' 등급 완전 제거 스크립트
-- 실행일: 2025-12-03
-- ============================================
-- 
-- 이 스크립트는 DB에 남아있는 모든 'free' 등급을 'seed'로 변경합니다.
-- 대소문자 구분 없이 처리합니다 (FREE, Free, free 모두).
--
-- 실행 방법:
-- 1. Supabase 대시보드 → SQL Editor
-- 2. 이 스크립트 전체를 복사하여 실행
-- 3. 결과 확인

-- ==================== 1단계: 변경 전 확인 ====================
SELECT 
  '🔍 변경 전 상태' as step,
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

-- ==================== 2단계: 모든 'free'를 'seed'로 변경 ====================
UPDATE profiles 
SET 
  membership_level = 'seed',
  updated_at = NOW()
WHERE 
  LOWER(membership_level) = 'free' 
  OR membership_level IS NULL
  OR membership_level = '';

-- ==================== 3단계: 변경 후 확인 ====================
SELECT 
  '✅ 변경 후 상태' as step,
  user_type,
  membership_level,
  COUNT(*) as count
FROM profiles
GROUP BY user_type, membership_level
ORDER BY user_type, membership_level;

-- ==================== 4단계: 'free' 남아있는지 최종 확인 ====================
-- 이 쿼리의 결과가 비어있어야 정상입니다 (0 rows)
SELECT 
  '⚠️ 남아있는 free 등급 (있으면 안 됨!)' as warning,
  id,
  email,
  name,
  membership_level,
  user_type,
  created_at
FROM profiles
WHERE LOWER(membership_level) = 'free'
ORDER BY created_at DESC;

-- ==================== 5단계: NULL 등급 확인 ====================
-- NULL 등급도 모두 'seed'로 변경되었는지 확인
SELECT 
  '⚠️ NULL 등급 (있으면 안 됨!)' as warning,
  id,
  email,
  name,
  membership_level,
  user_type,
  created_at
FROM profiles
WHERE membership_level IS NULL OR membership_level = ''
ORDER BY created_at DESC;

