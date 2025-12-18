/**
 * 자동 답글 활성화/비활성화 API
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
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, user-id');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const userId = req.headers['user-id'];
    const { connectionId, enabled } = req.body;

    if (!userId || !connectionId || typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: '사용자 ID, 연동 ID, 활성화 여부가 필요합니다'
      });
    }

    // 연동 정보 확인 (본인 것인지 확인)
    const { data: connection, error: checkError } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (checkError || !connection) {
      return res.status(404).json({
        success: false,
        error: '연동 정보를 찾을 수 없습니다'
      });
    }

    // 자동 답글 활성화/비활성화 업데이트
    const { error: updateError } = await supabase
      .from('platform_connections')
      .update({
        auto_reply_enabled: enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId);

    if (updateError) {
      console.error('자동 답글 설정 실패:', updateError);
      return res.status(500).json({
        success: false,
        error: '자동 답글 설정 실패: ' + updateError.message
      });
    }

    res.json({
      success: true,
      message: enabled ? '자동 답글이 활성화되었습니다' : '자동 답글이 비활성화되었습니다'
    });

  } catch (error) {
    console.error('[자동 답글 설정] 오류:', error);
    res.status(500).json({
      success: false,
      error: '자동 답글 설정 중 오류가 발생했습니다: ' + error.message
    });
  }
};

