-- 뉴스 게시판 테이블 생성
-- 식당 대표들을 위한 유용한 정보 게시판

CREATE TABLE IF NOT EXISTS news_board (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  image_url TEXT,
  source_url TEXT,
  author VARCHAR(100) DEFAULT 'ADMIN',
  views INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 카테고리 값:
-- 'policy' : 정책/법규 (위생, 세금, 지원금)
-- 'trend' : 트렌드 (유행 메뉴, 소비 패턴)
-- 'management' : 경영 팁 (마케팅, 인건비 절감)
-- 'ingredients' : 식자재 정보 (가격, 원산지)
-- 'technology' : 기술/도구 (POS, 배달앱)

-- 인덱스 생성 (검색 속도 향상)
CREATE INDEX idx_news_category ON news_board(category);
CREATE INDEX idx_news_created_at ON news_board(created_at DESC);
CREATE INDEX idx_news_is_featured ON news_board(is_featured);

-- RLS (Row Level Security) 설정
ALTER TABLE news_board ENABLE ROW LEVEL SECURITY;

-- 모든 사용자는 뉴스를 읽을 수 있음
CREATE POLICY "Anyone can read news"
  ON news_board FOR SELECT
  USING (true);

-- 어드민만 뉴스를 작성/수정/삭제할 수 있음
CREATE POLICY "Admins can insert news"
  ON news_board FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update news"
  ON news_board FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete news"
  ON news_board FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_news_board_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
CREATE TRIGGER news_board_updated_at
  BEFORE UPDATE ON news_board
  FOR EACH ROW
  EXECUTE FUNCTION update_news_board_updated_at();

-- 샘플 데이터 (테스트용)
INSERT INTO news_board (title, content, category, is_featured) VALUES
(
  '2024년 식당 위생등급제 변경사항 안내',
  '식품의약품안전처는 2024년부터 식당 위생등급제를 강화한다고 발표했습니다. 주요 변경사항으로는 평가 항목 세분화, 등급 유효기간 단축(3년→2년), 위생교육 의무화 등이 있습니다. 기존 등급을 받은 업소도 재평가 대상이 되므로 미리 준비하시기 바랍니다.',
  'policy',
  true
),
(
  '올해 주목받는 메뉴 트렌드 TOP 5',
  '2024년 외식 트렌드는 "건강", "프리미엄", "경험"이 키워드입니다. 1) 식물성 단백질 메뉴 2) 로컬 식재료 활용 3) 1인 코스 요리 4) 시그니처 디저트 5) 테이블링 서비스 등이 인기를 끌고 있습니다.',
  'trend',
  true
),
(
  '배달앱 수수료 절감 꿀팁 5가지',
  '배달앱 수수료 부담을 줄이는 실전 노하우를 공유합니다. 1) 자체 배달 병행 2) 포장 주문 유도 3) 중개형/배달대행형 전략적 선택 4) 쿠폰 최적화 5) 피크타임 메뉴 구성 등을 활용하면 월 100만원 이상 절감 가능합니다.',
  'management',
  false
);

