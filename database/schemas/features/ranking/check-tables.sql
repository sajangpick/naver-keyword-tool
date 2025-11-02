-- 생성된 테이블 확인
SELECT 
    'adlog_restaurants' as table_name, 
    COUNT(*) as row_count 
FROM adlog_restaurants
UNION ALL
SELECT 
    'daily_rankings' as table_name, 
    COUNT(*) as row_count 
FROM daily_rankings
UNION ALL
SELECT 
    'ranking_snapshots' as table_name, 
    COUNT(*) as row_count 
FROM ranking_snapshots
UNION ALL
SELECT 
    'ranking_statistics' as table_name, 
    COUNT(*) as row_count 
FROM ranking_statistics;

-- 테스트 데이터 확인
SELECT * FROM adlog_restaurants;
