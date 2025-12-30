// ============================================
// 홈택스 매입내역 조회 API
// 바로빌 홈택스 매입세금계산서 조회
// GetMonthlyTaxInvoicePurchaseList - 매입세금계산서 1개월분 조회
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
    // GET: 매입내역 조회
    if (req.method === 'GET') {
      const { 
        userId, 
        baseMonth,           // YYYY-MM 형식 (예: 2024-12)
        taxType = 1,         // 1: 과세+영세, 3: 면세 (기본값: 1)
        dateType = 1,        // 1: 작성일자, 2: 발급일자, 3: 전송일자 (기본값: 1)
        countPerPage = 100,  // 페이지 당 조회 건수 (최대 100건, 기본값: 100)
        currentPage = 1,     // 조회할 페이지 번호 (기본값: 1)
        orderDirection = 2  // 1: ASC, 2: DESC (기본값: 2)
      } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: 'userId is required'
        });
      }

      if (!baseMonth) {
        return res.status(400).json({
          success: false,
          error: 'baseMonth is required (YYYY-MM 형식, 예: 2024-12)'
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

      // 바로빌 회원 아이디 (UserID) 확인
      // platform_connections 테이블에 바로빌 회원 아이디가 저장되어 있어야 함
      // 또는 profiles 테이블에서 가져올 수 있음
      let barobillUserId = null;
      
      // 1. connection에 바로빌 아이디가 저장되어 있는지 확인
      if (connection.account_id_encrypted) {
        try {
          // account_id_encrypted가 바로빌 아이디일 수도 있음
          barobillUserId = cipher.decrypt(connection.account_id_encrypted);
        } catch (err) {
          console.warn('⚠️ 바로빌 아이디 복호화 실패, 다른 방법 시도');
        }
      }

      // 2. profiles 테이블에서 바로빌 아이디 확인 (필요시)
      if (!barobillUserId) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('barobill_user_id')
            .eq('id', userId)
            .single();
          
          if (profile?.barobill_user_id) {
            barobillUserId = profile.barobill_user_id;
          }
        } catch (err) {
          console.warn('⚠️ 프로필에서 바로빌 아이디 조회 실패');
        }
      }

      // 3. 바로빌 아이디가 없으면 에러
      if (!barobillUserId) {
        return res.status(400).json({
          success: false,
          error: '바로빌 회원 아이디(UserID)가 필요합니다. 홈택스 연동 시 바로빌 회원 아이디를 입력해주세요.'
        });
      }

      // 날짜 형식 변환 (YYYY-MM -> YYYYMM)
      const baseMonthFormatted = baseMonth.replace(/-/g, '');

      // 파라미터 검증
      const taxTypeInt = parseInt(taxType);
      if (taxTypeInt !== 1 && taxTypeInt !== 3) {
        return res.status(400).json({
          success: false,
          error: 'taxType은 1(과세+영세) 또는 3(면세)만 가능합니다.'
        });
      }

      const dateTypeInt = parseInt(dateType);
      if (dateTypeInt < 1 || dateTypeInt > 3) {
        return res.status(400).json({
          success: false,
          error: 'dateType은 1(작성일자), 2(발급일자), 3(전송일자)만 가능합니다.'
        });
      }

      const countPerPageInt = parseInt(countPerPage);
      if (countPerPageInt < 1 || countPerPageInt > 100) {
        return res.status(400).json({
          success: false,
          error: 'countPerPage는 1~100 사이의 값이어야 합니다.'
        });
      }

      const currentPageInt = parseInt(currentPage);
      if (currentPageInt < 1) {
        return res.status(400).json({
          success: false,
          error: 'currentPage는 1 이상이어야 합니다.'
        });
      }

      const orderDirectionInt = parseInt(orderDirection);
      if (orderDirectionInt !== 1 && orderDirectionInt !== 2) {
        return res.status(400).json({
          success: false,
          error: 'orderDirection은 1(ASC) 또는 2(DESC)만 가능합니다.'
        });
      }

      console.log('📞 바로빌 매입 조회 API 호출:', {
        method: 'GetMonthlyTaxInvoicePurchaseList',
        corpNum,
        barobillUserId,
        baseMonth: baseMonthFormatted,
        taxType: taxTypeInt,
        dateType: dateTypeInt,
        countPerPage: countPerPageInt,
        currentPage: currentPageInt,
        orderDirection: orderDirectionInt
      });

      // SOAP 요청 생성
      const apiMethod = 'GetMonthlyTaxInvoicePurchaseList';
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${apiMethod} xmlns="http://www.barobill.co.kr/">
      <CERTKEY>${CERTKEY}</CERTKEY>
      <CorpNum>${corpNum}</CorpNum>
      <UserID>${escapeXml(barobillUserId)}</UserID>
      <TaxType>${taxTypeInt}</TaxType>
      <DateType>${dateTypeInt}</DateType>
      <BaseMonth>${baseMonthFormatted}</BaseMonth>
      <CountPerPage>${countPerPageInt}</CountPerPage>
      <CurrentPage>${currentPageInt}</CurrentPage>
      <OrderDirection>${orderDirectionInt}</OrderDirection>
    </${apiMethod}>
  </soap:Body>
</soap:Envelope>`;

      try {
        // 바로빌 API 엔드포인트
        const apiEndpoint = `${BAROBIL_API_BASE}/Service/TaxInvoice/${apiMethod}`;

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
        
        // XML 파싱
        const purchaseData = parseBarobillPurchaseResponse(xmlResponse, apiMethod);

        if (purchaseData.error) {
          return res.status(500).json({
            success: false,
            error: purchaseData.error,
            errorCode: purchaseData.errorCode,
            debug: xmlResponse.substring(0, 500)
          });
        }

        return res.status(200).json({
          success: true,
          data: purchaseData
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
    console.error('❌ 매입내역 조회 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

// 바로빌 매입 응답 파싱
function parseBarobillPurchaseResponse(xmlResponse, apiMethod) {
  try {
    // PagedTaxInvoiceEx.CurrentPage로 성공/실패 확인
    // 양수 = 성공, 음수 = 실패 (오류코드)
    const currentPageMatch = xmlResponse.match(/<CurrentPage>(-?\d+)<\/CurrentPage>/);
    
    if (currentPageMatch) {
      const currentPage = parseInt(currentPageMatch[1]);
      
      // 음수면 오류코드
      if (currentPage < 0) {
        return {
          error: `바로빌 API 오류 (오류코드: ${currentPage})`,
          errorCode: currentPage,
          purchaseList: [],
          totalCount: 0,
          currentPage: 0
        };
      }
    }

    // PagedTaxInvoiceEx 구조 파싱
    const purchaseList = [];
    
    // XML에서 매입 항목 추출
    // 실제 XML 구조에 맞게 수정 필요
    const itemMatches = xmlResponse.matchAll(/<TaxInvoice[^>]*>([\s\S]*?)<\/TaxInvoice>/g);
    
    for (const match of itemMatches) {
      const itemXml = match[1];
      
      // 주요 필드 추출 (실제 XML 구조에 맞게 수정 필요)
      const invoiceDateMatch = itemXml.match(/<InvoiceDate>(\d{8})<\/InvoiceDate>/);
      const issueDateMatch = itemXml.match(/<IssueDate>(\d{8})<\/IssueDate>/);
      const supplyCostMatch = itemXml.match(/<SupplyCostTotal>(\d+)<\/SupplyCostTotal>/);
      const taxMatch = itemXml.match(/<TaxTotal>(\d+)<\/TaxTotal>/);
      const totalMatch = itemXml.match(/<TotalAmount>(\d+)<\/TotalAmount>/);
      const corpNumMatch = itemXml.match(/<CorpNum>([^<]+)<\/CorpNum>/);
      const corpNameMatch = itemXml.match(/<CorpName>([^<]+)<\/CorpName>/);
      const itemNameMatch = itemXml.match(/<ItemName>([^<]+)<\/ItemName>/); // 첫번째 품목의 품명만
      
      if (invoiceDateMatch || issueDateMatch) {
        purchaseList.push({
          invoiceDate: invoiceDateMatch ? invoiceDateMatch[1] : null, // YYYYMMDD
          issueDate: issueDateMatch ? issueDateMatch[1] : null, // YYYYMMDD
          supplyCost: supplyCostMatch ? parseInt(supplyCostMatch[1]) : 0,
          tax: taxMatch ? parseInt(taxMatch[1]) : 0,
          total: totalMatch ? parseInt(totalMatch[1]) : 0,
          corpNum: corpNumMatch ? corpNumMatch[1] : null,
          corpName: corpNameMatch ? corpNameMatch[1] : null,
          itemName: itemNameMatch ? itemNameMatch[1] : null // 첫번째 품목의 품명만
        });
      }
    }

    // 페이징 정보 추출
    const totalCountMatch = xmlResponse.match(/<TotalCount>(\d+)<\/TotalCount>/);
    const totalCount = totalCountMatch ? parseInt(totalCountMatch[1]) : purchaseList.length;
    
    // currentPageMatch는 이미 295번째 줄에서 선언되었으므로 재사용
    const currentPage = currentPageMatch ? parseInt(currentPageMatch[1]) : 1;
    
    const countPerPageMatch = xmlResponse.match(/<CountPerPage>(\d+)<\/CountPerPage>/);
    const countPerPage = countPerPageMatch ? parseInt(countPerPageMatch[1]) : purchaseList.length;

    return {
      purchaseList: purchaseList,
      totalCount: totalCount,
      currentPage: currentPage,
      countPerPage: countPerPage,
      hasMore: totalCount > currentPage * countPerPage
    };

  } catch (error) {
    console.error('❌ XML 파싱 오류:', error);
    return {
      error: '매입 데이터 파싱 실패',
      purchaseList: [],
      totalCount: 0,
      currentPage: 0
    };
  }
}

