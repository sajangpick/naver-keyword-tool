/**
 * 배달의민족 연동 정보 조회 API
 */

const { createClient } = require('@supabase/supabase-js');

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

module.exports = async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, user-id');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const userId = req.headers['user-id'] || req.query.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: '사용자 ID가 필요합니다' });
    }

    // 연동 정보 조회
    const { data: connections, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'baemin')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('연동 정보 조회 실패:', error);
      return res.status(500).json({
        success: false,
        error: '연동 정보 조회 실패: ' + error.message
      });
    }

    // 각 연동마다 답글 대기중 개수 계산
    const connectionsWithStats = await Promise.all(
      (connections || []).map(async (conn) => {
        const { count } = await supabase
          .from('platform_reviews')
          .select('*', { count: 'exact', head: true })
          .eq('connection_id', conn.id)
          .eq('reply_status', 'pending');

        return {
          ...conn,
          pending_replies: count || 0
        };
      })
    );

    res.json({
      success: true,
      connections: connectionsWithStats
    });

  } catch (error) {
    console.error('[연동 정보 조회] 오류:', error);
    res.status(500).json({
      success: false,
      error: '연동 정보 조회 중 오류가 발생했습니다: ' + error.message
    });
  }
};

