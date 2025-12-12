// 네이버 스마트플레이스 연동 해제 API

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

module.exports = async (req, res) => {
  try {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, user-id');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'DELETE') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const userId = req.headers['user-id'] || req.query.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: '사용자 ID가 필요합니다' });
    }

    // URL에서 connectionId 추출
    const connectionId = req.url.split('/').pop();
    if (!connectionId) {
      return res.status(400).json({ success: false, error: '연동 ID가 필요합니다' });
    }

    // 연동 정보 확인 (본인 것인지 확인)
    const { data: connection, error: checkError } = await supabase
      .from('naver_place_connections')
      .select('id, user_id')
      .eq('id', connectionId)
      .single();

    if (checkError || !connection) {
      return res.status(404).json({ success: false, error: '연동 정보를 찾을 수 없습니다' });
    }

    if (connection.user_id !== userId) {
      return res.status(403).json({ success: false, error: '권한이 없습니다' });
    }

    // 연동 해제 (is_active를 false로 변경)
    const { error: updateError } = await supabase
      .from('naver_place_connections')
      .update({ is_active: false })
      .eq('id', connectionId);

    if (updateError) {
      console.error('연동 해제 실패:', updateError);
      return res.status(500).json({
        success: false,
        error: '연동 해제 실패: ' + updateError.message
      });
    }

    console.log(`[네이버 연동 해제] 사용자 ${userId} - 연동 ID: ${connectionId}`);

    res.json({
      success: true,
      message: '연동이 해제되었습니다'
    });

  } catch (error) {
    console.error('[연동 해제] 오류:', error);
    res.status(500).json({
      success: false,
      error: '연동 해제 중 오류가 발생했습니다: ' + error.message
    });
  }
};

