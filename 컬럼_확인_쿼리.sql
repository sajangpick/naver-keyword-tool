-- ============================================
-- subscription_cycle 테이블 컬럼 확인
-- ============================================

-- 1. 모든 컬럼 목록 확인
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'subscription_cycle'
ORDER BY ordinal_position;

-- 2. 작업 크레딧 컬럼이 있는지 확인
SELECT 
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'credits_used'
  ) THEN '✅ credits_used 컬럼 있음' ELSE '❌ credits_used 컬럼 없음' END as credits_used_check,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'credits_remaining'
  ) THEN '✅ credits_remaining 컬럼 있음' ELSE '❌ credits_remaining 컬럼 없음' END as credits_remaining_check,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'subscription_cycle' 
    AND column_name = 'included_credits'
  ) THEN '✅ included_credits 컬럼 있음' ELSE '❌ included_credits 컬럼 없음' END as included_credits_check;

-- 3. 실제 데이터 확인 (샘플)
SELECT 
  id,
  user_id,
  credits_used,
  credits_remaining,
  included_credits,
  status,
  created_at
FROM public.subscription_cycle
ORDER BY created_at DESC
LIMIT 5;

