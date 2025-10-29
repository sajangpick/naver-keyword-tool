-- 플레이스 크롤링 캐시 테이블
-- 중복 크롤링 방지를 위한 캐시 저장소

CREATE TABLE IF NOT EXISTS public.place_crawl_cache (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- 플레이스 정보
  place_url text UNIQUE NOT NULL,
  place_id varchar(50),
  place_name text,
  place_address text,
  business_hours text,
  main_menu text,
  phone_number text,
  
  -- 크롤링 원본 데이터 (JSON)
  crawl_data jsonb,
  
  -- 메타 정보
  crawl_count integer DEFAULT 1,
  last_crawled_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_place_cache_url ON public.place_crawl_cache(place_url);
CREATE INDEX IF NOT EXISTS idx_place_cache_place_id ON public.place_crawl_cache(place_id);
CREATE INDEX IF NOT EXISTS idx_place_cache_created_at ON public.place_crawl_cache(created_at DESC);

-- RLS 활성화
ALTER TABLE public.place_crawl_cache ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 개발 중에는 모두 허용
DROP POLICY IF EXISTS "Dev: Allow all on place_crawl_cache" ON public.place_crawl_cache;
CREATE POLICY "Dev: Allow all on place_crawl_cache" 
  ON public.place_crawl_cache 
  FOR ALL 
  USING (true);

-- updated_at 자동 업데이트 트리거
DROP TRIGGER IF EXISTS update_place_cache_updated_at ON public.place_crawl_cache;
CREATE TRIGGER update_place_cache_updated_at 
  BEFORE UPDATE ON public.place_crawl_cache
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 코멘트 추가
COMMENT ON TABLE public.place_crawl_cache IS '네이버 플레이스 크롤링 캐시 - 중복 크롤링 방지';
COMMENT ON COLUMN public.place_crawl_cache.place_url IS '네이버 플레이스 URL (UNIQUE)';
COMMENT ON COLUMN public.place_crawl_cache.crawl_data IS '크롤링된 전체 데이터 (JSON)';
COMMENT ON COLUMN public.place_crawl_cache.crawl_count IS '크롤링 횟수 (재크롤링 시 증가)';

