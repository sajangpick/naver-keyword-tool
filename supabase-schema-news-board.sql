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

-- ⚠️ 샘플 데이터는 제거되었습니다.
-- 뉴스는 news-management.html 관리자 페이지에서만 작성/저장됩니다.

