// Supabase 데이터 조회 테스트 API
// 영상처럼 로컬에서 Supabase 데이터를 JSON으로 확인

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  try {
    // 환경변수에서 Supabase 정보 가져오기
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 환경변수 확인
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({
        success: false,
        error: 'Supabase 환경변수가 설정되지 않았습니다.',
        missing: {
          url: !supabaseUrl,
          key: !supabaseKey
        },
        hint: '.env 파일에 SUPABASE_URL과 SUPABASE_ANON_KEY를 추가하세요'
      });
    }

    // Supabase 클라이언트 생성
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 쿼리 파라미터로 테이블 지정 (기본값: places)
    const tableName = req.query.table || 'places';
    const limit = parseInt(req.query.limit) || 10;

    console.log(`📊 Supabase 테스트: ${tableName} 테이블에서 ${limit}개 조회`);

    // 데이터 조회
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(limit);

    if (error) {
      console.error('Supabase 오류:', error);
      return res.status(500).json({
        success: false,
        error: 'Supabase 데이터 조회 실패',
        details: error.message,
        hint: error.code === 'PGRST116' 
          ? `테이블 '${tableName}'이(가) 존재하지 않거나 권한이 없습니다. supabase-schema.sql을 실행했는지 확인하세요.`
          : '데이터베이스 연결이나 RLS 정책을 확인하세요.'
      });
    }

    // 성공!
    console.log(`✅ 데이터 조회 성공: ${data?.length || 0}개`);

    res.json({
      success: true,
      message: `✅ Supabase 연결 성공!`,
      data: data,
      metadata: {
        table: tableName,
        count: data?.length || 0,
        limit: limit,
        timestamp: new Date().toISOString(),
        supabaseUrl: supabaseUrl,
        connection: 'OK'
      }
    });

  } catch (error) {
    console.error('테스트 API 오류:', error);
    res.status(500).json({
      success: false,
      error: '서버 오류가 발생했습니다.',
      details: error.message
    });
  }
};


