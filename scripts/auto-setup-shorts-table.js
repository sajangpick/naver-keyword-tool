/**
 * shorts_videos 테이블 자동 생성 스크립트
 * Supabase CLI를 사용해서 자동으로 테이블 생성
 */

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 shorts_videos 테이블 자동 생성 시작...\n');

// 1. Supabase CLI가 설치되어 있는지 확인
try {
  const version = execSync('npx supabase --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ Supabase CLI 확인: ${version}\n`);
} catch (error) {
  console.error('❌ Supabase CLI를 찾을 수 없습니다.');
  console.log('📦 설치 중...\n');
  try {
    execSync('npm install -g supabase', { stdio: 'inherit' });
    console.log('✅ Supabase CLI 설치 완료\n');
  } catch (installError) {
    console.error('❌ Supabase CLI 설치 실패');
    console.log('\n💡 대신 Supabase Dashboard에서 직접 실행하세요:');
    console.log('   1. https://supabase.com/dashboard');
    console.log('   2. 프로젝트 선택 → SQL Editor');
    console.log('   3. 🚨_이것만_복사해서_실행하세요.sql 파일의 SQL 실행');
    process.exit(1);
  }
}

// 2. 마이그레이션 파일 확인
const migrationFile = path.join(__dirname, '../supabase/migrations/20251112000000_create_shorts_videos.sql');
if (!fs.existsSync(migrationFile)) {
  console.error('❌ 마이그레이션 파일을 찾을 수 없습니다.');
  process.exit(1);
}

console.log('✅ 마이그레이션 파일 확인 완료\n');

// 3. Supabase 프로젝트 연결 확인
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌ Supabase URL 형식이 올바르지 않습니다.');
  process.exit(1);
}

console.log(`📦 프로젝트: ${projectRef}\n`);

// 4. Supabase CLI로 마이그레이션 실행 시도
console.log('🔧 Supabase CLI로 테이블 생성 시도...\n');

try {
  // Supabase CLI는 로컬 프로젝트와 연결되어 있어야 합니다
  // 하지만 원격 프로젝트에 직접 연결할 수는 없습니다
  
  console.log('⚠️  Supabase CLI는 로컬 프로젝트와 연결되어 있어야 합니다.');
  console.log('📋 대신 다음 방법을 사용하세요:\n');
  console.log('방법 1: Supabase Dashboard (가장 확실)');
  console.log('   1. https://supabase.com/dashboard 접속');
  console.log('   2. 프로젝트 선택 → SQL Editor');
  console.log('   3. 🚨_이것만_복사해서_실행하세요.sql 파일 열기');
  console.log('   4. 전체 복사 → 붙여넣기 → RUN\n');
  
  // SQL 파일 내용 출력
  const sqlFile = path.join(__dirname, '../🚨_이것만_복사해서_실행하세요.sql');
  if (fs.existsSync(sqlFile)) {
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    console.log('📝 실행할 SQL:\n');
    console.log('='.repeat(70));
    console.log(sql);
    console.log('='.repeat(70));
  }
  
} catch (error) {
  console.error('❌ 오류:', error.message);
  process.exit(1);
}

