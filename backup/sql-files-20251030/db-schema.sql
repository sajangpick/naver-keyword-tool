-- 사장픽 데이터베이스 스키마
-- SQLite / PostgreSQL 호환

-- ========== 1. 식당 기본 정보 테이블 ==========
CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id VARCHAR(50) UNIQUE NOT NULL,        -- 네이버 플레이스 ID
  place_name VARCHAR(200) NOT NULL,            -- 업체명
  category VARCHAR(100),                        -- 카테고리
  
  -- 주소
  road_address TEXT,                            -- 도로명 주소
  lot_address TEXT,                             -- 지번 주소
  sido VARCHAR(50),                             -- 시/도 (예: 부산광역시)
  sigungu VARCHAR(50),                          -- 시/군/구 (예: 동래구)
  dong VARCHAR(50),                             -- 동 (예: 명장동)
  
  -- 연락처
  phone VARCHAR(20),                            -- 전화번호
  
  -- 통계
  rating DECIMAL(3,2),                          -- 평점 (4.45)
  visitor_reviews INTEGER DEFAULT 0,            -- 방문자 리뷰 수
  blog_reviews INTEGER DEFAULT 0,               -- 블로그 리뷰 수
  
  -- 메타데이터
  first_crawled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 최초 크롤링 시각
  last_crawled_at TIMESTAMP,                    -- 마지막 크롤링 시각
  crawl_count INTEGER DEFAULT 1,                -- 크롤링 횟수
  
  -- 인덱스
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========== 2. 상세 정보 테이블 ==========
CREATE TABLE IF NOT EXISTS place_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id VARCHAR(50) NOT NULL,
  
  -- 영업 정보
  business_hours TEXT,                          -- 영업시간
  break_time TEXT,                              -- 브레이크타임
  
  -- 소개
  introduction TEXT,                            -- 소개/소식
  
  -- 영수증
  new_receipt_count INTEGER DEFAULT 0,          -- 신규 영수증 개수
  total_receipt_count INTEGER DEFAULT 0,        -- 전체 영수증 개수
  
  -- 편의시설 (JSON 형식)
  facilities TEXT,                              -- JSON: ["주차", "예약", "단체석"]
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE CASCADE
);

-- ========== 3. 메뉴 테이블 ==========
CREATE TABLE IF NOT EXISTS menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id VARCHAR(50) NOT NULL,
  menu_name VARCHAR(200) NOT NULL,             -- 메뉴명
  price VARCHAR(50),                            -- 가격 (예: "10,000원")
  price_numeric INTEGER,                        -- 숫자 가격 (10000)
  is_signature BOOLEAN DEFAULT 0,               -- 대표 메뉴 여부
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE CASCADE
);

-- ========== 4. 사진 테이블 ==========
CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id VARCHAR(50) NOT NULL,
  photo_url TEXT NOT NULL,                      -- 사진 URL
  photo_order INTEGER DEFAULT 0,                -- 순서 (1-5)
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE CASCADE
);

-- ========== 5. 순위 히스토리 테이블 ==========
CREATE TABLE IF NOT EXISTS rank_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id VARCHAR(50) NOT NULL,
  keyword VARCHAR(200) NOT NULL,                -- 검색 키워드
  rank_position INTEGER NOT NULL,               -- 순위 (1, 2, 3...)
  
  -- 해당 시점의 통계
  rating DECIMAL(3,2),
  visitor_reviews INTEGER,
  blog_reviews INTEGER,
  
  measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- 측정 시각
  
  FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE CASCADE
);

-- ========== 6. 크롤링 작업 로그 ==========
CREATE TABLE IF NOT EXISTS crawl_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword VARCHAR(200) NOT NULL,                -- 검색 키워드
  location VARCHAR(100),                        -- 지역 (예: "부산 명장동")
  total_found INTEGER DEFAULT 0,                -- 발견된 업체 수
  total_crawled INTEGER DEFAULT 0,              -- 크롤링된 업체 수
  total_errors INTEGER DEFAULT 0,               -- 오류 수
  duration_seconds INTEGER,                     -- 소요 시간 (초)
  status VARCHAR(20) DEFAULT 'pending',         -- pending, running, completed, failed
  error_message TEXT,                           -- 오류 메시지
  
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- ========== 인덱스 생성 ==========
CREATE INDEX idx_places_place_id ON places(place_id);
CREATE INDEX idx_places_location ON places(sido, sigungu, dong);
CREATE INDEX idx_places_rating ON places(rating DESC);
CREATE INDEX idx_rank_history_keyword ON rank_history(keyword);
CREATE INDEX idx_rank_history_date ON rank_history(measured_at DESC);
CREATE INDEX idx_menus_place_id ON menus(place_id);
CREATE INDEX idx_photos_place_id ON photos(place_id);

