// ============================================
// 홈택스 매출내역 조회 API
// 바로빌 홈택스 매입매출조회 - 세금계산서/현금영수증 매출 조회
// ============================================

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const cipher = require('../../lib/cipher-service');

// XML 특수문자 이스케이프
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
const BAROBIL_API_BASE = process.env.BAROBIL_API_BASE || 'https://api.barobill.co.kr';
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

      // 사업자번호 추출 (store_id에서 _taxinvoice 또는 _cashbill 제거)
      let corpNum = connection.store_id;
      if (corpNum.endsWith('_taxinvoice')) {
        corpNum = corpNum.replace('_taxinvoice', '');
      } else if (corpNum.endsWith('_cashbill')) {
        corpNum = corpNum.replace('_cashbill', '');
      }
      corpNum = corpNum.replace(/-/g, ''); // 하이픈 제거

      // 로그인 정보 복호화 (ID 방식인 경우)
      let hometaxId = null;
      let hometaxPwd = null;
      let jumin = null;
      
      if (connection.account_id_encrypted && connection.account_password_encrypted) {
        try {
          hometaxId = cipher.decrypt(connection.account_id_encrypted);
          hometaxPwd = cipher.decrypt(connection.account_password_encrypted);
          // 주민번호는 별도 저장 안 함 (필요시 추가)
        } catch (err) {
          console.error('❌ 로그인 정보 복호화 실패:', err);
        }
      }

      // 바로빌 API 메서드 결정
      const apiMethod = serviceType === 'cashbill'
        ? (dateType === 'daily' ? 'GetDailyCashBillSalesList' : 'GetMonthlyCashBillSalesList')
        : (dateType === 'daily' ? 'GetDailyTaxInvoiceSalesList' : 'GetMonthlyTaxInvoiceSalesList');

      // 날짜 형식 변환
      let barobillDate = date;
      if (dateType === 'monthly') {
        // YYYY-MM -> YYYYMM
        barobillDate = date.replace(/-/g, '');
      } else if (dateType === 'daily') {
        // YYYY-MM-DD -> YYYYMMDD
        barobillDate = date.replace(/-/g, '');
      }

      console.log('📞 바로빌 매출 조회 API 호출:', {
        method: apiMethod,
        corpNum,
        date: barobillDate,
        serviceType
      });

      // SOAP 요청 생성
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${apiMethod} xmlns="http://www.barobill.co.kr/">
      <CERTKEY>${CERTKEY}</CERTKEY>
      <CorpNum>${corpNum}</CorpNum>
      <Date>${barobillDate}</Date>
      <CurrentPage>1</CurrentPage>
      ${hometaxId ? `
      <HometaxLoginMethod>ID</HometaxLoginMethod>
      <HometaxID>${escapeXml(hometaxId)}</HometaxID>
      <HometaxPWD>${escapeXml(hometaxPwd)}</HometaxPWD>
      ` : `
      <HometaxLoginMethod>CERT</HometaxLoginMethod>
      `}
    </${apiMethod}>
  </soap:Body>
</soap:Envelope>`;

      try {
        // 바로빌 API 엔드포인트
        const apiEndpoint = serviceType === 'cashbill'
          ? `${BAROBIL_API_BASE}/Service/CashBill/${apiMethod}`
          : `${BAROBIL_API_BASE}/Service/TaxInvoice/${apiMethod}`;

        const response = await axios.post(
          apiEndpoint,
          soapBody,
          {
            headers: {
              'Content-Type': 'text/xml; charset=utf-8',
              'SOAPAction': `http://www.barobill.co.kr/${apiMethod}`
            },
            timeout: 30000
          }
        );

        // SOAP 응답 파싱
        const xmlResponse = response.data;
        
        // XML 파싱 (간단한 파싱 - 실제로는 xml2js 같은 라이브러리 사용 권장)
        const salesData = parseBarobillSalesResponse(xmlResponse, apiMethod);

        if (salesData.error) {
          return res.status(500).json({
            success: false,
            error: salesData.error,
            debug: xmlResponse.substring(0, 500)
          });
        }

        return res.status(200).json({
          success: true,
          data: salesData
        });

      } catch (apiError) {
        console.error('❌ 바로빌 API 호출 실패:', apiError.response?.data || apiError.message);
        return res.status(500).json({
          success: false,
          error: `바로빌 API 호출 실패: ${apiError.response?.data || apiError.message}`,
          note: '바로빌 API 엔드포인트가 올바른지 확인해주세요. 바로빌 개발자센터 문서를 참고하세요.'
        });
      }
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

// 바로빌 매출 응답 파싱
function parseBarobillSalesResponse(xmlResponse, apiMethod) {
  try {
    // 오류 체크
    const errorMatch = xmlResponse.match(/<(\w+)Result>(-?\d+)<\/\1Result>/);
    if (errorMatch && parseInt(errorMatch[2]) < 0) {
      return {
        error: `바로빌 API 오류 (코드: ${errorMatch[2]})`,
        salesList: []
      };
    }

    // 매출 리스트 추출 (간단한 파싱)
    // 실제로는 xml2js 같은 라이브러리 사용 권장
    const salesList = [];
    
    // XML에서 매출 항목 추출 (예시 - 실제 XML 구조에 맞게 수정 필요)
    const itemMatches = xmlResponse.matchAll(/<TaxInvoiceSalesItem[^>]*>([\s\S]*?)<\/TaxInvoiceSalesItem>/g);
    
    for (const match of itemMatches) {
      const itemXml = match[1];
      const dateMatch = itemXml.match(/<IssueDate>(\d{8})<\/IssueDate>/);
      const amountMatch = itemXml.match(/<SupplyCostTotal>(\d+)<\/SupplyCostTotal>/);
      const taxMatch = itemXml.match(/<TaxTotal>(\d+)<\/TaxTotal>/);
      const totalMatch = itemXml.match(/<TotalAmount>(\d+)<\/TotalAmount>/);
      
      if (dateMatch) {
        salesList.push({
          date: dateMatch[1], // YYYYMMDD
          supplyCost: amountMatch ? parseInt(amountMatch[1]) : 0,
          tax: taxMatch ? parseInt(taxMatch[1]) : 0,
          total: totalMatch ? parseInt(totalMatch[1]) : (amountMatch ? parseInt(amountMatch[1]) : 0)
        });
      }
    }

    // 매출 리스트가 비어있으면 빈 배열 반환
    return {
      salesList: salesList,
      totalCount: salesList.length,
      currentPage: 1
    };

  } catch (error) {
    console.error('❌ XML 파싱 오류:', error);
    return {
      error: '매출 데이터 파싱 실패',
      salesList: []
    };
  }
}

