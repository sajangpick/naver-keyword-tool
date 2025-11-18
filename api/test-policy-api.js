const axios = require('axios');

/**
 * API 테스트 엔드포인트
 * 실제 API가 작동하는지 확인
 */
module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // API 키: e45b26951c63da01a0d82653dd6101417c57f3812905e604bb4f60f80157bac8
    const apiKey = process.env.PUBLIC_DATA_KEY || 'e45b26951c63da01a0d82653dd6101417c57f3812905e604bb4f60f80157bac8';
    
    // API 키 유효성 검사
    if (!apiKey || apiKey.length < 20) {
      console.error('❌ API 키가 유효하지 않습니다.');
      console.error('❌ API 키 길이:', apiKey ? apiKey.length : 0);
      return res.status(400).json({
        success: false,
        error: 'API 키가 설정되지 않았거나 유효하지 않습니다.',
        apiKeyLength: apiKey ? apiKey.length : 0,
        apiKeySet: !!process.env.PUBLIC_DATA_KEY
      });
    }
    
    console.log('\n🧪 ========== API 테스트 시작 ==========');
    console.log('🔑 API 키 길이:', apiKey.length);
    console.log('🔑 API 키 앞 10자:', apiKey.substring(0, 10));
    console.log('🔑 API 키 뒤 10자:', apiKey.substring(apiKey.length - 10));
    console.log('🔑 환경변수 PUBLIC_DATA_KEY:', process.env.PUBLIC_DATA_KEY ? '설정됨' : '미설정 (기본값 사용)');
    console.log('========================================\n');
    
    const testResults = [];
    
    // 테스트할 API 엔드포인트들
    // K-Startup(한국창업진흥원) 사업공고 API: https://apis.data.go.kr/B552735/kisedKstartupService01
    // 실제 서비스 메서드: getAnnouncementInformation01, getBusinessInformation01
    const testEndpoints = [
      // K-Startup 사업공고 정보 조회 - 실제 작동하는 메서드
      {
        name: 'K-Startup 사업공고 정보 (getAnnouncementInformation01)',
        url: `https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=10&pageNo=1`,
        type: 'xml',
        note: 'K-Startup 사업공고 정보 조회 (총 26,757개 항목)'
      },
      // K-Startup 사업 정보 조회 - 사업 상세 정보
      {
        name: 'K-Startup 사업 정보 (getBusinessInformation01)',
        url: `https://apis.data.go.kr/B552735/kisedKstartupService01/getBusinessInformation01?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=10&pageNo=1`,
        type: 'xml',
        note: 'K-Startup 사업 정보 조회 (총 1,231개 항목)'
      },
    ];
    
    console.log('🔍 K-Startup API 2개를 테스트합니다.');
    console.log('💡 실제 작동하는 API만 테스트합니다.');
    
    for (const endpoint of testEndpoints) {
      try {
        console.log(`\n🧪 테스트: ${endpoint.name}`);
        console.log(`📡 URL: ${endpoint.url.substring(0, 100)}...`);
        console.log(`🔑 API 키 포함 여부: ${endpoint.url.includes(apiKey.substring(0, 10)) ? '✅ 포함됨' : '❌ 누락됨'}`);
        console.log(`🔑 API 키 인코딩 확인: ${endpoint.url.includes(encodeURIComponent(apiKey).substring(0, 10)) ? '✅ 인코딩됨' : '❌ 인코딩 안됨'}`);
        
        const startTime = Date.now();
        const response = await axios.get(endpoint.url, {
          timeout: 10000,
          headers: {
            'Accept': endpoint.type === 'xml' ? 'application/xml' : 'application/json',
            'User-Agent': 'Mozilla/5.0'
          },
          validateStatus: function (status) {
            return status >= 200 && status < 500;
          }
        });
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        
        const result = {
          name: endpoint.name,
          status: response.status,
          duration: `${duration}초`,
          success: response.status === 200,
          dataSize: JSON.stringify(response.data).length,
          dataType: typeof response.data,
          sample: null
        };
        
        if (response.status === 200) {
          if (endpoint.type === 'xml' && typeof response.data === 'string') {
            // XML 파싱 시도
            const itemCount = (response.data.match(/<item>/gi) || []).length;
            result.itemCount = itemCount;
            result.sample = response.data.substring(0, 500);
            
            // 에러 코드 확인 (다양한 형식 지원)
            const resultCode = response.data.match(/<resultCode>(\d+)<\/resultCode>/i)?.[1] ||
                              response.data.match(/<resultcode>(\d+)<\/resultcode>/i)?.[1] ||
                              response.data.match(/<code>(\d+)<\/code>/i)?.[1];
            
            // resultCode가 있고 에러 코드인 경우만 실패로 처리
            if (resultCode && resultCode !== '00' && resultCode !== '0') {
              result.success = false;
              result.errorCode = resultCode;
              result.errorMsg = response.data.match(/<resultMsg>(.*?)<\/resultMsg>/i)?.[1] ||
                               response.data.match(/<resultmsg>(.*?)<\/resultmsg>/i)?.[1] ||
                               response.data.match(/<message>(.*?)<\/message>/i)?.[1] ||
                               response.data.match(/<msg>(.*?)<\/msg>/i)?.[1];
            }
            
            // API 키 관련 에러 확인 (더 엄격한 패턴)
            // 실제 API 에러 메시지 패턴만 확인 (일반 텍스트의 "키"는 무시)
            const apiKeyErrorPatterns = [
              /SERVICE_KEY.*?오류/i,
              /SERVICE_KEY.*?에러/i,
              /SERVICE_KEY.*?없음/i,
              /인증.*?실패/i,
              /인증.*?오류/i,
              /인증.*?에러/i,
              /등록되지.*?서비스/i,
              /유효하지.*?키/i,
              /만료.*?키/i
            ];
            
            // resultCode가 없고, 실제 에러 패턴이 있는 경우만 API 키 에러로 판단
            if (!resultCode && apiKeyErrorPatterns.some(pattern => pattern.test(response.data))) {
              const errorMatch = response.data.match(/(SERVICE_KEY[^<]*|인증[^<]*|등록되지[^<]*|유효하지[^<]*)/i);
              if (errorMatch) {
                result.success = false;
                result.errorCode = 'API_KEY_ERROR';
                result.errorMsg = errorMatch[1];
              }
            }
            
            // 데이터가 정상적으로 있는 경우 성공으로 처리
            if (itemCount > 0 && !resultCode) {
              result.success = true;
              result.errorCode = null;
              result.errorMsg = null;
            }
          } else if (endpoint.type === 'json' && typeof response.data === 'object') {
            // JSON 구조 확인
            const data = response.data.data || response.data.items || response.data;
            if (Array.isArray(data)) {
              result.itemCount = data.length;
              result.sample = JSON.stringify(data[0] || {}, null, 2).substring(0, 500);
            } else if (data) {
              result.itemCount = 1;
              result.sample = JSON.stringify(data, null, 2).substring(0, 500);
            }
          }
        } else {
          result.error = JSON.stringify(response.data).substring(0, 500);
        }
        
        testResults.push(result);
        
        if (result.success) {
          console.log(`✅ 성공: ${result.itemCount || 0}개 항목, ${duration}초`);
        } else {
          console.log(`❌ 실패: HTTP ${response.status}, ${result.errorCode || result.error || '알 수 없음'}`);
        }
        
      } catch (error) {
        console.error(`❌ 테스트 실패:`, error.message);
        testResults.push({
          name: endpoint.name,
          success: false,
          error: error.message,
          errorCode: error.code,
          errorResponse: error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : null
        });
      }
      
      // 요청 간격
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const successCount = testResults.filter(r => r.success).length;
    const failCount = testResults.filter(r => !r.success).length;
    
    console.log(`\n📊 ========== 테스트 결과 요약 ==========`);
    console.log(`✅ 성공: ${successCount}개`);
    console.log(`❌ 실패: ${failCount}개`);
    console.log(`========================================\n`);
    
    // 상세한 API 키 정보 포함
    const summary = {
      total: testResults.length,
      success: successCount,
      failed: failCount,
      apiKeySet: !!process.env.PUBLIC_DATA_KEY,
      apiKeyLength: process.env.PUBLIC_DATA_KEY?.length || apiKey.length,
      apiKeyPrefix: apiKey.substring(0, 10),
      apiKeySuffix: apiKey.substring(apiKey.length - 10),
      environment: process.env.NODE_ENV || 'development',
      isUsingEnvVar: !!process.env.PUBLIC_DATA_KEY,
      isUsingDefault: !process.env.PUBLIC_DATA_KEY
    };
    
    console.log('\n📊 ========== API 테스트 결과 요약 ==========');
    console.log('✅ 성공:', summary.success, '개');
    console.log('❌ 실패:', summary.failed, '개');
    console.log('🔑 API 키 설정:', summary.apiKeySet ? '✅ 환경변수 사용' : '⚠️ 기본값 사용');
    console.log('🔑 API 키 길이:', summary.apiKeyLength);
    console.log('🔑 API 키 앞 10자:', summary.apiKeyPrefix);
    console.log('🔑 API 키 뒤 10자:', summary.apiKeySuffix);
    console.log('===========================================\n');
    
    return res.json({
      success: true,
      message: `API 테스트 완료: ${successCount}개 성공, ${failCount}개 실패`,
      results: testResults,
      summary: summary
    });
    
  } catch (error) {
    console.error('API 테스트 에러:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
};

