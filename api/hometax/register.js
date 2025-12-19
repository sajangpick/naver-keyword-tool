// ============================================
// 홈택스 연동 등록 API
// 바로빌 홈택스 매입매출조회 API 연동
// ============================================

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cipher = require('../../lib/cipher-service');

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

// 암호화 서비스는 lib/cipher-service.js에서 직접 사용

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
    // POST: 홈택스 연동 등록
    if (req.method === 'POST') {
      const { corpNum, loginMethod, hometaxId, hometaxPwd, jumin } = req.body;

      // 필수 파라미터 확인
      if (!corpNum || !loginMethod) {
        return res.status(400).json({
          success: false,
          error: '사업자번호와 로그인 방법은 필수입니다.'
        });
      }

      if (loginMethod === 'ID' && (!hometaxId || !hometaxPwd || !jumin)) {
        return res.status(400).json({
          success: false,
          error: '홈택스 로그인 정보를 모두 입력해주세요.'
        });
      }

      // 사용자 인증 확인
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({
          success: false,
          error: '인증이 필요합니다.'
        });
      }

      // Supabase에서 사용자 정보 확인 (JWT 토큰 또는 세션 확인)
      // 여기서는 간단히 userId를 body에서 받거나, 실제로는 JWT 토큰을 검증해야 함
      const userId = req.body.userId; // 실제로는 JWT에서 추출해야 함
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: '사용자 정보를 확인할 수 없습니다.'
        });
      }

      const { serviceType } = req.body; // 'taxinvoice' 또는 'cashbill'
      const serviceTypeName = serviceType === 'cashbill' ? '현금영수증' : '세금계산서';

      // 바로빌 API 호출 - 서비스 신청 URL 반환 (2번 방법: 신청 화면 API)
      // 이 방법이 더 사용자 친화적이며, 바로빌 사이트에서 직접 신청할 수 있음
      const apiParams = {
        CERTKEY: CERTKEY,
        CorpNum: corpNum.replace(/-/g, ''), // 하이픈 제거
        UserID: '', // 더 이상 사용되지 않음 (빈 문자열)
        PWD: '' // 더 이상 사용되지 않음 (빈 문자열)
      };

      console.log('📞 바로빌 API 호출:', {
        method: serviceType === 'cashbill' ? 'GetCashBillScrapRequestURL' : 'GetTaxInvoiceScrapRequestURL',
        corpNum: apiParams.CorpNum,
        serviceType: serviceTypeName
      });

      // 바로빌 API 호출 - 신청 URL 반환
      // 바로빌 API는 SOAP 방식으로 제공되므로, 실제 구현 시 바로빌 SDK 사용 권장
      // 여기서는 예시로 작성 (실제로는 바로빌 SDK의 GetTaxInvoiceScrapRequestURL 또는 GetCashBillScrapRequestURL 메서드 사용)
      let requestUrl;
      try {
        // 실제 바로빌 API 호출은 바로빌 SDK를 사용해야 함
        // 여기서는 예시로 작성
        const apiMethod = serviceType === 'cashbill' 
          ? 'GetCashBillScrapRequestURL' 
          : 'GetTaxInvoiceScrapRequestURL';
        
        // 바로빌 API는 SOAP 방식이므로 실제 구현 시 바로빌 SDK 사용 필요
        // 예시: const url = barobillSDK[apiMethod](CERTKEY, corpNum, '', '');
        
        // 임시로 에러 반환 (실제 구현 필요)
        return res.status(501).json({
          success: false,
          error: '바로빌 API 연동은 바로빌 SDK 설치가 필요합니다. 바로빌 SDK를 설치하고 연동해주세요.',
          note: '바로빌 홈페이지에서 SDK를 다운로드하여 설치한 후, 해당 API를 구현해주세요.'
        });
        
        // 실제 구현 시 아래와 같이 사용:
        // requestUrl = barobillSDK[apiMethod](CERTKEY, apiParams.CorpNum, '', '');
        
      } catch (apiError) {
        console.error('❌ 바로빌 API 호출 실패:', apiError.response?.data || apiError.message);
        return res.status(500).json({
          success: false,
          error: `바로빌 API 호출 실패: ${apiError.response?.data?.message || apiError.message}`
        });
      }

      // URL이 음수로 된 다섯자리 숫자 형식이면 실패
      if (typeof requestUrl === 'string' && /^-\d{5}$/.test(requestUrl)) {
        const errorCode = parseInt(requestUrl);
        return res.status(400).json({
          success: false,
          error: `홈택스 연동 실패 (오류코드: ${errorCode})`
        });
      }

      // 성공 시 URL 반환 (프론트엔드에서 팝업으로 열어야 함)
      return res.status(200).json({
        success: true,
        data: {
          requestUrl: requestUrl,
          message: `${serviceTypeName} 서비스 신청 URL이 생성되었습니다. 팝업에서 신청을 완료해주세요.`
        }
      });

      // platform_connections 테이블에 저장
      const connectionData = {
        user_id: userId,
        platform: 'hometax',
        store_id: corpNum.replace(/-/g, ''), // 사업자번호를 store_id로 저장
        store_name: '홈택스 매입매출조회',
        account_id_encrypted: loginMethod === 'ID' && hometaxId ? cipher.encrypt(hometaxId) : null,
        account_password_encrypted: loginMethod === 'ID' && hometaxPwd ? cipher.encrypt(hometaxPwd) : null,
        is_active: true,
        last_sync_at: new Date().toISOString()
      };

      const { data: savedConnection, error: dbError } = await supabase
        .from('platform_connections')
        .upsert(connectionData, {
          onConflict: 'user_id,platform,store_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (dbError) {
        console.error('❌ DB 저장 실패:', dbError);
        return res.status(500).json({
          success: false,
          error: '연동 정보 저장 실패: ' + dbError.message
        });
      }

      console.log('✅ 홈택스 연동 완료:', savedConnection.id);

      return res.status(200).json({
        success: true,
        data: {
          connectionId: savedConnection.id,
          message: '홈택스 연동이 완료되었습니다. 매일 새벽에 전날까지의 매입매출 내역을 자동으로 수집합니다.'
        }
      });
    }

    // GET: 홈택스 연동 상태 조회
    if (req.method === 'GET') {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }

      const { data: connections, error } = await supabase
        .from('platform_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', 'hometax')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ 홈택스 연동 상태 조회 실패:', error);
        return res.status(500).json({
          success: false,
          error: '연동 상태 조회 실패: ' + error.message
        });
      }

      return res.status(200).json({
        success: true,
        data: connections || null
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error('❌ 홈택스 연동 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

