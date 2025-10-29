-- 리뷰 답글 관리 데이터베이스 스키마
-- SQLite / PostgreSQL 호환

-- ========== 1. 사용자 테이블 ==========
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kakao_id VARCHAR(100) UNIQUE,                    -- 카카오 ID
  email VARCHAR(255),                              -- 이메일
  name VARCHAR(100),                               -- 이름
  profile_image TEXT,                              -- 프로필 이미지 URL
  
  -- 사업자 정보
  business_name VARCHAR(200),                      -- 상호명
  business_number VARCHAR(50),                     -- 사업자 등록번호
  place_id VARCHAR(50),                            -- 연결된 네이버 플레이스 ID
  
  -- 구독 정보
  subscription_plan VARCHAR(50) DEFAULT 'free',   -- free, basic, premium
  subscription_expires_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE SET NULL
);

-- ========== 2. 리뷰 테이블 ==========
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,                        -- 작성자 (사장님)
  
  -- 리뷰 정보
  review_text TEXT NOT NULL,                       -- 고객이 작성한 리뷰 원문
  naver_place_url TEXT,                            -- 네이버 플레이스 URL (선택)
  place_id VARCHAR(50),                            -- 추출된 place_id
  
  -- 크롤링된 식당 정보 (JSON)
  place_info_json TEXT,                            -- 크롤링된 식당 정보 (JSON 형식)
  
  -- 사장님 입력 정보
  owner_tips TEXT,                                 -- 사장님 추천 포인트
  
  -- 메타데이터
  source VARCHAR(50) DEFAULT 'manual',             -- manual, naver, kakao 등
  status VARCHAR(20) DEFAULT 'draft',              -- draft, replied, archived
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (place_id) REFERENCES places(place_id) ON DELETE SET NULL
);

-- ========== 3. 답글 테이블 ==========
CREATE TABLE IF NOT EXISTS review_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL,                      -- 원본 리뷰
  user_id INTEGER NOT NULL,                        -- 작성자 (사장님)
  
  -- 답글 내용
  reply_text TEXT NOT NULL,                        -- AI가 생성한 답글
  
  -- 생성 정보
  ai_model VARCHAR(50),                            -- claude, chatgpt, gemini
  generation_time_ms INTEGER,                      -- 생성 소요 시간 (밀리초)
  
  -- 피드백
  is_used BOOLEAN DEFAULT 0,                       -- 실제로 사용했는지
  feedback_rating INTEGER,                         -- 1-5 평점
  feedback_comment TEXT,                           -- 피드백 코멘트
  
  -- 수정 이력
  edited_text TEXT,                                -- 사용자가 수정한 최종 텍스트
  is_edited BOOLEAN DEFAULT 0,                     -- 수정 여부
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========== 4. 사용 통계 테이블 ==========
CREATE TABLE IF NOT EXISTS usage_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  
  -- 사용량
  reviews_created INTEGER DEFAULT 0,               -- 리뷰 분석 횟수
  replies_generated INTEGER DEFAULT 0,             -- 답글 생성 횟수
  replies_used INTEGER DEFAULT 0,                  -- 실제 사용 횟수
  
  -- 기간
  stat_date DATE NOT NULL,                         -- 통계 날짜
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, stat_date)
);

-- ========== 5. 답글 템플릿 테이블 (선택) ==========
CREATE TABLE IF NOT EXISTS reply_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,                        -- 소유자
  
  -- 템플릿 정보
  template_name VARCHAR(100) NOT NULL,             -- 템플릿 이름
  template_text TEXT NOT NULL,                     -- 템플릿 내용
  category VARCHAR(50),                            -- 긍정, 부정, 중립 등
  
  -- 통계
  usage_count INTEGER DEFAULT 0,                   -- 사용 횟수
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ========== 인덱스 생성 ==========
CREATE INDEX idx_users_kakao_id ON users(kakao_id);
CREATE INDEX idx_users_place_id ON users(place_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_place_id ON reviews(place_id);
CREATE INDEX idx_reviews_status ON reviews(status);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_review_replies_review_id ON review_replies(review_id);
CREATE INDEX idx_review_replies_user_id ON review_replies(user_id);
CREATE INDEX idx_review_replies_created_at ON review_replies(created_at DESC);
CREATE INDEX idx_usage_stats_user_date ON usage_stats(user_id, stat_date);
CREATE INDEX idx_reply_templates_user_id ON reply_templates(user_id);

-- ========== 샘플 데이터 삽입 (테스트용) ==========
-- 나중에 삭제 가능

-- 테스트 사용자
INSERT INTO users (kakao_id, email, name, business_name, subscription_plan) 
VALUES ('test_kakao_123', 'test@example.com', '홍길동', '맛있는 식당', 'free');

-- 테스트 리뷰
INSERT INTO reviews (user_id, review_text, owner_tips, status) 
VALUES 
(1, '음식이 정말 맛있었어요. 분위기도 좋고 서비스도 친절했습니다.', '삼겹살, 돼지갈비', 'draft'),
(1, '갈비탕이 진짜 맛있네요. 다음엔 냉면도 먹어보고 싶어요.', '냉면, 육회', 'draft');

