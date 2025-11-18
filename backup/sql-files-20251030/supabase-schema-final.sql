-- ============================================
-- Supabase 클라우드 데이터베이스 스키마
-- 프로젝트: 소상공인 AI 에이전트 (리뷰 답글 자동 생성)
-- 작성일: 2025-10-22
-- 버전: 1.0
-- ============================================

-- ==================== 확장 기능 활성화 ====================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== 1단계: 핵심 테이블 (지금 구축) ====================

-- ========== 1. profiles (사용자 정보) ==========
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 회원 분류
  user_type text NOT NULL DEFAULT 'owner',  -- 'admin', 'owner', 'agency'
  membership_level text NOT NULL DEFAULT 'seed',
  -- owner: seed, power, big_power, premium
  -- agency: elite, expert, master, platinum
  -- admin: admin
  
  -- 기본 정보
  name text,
  business_name text,  -- 상호명 또는 회사명
  kakao_id text UNIQUE,  -- 카카오 로그인 ID (나중에 연동)
  email text,
  phone text,
  
  -- 사용 한도
  monthly_review_limit integer NOT NULL DEFAULT 10,
  monthly_blog_limit integer NOT NULL DEFAULT 2,
  
  -- 구독 정보
  subscription_status text DEFAULT 'active',  -- 'active', 'expired', 'cancelled'
  subscription_started_at timestamp with time zone,
  subscription_expires_at timestamp with time zone,
  last_payment_date timestamp with time zone,
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.profiles IS '사용자 정보 및 회원 등급 관리';
COMMENT ON COLUMN public.profiles.user_type IS 'admin(관리자), owner(식당 대표), agency(대행사/블로거)';
COMMENT ON COLUMN public.profiles.membership_level IS 'owner: seed/power/big_power/premium, agency: elite/expert/master/platinum';

-- ========== 2. places (식당 정보) ==========
CREATE TABLE public.places (
  id bigserial PRIMARY KEY,
  place_id varchar(50) UNIQUE NOT NULL,  -- 네이버 place_id
  
  -- 기본 정보
  place_name varchar(200) NOT NULL,
  category varchar(100),  -- 예: "한식>육류,고기요리"
  
  -- 주소
  road_address text,  -- 도로명 주소
  lot_address text,   -- 지번 주소
  sido varchar(50),   -- 시/도
  sigungu varchar(50),  -- 시/군/구
  dong varchar(50),   -- 읍/면/동
  
  -- 연락처
  phone varchar(20),
  homepage text,
  
  -- 통계
  rating decimal(3,2),  -- 평점 (예: 4.52)
  visitor_reviews integer DEFAULT 0,  -- 방문자 리뷰 수
  blog_reviews integer DEFAULT 0,     -- 블로그 리뷰 수
  
  -- 영업 정보
  business_hours text,  -- JSON 또는 텍스트
  break_time text,
  
  -- 메타데이터
  first_crawled_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  last_crawled_at timestamp with time zone,
  crawl_count integer DEFAULT 1,
  
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.places IS '네이버 플레이스 식당 정보 (크롤링 데이터 저장 및 재사용)';
COMMENT ON COLUMN public.places.place_id IS '네이버 place_id (UNIQUE, 중복 방지)';

-- ========== 3. review_responses (리뷰 & 답글) ==========
CREATE TABLE public.review_responses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id varchar(50) REFERENCES public.places(place_id) ON DELETE SET NULL,
  
  -- 입력 데이터
  naver_place_url text,  -- 네이버 플레이스 URL
  customer_review text NOT NULL,  -- 고객 리뷰 원문
  owner_tips text,  -- 사장님 추천 포인트 (예: "삼겹살, 냉면 추천")
  
  -- 크롤링 데이터 (확장성)
  place_info_json jsonb,  -- 크롤링한 식당 정보 전체 (JSON)
  
  -- AI 답글
  ai_response text NOT NULL,  -- AI가 생성한 답글
  ai_model varchar(50),  -- 사용한 AI 모델 (예: "claude", "chatgpt")
  generation_time_ms integer,  -- 생성 소요 시간 (밀리초)
  
  -- 사용 여부
  is_used boolean DEFAULT false,  -- 실제로 답글을 사용했는지
  used_at timestamp with time zone,  -- 사용 시간
  
  -- 피드백
  feedback_rating integer CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_comment text,
  
  -- 수정 이력
  edited_text text,  -- 사용자가 수정한 최종 답글
  is_edited boolean DEFAULT false,
  
  -- 메타데이터
  status text DEFAULT 'draft',  -- 'draft', 'used', 'archived'
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.review_responses IS '고객 리뷰와 AI 생성 답글 저장';
COMMENT ON COLUMN public.review_responses.place_info_json IS '확장 가능한 JSON 데이터 (facilities, tv_appearances 등)';

-- ==================== 인덱스 생성 ====================
CREATE INDEX idx_profiles_kakao_id ON public.profiles(kakao_id);
CREATE INDEX idx_profiles_user_type ON public.profiles(user_type);
CREATE INDEX idx_profiles_membership_level ON public.profiles(membership_level);

CREATE INDEX idx_places_place_id ON public.places(place_id);
CREATE INDEX idx_places_location ON public.places(sido, sigungu, dong);
CREATE INDEX idx_places_rating ON public.places(rating DESC);
CREATE INDEX idx_places_category ON public.places(category);

CREATE INDEX idx_review_responses_user_id ON public.review_responses(user_id);
CREATE INDEX idx_review_responses_place_id ON public.review_responses(place_id);
CREATE INDEX idx_review_responses_status ON public.review_responses(status);
CREATE INDEX idx_review_responses_created_at ON public.review_responses(created_at DESC);

-- ==================== Row Level Security (RLS) 활성화 ====================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;

-- ==================== RLS 정책 (개발 모드 - 모두 허용) ====================
-- 프로덕션 배포 시 아래 정책을 삭제하고 본인만 조회 가능하도록 변경 필요

CREATE POLICY "Dev: Allow all on profiles" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Dev: Allow all on places" ON public.places FOR ALL USING (true);
CREATE POLICY "Dev: Allow all on review_responses" ON public.review_responses FOR ALL USING (true);

-- ==================== 프로덕션 RLS 정책 (주석 처리 - 향후 활성화) ====================
/*
-- profiles: 본인만 조회/수정
DROP POLICY IF EXISTS "Dev: Allow all on profiles" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles 
  FOR SELECT USING (auth.uid()::text = kakao_id);
CREATE POLICY "Users can update own profile" ON public.profiles 
  FOR UPDATE USING (auth.uid()::text = kakao_id);

-- review_responses: 본인 리뷰만 조회/수정
DROP POLICY IF EXISTS "Dev: Allow all on review_responses" ON public.review_responses;
CREATE POLICY "Users can manage own reviews" ON public.review_responses
  FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE kakao_id = auth.uid()::text));

-- places: 모두 조회 가능 (공개 데이터)
DROP POLICY IF EXISTS "Dev: Allow all on places" ON public.places;
CREATE POLICY "Public can read places" ON public.places FOR SELECT USING (true);
*/

-- ==================== updated_at 자동 업데이트 함수 ====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ==================== 트리거 생성 ====================
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_places_updated_at BEFORE UPDATE ON public.places
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_review_responses_updated_at BEFORE UPDATE ON public.review_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== 테스트 데이터 삽입 ====================

-- 1. 샘플 회원 (3명)
INSERT INTO public.profiles (user_type, membership_level, name, business_name, monthly_review_limit, monthly_blog_limit) 
VALUES 
  ('admin', 'admin', '시스템 관리자', '사장픽 운영팀', 99999, 99999),
  ('owner', 'premium', '김사장', '두찜 명장점', 999, 100),
  ('agency', 'master', '마케팅 프로', '마케팅 대행사', 2000, 500);

-- 2. 샘플 식당 (1개)
INSERT INTO public.places (
  place_id, place_name, category, road_address, phone, 
  rating, visitor_reviews, blog_reviews,
  sido, sigungu, dong
) VALUES (
  '1390003666', 
  '두찜 명장점', 
  '한식>육류,고기요리', 
  '부산광역시 동래구 명장로 123', 
  '051-1234-5678',
  4.52,
  2335,
  253,
  '부산광역시',
  '동래구',
  '명장동'
);

-- 3. 샘플 리뷰 (1개)
INSERT INTO public.review_responses (
  user_id, 
  place_id,
  naver_place_url,
  customer_review,
  owner_tips,
  ai_response,
  ai_model,
  is_used,
  status
) VALUES (
  (SELECT id FROM public.profiles WHERE name = '김사장' LIMIT 1),
  '1390003666',
  'https://m.place.naver.com/restaurant/1390003666',
  '고기가 정말 맛있어요! 특히 삼겹살이 일품이었습니다. 다만 대기 시간이 조금 길었어요.',
  '삼겹살, 돼지갈비 추천',
  '안녕하세요, 두찜 명장점입니다! 😊

저희 삼겹살을 맛있게 드셨다니 정말 기쁩니다. 고객님께서 언급해주신 삼겹살과 돼지갈비는 저희 식당의 시그니처 메뉴로, 신선한 국내산 돼지고기를 사용하여 부드럽고 풍미가 뛰어납니다.

대기 시간이 길어 불편을 드려 죄송합니다. 주말과 저녁 시간대에는 손님이 많아 다소 기다리실 수 있으니, 평일 오후나 예약 후 방문하시면 더 편하게 이용하실 수 있습니다.

다음에도 맛있는 한 끼 대접하겠습니다. 감사합니다!',
  'claude',
  false,
  'draft'
);

-- ==================== 2단계: 순위 추적 테이블 (향후 확장 - 주석 처리) ====================
/*
-- ========== rank_history (순위 이력) ==========
CREATE TABLE public.rank_history (
  id bigserial PRIMARY KEY,
  place_id varchar(50) NOT NULL REFERENCES public.places(place_id) ON DELETE CASCADE,
  keyword varchar(200) NOT NULL,  -- 검색 키워드 (예: "명장동맛집")
  rank_position integer NOT NULL,  -- 순위 (1-300)
  
  -- 해당 시점의 통계
  rating decimal(3,2),
  visitor_reviews integer,
  blog_reviews integer,
  
  measured_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.rank_history IS '네이버 플레이스 순위 추적 이력 (애드로그 기능)';

CREATE INDEX idx_rank_history_place_id ON public.rank_history(place_id);
CREATE INDEX idx_rank_history_keyword ON public.rank_history(keyword);
CREATE INDEX idx_rank_history_measured_at ON public.rank_history(measured_at DESC);

ALTER TABLE public.rank_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read rank_history" ON public.rank_history FOR SELECT USING (true);

-- ========== crawl_logs (크롤링 작업 이력) ==========
CREATE TABLE public.crawl_logs (
  id bigserial PRIMARY KEY,
  keyword varchar(200) NOT NULL,
  location varchar(100),
  total_found integer DEFAULT 0,
  total_crawled integer DEFAULT 0,
  total_errors integer DEFAULT 0,
  duration_seconds integer,
  status varchar(20) DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed'
  error_message text,
  
  started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp with time zone
);

COMMENT ON TABLE public.crawl_logs IS '크롤링 작업 이력 및 모니터링';

CREATE INDEX idx_crawl_logs_keyword ON public.crawl_logs(keyword);
CREATE INDEX idx_crawl_logs_status ON public.crawl_logs(status);
CREATE INDEX idx_crawl_logs_started_at ON public.crawl_logs(started_at DESC);

ALTER TABLE public.crawl_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read crawl_logs" ON public.crawl_logs FOR SELECT USING (true);

-- ========== monitored_keywords (추적 키워드 관리) ==========
CREATE TABLE public.monitored_keywords (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keyword varchar(200) NOT NULL,
  target_place_id varchar(50) REFERENCES public.places(place_id) ON DELETE CASCADE,
  
  -- 모니터링 설정
  check_frequency text DEFAULT 'daily',  -- 'hourly', 'daily', 'weekly'
  is_active boolean DEFAULT true,
  
  -- 알림 설정
  alert_on_rank_change boolean DEFAULT true,
  alert_threshold integer,  -- 순위 변동 N위 이상 시 알림
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  
  UNIQUE(user_id, keyword, target_place_id)
);

COMMENT ON TABLE public.monitored_keywords IS '사용자별 순위 추적 키워드 관리';

CREATE INDEX idx_monitored_keywords_user_id ON public.monitored_keywords(user_id);
CREATE INDEX idx_monitored_keywords_target_place_id ON public.monitored_keywords(target_place_id);

ALTER TABLE public.monitored_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own keywords" ON public.monitored_keywords
  FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE kakao_id = auth.uid()::text));

CREATE TRIGGER update_monitored_keywords_updated_at BEFORE UPDATE ON public.monitored_keywords
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
*/

-- ==================== 3단계: 콘텐츠 & 광고 테이블 (향후 확장 - 주석 처리) ====================
/*
-- ========== blog_posts (블로그 포스팅) ==========
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id varchar(50) REFERENCES public.places(place_id) ON DELETE SET NULL,
  
  target_platform text NOT NULL DEFAULT 'naver_blog',  -- 'naver_blog', 'tistory', 등
  keywords text[],  -- 주요 키워드 배열
  blog_title text NOT NULL,
  blog_content text NOT NULL,
  
  -- 이미지
  featured_image_url text,
  image_urls text[],
  
  -- 상태
  status text NOT NULL DEFAULT 'draft',  -- 'draft', 'published', 'scheduled'
  published_at timestamp with time zone,
  scheduled_at timestamp with time zone,
  
  -- AI 생성 정보
  ai_model varchar(50),
  generation_time_ms integer,
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.blog_posts IS '블로그 포스팅 관리';

CREATE INDEX idx_blog_posts_user_id ON public.blog_posts(user_id);
CREATE INDEX idx_blog_posts_place_id ON public.blog_posts(place_id);
CREATE INDEX idx_blog_posts_status ON public.blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON public.blog_posts(published_at DESC);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own blog posts" ON public.blog_posts
  FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE kakao_id = auth.uid()::text));

CREATE TRIGGER update_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== ad_keywords (파워클릭 광고 키워드) ==========
CREATE TABLE public.ad_keywords (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  
  -- 분석 데이터
  monthly_search_volume integer,
  competition_level text,  -- 'low', 'medium', 'high'
  avg_cpc integer,  -- 평균 클릭당 비용
  
  -- 광고 성과
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  conversions integer DEFAULT 0,
  cost integer DEFAULT 0,
  
  -- 메타데이터
  last_analysis_date date,
  is_active boolean DEFAULT true,
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  
  UNIQUE(user_id, keyword)
);

COMMENT ON TABLE public.ad_keywords IS '네이버 파워클릭 광고 키워드 관리';

CREATE INDEX idx_ad_keywords_user_id ON public.ad_keywords(user_id);
CREATE INDEX idx_ad_keywords_keyword ON public.ad_keywords(keyword);
CREATE INDEX idx_ad_keywords_competition_level ON public.ad_keywords(competition_level);

ALTER TABLE public.ad_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ad keywords" ON public.ad_keywords
  FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE kakao_id = auth.uid()::text));

CREATE TRIGGER update_ad_keywords_updated_at BEFORE UPDATE ON public.ad_keywords
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
*/

-- ==================== 완료 메시지 ====================
DO $$ 
BEGIN 
  RAISE NOTICE '============================================';
  RAISE NOTICE '데이터베이스 스키마 생성 완료!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '생성된 테이블:';
  RAISE NOTICE '  1. profiles (사용자 정보)';
  RAISE NOTICE '  2. places (식당 정보)';
  RAISE NOTICE '  3. review_responses (리뷰 & 답글)';
  RAISE NOTICE '';
  RAISE NOTICE '테스트 데이터:';
  RAISE NOTICE '  - 회원 3명 (관리자, 식당 대표, 대행사)';
  RAISE NOTICE '  - 식당 1개 (두찜 명장점)';
  RAISE NOTICE '  - 리뷰 1개';
  RAISE NOTICE '';
  RAISE NOTICE '다음 단계:';
  RAISE NOTICE '  1. Table Editor에서 데이터 확인';
  RAISE NOTICE '  2. server.js에 Supabase 저장 로직 추가';
  RAISE NOTICE '  3. review.html에서 DB 저장 API 호출';
  RAISE NOTICE '============================================';
END $$;

