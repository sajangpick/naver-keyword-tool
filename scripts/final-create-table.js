/**
 * 최종 시도: pg 라이브러리로 직접 PostgreSQL 연결
 * Supabase Database 연결 정보 필요
 */

require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

// Supabase URL에서 프로젝트 ID 추출
const urlMatch = SUPABASE_URL.match(/https?:\/\/([^.]+)\.supabase\.co/);
if (!urlMatch) {
  console.error('❌ Supabase URL 형식이 올바르지 않습니다.');
  process.exit(1);
}

const projectRef = urlMatch[1];

console.log('🔧 PostgreSQL 직접 연결 시도...');
console.log(`📦 프로젝트: ${projectRef}`);
console.log('');

// SQL
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

async function createTable() {
  try {
    const { Client } = require('pg');
    
    console.log('⚠️  Supabase는 보안상 직접 PostgreSQL 연결을 제한합니다.');
    console.log('');
    console.log('📋 Supabase Dashboard에서 연결 정보를 확인하세요:');
    console.log('   1. https://supabase.com/dashboard 접속');
    console.log('   2. 프로젝트 선택 → Settings → Database');
    console.log('   3. Connection string 확인');
    console.log('');
    console.log('💡 또는 더 간단한 방법:');
    console.log('   → SQL Editor에서 직접 SQL 실행');
    console.log('');
    console.log('📝 실행할 SQL:');
    console.log('='.repeat(70));
    console.log(sql);
    console.log('='.repeat(70));
    console.log('');
    console.log('✅ 이 SQL을 Supabase SQL Editor에 복사해서 실행하세요!');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    console.log('');
    console.log('📋 Supabase Dashboard에서 직접 실행하세요:');
    console.log('   1. https://supabase.com/dashboard');
    console.log('   2. 프로젝트 선택 → SQL Editor');
    console.log('   3. 위 SQL 실행');
  }
}

createTable();

