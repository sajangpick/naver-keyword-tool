// ============================================
// 바로빌 오류 메시지 조회 API
// GetErrString - 오류코드에 해당하는 오류 메시지를 조회합니다
// ============================================

const axios = require('axios');

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

  if (!CERTKEY) {
    return res.status(500).json({
      success: false,
      error: '바로빌 연동인증키가 설정되지 않았습니다. BAROBIL_CERTKEY 환경변수를 설정해주세요.'
    });
  }

  try {
    // POST: 오류 메시지 조회
    if (req.method === 'POST') {
      const { errorCode } = req.body;

      if (errorCode === undefined || errorCode === null) {
        return res.status(400).json({
          success: false,
          error: 'errorCode는 필수입니다.'
        });
      }

      // 바로빌 API 호출 (SOAP 방식)
      const apiMethod = 'GetErrString';
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${apiMethod} xmlns="http://www.barobill.co.kr/">
      <CERTKEY>${CERTKEY}</CERTKEY>
      <ErrCode>${errorCode}</ErrCode>
    </${apiMethod}>
  </soap:Body>
</soap:Envelope>`;

      try {
        const apiEndpoint = `${BAROBIL_API_BASE}/Service/Corp/${apiMethod}`;
        
        console.log('📞 바로빌 API 호출:', {
          endpoint: apiEndpoint,
          method: apiMethod,
          errorCode: errorCode
        });

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
        const resultMatch = xmlResponse.match(new RegExp(`<${apiMethod}Result>([\\s\\S]*?)</${apiMethod}Result>`));
        
        if (!resultMatch) {
          return res.status(500).json({
            success: false,
            error: '바로빌 API 응답 형식이 올바르지 않습니다.'
          });
        }

        const errorMessage = resultMatch[1].trim();

        return res.status(200).json({
          success: true,
          data: {
            errorCode: errorCode,
            errorMessage: errorMessage
          }
        });

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
    console.error('❌ 오류 메시지 조회 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

