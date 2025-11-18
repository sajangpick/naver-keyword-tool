-- 관리자가 작성하지 않은 모든 뉴스 삭제
-- author가 'ADMIN'이 아닌 모든 뉴스 삭제

-- ⚠️ 주의: 이 스크립트는 author가 'ADMIN'이 아닌 모든 뉴스를 삭제합니다.

-- 삭제 전 확인 (어떤 뉴스가 삭제될지 확인)
SELECT id, title, author, created_at 
FROM news_board 
WHERE author != 'ADMIN' OR author IS NULL
ORDER BY created_at DESC;

-- 관리자가 작성하지 않은 뉴스 삭제
DELETE FROM news_board 
WHERE author != 'ADMIN' OR author IS NULL;

-- 삭제 후 확인 (ADMIN 뉴스만 남아야 함)
SELECT COUNT(*) as admin_news_count FROM news_board WHERE author = 'ADMIN';
SELECT COUNT(*) as total_news_count FROM news_board;

