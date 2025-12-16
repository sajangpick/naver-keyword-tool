# 작업 크레딧 청구 시스템 설치 가이드

## 1단계: Supabase에서 테이블 생성

Supabase 대시보드 → SQL Editor에서 아래 파일을 실행하세요:

```
database/schemas/features/subscription/work-credit-billing-system.sql
```

이 파일은 다음 테이블을 생성합니다:
- `work_credit_config` - 기능별 작업 크레딧 가중치 (리뷰 1, 블로그 5, 영상 20)
- `work_credit_usage` - 작업 크레딧 사용 기록
- `user_subscription` - 사용자 구독 정보
- `billing_history` (수정) - 청구 내역에 작업 크레딧 컬럼 추가

## 2단계: 테이블 생성 확인

Supabase 대시보드 → Table Editor에서 아래 테이블이 생성되었는지 확인:
- ✅ `work_credit_config` 
- ✅ `work_credit_usage`
- ✅ `user_subscription`
- ✅ `billing_history` (새 컬럼 추가 확인)

## 3단계: 서버 재시작

```bash
# 터미널에서 실행
Ctrl + C  # 서버 중지
node server.js  # 서버 재시작
```

## 4단계: 테스트

### 4-1. 작업 크레딧 기록 테스트
1. 리뷰 답글 작성 (1 크레딧 소비)
2. 블로그 작성 (5 크레딧 소비)
3. 영상 생성 (20 크레딧 소비)

### 4-2. Supabase에서 확인
```sql
-- work_credit_usage 테이블에 데이터가 있는지 확인
SELECT * FROM work_credit_usage 
ORDER BY used_at DESC 
LIMIT 10;

-- 사용자별 총 크레딧 확인
SELECT 
  user_id,
  service_type,
  SUM(work_credits_used) as total_credits,
  COUNT(*) as usage_count
FROM work_credit_usage
GROUP BY user_id, service_type
ORDER BY total_credits DESC;
```

### 4-3. 관리자 청구 페이지에서 확인
1. `/admin/pages/billing-management.html` 접속
2. "청구 금액 미리보기" 버튼 클릭
3. 총 사용 크레딧이 표시되는지 확인

## 문제 해결

### 문제: 총 사용 크레딧이 0으로 표시됨

**원인 1: 테이블이 생성되지 않음**
- Supabase에서 `work_credit_usage` 테이블 확인
- 없으면 1단계 SQL 실행

**원인 2: 데이터가 기록되지 않음**
- 서버 콘솔에서 "✅ 작업 크레딧 사용 기록" 메시지 확인
- 없으면 서버 재시작 후 다시 테스트

**원인 3: 기존 데이터가 없음**
- 새로운 기능 사용 (리뷰 답글, 블로그 작성 등)
- Supabase에서 `work_credit_usage` 테이블에 데이터 확인

**원인 4: 날짜 범위 문제**
- 청구 페이지에서 올바른 월(YYYY-MM) 선택
- 최근 1-2개월 데이터만 표시됨

## 디버깅 쿼리

```sql
-- 1. 특정 사용자의 크레딧 사용 내역
SELECT * FROM work_credit_usage 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY used_at DESC;

-- 2. 특정 월의 크레딧 사용 내역
SELECT 
  user_id,
  SUM(work_credits_used) as total_credits,
  COUNT(*) as usage_count
FROM work_credit_usage
WHERE usage_date >= '2025-12-01' 
  AND usage_date <= '2025-12-31'
GROUP BY user_id;

-- 3. 서비스 타입별 크레딧 사용량
SELECT 
  service_type,
  SUM(work_credits_used) as total_credits,
  COUNT(*) as usage_count
FROM work_credit_usage
GROUP BY service_type;

-- 4. billing_history 확인
SELECT * FROM billing_history
WHERE billing_period_start >= '2025-12-01'
ORDER BY created_at DESC;
```

## 추가 정보

- 작업 크레딧은 토큰과 별도로 추적됩니다
- 기존 토큰 시스템은 그대로 유지됩니다
- 청구 금액 = max(월 최소 이용료, 실제 사용 금액)
- 실제 사용 금액 = 총 사용 크레딧 × 초과 작업 크레딧당 단가

