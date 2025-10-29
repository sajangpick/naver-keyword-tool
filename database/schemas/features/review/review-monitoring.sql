-- ============================================
-- 리뷰 모니터링 시스템
-- 작성일: 2025-10-30
-- 설명: 네이버 플레이스 리뷰 자동 수집 및 알림
-- ============================================

-- ========== 1. review_monitoring (모니터링 설정) ==========
CREATE TABLE IF NOT EXISTS public.review_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 회원 정보
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 플레이스 정보
  place_url text NOT NULL,  -- 네이버 플레이스 URL
  place_id text,  -- 플레이스 ID (URL에서 추출)
  place_name text,  -- 가게명
  
  -- 모니터링 설정
  monitoring_enabled boolean DEFAULT true,  -- 모니터링 활성화 여부
  alert_on_low_rating boolean DEFAULT true,  -- 저평점(1-2점) 알림
  alert_on_high_rating boolean DEFAULT true,  -- 고평점(5점) 알림
  alert_on_keywords boolean DEFAULT true,  -- 키워드 감지 알림
  alert_keywords text[],  -- 감지할 키워드 (예: ['불친절', '위생', '맛없'])
  
  -- 크롤링 상태
  last_crawled_at timestamp with time zone,  -- 마지막 크롤링 시간
  last_review_count integer DEFAULT 0,  -- 마지막 리뷰 개수
  crawl_error_count integer DEFAULT 0,  -- 크롤링 에러 횟수
  
  -- 통계
  total_reviews integer DEFAULT 0,  -- 총 리뷰 수
  average_rating decimal(2,1),  -- 평균 평점
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.review_monitoring IS '리뷰 모니터링 설정 테이블';
COMMENT ON COLUMN public.review_monitoring.place_url IS '네이버 플레이스 URL (https://m.place.naver.com/restaurant/...)';
COMMENT ON COLUMN public.review_monitoring.alert_keywords IS '감지할 키워드 배열 (부정적 키워드)';

-- 인덱스
CREATE INDEX idx_review_monitoring_user_id ON public.review_monitoring(user_id);
CREATE INDEX idx_review_monitoring_enabled ON public.review_monitoring(monitoring_enabled) WHERE monitoring_enabled = true;
CREATE INDEX idx_review_monitoring_last_crawled ON public.review_monitoring(last_crawled_at);

-- ========== 2. review_alerts (리뷰 알림) ==========
CREATE TABLE IF NOT EXISTS public.review_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 연결 정보
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monitoring_id uuid NOT NULL REFERENCES public.review_monitoring(id) ON DELETE CASCADE,
  
  -- 리뷰 정보
  review_type text NOT NULL,  -- 'visitor' (방문자리뷰), 'blog' (블로그리뷰), 'news' (새소식)
  review_external_id text,  -- 외부 리뷰 ID (중복 체크용)
  
  rating integer,  -- 별점 (1-5)
  content text,  -- 리뷰 내용
  reviewer_name text,  -- 리뷰 작성자 (익명 가능)
  reviewed_at timestamp with time zone,  -- 리뷰 작성 시간
  
  -- 분석 결과
  is_urgent boolean DEFAULT false,  -- 긴급 여부 (1-2점)
  detected_keywords text[],  -- 감지된 키워드
  sentiment text,  -- 'positive', 'neutral', 'negative'
  
  -- 답글 정보
  has_reply boolean DEFAULT false,  -- 답글 작성 여부
  ai_suggested_reply text,  -- AI가 제안한 답글
  
  -- 알림 상태
  is_read boolean DEFAULT false,  -- 읽음 여부
  kakao_sent boolean DEFAULT false,  -- 카카오톡 발송 여부
  kakao_sent_at timestamp with time zone,  -- 카카오톡 발송 시간
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.review_alerts IS '리뷰 알림 테이블';
COMMENT ON COLUMN public.review_alerts.review_type IS 'visitor: 방문자리뷰, blog: 블로그리뷰, news: 새소식';
COMMENT ON COLUMN public.review_alerts.is_urgent IS '긴급 알림 (1-2점 리뷰)';

-- 인덱스
CREATE INDEX idx_review_alerts_user_id ON public.review_alerts(user_id);
CREATE INDEX idx_review_alerts_monitoring_id ON public.review_alerts(monitoring_id);
CREATE INDEX idx_review_alerts_is_urgent ON public.review_alerts(is_urgent) WHERE is_urgent = true;
CREATE INDEX idx_review_alerts_is_read ON public.review_alerts(is_read) WHERE is_read = false;
CREATE INDEX idx_review_alerts_created_at ON public.review_alerts(created_at DESC);
CREATE INDEX idx_review_alerts_external_id ON public.review_alerts(review_external_id);

-- ========== 3. review_crawl_logs (크롤링 로그) ==========
CREATE TABLE IF NOT EXISTS public.review_crawl_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  monitoring_id uuid REFERENCES public.review_monitoring(id) ON DELETE CASCADE,
  
  -- 크롤링 결과
  status text NOT NULL,  -- 'success', 'failed', 'partial'
  reviews_found integer DEFAULT 0,  -- 발견된 리뷰 수
  new_reviews integer DEFAULT 0,  -- 새로운 리뷰 수
  error_message text,  -- 에러 메시지
  
  -- 실행 정보
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  duration_seconds integer,  -- 소요 시간 (초)
  
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.review_crawl_logs IS '리뷰 크롤링 실행 로그';

-- 인덱스
CREATE INDEX idx_review_crawl_logs_monitoring_id ON public.review_crawl_logs(monitoring_id);
CREATE INDEX idx_review_crawl_logs_created_at ON public.review_crawl_logs(created_at DESC);

-- ========== RLS (Row Level Security) ==========

-- review_monitoring
ALTER TABLE public.review_monitoring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own monitoring settings"
  ON public.review_monitoring FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monitoring settings"
  ON public.review_monitoring FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monitoring settings"
  ON public.review_monitoring FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own monitoring settings"
  ON public.review_monitoring FOR DELETE
  USING (auth.uid() = user_id);

-- review_alerts
ALTER TABLE public.review_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts"
  ON public.review_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts"
  ON public.review_alerts FOR UPDATE
  USING (auth.uid() = user_id);

-- review_crawl_logs
ALTER TABLE public.review_crawl_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs of own monitoring"
  ON public.review_crawl_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.review_monitoring
      WHERE review_monitoring.id = review_crawl_logs.monitoring_id
      AND review_monitoring.user_id = auth.uid()
    )
  );

-- ========== 함수 ==========

-- 자동 updated_at 업데이트
CREATE OR REPLACE FUNCTION update_review_monitoring_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_review_monitoring_updated_at
  BEFORE UPDATE ON public.review_monitoring
  FOR EACH ROW
  EXECUTE FUNCTION update_review_monitoring_updated_at();

