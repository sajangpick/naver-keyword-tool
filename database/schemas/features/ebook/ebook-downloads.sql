-- ============================================
-- 전자책 다운로드 기록 테이블
-- 작성일: 2025-11-28
-- ============================================

CREATE TABLE IF NOT EXISTS public.ebook_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 회원 정보 스냅샷
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text,
  name text,
  membership_level text,
  user_type text,

  -- 다운로드 컨텍스트
  download_source text DEFAULT 'hero_primary',
  download_method text DEFAULT 'unknown',
  device_type text,
  user_agent text,
  ip_address text,
  metadata jsonb DEFAULT '{}'::jsonb,

  -- 기본 메타데이터
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.ebook_downloads IS '사장픽 전자책(PDF) 다운로드 기록';
COMMENT ON COLUMN public.ebook_downloads.download_source IS '다운로드 버튼 또는 진입 경로 식별자';
COMMENT ON COLUMN public.ebook_downloads.download_method IS '다운로드 처리 방식 (새 창, 직접 다운로드 등)';
COMMENT ON COLUMN public.ebook_downloads.metadata IS '추가 데이터(JSON) - referrer, campaign 등';

CREATE INDEX IF NOT EXISTS idx_ebook_downloads_user_id
  ON public.ebook_downloads(user_id);

CREATE INDEX IF NOT EXISTS idx_ebook_downloads_created_at
  ON public.ebook_downloads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ebook_downloads_source
  ON public.ebook_downloads(download_source);

ALTER TABLE public.ebook_downloads ENABLE ROW LEVEL SECURITY;

-- RLS 정책은 서버(Service Role)에서만 접근하도록 별도로 추가하지 않습니다.
-- (service_role 키는 RLS를 우회하므로 Render 백엔드에서만 INSERT/SELECT 수행)

SELECT '✅ ebook_downloads 테이블 준비 완료' AS result;

