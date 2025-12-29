// ============================================
// 홈택스 연동 등록 API
// 바로빌 홈택스 매입매출조회 API 연동
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
// 실제 바로빌 API 엔드포인트는 바로빌 개발자센터(https://dev.barobill.co.kr)에서 확인 가능
// 테스트 환경: https://testapi.barobill.co.kr
// 운영 환경: https://api.barobill.co.kr
const BAROBIL_API_BASE = process.env.BAROBIL_API_BASE || 'https://api.barobill.co.kr';
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

      // 사용자 정보 가져오기 (이메일 등)
      const { data: { user } } = await supabase.auth.admin.getUserById(userId).catch(async () => {
        // admin API 실패 시 일반 API 시도
        const { data: { session } } = await supabase.auth.getSession();
        return { data: { user: session?.user || null } };
      });

      const { serviceType } = req.body; // 'taxinvoice' 또는 'cashbill'
      const serviceTypeName = serviceType === 'cashbill' ? '현금영수증' : '세금계산서';

      // 1단계: 바로빌 회원가입 확인 및 자동 가입
      console.log('📋 바로빌 회원가입 확인:', corpNum);
      let isBarobillMember = false;
      
      try {
        const checkResponse = await axios.post(
          `${req.protocol}://${req.get('host')}/api/barobill/check-member`,
          {
            corpNum: corpNum.replace(/-/g, ''),
            checkCorpNum: corpNum.replace(/-/g, '')
          }
        );

        const checkResult = checkResponse.data;
        
        if (checkResult.success && checkResult.data.isMember) {
          isBarobillMember = true;
          console.log('✅ 바로빌 회원 확인 완료');
        } else {
          console.log('⚠️ 바로빌 미가입 - 자동 회원가입 시도');
        }
      } catch (checkError) {
        console.error('❌ 바로빌 회원 확인 실패:', checkError.message);
        // 회원 확인 실패해도 계속 진행
      }

      // 바로빌 미가입 시 자동 회원가입 시도
      let barobillUserId = null; // 바로빌 회원 아이디 저장용
      
      if (!isBarobillMember) {
        console.log('📝 바로빌 자동 회원가입 시도');
        try {
          // 사용자 프로필 정보 가져오기
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          // 사용자 정보 가져오기 (이메일 등) - profiles 테이블에서 이메일 확인 또는 userId로 추정
          let userEmail = null;
          try {
            const { data: { user } } = await supabase.auth.admin.getUserById(userId);
            userEmail = user?.email;
          } catch (err) {
            // admin API 실패 시 profiles에서 이메일 확인
            userEmail = profile?.email || `${userId}@temp.com`;
          }

          // 바로빌 회원가입에 필요한 기본 정보
          // 아이디는 홈택스 아이디를 우선 사용, 없으면 사업자번호 기반 생성
          const generatedBarobillId = hometaxId || `user${corpNum.replace(/-/g, '').substring(0, 6)}`;
          const generatedBarobillPwd = hometaxPwd || `temp${corpNum.replace(/-/g, '').substring(0, 6)}`;
          
          const registerData = {
            CorpNum: corpNum.replace(/-/g, ''),
            CorpName: profile?.store_name || '회사명',
            CEOName: profile?.full_name || '대표자명',
            BizType: profile?.biz_type || '업태',
            BizClass: profile?.biz_class || '업종',
            Addr1: profile?.store_address || '주소',
            MemberName: profile?.full_name || '담당자명',
            ID: generatedBarobillId,
            PWD: generatedBarobillPwd,
            TEL: profile?.phone_number || '010-0000-0000',
            Email: userEmail || 'temp@example.com'
          };

          const registerResponse = await axios.post(
            `${req.protocol}://${req.get('host')}/api/barobill/register-corp`,
            registerData
          );

          const registerResult = registerResponse.data;
          
          if (registerResult.success) {
            console.log('✅ 바로빌 자동 회원가입 완료');
            isBarobillMember = true;
            barobillUserId = registerResult.data.barobillUserId || generatedBarobillId;
            
            // 회원가입 성공 시 아이디를 profiles 테이블에 저장
            try {
              await supabase
                .from('profiles')
                .update({ barobill_user_id: barobillUserId })
                .eq('id', userId);
              console.log('✅ 바로빌 아이디 저장 완료:', barobillUserId);
            } catch (saveError) {
              console.warn('⚠️ 바로빌 아이디 저장 실패 (계속 진행):', saveError.message);
            }
          } else if (registerResult.errorCode === -32000) {
            // 이미 가입된 사업자번호인 경우
            console.log('⚠️ 이미 가입된 사업자번호 - 기존 계정 확인 시도');
            
            try {
              // GetCorpMemberContacts로 기존 계정 확인
              const contactsResponse = await axios.post(
                `${req.protocol}://${req.get('host')}/api/barobill/get-corp-member-contacts`,
                { corpNum: corpNum.replace(/-/g, '') }
              );
              
              if (contactsResponse.data.success && contactsResponse.data.data.contacts.length > 0) {
                // 첫 번째 계정 사용
                barobillUserId = contactsResponse.data.data.contacts[0].id;
                console.log('✅ 기존 바로빌 계정 확인:', barobillUserId);
                isBarobillMember = true;
                
                // 기존 계정 아이디 저장
                try {
                  await supabase
                    .from('profiles')
                    .update({ barobill_user_id: barobillUserId })
                    .eq('id', userId);
                  console.log('✅ 기존 바로빌 아이디 저장 완료:', barobillUserId);
                } catch (saveError) {
                  console.warn('⚠️ 바로빌 아이디 저장 실패 (계속 진행):', saveError.message);
                }
              } else {
                console.warn('⚠️ 기존 계정을 찾을 수 없습니다. 개발자센터에서 회원사를 연결해주세요.');
                // 계속 진행 (홈택스 연동은 시도)
              }
            } catch (contactsError) {
              console.error('❌ 기존 계정 확인 실패:', contactsError.message);
              // 계속 진행 (홈택스 연동은 시도)
            }
          } else {
            // 기타 오류 - GetErrString으로 상세 메시지 확인
            console.error('❌ 바로빌 자동 회원가입 실패:', registerResult.error);
            
            if (registerResult.errorCode) {
              try {
                const errStringResponse = await axios.post(
                  `${req.protocol}://${req.get('host')}/api/barobill/get-err-string`,
                  { errorCode: registerResult.errorCode }
                );
                
                if (errStringResponse.data.success) {
                  console.error('📋 오류 상세:', errStringResponse.data.data.errorMessage);
                }
              } catch (errStringError) {
                console.warn('⚠️ 오류 메시지 조회 실패');
              }
            }
            
            // 회원가입 실패해도 홈택스 연동은 시도 (CERT 방식은 가능할 수 있음)
            console.log('⚠️ 회원가입 실패했지만 홈택스 연동은 계속 진행합니다.');
          }
        } catch (registerError) {
          console.error('❌ 바로빌 자동 회원가입 오류:', registerError.message);
          // 회원가입 실패해도 홈택스 연동은 시도
        }
      } else {
        // 이미 회원인 경우 기존 아이디 확인
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('barobill_user_id')
            .eq('id', userId)
            .single();
          
          if (profile?.barobill_user_id) {
            barobillUserId = profile.barobill_user_id;
            console.log('✅ 기존 바로빌 아이디 확인:', barobillUserId);
          }
        } catch (err) {
          console.warn('⚠️ 기존 바로빌 아이디 조회 실패');
        }
      }

      // 2단계: 바로빌 API 호출 - 서비스 신청
      const apiParams = {
        CERTKEY: CERTKEY,
        CorpNum: corpNum.replace(/-/g, ''), // 하이픈 제거
        HometaxLoginMethod: loginMethod,
        ...(loginMethod === 'ID' && {
          HometaxID: hometaxId,
          HometaxPWD: hometaxPwd,
          ShortJuminNum: jumin
        })
      };

      console.log('📞 바로빌 API 호출:', {
        method: serviceType === 'cashbill' ? 'RegistCashBillScrapEx' : 'RegistTaxInvoiceScrapEx',
        corpNum: apiParams.CorpNum,
        loginMethod: apiParams.HometaxLoginMethod,
        serviceType: serviceTypeName
      });

      // 바로빌 API 호출 - SOAP 방식
      const apiMethod = serviceType === 'cashbill' 
        ? 'RegistCashBillScrapEx' 
        : 'RegistTaxInvoiceScrapEx';

      // SOAP 요청 생성
      const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${apiMethod} xmlns="http://www.barobill.co.kr/">
      <CERTKEY>${CERTKEY}</CERTKEY>
      <CorpNum>${apiParams.CorpNum}</CorpNum>
      <HometaxLoginMethod>${apiParams.HometaxLoginMethod}</HometaxLoginMethod>
      ${loginMethod === 'ID' ? `
      <HometaxID>${escapeXml(apiParams.HometaxID)}</HometaxID>
      <HometaxPWD>${escapeXml(apiParams.HometaxPWD)}</HometaxPWD>
      <ShortJuminNum>${apiParams.ShortJuminNum}</ShortJuminNum>
      ` : ''}
    </${apiMethod}>
  </soap:Body>
</soap:Envelope>`;

      let apiResult;
      try {
        // 바로빌 API 엔드포인트 (실제 엔드포인트는 바로빌 개발자센터 문서 확인 필요)
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
        const resultMatch = xmlResponse.match(new RegExp(`<${apiMethod}Result>(-?\\d+)</${apiMethod}Result>`));
        
        if (!resultMatch) {
          console.error('❌ SOAP 응답 파싱 실패:', xmlResponse.substring(0, 500));
          return res.status(500).json({
            success: false,
            error: '바로빌 API 응답 형식이 올바르지 않습니다.',
            debug: xmlResponse.substring(0, 500)
          });
        }

        apiResult = parseInt(resultMatch[1]);
      } catch (apiError) {
        console.error('❌ 바로빌 API 호출 실패:', apiError.response?.data || apiError.message);
        return res.status(500).json({
          success: false,
          error: `바로빌 API 호출 실패: ${apiError.response?.data || apiError.message}`,
          note: '바로빌 API 엔드포인트가 올바른지 확인해주세요. 바로빌 개발자센터 문서를 참고하세요.'
        });
      }

      // API 결과 확인 (1 = 성공, 음수 = 실패)
      if (apiResult !== 1) {
        return res.status(400).json({
          success: false,
          error: `홈택스 연동 실패 (오류코드: ${apiResult})`,
          note: '바로빌 오류코드에 대한 자세한 내용은 바로빌 개발자센터를 참고하세요.'
        });
      }

      console.log('✅ 바로빌 홈택스 연동 성공');

      // platform_connections 테이블에 저장
      const connectionData = {
        user_id: userId,
        platform: 'hometax',
        store_id: `${corpNum.replace(/-/g, '')}_${serviceType}`, // 사업자번호_서비스타입으로 저장
        store_name: `홈택스 ${serviceTypeName} 매입매출조회`,
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
          serviceType: serviceType,
          serviceTypeName: serviceTypeName,
          message: `${serviceTypeName} 서비스 연동이 완료되었습니다. 매일 오전 4시~6시에 전날까지의 매입매출 내역을 자동으로 수집합니다.`
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

