-- ============================================
-- 블로그 다양성 시스템 스키마
-- profiles 테이블에 블로그 스타일 설정 추가
-- 작성일: 2025-10-29
-- ============================================

-- profiles 테이블에 블로그 스타일 설정 컬럼 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blog_style jsonb DEFAULT '{
  "tone": "friendly",
  "formality": "polite",
  "emoji_usage": "moderate",
  "personality": "warm",
  "expertise_level": "intermediate",
  "content_length": "detailed",
  "writing_style": "storytelling"
}'::jsonb;

-- 컬럼 설명 추가
COMMENT ON COLUMN public.profiles.blog_style IS '블로그 작성 스타일 설정 (JSON): tone(말투), formality(격식), emoji_usage(이모티콘), personality(성격), expertise_level(전문성), content_length(길이), writing_style(글쓰기 스타일)';

-- blog_posts 테이블에 다양성 관련 컬럼 추가
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS writing_angle text;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS diversity_keywords jsonb;
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS avoid_patterns jsonb;

COMMENT ON COLUMN public.blog_posts.writing_angle IS '글쓰기 앵글 (단골 고객, 첫 방문, 지역 주민, 미식가, 가족 외식, 데이트, 혼밥, 재방문 등)';
COMMENT ON COLUMN public.blog_posts.diversity_keywords IS '이 글에서 사용된 주요 키워드 및 표현 (다음 글 작성 시 회피용)';
COMMENT ON COLUMN public.blog_posts.avoid_patterns IS '다음 글 작성 시 피해야 할 패턴 및 표현';

-- 완료 메시지
DO $$ 
BEGIN 
  RAISE NOTICE '============================================';
  RAISE NOTICE '블로그 다양성 시스템 스키마 생성 완료!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '추가된 컬럼 (profiles 테이블):';
  RAISE NOTICE '  - blog_style (블로그 스타일 설정 JSON)';
  RAISE NOTICE '';
  RAISE NOTICE '추가된 컬럼 (blog_posts 테이블):';
  RAISE NOTICE '  - writing_angle (글쓰기 앵글)';
  RAISE NOTICE '  - diversity_keywords (다양성 키워드)';
  RAISE NOTICE '  - avoid_patterns (회피 패턴)';
  RAISE NOTICE '============================================';
END $$;

