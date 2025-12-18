/**
 * 쿠팡이츠 연동 해제 API
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
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, user-id');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'DELETE') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const userId = req.headers['user-id'];
    const connectionId = req.params.connectionId || req.query.connectionId;

    if (!userId || !connectionId) {
      return res.status(400).json({
        success: false,
        error: '사용자 ID와 연동 ID가 필요합니다'
      });
    }

    const { data: connection, error: checkError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .eq('platform', 'coupangeats')
      .single();

    if (checkError || !connection) {
      return res.status(404).json({
        success: false,
        error: '연동 정보를 찾을 수 없습니다'
      });
    }

    const { error: updateError } = await supabase
      .from('platform_connections')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId);

    if (updateError) {
      console.error('연동 해제 실패:', updateError);
      return res.status(500).json({
        success: false,
        error: '연동 해제 실패: ' + updateError.message
      });
    }

    res.json({
      success: true,
      message: '쿠팡이츠 연동이 해제되었습니다'
    });

  } catch (error) {
    console.error('[연동 해제] 오류:', error);
    res.status(500).json({
      success: false,
      error: '연동 해제 중 오류가 발생했습니다: ' + error.message
    });
  }
};

