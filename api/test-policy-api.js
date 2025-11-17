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
    const apiKey = process.env.PUBLIC_DATA_KEY || 'e45b26951c63da01a0d82653dd6101417c57f3812905e604bb4f60f80157bac8';
    
    console.log('\n🧪 ========== API 테스트 시작 ==========');
    console.log('🔑 API 키 길이:', apiKey.length);
    console.log('🔑 API 키 앞 10자:', apiKey.substring(0, 10));
    console.log('========================================\n');
    
    const testResults = [];
    
    // 테스트할 API 엔드포인트들
    // K-Startup(한국창업진흥원) 사업공고 API: https://apis.data.go.kr/B552735/kisedKstartupService01
    const testEndpoints = [
      // K-Startup 사업공고 API - 다양한 서비스 메서드 시도
      {
        name: 'K-Startup 사업공고 목록 (getBizPblancList)',
        url: `https://apis.data.go.kr/B552735/kisedKstartupService01/getBizPblancList?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=10&pageNo=1`,
        type: 'xml',
        note: 'K-Startup 사업공고 목록 조회'
      },
      {
        name: 'K-Startup 사업공고 상세 (getBizPblancDetail)',
        url: `https://apis.data.go.kr/B552735/kisedKstartupService01/getBizPblancDetail?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=10&pageNo=1`,
        type: 'xml',
        note: 'K-Startup 사업공고 상세 조회'
      },
      {
        name: 'K-Startup 사업공고 검색 (getBizPblancSearch)',
        url: `https://apis.data.go.kr/B552735/kisedKstartupService01/getBizPblancSearch?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=10&pageNo=1`,
        type: 'xml',
        note: 'K-Startup 사업공고 검색'
      },
      // 기업마당/입찰공고 관련 API들
      {
        name: '기업마당 입찰공고 (API ID: 1230000)',
        url: `https://apis.data.go.kr/1230000/BidPublicInfoService02/getBidPblancListInfoServcPPSSuplyInfo?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=10&pageNo=1`,
        type: 'xml'
      },
      {
        name: '기업마당 입찰공고 (간단한 서비스명)',
        url: `https://apis.data.go.kr/1230000/BidPublicInfoService02/getBidPblancListInfo?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=10&pageNo=1`,
        type: 'xml'
      },
      // 소상공인 관련 API들
      {
        name: '소상공인 정책정보 (API ID: 15000000)',
        url: `https://apis.data.go.kr/15000000/smallBusinessPolicyService/getSmallBusinessPolicyList?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=10&pageNo=1`,
        type: 'xml'
      },
      // 일반적인 공공데이터포털 API 패턴
      {
        name: '공공데이터포털 일반 검색 (API ID: 15000000)',
        url: `https://apis.data.go.kr/15000000/service/getServiceList?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=10&pageNo=1`,
        type: 'xml'
      },
      // 정책자금 관련
      {
        name: '정책자금 정보 (API ID: 15000000)',
        url: `https://apis.data.go.kr/15000000/policyFundService/getPolicyFundList?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=10&pageNo=1`,
        type: 'xml'
      }
    ];
    
    console.log('🔍 다양한 공공데이터포털 API 패턴을 테스트합니다.');
    console.log('💡 성공한 API를 찾으면 해당 API를 사용하도록 설정하겠습니다.');
    
    for (const endpoint of testEndpoints) {
      try {
        console.log(`\n🧪 테스트: ${endpoint.name}`);
        console.log(`📡 URL: ${endpoint.url.substring(0, 100)}...`);
        
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
            
            // 에러 코드 확인
            const resultCode = response.data.match(/<resultCode>(\d+)<\/resultCode>/i)?.[1];
            if (resultCode && resultCode !== '00') {
              result.success = false;
              result.errorCode = resultCode;
              result.errorMsg = response.data.match(/<resultMsg>(.*?)<\/resultMsg>/i)?.[1];
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
    
    return res.json({
      success: true,
      message: `API 테스트 완료: ${successCount}개 성공, ${failCount}개 실패`,
      results: testResults,
      summary: {
        total: testResults.length,
        success: successCount,
        failed: failCount,
        apiKeyLength: apiKey.length,
        apiKeySet: !!process.env.PUBLIC_DATA_KEY
      }
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

