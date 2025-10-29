-- =====================================================
-- store_promotions 테이블 RLS 보안 정책
-- =====================================================
-- 목적: 회원은 본인 정보만, 관리자는 모든 정보 접근
-- 작성일: 2025-10-29
-- =====================================================

-- 1단계: RLS 활성화
ALTER TABLE public.store_promotions ENABLE ROW LEVEL SECURITY;

-- 2단계: 기존 정책 삭제 (있다면)
DROP POLICY IF EXISTS "회원은 본인 가게 정보만 조회" ON store_promotions;
DROP POLICY IF EXISTS "회원은 본인 가게 정보만 생성" ON store_promotions;
DROP POLICY IF EXISTS "회원은 본인 가게 정보만 수정" ON store_promotions;
DROP POLICY IF EXISTS "회원은 본인 가게 정보만 삭제" ON store_promotions;
DROP POLICY IF EXISTS "관리자는 모든 가게 정보 조회" ON store_promotions;

-- 3단계: 새로운 정책 생성

-- 조회: 본인 것만 OR 관리자
CREATE POLICY "회원은 본인 가게 정보만 조회"
ON store_promotions
FOR SELECT
USING (
  auth.uid() = user_id 
  OR 
  public.is_admin()
);

-- 생성: 본인 것만
CREATE POLICY "회원은 본인 가게 정보만 생성"
ON store_promotions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

-- 수정: 본인 것만
CREATE POLICY "회원은 본인 가게 정보만 수정"
ON store_promotions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 삭제: 본인 것만
CREATE POLICY "회원은 본인 가게 정보만 삭제"
ON store_promotions
FOR DELETE
USING (auth.uid() = user_id);

-- 관리자는 모든 작업 가능 (이미 위 정책에 포함됨)

-- =====================================================
-- 완료 메시지
-- =====================================================

DO $$ 
BEGIN
  RAISE NOTICE '====================================';
  RAISE NOTICE '✅ store_promotions RLS 설정 완료!';
  RAISE NOTICE '====================================';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 보안 정책:';
  RAISE NOTICE '  - 회원: 본인 가게 정보만 조회/수정/삭제 가능';
  RAISE NOTICE '  - 관리자: 모든 가게 정보 조회 가능';
  RAISE NOTICE '';
  RAISE NOTICE '✅ 이제 store_promotions 테이블이 안전합니다!';
  RAISE NOTICE '====================================';
END $$;

