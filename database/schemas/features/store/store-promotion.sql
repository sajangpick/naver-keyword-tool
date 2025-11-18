-- =====================================================
-- 내 가게 알리기 (Store Promotion) 스키마
-- =====================================================
-- 설명: 가게를 심도 있게 설명하고 싶은 대표를 위한 공간
--       자세히 작성할수록 AI가 활용할 정보가 많아져서
--       더 풍부한 블로그/답글 생성 가능
-- =====================================================

-- store_promotions 테이블 생성 (별도 테이블)
CREATE TABLE IF NOT EXISTS store_promotions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- 7개 항목 (모두 선택사항)
  signature_menu TEXT,              -- 시그니처 메뉴 스토리
  special_ingredients TEXT,         -- 재료/조리법의 특별함
  atmosphere_facilities TEXT,       -- 분위기/편의시설 (상세)
  owner_story TEXT,                 -- 사장님/셰프 이야기
  recommended_situations TEXT,      -- 추천 상황 (가족 모임, 데이트 등)
  sns_photo_points TEXT,            -- 인스타/SNS 포인트
  special_events TEXT,              -- 이벤트/특별 서비스
  
  -- 메타 정보
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_store_promotions_user_id ON store_promotions(user_id);

-- 컬럼 설명
COMMENT ON TABLE store_promotions IS '내 가게 알리기 - 심도 있는 가게 설명';
COMMENT ON COLUMN store_promotions.signature_menu IS '시그니처 메뉴 스토리 (예: "30년 전통 비법 양념장으로 72시간 숙성한 LA갈비")';
COMMENT ON COLUMN store_promotions.special_ingredients IS '재료/조리법 특별함 (예: "국내산 1등급 한우만 사용, 매일 새벽 직접 만드는 육수")';
COMMENT ON COLUMN store_promotions.atmosphere_facilities IS '분위기/편의시설 상세 (예: "2층 독립 룸 4개, 한옥 정원 뷰")';
COMMENT ON COLUMN store_promotions.owner_story IS '사장님/셰프 이야기 (예: "한식 조리 기능장 출신, 20년 경력")';
COMMENT ON COLUMN store_promotions.recommended_situations IS '추천 상황 (예: "가족 모임, 회식, 데이트")';
COMMENT ON COLUMN store_promotions.sns_photo_points IS 'SNS 포인트 (예: "한옥 정원 뷰, 예쁜 도자기 그릇")';
COMMENT ON COLUMN store_promotions.special_events IS '이벤트/특별 서비스 (예: "생일 케이크 무료 제공")';

