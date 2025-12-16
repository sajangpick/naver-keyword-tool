-- ============================================
-- 기존 token_usage 데이터를 work_credit_usage로 마이그레이션
-- 작성일: 2025-11-25
-- 버전: 1.0
-- ============================================
-- 
-- 이 스크립트는 기존 token_usage 테이블의 데이터를 
-- work_credit_usage 테이블로 변환하여 작업 크레딧 시스템과 연동합니다.
--
-- 변환 규칙:
-- - api_type에 따라 서비스 타입 결정
-- - 작업 단위당 크레딧 가중치 적용 (리뷰 1, 블로그 5, 영상 20)
-- - 기존 사용 기록을 작업 크레딧으로 변환

-- ==================== 1. 기존 token_usage 데이터 확인 ====================

-- 먼저 기존 데이터 확인
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(used_at) as earliest_usage,
  MAX(used_at) as latest_usage
FROM token_usage;

-- ==================== 2. token_usage → work_credit_usage 변환 ====================

-- 기존 데이터를 작업 크레딧으로 변환하여 삽입
INSERT INTO work_credit_usage (
  user_id,
  store_id,
  service_type,
  work_credits_used,
  input_tokens,
  output_tokens,
  ai_model,
  usage_date,
  used_at,
  created_at
)
SELECT 
  tu.user_id,
  tu.store_id,
  -- api_type을 기반으로 서비스 타입 결정
  CASE 
    WHEN tu.api_type LIKE '%blog%' OR tu.api_type LIKE '%chatgpt-blog%' THEN 'blog_writing'
    WHEN tu.api_type LIKE '%review%' OR tu.api_type LIKE '%reply%' OR tu.api_type LIKE '%naver-auto-reply%' THEN 'review_reply'
    WHEN tu.api_type LIKE '%video%' OR tu.api_type LIKE '%shorts%' THEN 'video_generation'
    WHEN tu.api_type LIKE '%news%' OR tu.api_type LIKE '%ai-news%' THEN 'review_reply'  -- 뉴스는 리뷰 답글과 동일
    ELSE 'review_reply'  -- 기본값
  END as service_type,
  -- 작업 크레딧 계산 (서비스 타입별 가중치)
  CASE 
    WHEN tu.api_type LIKE '%blog%' OR tu.api_type LIKE '%chatgpt-blog%' THEN 5  -- 블로그: 5 크레딧
    WHEN tu.api_type LIKE '%video%' OR tu.api_type LIKE '%shorts%' THEN 20  -- 영상: 20 크레딧
    ELSE 1  -- 리뷰 답글 등: 1 크레딧
  END as work_credits_used,
  tu.input_tokens,
  tu.output_tokens,
  -- ai_model 결정
  CASE 
    WHEN tu.api_type LIKE '%chatgpt%' OR tu.api_type LIKE '%gpt%' THEN 'chatgpt'
    WHEN tu.api_type LIKE '%gemini%' THEN 'gemini'
    WHEN tu.api_type LIKE '%claude%' THEN 'claude'
    ELSE 'chatgpt'  -- 기본값
  END as ai_model,
  DATE(tu.used_at) as usage_date,
  tu.used_at,
  tu.used_at as created_at
FROM token_usage tu
WHERE tu.user_id IS NOT NULL
  AND tu.used_at IS NOT NULL
  -- 중복 방지: 이미 변환된 데이터는 제외
  AND NOT EXISTS (
    SELECT 1 
    FROM work_credit_usage wcu 
    WHERE wcu.user_id = tu.user_id 
      AND wcu.used_at = tu.used_at
      AND wcu.service_type = CASE 
        WHEN tu.api_type LIKE '%blog%' OR tu.api_type LIKE '%chatgpt-blog%' THEN 'blog_writing'
        WHEN tu.api_type LIKE '%review%' OR tu.api_type LIKE '%reply%' OR tu.api_type LIKE '%naver-auto-reply%' THEN 'review_reply'
        WHEN tu.api_type LIKE '%video%' OR tu.api_type LIKE '%shorts%' THEN 'video_generation'
        ELSE 'review_reply'
      END
  )
ORDER BY tu.used_at ASC;

-- ==================== 3. 변환 결과 확인 ====================

-- 변환된 데이터 확인
SELECT 
  service_type,
  COUNT(*) as usage_count,
  SUM(work_credits_used) as total_credits,
  MIN(used_at) as earliest,
  MAX(used_at) as latest
FROM work_credit_usage
GROUP BY service_type
ORDER BY total_credits DESC;

-- 사용자별 변환된 크레딧 확인
SELECT 
  user_id,
  COUNT(*) as usage_count,
  SUM(work_credits_used) as total_credits,
  COUNT(DISTINCT service_type) as service_types
FROM work_credit_usage
GROUP BY user_id
ORDER BY total_credits DESC
LIMIT 10;

-- ==================== 4. 최근 사용 내역 확인 ====================

-- 최근 10건의 작업 크레딧 사용 내역
SELECT 
  wcu.service_type,
  wcu.work_credits_used,
  wcu.used_at,
  p.email as user_email
FROM work_credit_usage wcu
LEFT JOIN profiles p ON p.id = wcu.user_id
ORDER BY wcu.used_at DESC
LIMIT 10;

-- ==================== 완료 ====================
SELECT '✅ token_usage → work_credit_usage 마이그레이션 완료!' as result;

