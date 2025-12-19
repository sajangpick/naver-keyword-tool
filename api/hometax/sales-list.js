// ============================================
// 홈택스 매출내역 조회 API
// 바로빌 홈택스 매입매출조회 - 세금계산서/현금영수증 매출 조회
// ============================================

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
let supabase = null;
try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (error) {
  console.error('❌ Supabase 초기화 실패:', error);
}

// 바로빌 API 설정
const BAROBIL_API_BASE = 'https://api.barobill.co.kr';
const CERTKEY = process.env.BAROBIL_CERTKEY;

module.exports = async (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!supabase) {
    return res.status(500).json({
      success: false,
      error: 'Database connection not configured'
    });
  }

  if (!CERTKEY) {
    return res.status(500).json({
      success: false,
      error: '바로빌 연동인증키가 설정되지 않았습니다.'
    });
  }

  try {
    // GET: 매출내역 조회
    if (req.method === 'GET') {
      const { userId, serviceType, dateType, date } = req.query;
      // serviceType: 'taxinvoice' 또는 'cashbill'
      // dateType: 'daily', 'monthly', 'period'
      // date: 'YYYY-MM-DD' (daily) 또는 'YYYY-MM' (monthly)

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }

      // 사용자의 홈택스 연동 정보 확인
      const { data: connection, error: connError } = await supabase
        .from('platform_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'hometax')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (connError || !connection) {
        return res.status(404).json({
          success: false,
          error: '홈택스 연동 정보를 찾을 수 없습니다. 먼저 홈택스 연동을 신청해주세요.'
        });
      }

      const corpNum = connection.store_id; // 사업자번호

      // 바로빌 API 호출
      // 실제 바로빌 SDK 사용 필요
      // const barobillSDK = require('barobill-sdk');
      // const apiMethod = serviceType === 'cashbill'
      //   ? (dateType === 'daily' ? 'GetDailyCashBillSalesList' : 'GetMonthlyCashBillSalesList')
      //   : (dateType === 'daily' ? 'GetDailyTaxInvoiceSalesList' : 'GetMonthlyTaxInvoiceSalesList');
      
      // const result = barobillSDK[apiMethod](CERTKEY, corpNum, date, 1); // currentPage = 1

      // 임시 응답 (실제 구현 필요)
      return res.status(501).json({
        success: false,
        error: '바로빌 SDK 설치가 필요합니다.',
        note: '바로빌 홈페이지에서 SDK를 다운로드하여 설치한 후, 매출내역 조회 API를 구현해주세요.'
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error('❌ 매출내역 조회 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

