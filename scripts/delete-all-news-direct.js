// news-board.html에 표시되는 모든 뉴스 삭제 스크립트
// 실행: node scripts/delete-all-news-direct.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다.');
  console.error('필요한 환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAllNews() {
  try {
    console.log('📰 뉴스 삭제 시작...');
    
    // 먼저 전체 뉴스 개수 확인
    const { count, error: countError } = await supabase
      .from('news_board')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      throw countError;
    }

    console.log(`현재 뉴스 개수: ${count || 0}개`);

    if (count === 0) {
      console.log('✅ 삭제할 뉴스가 없습니다.');
      return;
    }

    // 모든 뉴스 ID 가져오기
    const { data: allNews, error: selectError } = await supabase
      .from('news_board')
      .select('id, title');

    if (selectError) {
      throw selectError;
    }

    if (!allNews || allNews.length === 0) {
      console.log('✅ 삭제할 뉴스가 없습니다.');
      return;
    }

    console.log(`\n삭제할 뉴스 목록:`);
    allNews.forEach((news, index) => {
      console.log(`  ${index + 1}. ${news.title}`);
    });

    // 모든 뉴스 삭제
    const ids = allNews.map(news => news.id);
    const { error: deleteError } = await supabase
      .from('news_board')
      .delete()
      .in('id', ids);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`\n✅ 성공! ${allNews.length}개의 뉴스가 삭제되었습니다.`);

    // 삭제 확인
    const { count: remainingCount } = await supabase
      .from('news_board')
      .select('*', { count: 'exact', head: true });

    console.log(`남은 뉴스 개수: ${remainingCount || 0}개`);

  } catch (error) {
    console.error('❌ 삭제 실패:', error.message);
    process.exit(1);
  }
}

deleteAllNews();

