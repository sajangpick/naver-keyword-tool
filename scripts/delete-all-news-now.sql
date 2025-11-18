-- news-board.html에 표시되는 모든 뉴스 삭제
-- ⚠️ 주의: 이 스크립트는 news_board 테이블의 모든 데이터를 삭제합니다.

-- 모든 뉴스 삭제
DELETE FROM news_board;

-- 삭제 확인 (결과가 0개여야 함)
SELECT COUNT(*) as remaining_news FROM news_board;

