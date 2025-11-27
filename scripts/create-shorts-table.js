/**
 * shorts_videos 테이블 자동 생성 스크립트
 * 
 * 사용법:
 * node scripts/create-shorts-table.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  console.error('   .env 파일에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정하세요.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function createShortsTable() {
  try {
    console.log('🔍 shorts_videos 테이블 존재 여부 확인 중...');
    
    // 테이블 존재 확인
    const { error: testError } = await supabase
      .from('shorts_videos')
      .select('id')
      .limit(0);
    
    if (!testError || !testError.message.includes('Could not find the table')) {
      console.log('✅ shorts_videos 테이블이 이미 존재합니다.');
      return;
    }
    
    console.log('📝 테이블이 없습니다. 생성 중...');
    console.log('');
    console.log('⚠️  Supabase는 보안상 서버에서 직접 SQL 실행을 제한합니다.');
    console.log('📋 다음 단계를 따라주세요:');
    console.log('');
    console.log('1. Supabase 대시보드 접속: https://supabase.com/dashboard');
    console.log('2. 프로젝트 선택 → SQL Editor 클릭');
    console.log('3. 아래 SQL을 복사해서 실행:');
    console.log('');
    console.log('='.repeat(60));
    
    // SQL 파일 읽기
    const sqlPath = path.join(__dirname, '../database/schemas/features/shorts/shorts-videos.sql');
    if (fs.existsSync(sqlPath)) {
      const sql = fs.readFileSync(sqlPath, 'utf8');
      console.log(sql);
    } else {
      // 기본 SQL
      console.log(`
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
      `.trim());
    }
    
    console.log('='.repeat(60));
    console.log('');
    console.log('✅ SQL 실행 후 서버를 재시작하세요.');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

createShortsTable();

