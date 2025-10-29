-- ============================================
-- blog_posts 테이블 생성
-- AI 블로그 생성 내역 저장
-- ============================================

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id varchar(50) REFERENCES public.places(place_id) ON DELETE SET NULL,
  
  -- 가게 정보
  store_name text,
  store_address text,
  store_business_hours text,
  store_main_menu text,
  naver_place_url text,
  
  -- 블로그 내용
  blog_type text NOT NULL DEFAULT 'our_store',  -- 'our_store', 'review_team', 'visit_review'
  blog_title text,  -- 선택된 주제의 제목
  blog_content text NOT NULL,  -- 생성된 블로그 전문
  
  -- 선택된 주제 정보 (JSON)
  selected_topic jsonb,  -- { title, description, keywords }
  
  -- 분석 데이터 (JSON)
  place_info jsonb,  -- 크롤링/구조화한 가게 정보
  menu_analysis jsonb,  -- 메뉴 분석 결과
  
  -- AI 생성 정보
  ai_model varchar(50),  -- 'gpt-4o-mini', 'gpt-4o'
  generation_time_ms integer,  -- 생성 소요 시간
  
  -- 상태
  status text NOT NULL DEFAULT 'draft',  -- 'draft', 'published', 'archived'
  is_used boolean DEFAULT false,
  used_at timestamp with time zone,
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 코멘트
COMMENT ON TABLE public.blog_posts IS 'AI 생성 블로그 포스팅 저장';
COMMENT ON COLUMN public.blog_posts.blog_type IS '우리매장(our_store), 체험단리뷰(review_team), 방문후기(visit_review)';
COMMENT ON COLUMN public.blog_posts.selected_topic IS '선택된 블로그 주제 (title, description, keywords)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_blog_posts_user_id ON public.blog_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_place_id ON public.blog_posts(place_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_blog_type ON public.blog_posts(blog_type);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON public.blog_posts(created_at DESC);

-- RLS 활성화
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (개발 모드 - 모두 허용)
DROP POLICY IF EXISTS "Dev: Allow all on blog_posts" ON public.blog_posts;
CREATE POLICY "Dev: Allow all on blog_posts" 
  ON public.blog_posts 
  FOR ALL 
  USING (true);

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER update_blog_posts_updated_at 
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 완료 메시지
DO $$ 
BEGIN 
  RAISE NOTICE '============================================';
  RAISE NOTICE 'blog_posts 테이블 생성 완료!';
  RAISE NOTICE '============================================';
END $$;

