// ============================================
// 홈택스 연동 신청 URL 반환 API
// 바로빌 홈택스 매입매출조회 신청 화면 URL 생성
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
const CERTKEY = process.env.BAROBIL_CERTKEY; // 바로빌 연동인증키

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
      error: '바로빌 연동인증키가 설정되지 않았습니다. BAROBIL_CERTKEY 환경변수를 설정해주세요.'
    });
  }

  try {
    // POST: 홈택스 연동 신청 URL 생성
    if (req.method === 'POST') {
      const { corpNum, serviceType } = req.body; // serviceType: 'taxinvoice' 또는 'cashbill'

      if (!corpNum) {
        return res.status(400).json({
          success: false,
          error: '사업자번호는 필수입니다.'
        });
      }

      if (!serviceType || !['taxinvoice', 'cashbill'].includes(serviceType)) {
        return res.status(400).json({
          success: false,
          error: '서비스 타입은 taxinvoice(세금계산서) 또는 cashbill(현금영수증) 중 하나여야 합니다.'
        });
      }

      // 사용자 인증 확인
      const userId = req.body.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '사용자 정보를 확인할 수 없습니다.'
        });
      }

      // 바로빌 API 호출 - 신청 URL 반환
      // 바로빌 API는 SOAP 방식이므로 실제로는 바로빌 SDK 사용 필요
      // 여기서는 예시로 작성
      const apiMethod = serviceType === 'cashbill' 
        ? 'GetCashBillScrapRequestURL' 
        : 'GetTaxInvoiceScrapRequestURL';

      console.log('📞 바로빌 API 호출:', {
        method: apiMethod,
        corpNum: corpNum.replace(/-/g, ''),
        serviceType: serviceType === 'cashbill' ? '현금영수증' : '세금계산서'
      });

      // 실제 바로빌 SDK 사용 예시 (주석 처리)
      // const barobillSDK = require('barobill-sdk'); // 바로빌 SDK 설치 필요
      // const requestUrl = barobillSDK[apiMethod](
      //   CERTKEY,
      //   corpNum.replace(/-/g, ''),
      //   '', // UserID (더 이상 사용 안 함)
      //   ''  // PWD (더 이상 사용 안 함)
      // );

      // 임시로 바로빌 사이트 URL 반환 (실제 구현 시 바로빌 SDK 사용)
      const serviceName = serviceType === 'cashbill' ? '현금영수증' : '세금계산서';
      const barobillSiteUrl = process.env.BAROBIL_SITE_URL || 'https://www.barobill.co.kr';
      
      // 실제 구현 시 바로빌 SDK에서 받은 URL 반환
      // 여기서는 바로빌 사이트로 안내
      return res.status(200).json({
        success: true,
        data: {
          requestUrl: `${barobillSiteUrl}/Service/Hometax/Request?serviceType=${serviceType}&corpNum=${corpNum.replace(/-/g, '')}`,
          message: `${serviceName} 서비스 신청을 위해 바로빌 사이트로 이동합니다.`,
          note: '실제 구현 시 바로빌 SDK의 GetTaxInvoiceScrapRequestURL 또는 GetCashBillScrapRequestURL 메서드를 사용하여 신청 URL을 생성해야 합니다.'
        }
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error('❌ 홈택스 신청 URL 생성 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

