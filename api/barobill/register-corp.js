// ============================================
// 바로빌 회원가입 API
// RegistCorp - 바로빌에 회원사를 가입시킵니다
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
    // POST: 바로빌 회원가입
    if (req.method === 'POST') {
      const {
        corpNum,
        corpName,
        ceoName,
        bizType,
        bizClass,
        postNum,
        addr1,
        addr2,
        memberName,
        id,
        pwd,
        grade,
        tel,
        hp,
        email
      } = req.body;

      // 필수 파라미터 확인
      if (!corpNum || !corpName || !ceoName || !bizType || !bizClass || !addr1 || !memberName || !id || !pwd || !tel || !email) {
        return res.status(400).json({
          success: false,
          error: '필수 항목을 모두 입력해주세요. (사업자번호, 회사명, 대표자명, 업태, 업종, 주소, 이름, 아이디, 비밀번호, 전화번호, 이메일)'
        });
      }

      // 아이디/비밀번호 길이 확인
      if (id.length < 6 || id.length > 20) {
        return res.status(400).json({
          success: false,
          error: '아이디는 6~20자여야 합니다.'
        });
      }

      if (pwd.length < 6 || pwd.length > 20) {
        return res.status(400).json({
          success: false,
          error: '비밀번호는 6~20자여야 합니다.'
        });
      }

      // 바로빌 API 호출 (SOAP 방식)
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <RegistCorp xmlns="http://www.barobill.co.kr/">
      <CERTKEY>${CERTKEY}</CERTKEY>
      <CorpNum>${corpNum.replace(/-/g, '')}</CorpNum>
      <CorpName>${escapeXml(corpName)}</CorpName>
      <CEOName>${escapeXml(ceoName)}</CEOName>
      <BizType>${escapeXml(bizType)}</BizType>
      <BizClass>${escapeXml(bizClass)}</BizClass>
      <PostNum>${postNum || ''}</PostNum>
      <Addr1>${escapeXml(addr1)}</Addr1>
      <Addr2>${escapeXml(addr2 || '')}</Addr2>
      <MemberName>${escapeXml(memberName)}</MemberName>
      <JuminNum></JuminNum>
      <ID>${escapeXml(id)}</ID>
      <PWD>${escapeXml(pwd)}</PWD>
      <Grade>${escapeXml(grade || '')}</Grade>
      <TEL>${escapeXml(tel)}</TEL>
      <HP>${escapeXml(hp || '')}</HP>
      <Email>${escapeXml(email)}</Email>
    </RegistCorp>
  </soap:Body>
</soap:Envelope>`;

      try {
        // 바로빌 API 엔드포인트 (실제 엔드포인트는 바로빌 개발자센터 문서 확인 필요)
        const apiEndpoint = `${BAROBIL_API_BASE}/Service/Corp/RegistCorp`;
        
        console.log('📞 바로빌 API 호출:', {
          endpoint: apiEndpoint,
          method: 'RegistCorp',
          corpNum: corpNum.replace(/-/g, ''),
          corpName: corpName
        });

        const response = await axios.post(
          apiEndpoint,
          soapBody,
          {
            headers: {
              'Content-Type': 'text/xml; charset=utf-8',
              'SOAPAction': 'http://www.barobill.co.kr/RegistCorp'
            },
            timeout: 30000
          }
        );

        // SOAP 응답 파싱
        const xmlResponse = response.data;
        const resultMatch = xmlResponse.match(/<RegistCorpResult>(-?\d+)<\/RegistCorpResult>/);
        
        if (!resultMatch) {
          return res.status(500).json({
            success: false,
            error: '바로빌 API 응답 형식이 올바르지 않습니다.'
          });
        }

        const result = parseInt(resultMatch[1]);

        // 결과 해석
        if (result === 1) {
          return res.status(200).json({
            success: true,
            data: {
              message: '바로빌 회원가입이 완료되었습니다.'
            }
          });
        } else {
          // 음수 = 오류코드
          return res.status(400).json({
            success: false,
            error: `바로빌 회원가입 실패 (오류코드: ${result})`
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
    console.error('❌ 바로빌 회원가입 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

// XML 특수문자 이스케이프
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

