/**
 * 가짜 뉴스 데이터 삭제 스크립트
 * Supabase news_board 테이블에서 테스트 데이터 제거
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAllNews() {
  console.log('🔍 news_board 테이블 데이터 조회 중...\n');

  // 1. 현재 데이터 확인
  const { data: newsList, error: fetchError } = await supabase
    .from('news_board')
    .select('*')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('❌ 데이터 조회 실패:', fetchError.message);
    return;
  }

  if (!newsList || newsList.length === 0) {
    console.log('✅ news_board 테이블이 이미 비어있습니다.');
    return;
  }

  console.log(`📊 현재 뉴스 개수: ${newsList.length}개\n`);
  console.log('📋 삭제할 뉴스 목록:');
  console.log('─'.repeat(80));
  
  newsList.forEach((news, index) => {
    console.log(`${index + 1}. [${news.category}] ${news.title}`);
    console.log(`   ID: ${news.id} | 생성일: ${new Date(news.created_at).toLocaleDateString('ko-KR')}`);
  });
  
  console.log('─'.repeat(80));
  console.log('\n🗑️  모든 데이터 삭제 중...\n');

  // 2. 모든 데이터 삭제
  const { error: deleteError } = await supabase
    .from('news_board')
    .delete()
    .neq('id', 0); // 모든 행 삭제

  if (deleteError) {
    console.error('❌ 삭제 실패:', deleteError.message);
    return;
  }

  console.log('✅ news_board 테이블의 모든 데이터가 삭제되었습니다.');
  
  // 3. 삭제 확인
  const { count } = await supabase
    .from('news_board')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 최종 확인: ${count}개 데이터 남음`);
}

// 실행
deleteAllNews()
  .then(() => {
    console.log('\n✅ 작업 완료!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ 오류 발생:', err);
    process.exit(1);
  });
