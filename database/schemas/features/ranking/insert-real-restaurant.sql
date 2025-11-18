-- 실제 네이버 플레이스 식당 추가 예시
-- 스무고개 해운대점 추가

INSERT INTO adlog_restaurants (
    place_id, 
    place_name, 
    category,
    sub_category,
    address, 
    district, 
    city,
    phone,
    place_url,
    is_active
) VALUES (
    '1390003666',  -- 네이버 플레이스 ID
    '스무고개 해운대점',
    '한식',
    '소고기구이',
    '부산 해운대구 좌동순환로468번가길 81',
    '해운대구',
    '부산',
    '0507-1416-2759',
    'https://m.place.naver.com/restaurant/1390003666',
    true
) ON CONFLICT (place_id) DO UPDATE SET
    place_name = EXCLUDED.place_name,
    category = EXCLUDED.category,
    address = EXCLUDED.address,
    updated_at = CURRENT_TIMESTAMP;

-- 더 많은 실제 식당 추가 (예시)
INSERT INTO adlog_restaurants (place_id, place_name, category, address, district, city, place_url)
VALUES 
    -- 강남 지역 인기 식당들
    ('1234567890', '식당이름1', '한식', '서울 강남구 주소1', '강남구', '서울', 'https://m.place.naver.com/restaurant/1234567890'),
    ('1234567891', '식당이름2', '중식', '서울 강남구 주소2', '강남구', '서울', 'https://m.place.naver.com/restaurant/1234567891'),
    ('1234567892', '식당이름3', '카페', '서울 강남구 주소3', '강남구', '서울', 'https://m.place.naver.com/restaurant/1234567892')
ON CONFLICT (place_id) DO NOTHING;

-- 확인
SELECT * FROM adlog_restaurants WHERE place_id = '1390003666';
