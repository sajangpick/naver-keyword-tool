// 데이터베이스 초기화 스크립트
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

console.log('='.repeat(60));
console.log('🔧 사장픽 데이터베이스 초기화');
console.log('='.repeat(60));
console.log('');

// 1. data 폴더 확인 및 생성
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  console.log('📁 data 폴더 생성 중...');
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ data 폴더 생성 완료');
} else {
  console.log('✅ data 폴더 존재함');
}

const DB_PATH = path.join(dataDir, 'sajangpick.db');

// 2. 기존 데이터베이스 파일 삭제 (있다면)
if (fs.existsSync(DB_PATH)) {
  console.log('⚠️  기존 데이터베이스 파일 발견');
  console.log('🗑️  기존 데이터베이스 삭제 중...');
  
  // WAL 파일도 함께 삭제
  const walPath = DB_PATH + '-wal';
  const shmPath = DB_PATH + '-shm';
  
  try {
    if (fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
    console.log('✅ 기존 데이터베이스 삭제 완료');
  } catch (err) {
    console.error('❌ 삭제 실패:', err.message);
    console.log('');
    console.log('💡 해결 방법:');
    console.log('   1. 실행 중인 서버를 모두 종료하세요 (Ctrl+C)');
    console.log('   2. 다시 이 명령어를 실행하세요: pnpm run db:init');
    process.exit(1);
  }
}

console.log('');
console.log('📝 새 데이터베이스 생성 중...');

// 3. 새 데이터베이스 생성
let db;
try {
  db = new Database(DB_PATH);
  console.log('✅ 데이터베이스 파일 생성 완료');
  
  // WAL 모드 설정
  db.pragma('journal_mode = WAL');
  console.log('✅ WAL 모드 설정 완료');
} catch (err) {
  console.error('❌ 데이터베이스 생성 실패:', err.message);
  process.exit(1);
}

console.log('');
console.log('🏗️  테이블 생성 중...');

// 4. 스키마 적용
const schemaPath = path.join(__dirname, 'db-schema.sql');

try {
  if (!fs.existsSync(schemaPath)) {
    console.error('❌ db-schema.sql 파일을 찾을 수 없습니다.');
    process.exit(1);
  }

  const schema = fs.readFileSync(schemaPath, 'utf8');
  const statements = schema.split(';').filter(s => s.trim());
  
  let tableCount = 0;
  
  for (const statement of statements) {
    const trimmed = statement.trim();
    if (trimmed) {
      try {
        db.exec(trimmed);
        
        // CREATE TABLE 문인 경우 카운트
        if (trimmed.toUpperCase().includes('CREATE TABLE')) {
          const match = trimmed.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i);
          if (match) {
            tableCount++;
            console.log(`  ✅ ${match[1]} 테이블 생성`);
          }
        }
      } catch (err) {
        console.error('❌ SQL 실행 오류:', err.message);
        console.log('문제가 된 SQL:', trimmed.substring(0, 100) + '...');
      }
    }
  }
  
  console.log('');
  console.log(`✅ 총 ${tableCount}개 테이블 생성 완료`);
  
} catch (err) {
  console.error('❌ 스키마 적용 실패:', err.message);
  db.close();
  process.exit(1);
}

// 5. 검증
console.log('');
console.log('🔍 데이터베이스 검증 중...');

try {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name
  `).all();
  
  console.log('');
  console.log('📋 생성된 테이블 목록:');
  console.log('-'.repeat(60));
  tables.forEach((table, index) => {
    // 각 테이블의 구조 확인
    const info = db.prepare(`PRAGMA table_info(${table.name})`).all();
    console.log(`${index + 1}. ${table.name} (${info.length}개 컬럼)`);
  });
  
  console.log('');
  console.log('='.repeat(60));
  console.log('🎉 데이터베이스 초기화 완료!');
  console.log('='.repeat(60));
  console.log('');
  console.log('📍 데이터베이스 위치:', DB_PATH);
  console.log('');
  console.log('💡 다음 단계:');
  console.log('   1. 서버 실행: pnpm run dev');
  console.log('   2. 데이터 확인: pnpm run db:check');
  console.log('   3. 크롤링 실행: pnpm run crawl:region');
  console.log('');
  
} catch (err) {
  console.error('❌ 검증 실패:', err.message);
}

// 데이터베이스 닫기
db.close();

