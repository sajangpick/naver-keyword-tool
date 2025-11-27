/**
 * shorts_videos 테이블 자동 생성 스크립트
 * Supabase에 직접 연결해서 테이블 생성
 * 
 * 사용법:
 * node scripts/auto-create-shorts-table.js
 */

require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

// Supabase URL에서 연결 정보 추출
// 예: https://xxxxx.supabase.co -> xxxxx
const urlMatch = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/);
if (!urlMatch) {
  console.error('❌ Supabase URL 형식이 올바르지 않습니다.');
  process.exit(1);
}

const projectRef = urlMatch[1];
const dbHost = `${projectRef}.supabase.co`;
const dbPort = 5432;

// Supabase는 직접 PostgreSQL 연결을 제한하므로
// Supabase Management API를 사용하거나
// 다른 방법을 시도해야 합니다

// 방법 1: Supabase REST API를 통한 SQL 실행 시도
async function createTableViaAPI() {
  try {
    console.log('🔧 Supabase API를 통해 테이블 생성 시도...');
    
    // Supabase는 REST API로 직접 SQL 실행을 지원하지 않습니다
    // 대신 Supabase Dashboard의 SQL Editor를 사용해야 합니다
    
    console.log('⚠️  Supabase는 보안상 API를 통한 직접 SQL 실행을 제한합니다.');
    console.log('');
    console.log('📋 대신 다음 방법을 사용하세요:');
    console.log('');
    console.log('방법 1: Supabase Dashboard 사용');
    console.log('  1. https://supabase.com/dashboard 접속');
    console.log('  2. 프로젝트 선택 → SQL Editor');
    console.log('  3. 아래 SQL 실행');
    console.log('');
    console.log('방법 2: Supabase CLI 사용 (설치 필요)');
    console.log('  npx supabase db push');
    console.log('');
    
    // SQL 출력
    const sql = `
CREATE TABLE IF NOT EXISTS public.shorts_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text,
  description text,
  style text,
  duration_sec integer,
  music_type text,
  menu_name text NOT NULL,
  menu_features text,
  menu_price text,
  image_url text,
  video_url text,
  thumbnail_url text,
  job_id text,
  status text NOT NULL DEFAULT 'processing',
  error_message text,
  generation_time_ms integer,
  ai_model text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shorts_videos_user_id ON public.shorts_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_shorts_videos_status ON public.shorts_videos(status);
CREATE INDEX IF NOT EXISTS idx_shorts_videos_created_at ON public.shorts_videos(created_at DESC);
    `.trim();
    
    console.log('='.repeat(70));
    console.log(sql);
    console.log('='.repeat(70));
    console.log('');
    
    // 방법 2: pg 라이브러리를 사용한 직접 연결 시도
    console.log('🔧 PostgreSQL 직접 연결 시도...');
    
    try {
      const { Client } = require('pg');
      
      // Supabase 연결 문자열 구성
      // Supabase는 직접 연결을 제한하므로 이 방법도 작동하지 않을 수 있습니다
      const client = new Client({
        host: dbHost,
        port: dbPort,
        database: 'postgres',
        user: 'postgres',
        password: SUPABASE_SERVICE_KEY, // Service Role Key는 DB 비밀번호가 아닙니다
        ssl: { rejectUnauthorized: false }
      });
      
      await client.connect();
      console.log('✅ PostgreSQL 연결 성공!');
      
      await client.query(sql);
      console.log('✅ 테이블 생성 완료!');
      
      await client.end();
      return true;
    } catch (pgError) {
      console.log('⚠️  PostgreSQL 직접 연결 실패:', pgError.message);
      console.log('   (Supabase는 직접 연결을 제한합니다)');
      return false;
    }
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    return false;
  }
}

// 실행
createTableViaAPI().then(success => {
  if (!success) {
    console.log('');
    console.log('💡 해결 방법:');
    console.log('   Supabase Dashboard에서 SQL Editor를 사용하세요.');
    console.log('   위에 출력된 SQL을 복사해서 실행하면 됩니다.');
    process.exit(1);
  } else {
    console.log('');
    console.log('✅ 완료! 서버를 재시작하세요.');
    process.exit(0);
  }
});

