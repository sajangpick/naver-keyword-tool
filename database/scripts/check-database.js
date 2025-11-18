// 데이터베이스 확인 스크립트
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'data/sajangpick.db');

console.log('='.repeat(60));
console.log('📊 사장픽 데이터베이스 확인 도구');
console.log('='.repeat(60));
console.log('');

// data 폴더 확인 및 생성
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  console.log('⚠️  data 폴더가 없습니다. 새로 생성합니다...');
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ data 폴더를 생성했습니다.');
}

// 데이터베이스 파일 확인
if (!fs.existsSync(DB_PATH)) {
  console.log('');
  console.log('⚠️  데이터베이스 파일이 없습니다!');
  console.log('');
  console.log('📝 데이터베이스를 초기화하려면 다음 명령어를 실행하세요:');
  console.log('   pnpm run db:init');
  console.log('');
  console.log('또는 서버를 실행하면 자동으로 데이터베이스가 생성됩니다:');
  console.log('   pnpm run dev');
  console.log('');
  process.exit(0);
}

console.log(`📁 데이터베이스 파일: ${DB_PATH}`);
console.log('');

try {
  // 데이터베이스 연결
  const db = new Database(DB_PATH, { readonly: true });
  
  console.log('✅ 데이터베이스 연결 성공!');
  console.log('');
  
  // 테이블 목록 조회
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  if (tables.length === 0) {
    console.log('⚠️  테이블이 없습니다. 데이터베이스를 초기화하세요:');
    console.log('   pnpm run db:init');
    db.close();
    process.exit(0);
  }
  
  console.log('📋 테이블 목록:');
  console.log('-'.repeat(60));
  tables.forEach((table, index) => {
    console.log(`${index + 1}. ${table.name}`);
  });
  console.log('');
  
  // 각 테이블의 레코드 수 확인
  console.log('📊 테이블별 데이터 수:');
  console.log('-'.repeat(60));
  
  tables.forEach((table) => {
    try {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
      const emoji = row.count > 0 ? '✅' : '⚪';
      console.log(`${emoji} ${table.name}: ${row.count}개`);
    } catch (err) {
      console.log(`❌ ${table.name}: 조회 오류`);
    }
  });
  
  console.log('');
  console.log('='.repeat(60));
  
  // places 테이블 상세 정보
  try {
    const places = db.prepare(`
      SELECT 
        place_name, 
        category, 
        rating, 
        visitor_reviews,
        sido,
        sigungu
      FROM places 
      ORDER BY last_crawled_at DESC 
      LIMIT 10
    `).all();
    
    if (places.length > 0) {
      console.log('');
      console.log('🏪 최근 크롤링된 식당 (최대 10개):');
      console.log('-'.repeat(60));
      places.forEach((place, index) => {
        console.log(`${index + 1}. ${place.place_name}`);
        console.log(`   - 카테고리: ${place.category || '정보없음'}`);
        console.log(`   - 위치: ${place.sido || ''} ${place.sigungu || ''}`);
        console.log(`   - 평점: ${place.rating || 'N/A'} (방문자 리뷰 ${place.visitor_reviews || 0}개)`);
        console.log('');
      });
    }
  } catch (err) {
    // places 테이블이 없거나 데이터가 없음
  }
  
  // 크롤링 로그 확인
  try {
    const logs = db.prepare(`
      SELECT 
        keyword, 
        location, 
        total_crawled, 
        status,
        started_at
      FROM crawl_logs 
      ORDER BY started_at DESC 
      LIMIT 5
    `).all();
    
    if (logs.length > 0) {
      console.log('📝 최근 크롤링 기록:');
      console.log('-'.repeat(60));
      logs.forEach((log, index) => {
        const statusEmoji = log.status === 'completed' ? '✅' : 
                            log.status === 'running' ? '🔄' : 
                            log.status === 'failed' ? '❌' : '⏸️';
        console.log(`${index + 1}. ${statusEmoji} ${log.keyword} (${log.location || '전국'})`);
        console.log(`   - 크롤링된 수: ${log.total_crawled}개`);
        console.log(`   - 시작 시간: ${log.started_at}`);
        console.log('');
      });
    }
  } catch (err) {
    // crawl_logs 테이블이 없거나 데이터가 없음
  }
  
  console.log('='.repeat(60));
  console.log('');
  console.log('💡 추가 정보:');
  console.log('   - DB 브라우저로 열어보기: https://sqlitebrowser.org/');
  console.log('   - 파일 위치:', DB_PATH);
  console.log('');
  
  db.close();
  
} catch (err) {
  console.error('❌ 오류 발생:', err.message);
  process.exit(1);
}
