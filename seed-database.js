// 데이터베이스 샘플 데이터 생성 스크립트
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('='.repeat(60));
console.log('🌱 데이터베이스 샘플 데이터 생성');
console.log('='.repeat(60));
console.log('');

const DB_PATH = path.join(__dirname, 'data/sajangpick.db');

// 데이터베이스 파일 확인
if (!fs.existsSync(DB_PATH)) {
  console.error('❌ 데이터베이스 파일이 없습니다!');
  console.log('먼저 데이터베이스를 초기화하세요: pnpm run db:init');
  process.exit(1);
}

const db = new Database(DB_PATH);

console.log('✅ 데이터베이스 연결 성공');
console.log('');

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
const sampleMenus = {
  'place_001': [
    { menu_name: '소갈비', price: '32,000원', price_numeric: 32000 },
    { menu_name: '돼지갈비', price: '28,000원', price_numeric: 28000 },
    { menu_name: '된장찌개', price: '8,000원', price_numeric: 8000 },
  ],
  'place_002': [
    { menu_name: '해물파전', price: '18,000원', price_numeric: 18000 },
    { menu_name: '김치전', price: '15,000원', price_numeric: 15000 },
    { menu_name: '동동주', price: '12,000원', price_numeric: 12000 },
  ],
  'place_003': [
    { menu_name: '특선 초밥', price: '45,000원', price_numeric: 45000 },
    { menu_name: '회 모듬', price: '55,000원', price_numeric: 55000 },
    { menu_name: '우동', price: '12,000원', price_numeric: 12000 },
  ],
  'place_004': [
    { menu_name: '회 정식', price: '38,000원', price_numeric: 38000 },
    { menu_name: '해물탕', price: '42,000원', price_numeric: 42000 },
    { menu_name: '조개구이', price: '25,000원', price_numeric: 25000 },
  ],
  'place_005': [
    { menu_name: '후라이드 치킨', price: '18,000원', price_numeric: 18000 },
    { menu_name: '양념 치킨', price: '19,000원', price_numeric: 19000 },
    { menu_name: '반반 치킨', price: '19,000원', price_numeric: 19000 },
  ],
};

try {
  console.log('📝 샘플 데이터 삽입 중...');
  console.log('');

  // 트랜잭션 시작
  const insertAll = db.transaction(() => {
    let placesInserted = 0;
    let menusInserted = 0;
    let historyInserted = 0;

    // 1. 식당 정보 삽입
    const insertPlace = db.prepare(`
      INSERT INTO places (
        place_id, place_name, category,
        road_address, lot_address,
        sido, sigungu, dong,
        phone, rating, visitor_reviews, blog_reviews,
        last_crawled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    for (const place of samplePlaces) {
      try {
        insertPlace.run(
          place.place_id,
          place.place_name,
          place.category,
          place.road_address,
          place.lot_address,
          place.sido,
          place.sigungu,
          place.dong,
          place.phone,
          place.rating,
          place.visitor_reviews,
          place.blog_reviews
        );
        placesInserted++;
        console.log(`  ✅ ${place.place_name}`);
      } catch (err) {
        if (err.message.includes('UNIQUE')) {
          console.log(`  ⚠️  ${place.place_name} (이미 존재함, 스킵)`);
        } else {
          throw err;
        }
      }
    }

    // 2. 메뉴 삽입
    const insertMenu = db.prepare(`
      INSERT INTO menus (place_id, menu_name, price, price_numeric)
      VALUES (?, ?, ?, ?)
    `);

    for (const [placeId, menus] of Object.entries(sampleMenus)) {
      for (const menu of menus) {
        insertMenu.run(
          placeId,
          menu.menu_name,
          menu.price,
          menu.price_numeric
        );
        menusInserted++;
      }
    }

    // 3. 순위 히스토리 삽입
    const insertHistory = db.prepare(`
      INSERT INTO rank_history (
        place_id, keyword, rank_position,
        rating, visitor_reviews, blog_reviews
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const keywords = ['부산 맛집', '해운대 맛집', '부산 일식', '광안리 맛집', '서면 맛집'];
    
    samplePlaces.forEach((place, index) => {
      const keyword = keywords[index] || '부산 맛집';
      insertHistory.run(
        place.place_id,
        keyword,
        index + 1,
        place.rating,
        place.visitor_reviews,
        place.blog_reviews
      );
      historyInserted++;
    });

    // 4. 크롤링 로그 삽입
    const insertLog = db.prepare(`
      INSERT INTO crawl_logs (
        keyword, location, total_found, total_crawled,
        total_errors, duration_seconds, status, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    insertLog.run('부산 해운대구 맛집', '부산 해운대구', 5, 5, 0, 12, 'completed');
    insertLog.run('부산 동래구 맛집', '부산 동래구', 3, 3, 0, 8, 'completed');

    return { placesInserted, menusInserted, historyInserted };
  });

  const result = insertAll();

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ 샘플 데이터 생성 완료!');
  console.log('='.repeat(60));
  console.log('');
  console.log(`📊 삽입된 데이터:`);
  console.log(`   - 식당: ${result.placesInserted}개`);
  console.log(`   - 메뉴: ${result.menusInserted}개`);
  console.log(`   - 순위 기록: ${result.historyInserted}개`);
  console.log(`   - 크롤링 로그: 2개`);
  console.log('');
  console.log('💡 다음 단계:');
  console.log('   1. 데이터 확인: pnpm run db:check');
  console.log('   2. 서버 실행: pnpm run dev');
  console.log('   3. 웹에서 확인: http://localhost:10000/admin/rank-report.html');
  console.log('');

} catch (err) {
  console.error('');
  console.error('❌ 오류 발생:', err.message);
  console.error('');
  if (err.message.includes('no such table')) {
    console.log('💡 먼저 데이터베이스를 초기화하세요: pnpm run db:init');
  }
  process.exit(1);
} finally {
  db.close();
}

