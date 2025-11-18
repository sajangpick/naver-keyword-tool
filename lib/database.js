// 데이터베이스 연동 (Better-SQLite3)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// data 폴더가 없으면 생성
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(__dirname, '../data/sajangpick.db');

// 데이터베이스 연결
let db;
try {
  db = new Database(DB_PATH);
  console.log('✅ 데이터베이스 연결 성공:', DB_PATH);
} catch (err) {
  console.error('❌ 데이터베이스 연결 오류:', err);
  process.exit(1);
}

// WAL 모드 설정 (성능 향상)
db.pragma('journal_mode = WAL');

// ========== Helper Functions ==========
function runQuery(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return {
      lastID: result.lastInsertRowid,
      changes: result.changes
    };
  } catch (err) {
    console.error('Query Error:', err.message);
    throw err;
  }
}

function getQuery(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  } catch (err) {
    console.error('Query Error:', err.message);
    throw err;
  }
}

function allQuery(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  } catch (err) {
    console.error('Query Error:', err.message);
    throw err;
  }
}

// ========== 식당 저장/업데이트 ==========
function upsertPlace(placeData) {
  const {
    place_id,
    place_name,
    detail = {}
  } = placeData;

  const {
    basic = {},
    contact = {},
    stats = {},
  } = detail;

  // 주소에서 시/군/구/동 추출
  const address = contact.road_address || contact.lot_address || '';
  const location = parseAddress(address);

  try {
    // 기존 데이터 확인
    const existing = getQuery(
      'SELECT id, crawl_count FROM places WHERE place_id = ?',
      [place_id]
    );

    if (existing) {
      // 업데이트
      runQuery(`
        UPDATE places 
        SET place_name = ?,
            category = ?,
            road_address = ?,
            lot_address = ?,
            sido = ?,
            sigungu = ?,
            dong = ?,
            phone = ?,
            rating = ?,
            visitor_reviews = ?,
            blog_reviews = ?,
            last_crawled_at = CURRENT_TIMESTAMP,
            crawl_count = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE place_id = ?
      `, [
        place_name || basic.name,
        basic.category,
        contact.road_address,
        contact.lot_address,
        location.sido,
        location.sigungu,
        location.dong,
        contact.phone,
        parseFloat(stats.rating) || null,
        parseInt(stats.visitor_reviews) || 0,
        parseInt(stats.blog_reviews) || 0,
        existing.crawl_count + 1,
        place_id
      ]);

      return { place_id, updated: true };
    } else {
      // 새로 삽입
      const result = runQuery(`
        INSERT INTO places (
          place_id, place_name, category,
          road_address, lot_address,
          sido, sigungu, dong,
          phone, rating, visitor_reviews, blog_reviews,
          last_crawled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        place_id,
        place_name || basic.name,
        basic.category,
        contact.road_address,
        contact.lot_address,
        location.sido,
        location.sigungu,
        location.dong,
        contact.phone,
        parseFloat(stats.rating) || null,
        parseInt(stats.visitor_reviews) || 0,
        parseInt(stats.blog_reviews) || 0
      ]);

      return { place_id, inserted: true, id: result.lastID };
    }
  } catch (err) {
    console.error('식당 저장 오류:', err);
    throw err;
  }
}

// ========== 상세 정보 저장 ==========
function saveDetails(place_id, detail) {
  const {
    business = {},
    introduction = {},
    receipts = {},
    facilities = {},
  } = detail;

  try {
    // 기존 데이터 삭제 후 재삽입
    runQuery('DELETE FROM place_details WHERE place_id = ?', [place_id]);
    
    runQuery(`
      INSERT INTO place_details (
        place_id, business_hours, break_time, introduction,
        new_receipt_count, total_receipt_count, facilities
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      place_id,
      business.hours,
      business.break_time,
      introduction.text,
      receipts.new_count || 0,
      receipts.total_count || 0,
      JSON.stringify(facilities.list || [])
    ]);
  } catch (err) {
    console.error('상세 정보 저장 오류:', err);
  }
}

// ========== 메뉴 저장 ==========
function saveMenus(place_id, menus) {
  if (!menus || menus.length === 0) return;

  try {
    // 기존 메뉴 삭제
    runQuery('DELETE FROM menus WHERE place_id = ?', [place_id]);

    // 새 메뉴 삽입 (트랜잭션 사용)
    const insertMenu = db.prepare(`
      INSERT INTO menus (place_id, menu_name, price, price_numeric)
      VALUES (?, ?, ?, ?)
    `);

    const insertMany = db.transaction((menus) => {
      for (const menu of menus) {
        const priceNumeric = menu.price ? parseInt(menu.price.replace(/[^0-9]/g, '')) : null;
        insertMenu.run(place_id, menu.name, menu.price, priceNumeric);
      }
    });

    insertMany(menus);
  } catch (err) {
    console.error('메뉴 저장 오류:', err);
  }
}

// ========== 사진 저장 ==========
function savePhotos(place_id, images) {
  if (!images || images.length === 0) return;

  try {
    // 기존 사진 삭제
    runQuery('DELETE FROM photos WHERE place_id = ?', [place_id]);

    // 새 사진 삽입 (트랜잭션 사용)
    const insertPhoto = db.prepare(`
      INSERT INTO photos (place_id, photo_url, photo_order)
      VALUES (?, ?, ?)
    `);

    const insertMany = db.transaction((images) => {
      for (let i = 0; i < images.length; i++) {
        insertPhoto.run(place_id, images[i], i + 1);
      }
    });

    insertMany(images);
  } catch (err) {
    console.error('사진 저장 오류:', err);
  }
}

// ========== 순위 히스토리 저장 ==========
function saveRankHistory(place_id, keyword, rank, stats) {
  try {
    runQuery(`
      INSERT INTO rank_history (
        place_id, keyword, rank_position,
        rating, visitor_reviews, blog_reviews
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      place_id,
      keyword,
      rank,
      parseFloat(stats.rating) || null,
      parseInt(stats.visitor_reviews) || 0,
      parseInt(stats.blog_reviews) || 0
    ]);
  } catch (err) {
    console.error('순위 히스토리 저장 오류:', err);
  }
}

// ========== 크롤링 로그 ==========
function createCrawlLog(keyword, location) {
  try {
    const result = runQuery(`
      INSERT INTO crawl_logs (keyword, location, status)
      VALUES (?, ?, 'running')
    `, [keyword, location]);
    
    return result.lastID;
  } catch (err) {
    console.error('크롤링 로그 생성 오류:', err);
    return null;
  }
}

function updateCrawlLog(logId, data) {
  try {
    runQuery(`
      UPDATE crawl_logs
      SET total_found = ?,
          total_crawled = ?,
          total_errors = ?,
          duration_seconds = ?,
          status = ?,
          error_message = ?,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      data.total_found || 0,
      data.total_crawled || 0,
      data.total_errors || 0,
      data.duration_seconds || 0,
      data.status || 'completed',
      data.error_message || null,
      logId
    ]);
  } catch (err) {
    console.error('크롤링 로그 업데이트 오류:', err);
  }
}

// ========== 통합 저장 함수 ==========
function saveCrawlResults(keyword, places) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    
    try {
      // 1. 기본 정보 저장
      upsertPlace(place);
      
      // 2. 상세 정보 저장
      if (place.detail) {
        saveDetails(place.place_id, place.detail);
        saveMenus(place.place_id, place.detail.menu);
        savePhotos(place.place_id, place.detail.images);
      }
      
      // 3. 순위 히스토리 저장
      saveRankHistory(
        place.place_id,
        keyword,
        place.rank || i + 1,
        place.detail?.stats || {}
      );
      
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({
        place_id: place.place_id,
        place_name: place.place_name,
        error: err.message
      });
    }
  }

  return results;
}

// ========== 유틸리티: 주소 파싱 ==========
function parseAddress(address) {
  if (!address) return { sido: null, sigungu: null, dong: null };

  const location = {
    sido: null,
    sigungu: null,
    dong: null
  };

  // 시/도 추출
  const sidoMatch = address.match(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[특별시광역시도]*/);
  if (sidoMatch) {
    location.sido = sidoMatch[0];
  }

  // 시/군/구 추출
  const sigunguMatch = address.match(/([가-힣]+[시군구])/);
  if (sigunguMatch) {
    location.sigungu = sigunguMatch[1];
  }

  // 동 추출
  const dongMatch = address.match(/([가-힣0-9]+동)/);
  if (dongMatch) {
    location.dong = dongMatch[1];
  }

  return location;
}

// ========== 순위 조회 ==========
function getRankingByKeyword(keyword, limit = 50) {
  try {
    return allQuery(`
      SELECT 
        p.*,
        rh.rank_position,
        rh.measured_at
      FROM places p
      INNER JOIN rank_history rh ON p.place_id = rh.place_id
      WHERE rh.keyword = ?
      AND rh.measured_at = (
        SELECT MAX(measured_at) 
        FROM rank_history 
        WHERE keyword = ? AND place_id = p.place_id
      )
      ORDER BY rh.rank_position ASC
      LIMIT ?
    `, [keyword, keyword, limit]);
  } catch (err) {
    console.error('순위 조회 오류:', err);
    return [];
  }
}

// ========== 데이터베이스 초기화 ==========
function initDatabase() {
  const schemaPath = path.join(__dirname, '../db-schema.sql');
  
  try {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const statements = schema.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        db.exec(statement);
      }
    }
    
    console.log('✅ 데이터베이스 초기화 완료');
  } catch (err) {
    console.error('❌ 데이터베이스 초기화 오류:', err);
  }
}

// 프로세스 종료 시 데이터베이스 닫기
process.on('exit', () => db.close());
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

module.exports = {
  db,
  runQuery,
  getQuery,
  allQuery,
  upsertPlace,
  saveDetails,
  saveMenus,
  savePhotos,
  saveRankHistory,
  saveCrawlResults,
  createCrawlLog,
  updateCrawlLog,
  getRankingByKeyword,
  initDatabase,
  parseAddress,
};

