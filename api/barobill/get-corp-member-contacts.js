// ============================================
// 바로빌 회원사 계정정보 조회 API
// GetCorpMemberContacts - 회원사의 계정정보를 조회합니다
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
    // POST: 회원사 계정정보 조회
    if (req.method === 'POST') {
      const { corpNum } = req.body;

      if (!corpNum) {
        return res.status(400).json({
          success: false,
          error: 'corpNum은 필수입니다.'
        });
      }

      // 바로빌 API 호출 (SOAP 방식)
      const apiMethod = 'GetCorpMemberContacts';
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${apiMethod} xmlns="http://www.barobill.co.kr/">
      <CERTKEY>${CERTKEY}</CERTKEY>
      <CorpNum>${corpNum.replace(/-/g, '')}</CorpNum>
    </${apiMethod}>
  </soap:Body>
</soap:Envelope>`;

      try {
        const apiEndpoint = `${BAROBIL_API_BASE}/Service/Corp/${apiMethod}`;
        
        console.log('📞 바로빌 API 호출:', {
          endpoint: apiEndpoint,
          method: apiMethod,
          corpNum: corpNum.replace(/-/g, '')
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
        const resultMatch = xmlResponse.match(new RegExp(`<${apiMethod}Result>(-?\\d+)</${apiMethod}Result>`));
        
        if (!resultMatch) {
          return res.status(500).json({
            success: false,
            error: '바로빌 API 응답 형식이 올바르지 않습니다.'
          });
        }

        const result = parseInt(resultMatch[1]);

        // 결과 해석 (음수 = 오류코드)
        if (result < 0) {
          return res.status(400).json({
            success: false,
            error: `바로빌 API 오류 (오류코드: ${result})`,
            errorCode: result
          });
        }

        // 계정정보 추출 (실제 XML 구조에 맞게 수정 필요)
        const contacts = [];
        const contactMatches = xmlResponse.matchAll(/<MemberContact[^>]*>([\s\S]*?)<\/MemberContact>/g);
        
        for (const match of contactMatches) {
          const contactXml = match[1];
          const idMatch = contactXml.match(/<ID>([^<]+)<\/ID>/);
          const nameMatch = contactXml.match(/<Name>([^<]+)<\/Name>/);
          const emailMatch = contactXml.match(/<Email>([^<]+)<\/Email>/);
          const telMatch = contactXml.match(/<TEL>([^<]+)<\/TEL>/);
          
          if (idMatch) {
            contacts.push({
              id: idMatch[1],
              name: nameMatch ? nameMatch[1] : null,
              email: emailMatch ? emailMatch[1] : null,
              tel: telMatch ? telMatch[1] : null
            });
          }
        }

        return res.status(200).json({
          success: true,
          data: {
            contacts: contacts,
            totalCount: contacts.length
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
    console.error('❌ 회원사 계정정보 조회 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

