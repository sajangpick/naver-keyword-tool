-- ========================================
-- page_visits 테이블에 사용자 정보 컬럼 추가
-- ========================================
-- 생성일: 2025년 12월 11일
-- 설명: 접속 기록에 사용자 이메일과 이름을 저장하여 관리자 페이지에서 표시

-- user_email, user_name 컬럼 추가
ALTER TABLE public.page_visits 
ADD COLUMN IF NOT EXISTS user_email TEXT,
ADD COLUMN IF NOT EXISTS user_name TEXT;

-- 인덱스 추가 (이메일로 검색 시 성능 향상)
CREATE INDEX IF NOT EXISTS idx_page_visits_user_email ON public.page_visits(user_email);

-- 코멘트 추가
COMMENT ON COLUMN public.page_visits.user_email IS '사용자 이메일 (profiles 테이블에서 가져옴)';
COMMENT ON COLUMN public.page_visits.user_name IS '사용자 이름 또는 가게명 (profiles 테이블에서 가져옴)';

