-- profiles 테이블에 전화번호 컬럼 추가
-- 회원의 가게 전화번호를 저장합니다.

-- 전화번호 컬럼 추가
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_number varchar(20);

-- 가게 전화번호 컬럼 추가 (블로그 작성용)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS store_phone_number varchar(20);

-- 인덱스 추가 (검색 최적화)
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_profiles_store_phone ON public.profiles(store_phone_number);

-- 코멘트 추가
COMMENT ON COLUMN public.profiles.phone_number IS '회원 연락처 (마이페이지용)';
COMMENT ON COLUMN public.profiles.store_phone_number IS '가게 전화번호 (블로그 작성 시 자동 입력용)';

-- 기존 데이터에 대한 처리 (선택사항)
-- UPDATE public.profiles SET phone_number = NULL WHERE phone_number IS NULL;

