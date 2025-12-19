// ============================================
// 바로빌 회원가입 확인 API
// CheckCorpIsMember - 사업자번호가 바로빌에 가입되어 있는지 확인
// ============================================

const axios = require('axios');

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

  if (!CERTKEY) {
    return res.status(500).json({
      success: false,
      error: '바로빌 연동인증키가 설정되지 않았습니다. BAROBIL_CERTKEY 환경변수를 설정해주세요.'
    });
  }

  try {
    // POST: 사업자번호 가입 확인
    if (req.method === 'POST') {
      const { corpNum, checkCorpNum } = req.body;

      if (!corpNum || !checkCorpNum) {
        return res.status(400).json({
          success: false,
          error: 'corpNum과 checkCorpNum은 필수입니다.'
        });
      }

      // 바로빌 API 호출 (SOAP 방식)
      // 바로빌은 SOAP API를 사용하므로 SOAP 요청 생성
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <CheckCorpIsMember xmlns="http://www.barobill.co.kr/">
      <CERTKEY>${CERTKEY}</CERTKEY>
      <CorpNum>${corpNum.replace(/-/g, '')}</CorpNum>
      <CheckCorpNum>${checkCorpNum.replace(/-/g, '')}</CheckCorpNum>
    </CheckCorpIsMember>
  </soap:Body>
</soap:Envelope>`;

      try {
        // 바로빌 API 엔드포인트 (실제 엔드포인트는 바로빌 개발자센터 문서 확인 필요)
        // 일반적으로 바로빌은 https://api.barobill.co.kr 또는 https://testapi.barobill.co.kr 사용
        // 실제 엔드포인트는 바로빌 개발자센터(https://dev.barobill.co.kr)에서 확인 가능
        const apiEndpoint = `${BAROBIL_API_BASE}/Service/Corp/CheckCorpIsMember`;
        
        console.log('📞 바로빌 API 호출:', {
          endpoint: apiEndpoint,
          method: 'CheckCorpIsMember',
          corpNum: corpNum.replace(/-/g, ''),
          checkCorpNum: checkCorpNum.replace(/-/g, '')
        });

        const response = await axios.post(
          apiEndpoint,
          soapBody,
          {
            headers: {
              'Content-Type': 'text/xml; charset=utf-8',
              'SOAPAction': 'http://www.barobill.co.kr/CheckCorpIsMember'
            },
            timeout: 30000
          }
        );

        // SOAP 응답 파싱
        const xmlResponse = response.data;
        const resultMatch = xmlResponse.match(/<CheckCorpIsMemberResult>(-?\d+)<\/CheckCorpIsMemberResult>/);
        
        if (!resultMatch) {
          return res.status(500).json({
            success: false,
            error: '바로빌 API 응답 형식이 올바르지 않습니다.'
          });
        }

        const result = parseInt(resultMatch[1]);

        // 결과 해석
        if (result === 0) {
          return res.status(200).json({
            success: true,
            data: {
              isMember: false,
              message: '가입되지 않은 사업자번호입니다.'
            }
          });
        } else if (result === 1) {
          return res.status(200).json({
            success: true,
            data: {
              isMember: true,
              message: '가입된 사업자번호입니다.'
            }
          });
        } else {
          // 음수 = 오류코드
          return res.status(400).json({
            success: false,
            error: `바로빌 API 오류 (오류코드: ${result})`
          });
        }
      } catch (apiError) {
        console.error('❌ 바로빌 API 호출 실패:', apiError.response?.data || apiError.message);
        return res.status(500).json({
          success: false,
          error: `바로빌 API 호출 실패: ${apiError.response?.data || apiError.message}`
        });
      }
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error('❌ 바로빌 회원 확인 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

