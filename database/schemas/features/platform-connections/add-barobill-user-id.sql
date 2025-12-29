-- ============================================
-- profiles 테이블에 바로빌 회원 아이디 컬럼 추가
-- 바로빌 홈택스 연동 시 회원가입한 아이디를 저장합니다.
-- ============================================

-- 바로빌 회원 아이디 컬럼 추가
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS barobill_user_id VARCHAR(20);

-- 인덱스 추가 (검색 최적화)
CREATE INDEX IF NOT EXISTS idx_profiles_barobill_user_id ON public.profiles(barobill_user_id);

-- 코멘트 추가
COMMENT ON COLUMN public.profiles.barobill_user_id IS '바로빌 회원 아이디 (홈택스 연동 시 자동 저장)';

