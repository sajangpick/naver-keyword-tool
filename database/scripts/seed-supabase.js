// Supabase 샘플 데이터 생성 스크립트
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

console.log('='.repeat(60));
console.log('🌱 Supabase 샘플 데이터 생성');
console.log('='.repeat(60));
console.log('');

// 환경변수 확인
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다!');
  console.log('');
  console.log('.env 파일에 다음을 추가하세요:');
  console.log('NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co');
  console.log('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
  console.log('');
  process.exit(1);
}

// Supabase 클라이언트 생성
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 샘플 데이터
const samplePlaces = [
  {
    place_id: 'place_001',
    place_name: '해운대 맛집 갈비집',
    category: '한식 > 갈비',
    road_address: '부산광역시 해운대구 해운대로 123',
    lot_address: '부산광역시 해운대구 우동 456-7',
    sido: '부산광역시',
    sigungu: '해운대구',
    dong: '우동',
    phone: '051-123-4567',
    rating: 4.5,
    visitor_reviews: 128,
    blog_reviews: 45,
  },
  {
    place_id: 'place_002',
    place_name: '동래 전통 파전집',
    category: '한식 > 파전',
    road_address: '부산광역시 동래구 중앙대로 234',
    lot_address: '부산광역시 동래구 명장동 789-1',
    sido: '부산광역시',
    sigungu: '동래구',
    dong: '명장동',
    phone: '051-234-5678',
    rating: 4.2,
    visitor_reviews: 89,
    blog_reviews: 32,
  },
  {
    place_id: 'place_003',
    place_name: '서면 고급 일식당',
    category: '일식 > 초밥',
    road_address: '부산광역시 부산진구 서면로 345',
    lot_address: '부산광역시 부산진구 부전동 123-4',
    sido: '부산광역시',
    sigungu: '부산진구',
    dong: '부전동',
    phone: '051-345-6789',
    rating: 4.7,
    visitor_reviews: 256,
    blog_reviews: 78,
  },
  {
    place_id: 'place_004',
    place_name: '광안리 해산물 전문점',
    category: '한식 > 해산물',
    road_address: '부산광역시 수영구 광안해변로 456',
    lot_address: '부산광역시 수영구 광안동 234-5',
    sido: '부산광역시',
    sigungu: '수영구',
    dong: '광안동',
    phone: '051-456-7890',
    rating: 4.4,
    visitor_reviews: 178,
    blog_reviews: 56,
  },
  {
    place_id: 'place_005',
    place_name: '남포동 먹자골목 치킨',
    category: '치킨',
    road_address: '부산광역시 중구 남포길 567',
    lot_address: '부산광역시 중구 남포동 345-6',
    sido: '부산광역시',
    sigungu: '중구',
    dong: '남포동',
    phone: '051-567-8901',
    rating: 4.3,
    visitor_reviews: 145,
    blog_reviews: 41,
  },
];

// 메뉴 샘플
const sampleMenus = [
  { place_id: 'place_001', menu_name: '소갈비', price: '32,000원', price_numeric: 32000 },
  { place_id: 'place_001', menu_name: '돼지갈비', price: '28,000원', price_numeric: 28000 },
  { place_id: 'place_001', menu_name: '된장찌개', price: '8,000원', price_numeric: 8000 },
  
  { place_id: 'place_002', menu_name: '해물파전', price: '18,000원', price_numeric: 18000 },
  { place_id: 'place_002', menu_name: '김치전', price: '15,000원', price_numeric: 15000 },
  { place_id: 'place_002', menu_name: '동동주', price: '12,000원', price_numeric: 12000 },
  
  { place_id: 'place_003', menu_name: '특선 초밥', price: '45,000원', price_numeric: 45000 },
  { place_id: 'place_003', menu_name: '회 모듬', price: '55,000원', price_numeric: 55000 },
  { place_id: 'place_003', menu_name: '우동', price: '12,000원', price_numeric: 12000 },
  
  { place_id: 'place_004', menu_name: '회 정식', price: '38,000원', price_numeric: 38000 },
  { place_id: 'place_004', menu_name: '해물탕', price: '42,000원', price_numeric: 42000 },
  { place_id: 'place_004', menu_name: '조개구이', price: '25,000원', price_numeric: 25000 },
  
  { place_id: 'place_005', menu_name: '후라이드 치킨', price: '18,000원', price_numeric: 18000 },
  { place_id: 'place_005', menu_name: '양념 치킨', price: '19,000원', price_numeric: 19000 },
  { place_id: 'place_005', menu_name: '반반 치킨', price: '19,000원', price_numeric: 19000 },
];

async function seedDatabase() {
  try {
    let stats = {
      places: 0,
      menus: 0,
      history: 0,
      logs: 0,
    };

    // 1. 식당 데이터 삽입
    console.log('📝 식당 데이터 삽입 중...');
    console.log('');
    
    for (const place of samplePlaces) {
      const { data, error } = await supabase
        .from('places')
        .insert([place])
        .select();
      
      if (error) {
        if (error.code === '23505') { // 중복 키
          console.log(`  ⚠️  ${place.place_name} (이미 존재함)`);
        } else {
          console.error(`  ❌ ${place.place_name}:`, error.message);
        }
      } else {
        console.log(`  ✅ ${place.place_name}`);
        stats.places++;
      }
    }

    // 2. 메뉴 데이터 삽입
    console.log('');
    console.log('🍽️  메뉴 데이터 삽입 중...');
    
    const { data: menuData, error: menuError } = await supabase
      .from('menus')
      .insert(sampleMenus)
      .select();
    
    if (menuError) {
      console.error('  ❌ 메뉴 삽입 오류:', menuError.message);
    } else {
      stats.menus = menuData.length;
      console.log(`  ✅ ${menuData.length}개 메뉴 삽입 완료`);
    }

    // 3. 순위 히스토리 삽입
    console.log('');
    console.log('📈 순위 기록 삽입 중...');
    
    const keywords = ['부산 맛집', '해운대 맛집', '부산 일식', '광안리 맛집', '서면 맛집'];
    const historyData = samplePlaces.map((place, index) => ({
      place_id: place.place_id,
      keyword: keywords[index] || '부산 맛집',
      rank_position: index + 1,
      rating: place.rating,
      visitor_reviews: place.visitor_reviews,
      blog_reviews: place.blog_reviews,
    }));
    
    const { data: histData, error: histError } = await supabase
      .from('rank_history')
      .insert(historyData)
      .select();
    
    if (histError) {
      console.error('  ❌ 순위 기록 오류:', histError.message);
    } else {
      stats.history = histData.length;
      console.log(`  ✅ ${histData.length}개 순위 기록 삽입 완료`);
    }

    // 4. 크롤링 로그 삽입
    console.log('');
    console.log('📝 크롤링 로그 삽입 중...');
    
    const logsData = [
      {
        keyword: '부산 해운대구 맛집',
        location: '부산 해운대구',
        total_found: 5,
        total_crawled: 5,
        total_errors: 0,
        duration_seconds: 12,
        status: 'completed',
      },
      {
        keyword: '부산 동래구 맛집',
        location: '부산 동래구',
        total_found: 3,
        total_crawled: 3,
        total_errors: 0,
        duration_seconds: 8,
        status: 'completed',
      },
    ];
    
    const { data: logData, error: logError } = await supabase
      .from('crawl_logs')
      .insert(logsData)
      .select();
    
    if (logError) {
      console.error('  ❌ 크롤링 로그 오류:', logError.message);
    } else {
      stats.logs = logData.length;
      console.log(`  ✅ ${logData.length}개 로그 삽입 완료`);
    }

    // 결과 출력
    console.log('');
    console.log('='.repeat(60));
    console.log('✅ Supabase 샘플 데이터 생성 완료!');
    console.log('='.repeat(60));
    console.log('');
    console.log(`📊 삽입된 데이터:`);
    console.log(`   - 식당: ${stats.places}개`);
    console.log(`   - 메뉴: ${stats.menus}개`);
    console.log(`   - 순위 기록: ${stats.history}개`);
    console.log(`   - 크롤링 로그: ${stats.logs}개`);
    console.log('');
    console.log('💡 Supabase 대시보드에서 확인해보세요!');
    console.log('   ' + supabaseUrl);
    console.log('');

  } catch (err) {
    console.error('');
    console.error('❌ 오류 발생:', err.message);
    console.error('');
  }
}

// 실행
seedDatabase();

