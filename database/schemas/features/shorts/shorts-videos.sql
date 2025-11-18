-- ========================================
-- 🎬 사장픽 쇼츠 영상 관리 시스템 데이터베이스 스키마
-- ========================================
-- 생성일: 2025년 11월 12일
-- 버전: 1.0.0
-- 설명: AI 생성 쇼츠 영상 저장 및 관리
-- ========================================

-- 1. 쇼츠 영상 메인 테이블
-- ========================================
CREATE TABLE IF NOT EXISTS public.shorts_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 영상 정보
  title text, -- 영상 제목 (메뉴명 등)
  description text, -- 영상 설명
  style text, -- 'luxury', 'fast', 'chef', 'plating', 'simple'
  duration_sec integer, -- 영상 길이 (초)
  music_type text, -- 'upbeat', 'elegant', 'trendy', 'calm', 'auto'
  
  -- 메뉴 정보
  menu_name text NOT NULL,
  menu_features text,
  menu_price text,
  
  -- 이미지 및 영상 파일
  image_url text, -- 업로드된 메인 이미지 URL
  video_url text, -- 생성된 영상 URL (나중에 추가)
  thumbnail_url text, -- 썸네일 URL
  
  -- 생성 상태
  status text NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  error_message text, -- 실패 시 에러 메시지
  
  -- AI 생성 정보
  generation_time_ms integer, -- 생성 소요 시간
  ai_model text, -- 사용된 AI 모델
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.shorts_videos IS 'AI 생성 쇼츠 영상 저장';
COMMENT ON COLUMN public.shorts_videos.status IS 'processing: 생성 중, completed: 완료, failed: 실패';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_shorts_videos_user_id ON public.shorts_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_shorts_videos_status ON public.shorts_videos(status);
CREATE INDEX IF NOT EXISTS idx_shorts_videos_created_at ON public.shorts_videos(created_at DESC);

