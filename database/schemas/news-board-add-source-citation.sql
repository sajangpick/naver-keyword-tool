-- news_board 테이블에 source_citation 컬럼 추가
-- 출처 정보 (언론사, 기자, 입력 시각 등) 저장용

ALTER TABLE news_board 
ADD COLUMN IF NOT EXISTS source_citation TEXT;

COMMENT ON COLUMN news_board.source_citation IS '출처 정보 (언론사, 기자, 입력 시각 등)';

