-- ========================================
-- 🔍 1단계: 테이블 존재 확인
-- ========================================
-- 이 SQL을 먼저 실행해서 테이블이 있는지 확인하세요

SELECT 
  table_name,
  CASE 
    WHEN table_name = 'shorts_videos' THEN '✅ 테이블이 존재합니다!'
    ELSE '❌ 테이블이 없습니다'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'shorts_videos';

-- ========================================
-- 🛠️ 2단계: 테이블이 없다면 아래 SQL 실행
-- ========================================
-- 위에서 "테이블이 없습니다"가 나오면 아래 SQL을 실행하세요

CREATE TABLE IF NOT EXISTS public.shorts_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text,
  description text,
  style text,
  duration_sec integer,
  music_type text,
  menu_name text NOT NULL,
  menu_features text,
  menu_price text,
  image_url text,
  video_url text,
  thumbnail_url text,
  job_id text,
  status text NOT NULL DEFAULT 'processing',
  error_message text,
  generation_time_ms integer,
  ai_model text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_shorts_videos_user_id ON public.shorts_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_shorts_videos_status ON public.shorts_videos(status);
CREATE INDEX IF NOT EXISTS idx_shorts_videos_created_at ON public.shorts_videos(created_at DESC);

-- ========================================
-- ✅ 3단계: 생성 확인
-- ========================================

SELECT '✅ shorts_videos 테이블 생성 완료!' as message;

