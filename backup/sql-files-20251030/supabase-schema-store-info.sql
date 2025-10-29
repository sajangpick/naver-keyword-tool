-- ============================================
-- Supabase 가게 정보 컬럼 추가
-- profiles 테이블에 가게 정보 저장 필드 추가
-- 작성일: 2025-10-28
-- ============================================

-- profiles 테이블에 가게 정보 컬럼 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_place_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_business_hours text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_main_menu text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_landmarks text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_keywords text;

-- 컬럼 설명 추가
COMMENT ON COLUMN public.profiles.store_place_url IS '네이버 플레이스 URL (블로그 작성 시 자동 입력용)';
COMMENT ON COLUMN public.profiles.store_name IS '가게 이름/업체명 (블로그 작성 시 자동 입력용)';
COMMENT ON COLUMN public.profiles.store_address IS '가게 주소 (블로그 작성 시 자동 입력용)';
COMMENT ON COLUMN public.profiles.store_business_hours IS '영업시간 (블로그 작성 시 자동 입력용)';
COMMENT ON COLUMN public.profiles.store_main_menu IS '대표메뉴 (쉼표로 구분, 블로그 작성 시 자동 입력용)';
COMMENT ON COLUMN public.profiles.store_landmarks IS '주변 랜드마크 (쉼표로 구분, 블로그 작성 시 자동 입력용)';
COMMENT ON COLUMN public.profiles.store_keywords IS '가게 키워드 (쉼표로 구분, 블로그 작성 시 자동 입력용)';

-- 완료 메시지
DO $$ 
BEGIN 
  RAISE NOTICE '============================================';
  RAISE NOTICE '가게 정보 컬럼 추가 완료!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '추가된 컬럼 (profiles 테이블):';
  RAISE NOTICE '  - store_place_url (플레이스 URL)';
  RAISE NOTICE '  - store_name (업체명)';
  RAISE NOTICE '  - store_address (업체주소)';
  RAISE NOTICE '  - store_business_hours (영업시간)';
  RAISE NOTICE '  - store_main_menu (대표메뉴)';
  RAISE NOTICE '  - store_landmarks (주변 랜드마크)';
  RAISE NOTICE '  - store_keywords (키워드)';
  RAISE NOTICE '';
  RAISE NOTICE '이제 다음 단계를 진행하세요:';
  RAISE NOTICE '  1. Backend API 작성 (가게 정보 저장/조회/수정)';
  RAISE NOTICE '  2. Blog-Editor.html 수정 (자동 입력, required 제거)';
  RAISE NOTICE '  3. mypage.html에 가게 정보 섹션 추가';
  RAISE NOTICE '  4. admin/member-management.html에 가게 정보 관리 추가';
  RAISE NOTICE '============================================';
END $$;

