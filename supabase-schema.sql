-- Supabase (PostgreSQL) 데이터베이스 스키마
-- SQLite에서 PostgreSQL로 변환

-- ========== 1. 식당 기본 정보 테이블 ==========
CREATE TABLE IF NOT EXISTS places (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(50) UNIQUE NOT NULL,
  place_name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  
  -- 주소
  road_address TEXT,
  lot_address TEXT,
  sido VARCHAR(50),
  sigungu VARCHAR(50),
  dong VARCHAR(50),
  
  -- 연락처
  phone VARCHAR(20),
  
  -- 통계
  rating DECIMAL(3,2),
  visitor_reviews INTEGER DEFAULT 0,
  blog_reviews INTEGER DEFAULT 0,
  
  -- 메타데이터
  first_crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_crawled_at TIMESTAMP,
  crawl_count INTEGER DEFAULT 1,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== 2. 상세 정보 테이블 ==========
CREATE TABLE IF NOT EXISTS place_details (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(50) NOT NULL,
  
  -- 영업 정보
  business_hours TEXT,
  break_time TEXT,
  
  -- 소개
  introduction TEXT,
  
  -- 영수증
  new_receipt_count INTEGER DEFAULT 0,
  total_receipt_count INTEGER DEFAULT 0,
  
  -- 편의시설 (JSON)
  facilities JSONB,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE CASCADE
);

-- ========== 3. 메뉴 테이블 ==========
CREATE TABLE IF NOT EXISTS menus (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(50) NOT NULL,
  menu_name VARCHAR(200) NOT NULL,
  price VARCHAR(50),
  price_numeric INTEGER,
  is_signature BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE CASCADE
);

-- ========== 4. 사진 테이블 ==========
CREATE TABLE IF NOT EXISTS photos (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(50) NOT NULL,
  photo_url TEXT NOT NULL,
  photo_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE CASCADE
);

-- ========== 5. 순위 히스토리 테이블 ==========
CREATE TABLE IF NOT EXISTS rank_history (
  id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(50) NOT NULL,
  keyword VARCHAR(200) NOT NULL,
  rank_position INTEGER NOT NULL,
  
  -- 해당 시점의 통계
  rating DECIMAL(3,2),
  visitor_reviews INTEGER,
  blog_reviews INTEGER,
  
  measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE CASCADE
);

-- ========== 6. 크롤링 작업 로그 ==========
CREATE TABLE IF NOT EXISTS crawl_logs (
  id BIGSERIAL PRIMARY KEY,
  keyword VARCHAR(200) NOT NULL,
  location VARCHAR(100),
  total_found INTEGER DEFAULT 0,
  total_crawled INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- ========== 인덱스 생성 ==========
CREATE INDEX IF NOT EXISTS idx_places_place_id ON places(place_id);
CREATE INDEX IF NOT EXISTS idx_places_location ON places(sido, sigungu, dong);
CREATE INDEX IF NOT EXISTS idx_places_rating ON places(rating DESC);
CREATE INDEX IF NOT EXISTS idx_rank_history_keyword ON rank_history(keyword);
CREATE INDEX IF NOT EXISTS idx_rank_history_date ON rank_history(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_menus_place_id ON menus(place_id);
CREATE INDEX IF NOT EXISTS idx_photos_place_id ON photos(place_id);

-- ========== Row Level Security (RLS) 활성화 ==========
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE rank_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_logs ENABLE ROW LEVEL SECURITY;

-- ========== 기본 정책 (모두 읽기 가능) ==========
CREATE POLICY "Allow public read access on places" ON places FOR SELECT USING (true);
CREATE POLICY "Allow public read access on place_details" ON place_details FOR SELECT USING (true);
CREATE POLICY "Allow public read access on menus" ON menus FOR SELECT USING (true);
CREATE POLICY "Allow public read access on photos" ON photos FOR SELECT USING (true);
CREATE POLICY "Allow public read access on rank_history" ON rank_history FOR SELECT USING (true);
CREATE POLICY "Allow public read access on crawl_logs" ON crawl_logs FOR SELECT USING (true);

-- ========== updated_at 자동 업데이트 함수 ==========
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ========== 트리거 생성 ==========
CREATE TRIGGER update_places_updated_at BEFORE UPDATE ON places
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_place_details_updated_at BEFORE UPDATE ON place_details
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

