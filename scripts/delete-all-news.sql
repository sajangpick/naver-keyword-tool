-- 기존 뉴스 게시판 데이터 모두 삭제
-- news-management.html에서 작성한 뉴스만 남기기 위해 실행

-- ⚠️ 주의: 이 스크립트는 news_board 테이블의 모든 데이터를 삭제합니다.
-- 실행 전에 백업을 권장합니다.

-- 모든 뉴스 삭제
DELETE FROM news_board;

-- 삭제 확인 (결과가 0개여야 함)
SELECT COUNT(*) as remaining_news FROM news_board;

-- 시퀀스 리셋 (선택사항 - ID를 1부터 다시 시작하려면)
-- ALTER SEQUENCE news_board_id_seq RESTART WITH 1;

