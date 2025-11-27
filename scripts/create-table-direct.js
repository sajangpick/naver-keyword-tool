/**
 * Supabase에 직접 테이블 생성 시도
 * 여러 방법을 시도합니다
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// SQL 쿼리
const createTableSQL = `
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

async function createTable() {
  console.log('🔧 테이블 생성 시도 중...\n');
  
  // 방법 1: Supabase RPC 함수 사용 (exec_sql 같은 함수가 있다면)
  try {
    console.log('방법 1: RPC 함수 사용 시도...');
    const { data, error } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    if (!error) {
      console.log('✅ RPC 함수로 테이블 생성 성공!');
      return true;
    }
    console.log('⚠️  RPC 함수 사용 불가:', error.message);
  } catch (e) {
    console.log('⚠️  RPC 함수 없음');
  }
  
  // 방법 2: Supabase REST API 직접 호출
  try {
    console.log('\n방법 2: REST API 직접 호출 시도...');
    const projectRef = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
    if (projectRef) {
      // Supabase Management API 엔드포인트
      const response = await axios.post(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
        { query: createTableSQL },
        {
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY
          }
        }
      );
      
      if (response.status === 200) {
        console.log('✅ REST API로 테이블 생성 성공!');
        return true;
      }
    }
  } catch (e) {
    console.log('⚠️  REST API 사용 불가:', e.message);
  }
  
  // 방법 3: PostgREST를 통한 시도 (작동하지 않을 가능성 높음)
  try {
    console.log('\n방법 3: PostgREST 시도...');
    // 이 방법은 작동하지 않을 가능성이 높습니다
  } catch (e) {
    console.log('⚠️  PostgREST 사용 불가');
  }
  
  console.log('\n❌ 자동 생성 실패');
  console.log('\n📋 Supabase Dashboard에서 직접 실행해야 합니다:');
  console.log('   1. https://supabase.com/dashboard 접속');
  console.log('   2. 프로젝트 선택 → SQL Editor');
  console.log('   3. 아래 SQL 실행:\n');
  console.log('='.repeat(70));
  console.log(createTableSQL);
  console.log('='.repeat(70));
  
  return false;
}

createTable().then(success => {
  if (success) {
    console.log('\n✅ 완료! 서버를 재시작하세요.');
    process.exit(0);
  } else {
    process.exit(1);
  }
});

