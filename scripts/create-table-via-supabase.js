/**
 * Supabase Management API를 사용한 테이블 생성
 * 
 * 사용법:
 * node scripts/create-table-via-supabase.js
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

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

async function createTable() {
  try {
    console.log('🔧 Supabase Management API를 통해 테이블 생성 시도...');
    console.log(`📦 프로젝트: ${projectRef}`);
    console.log('');
    
    // SQL 파일 읽기
    const sqlPath = path.join(__dirname, '../database/schemas/features/shorts/shorts-videos.sql');
    let sql = '';
    
    if (fs.existsSync(sqlPath)) {
      sql = fs.readFileSync(sqlPath, 'utf8');
      console.log('✅ SQL 파일 로드 완료');
    } else {
      // 기본 SQL
      sql = `
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
    }
    
    // Supabase Management API는 직접 SQL 실행을 지원하지 않습니다
    // 대신 Supabase Dashboard의 SQL Editor를 사용해야 합니다
    
    console.log('⚠️  Supabase Management API는 직접 SQL 실행을 지원하지 않습니다.');
    console.log('');
    console.log('📋 다음 방법을 사용하세요:');
    console.log('');
    console.log('방법 1: Supabase Dashboard (가장 확실)');
    console.log('  1. https://supabase.com/dashboard 접속');
    console.log('  2. 프로젝트 선택 → SQL Editor');
    console.log('  3. 아래 SQL 실행');
    console.log('');
    console.log('='.repeat(70));
    console.log(sql);
    console.log('='.repeat(70));
    console.log('');
    
    // 방법 2: Supabase CLI 시도
    console.log('방법 2: Supabase CLI 사용');
    console.log('  npx supabase db push');
    console.log('');
    
    // 방법 3: 직접 pg 연결 시도 (Supabase는 제한할 수 있음)
    console.log('방법 3: PostgreSQL 직접 연결 시도...');
    
    try {
      const { Client } = require('pg');
      
      // Supabase는 직접 연결을 제한하므로 이 방법은 작동하지 않을 수 있습니다
      // Supabase Dashboard → Settings → Database → Connection string에서
      // 실제 연결 정보를 확인해야 합니다
      
      console.log('⚠️  Supabase는 보안상 직접 PostgreSQL 연결을 제한합니다.');
      console.log('   Supabase Dashboard에서 Connection string을 확인하세요.');
      console.log('   Settings → Database → Connection string');
      
    } catch (error) {
      console.log('⚠️  pg 모듈 오류:', error.message);
    }
    
    console.log('');
    console.log('💡 가장 확실한 방법: Supabase Dashboard에서 SQL Editor 사용');
    console.log('   위에 출력된 SQL을 복사해서 실행하세요.');
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
    process.exit(1);
  }
}

createTable();

