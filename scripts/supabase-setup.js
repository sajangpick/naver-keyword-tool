// Supabase 데이터베이스 자동 설정 스크립트
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

console.log('='.repeat(60));
console.log('☁️  Supabase 데이터베이스 설정');
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

console.log('✅ Supabase URL:', supabaseUrl);
console.log('✅ Service Key:', supabaseServiceKey.substring(0, 20) + '...');
console.log('');

// Supabase 클라이언트 생성 (관리자 권한)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  try {
    console.log('📝 SQL 스크립트 읽기 중...');
    
    const schemaPath = path.join(__dirname, 'supabase-schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.error('❌ supabase-schema.sql 파일을 찾을 수 없습니다!');
      process.exit(1);
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('✅ SQL 스크립트 로드 완료');
    console.log('');
    console.log('🏗️  테이블 생성 중...');
    console.log('');
    
    // SQL 실행 (RPC 함수 사용)
    // 주의: Supabase는 직접 SQL 실행을 제한하므로 
    // SQL Editor에서 수동으로 실행해야 합니다
    
    console.log('⚠️  중요: Supabase는 보안상 JavaScript에서 직접 SQL 실행을 제한합니다.');
    console.log('');
    console.log('📋 다음 단계를 따라주세요:');
    console.log('');
    console.log('1. Supabase 대시보드 열기:', supabaseUrl.replace('.supabase.co', '.supabase.co'));
    console.log('2. 왼쪽 메뉴에서 "SQL Editor" 클릭');
    console.log('3. "New query" 클릭');
    console.log('4. supabase-schema.sql 파일 내용 복사');
    console.log('5. SQL Editor에 붙여넣기');
    console.log('6. "Run" 버튼 클릭');
    console.log('');
    console.log('또는 터미널에서:');
    console.log('  cat supabase-schema.sql | pbcopy  (Mac)');
    console.log('  cat supabase-schema.sql | clip  (Windows)');
    console.log('');
    
    // 테이블 존재 확인
    console.log('🔍 기존 테이블 확인 중...');
    
    const { data: tables, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');
    
    if (error && !error.message.includes('does not exist')) {
      console.log('');
      console.log('현재 테이블:', tables?.length || 0, '개');
      if (tables && tables.length > 0) {
        tables.forEach(t => console.log('  -', t.table_name));
      }
    } else {
      console.log('아직 테이블이 없습니다.');
    }
    
  } catch (err) {
    console.error('');
    console.error('❌ 오류:', err.message);
  }
}

// 실행
setupDatabase();

