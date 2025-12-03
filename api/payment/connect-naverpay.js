/**
 * 네이버페이 연동 API
 * 네이버페이 연동을 위한 엔드포인트
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.trim() !== '' && SUPABASE_KEY.trim() !== '') {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (error) {
    console.error('Supabase 클라이언트 초기화 실패:', error.message);
  }
}

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 인증 확인
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: '인증이 필요합니다'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: '유효하지 않은 인증 토큰입니다'
      });
    }

    const userId = user.id;

    // 네이버페이 연동 URL 생성
    // 실제로는 네이버페이 API를 호출하여 연동 URL을 받아와야 함
    const NAVER_PAY_CLIENT_ID = process.env.NAVER_PAY_CLIENT_ID;
    const NAVER_PAY_CLIENT_SECRET = process.env.NAVER_PAY_CLIENT_SECRET;
    
    if (!NAVER_PAY_CLIENT_ID || !NAVER_PAY_CLIENT_SECRET) {
      return res.json({
        success: false,
        error: '네이버페이 설정이 완료되지 않았습니다. 관리자에게 문의하세요.'
      });
    }

    // TODO: 실제 네이버페이 API 연동
    // 현재는 연동 준비 상태만 반환
    return res.json({
      success: true,
      message: '네이버페이 연동 준비 중입니다',
      redirectUrl: `https://pay.naver.com/billing/authorize?customerKey=${userId}`,
      note: '실제 연동을 위해서는 네이버페이 API 키 설정이 필요합니다'
    });

  } catch (error) {
    console.error('❌ 네이버페이 연동 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '네이버페이 연동 중 오류가 발생했습니다'
    });
  }
};
