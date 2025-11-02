-- ========================================
-- 🍳 사장픽 레시피 관리 시스템 데이터베이스 스키마
-- ========================================
-- 생성일: 2025년 11월 2일
-- 버전: 1.0.0
-- 설명: 레시피 검색, 생성, 관리를 위한 테이블 구조
-- ========================================

-- 1. 레시피 메인 테이블
-- ========================================
CREATE TABLE IF NOT EXISTS recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- 기본 정보
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 한식, 중식, 일식, 양식, 분식 등
  sub_category VARCHAR(50), -- 국/탕, 찌개, 구이, 볶음 등
  
  -- 상세 정보
  ingredients JSONB NOT NULL, -- [{name, amount, unit, cost}]
  seasonings JSONB, -- [{name, amount, unit}]
  steps JSONB NOT NULL, -- [{order, description, time, image_url}]
  
  -- 원가 및 시간 정보
  cost_per_serving DECIMAL(10, 2),
  total_cost DECIMAL(10, 2),
  servings INTEGER DEFAULT 1,
  prep_time INTEGER, -- 준비 시간(분)
  cook_time INTEGER, -- 조리 시간(분)
  total_time INTEGER GENERATED ALWAYS AS (prep_time + cook_time) STORED,
  
  -- 난이도 및 특성
  difficulty VARCHAR(20) CHECK (difficulty IN ('초급', '중급', '고급', '전문가')),
  spicy_level INTEGER DEFAULT 0 CHECK (spicy_level >= 0 AND spicy_level <= 5),
  
  -- 이미지 및 영상
  main_image_url TEXT,
  images JSONB, -- 추가 이미지 URL 배열
  video_url TEXT,
  
  -- 태그 및 검색
  tags TEXT[], -- ARRAY['김치', '발효', '매운맛']
  keywords TEXT[], -- 검색용 키워드
  
  -- 공개 설정
  is_public BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false, -- 추천 레시피
  
  -- 출처 정보
  source VARCHAR(50), -- 'user', 'public_api', 'chatgpt', 'youtube'
  source_url TEXT, -- 원본 출처 URL
  
  -- 평가 정보
  rating DECIMAL(2, 1) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  bookmark_count INTEGER DEFAULT 0,
  
  -- 버전 관리
  version INTEGER DEFAULT 1,
  parent_recipe_id UUID REFERENCES recipes(id), -- 원본 레시피 (변형인 경우)
  
  -- 타임스탬프
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_recipes_user_id ON recipes(user_id);
CREATE INDEX idx_recipes_category ON recipes(category);
CREATE INDEX idx_recipes_is_public ON recipes(is_public);
CREATE INDEX idx_recipes_created_at ON recipes(created_at DESC);
CREATE INDEX idx_recipes_rating ON recipes(rating DESC);
CREATE INDEX idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX idx_recipes_keywords ON recipes USING GIN(keywords);

-- ========================================
-- 2. 레시피 버전 이력 테이블
-- ========================================
CREATE TABLE IF NOT EXISTS recipe_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  
  -- 스냅샷 데이터 (수정 시점의 전체 레시피 정보)
  recipe_data JSONB NOT NULL,
  
  -- 변경 정보
  change_note TEXT,
  changed_by UUID REFERENCES profiles(id),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_recipe_versions_recipe_id ON recipe_versions(recipe_id);
CREATE INDEX idx_recipe_versions_created_at ON recipe_versions(created_at DESC);

-- ========================================
-- 3. 밑반찬 매칭 테이블
-- ========================================
CREATE TABLE IF NOT EXISTS side_dish_pairings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- 메인 요리와 밑반찬 매칭
  main_dish VARCHAR(100) NOT NULL,
  side_dishes JSONB NOT NULL, -- [{name, category, required}]
  
  -- 매칭 규칙
  pairing_rule VARCHAR(50), -- 'traditional', 'modern', 'fusion'
  season VARCHAR(20), -- 'spring', 'summer', 'fall', 'winter', 'all'
  
  -- 사용 통계
  use_count INTEGER DEFAULT 0,
  rating DECIMAL(2, 1) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_side_dish_pairings_user_id ON side_dish_pairings(user_id);
CREATE INDEX idx_side_dish_pairings_main_dish ON side_dish_pairings(main_dish);

-- ========================================
-- 4. 레시피 북마크 테이블
-- ========================================
CREATE TABLE IF NOT EXISTS recipe_bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  
  folder_name VARCHAR(100),
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, recipe_id)
);

CREATE INDEX idx_recipe_bookmarks_user_id ON recipe_bookmarks(user_id);
CREATE INDEX idx_recipe_bookmarks_recipe_id ON recipe_bookmarks(recipe_id);

-- ========================================
-- 5. 레시피 평가 테이블
-- ========================================
CREATE TABLE IF NOT EXISTS recipe_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, recipe_id)
);

CREATE INDEX idx_recipe_ratings_recipe_id ON recipe_ratings(recipe_id);
CREATE INDEX idx_recipe_ratings_user_id ON recipe_ratings(user_id);

-- ========================================
-- 6. 레시피 카테고리 마스터 테이블
-- ========================================
CREATE TABLE IF NOT EXISTS recipe_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_name VARCHAR(50) UNIQUE NOT NULL,
  sub_categories JSONB, -- ['국/탕', '찌개', '전골']
  icon_emoji VARCHAR(10),
  display_order INTEGER,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 기본 카테고리 삽입
INSERT INTO recipe_categories (category_name, sub_categories, icon_emoji, display_order) VALUES
  ('한식', '["국/탕", "찌개", "구이", "볶음", "조림", "찜", "전", "나물", "김치"]', '🍚', 1),
  ('중식', '["볶음", "탕수육", "짜장", "짬뽕", "딤섬", "냉채"]', '🥟', 2),
  ('일식', '["초밥", "라멘", "돈부리", "우동", "튀김", "나베"]', '🍱', 3),
  ('양식', '["파스타", "스테이크", "샐러드", "수프", "그라탕", "리조또"]', '🍝', 4),
  ('분식', '["떡볶이", "김밥", "순대", "튀김", "어묵"]', '🍜', 5),
  ('디저트', '["케이크", "쿠키", "빵", "아이스크림", "음료"]', '🍰', 6),
  ('반찬', '["김치류", "장아찌", "젓갈", "나물", "조림", "볶음"]', '🥘', 7),
  ('기타', '["퓨전", "샐러드", "샌드위치", "브런치"]', '🍴', 8)
ON CONFLICT (category_name) DO NOTHING;

-- ========================================
-- 7. 공공 API 캐시 테이블 (성능 최적화)
-- ========================================
CREATE TABLE IF NOT EXISTS public_recipe_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  api_source VARCHAR(50) NOT NULL, -- 'rural_dev', 'youtube', etc.
  search_query TEXT NOT NULL,
  response_data JSONB NOT NULL,
  
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(api_source, search_query)
);

CREATE INDEX idx_public_recipe_cache_expires ON public_recipe_cache(expires_at);

-- ========================================
-- 8. Row Level Security (RLS) 정책
-- ========================================

-- recipes 테이블 RLS
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public recipes" ON recipes
  FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own recipes" ON recipes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipes" ON recipes
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipes" ON recipes
  FOR DELETE
  USING (auth.uid() = user_id);

-- recipe_bookmarks 테이블 RLS
ALTER TABLE recipe_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own bookmarks" ON recipe_bookmarks
  FOR ALL
  USING (auth.uid() = user_id);

-- recipe_ratings 테이블 RLS
ALTER TABLE recipe_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all ratings" ON recipe_ratings
  FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own ratings" ON recipe_ratings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" ON recipe_ratings
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings" ON recipe_ratings
  FOR DELETE
  USING (auth.uid() = user_id);

-- ========================================
-- 9. 트리거 함수
-- ========================================

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_side_dish_pairings_updated_at BEFORE UPDATE ON side_dish_pairings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 레시피 평점 자동 계산 트리거
CREATE OR REPLACE FUNCTION update_recipe_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE recipes
  SET rating = (
    SELECT AVG(rating)::DECIMAL(2,1)
    FROM recipe_ratings
    WHERE recipe_id = NEW.recipe_id
  ),
  rating_count = (
    SELECT COUNT(*)
    FROM recipe_ratings
    WHERE recipe_id = NEW.recipe_id
  )
  WHERE id = NEW.recipe_id;
  
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_recipe_rating_on_insert
  AFTER INSERT OR UPDATE OR DELETE ON recipe_ratings
  FOR EACH ROW EXECUTE FUNCTION update_recipe_rating();

-- ========================================
-- 10. 샘플 데이터 (테스트용)
-- ========================================
-- 주의: 프로덕션 환경에서는 이 부분을 주석처리하거나 제거하세요

-- 샘플 레시피 추가 (김치찌개)
/*
INSERT INTO recipes (
  user_id,
  name,
  description,
  category,
  sub_category,
  ingredients,
  seasonings,
  steps,
  cost_per_serving,
  servings,
  prep_time,
  cook_time,
  difficulty,
  spicy_level,
  tags,
  keywords,
  is_public,
  source
) VALUES (
  (SELECT id FROM profiles LIMIT 1),
  '김치찌개',
  '한국인의 소울푸드, 얼큰하고 시원한 김치찌개',
  '한식',
  '찌개',
  '[
    {"name": "김치", "amount": "200", "unit": "g", "cost": 2000},
    {"name": "돼지고기", "amount": "150", "unit": "g", "cost": 3000},
    {"name": "두부", "amount": "1/2", "unit": "모", "cost": 1000},
    {"name": "대파", "amount": "1", "unit": "대", "cost": 500}
  ]'::jsonb,
  '[
    {"name": "고춧가루", "amount": "1", "unit": "큰술"},
    {"name": "다진마늘", "amount": "1", "unit": "큰술"},
    {"name": "국간장", "amount": "1", "unit": "큰술"}
  ]'::jsonb,
  '[
    {"order": 1, "description": "김치를 한입 크기로 썬다", "time": 2},
    {"order": 2, "description": "돼지고기를 먹기 좋게 썬다", "time": 3},
    {"order": 3, "description": "냄비에 김치와 돼지고기를 넣고 볶는다", "time": 5},
    {"order": 4, "description": "물을 붓고 끓인다", "time": 10},
    {"order": 5, "description": "두부와 대파를 넣고 5분 더 끓인다", "time": 5}
  ]'::jsonb,
  1650,
  4,
  10,
  15,
  '초급',
  3,
  ARRAY['김치', '찌개', '한식', '매운맛'],
  ARRAY['김치찌개 레시피', '김치찌개 만들기', '돼지고기 김치찌개'],
  true,
  'user'
);
*/

-- ========================================
-- 완료 메시지
-- ========================================
-- 스키마 생성이 완료되었습니다.
-- Supabase SQL 에디터에서 이 파일을 실행하세요.
