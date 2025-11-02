-- 수집된 데이터 확인

-- 1. 식당 데이터 확인
SELECT COUNT(*) as total_restaurants FROM adlog_restaurants;

-- 2. 실제 식당 목록 (테스트 데이터 제외)
SELECT * FROM adlog_restaurants 
WHERE place_id NOT LIKE 'test_%'
LIMIT 10;

-- 3. 오늘 순위 데이터 확인
SELECT COUNT(*) as today_rankings FROM daily_rankings 
WHERE search_date = CURRENT_DATE;

-- 4. 키워드별 순위 확인
SELECT 
    search_keyword,
    COUNT(*) as count
FROM daily_rankings
WHERE search_date = CURRENT_DATE
GROUP BY search_keyword
ORDER BY search_keyword;

-- 5. 상위 순위 식당
SELECT 
    dr.rank,
    ar.place_name,
    dr.search_keyword,
    dr.search_time
FROM daily_rankings dr
JOIN adlog_restaurants ar ON dr.restaurant_id = ar.id
WHERE dr.search_date = CURRENT_DATE
    AND dr.rank <= 5
ORDER BY dr.search_keyword, dr.rank
LIMIT 20;
