const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { JSDOM } = require('jsdom');
// 크롤링 제거 - API 키만 사용
// const puppeteer = require('puppeteer');
// const chromium = require('@sparticuz/chromium');

// Supabase 초기화
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * 실제 정책지원금 데이터 수집 API
 * 
 * 데이터 출처:
 * 1. 기업마당 (bizinfo.go.kr) - 중소기업 지원사업
 * 2. 소상공인마당 (sbiz.or.kr) - 소상공인 정책
 * 3. K-Startup (k-startup.go.kr) - 창업지원
 * 4. 정책브리핑 (korea.kr) - 정부 정책
 */

// 실제 데이터 소스 URL
const DATA_SOURCES = {
  // K-Startup - 창업지원 정책 공고 (진행중인 사업)
  K_STARTUP: 'https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do',
  
  // 중소벤처기업부 - 소상공인 지원사업 공고
  MSS: 'https://www.mss.go.kr/site/smba/ex/bbs/List.do?cbIdx=86',
  
  // 소상공인시장진흥공단
  SEMAS: 'https://www.semas.or.kr/web/board/webBoardList.do?bsCd=notice',
  
  // 기업마당 API (공공데이터포털 인증키 필요)
  BIZINFO_API: 'https://api.odcloud.kr/api/3074462/v1/uddi:f3f4df8b-5b64-4165-8581-973bf5d50c94'
};

// 프로덕션 환경 확인
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER || process.env.VERCEL;

/**
 * 내장된 실제 정책 데이터 (6개)
 * 문서: docs/06_지원금_정책안내/01_정책지원금_6가지안내.md
 */
function getBuiltInPolicies() {
  const today = new Date();
  const nextYear = new Date(today.getFullYear() + 1, 0, 1);
  
  return [
    {
      title: '2024년 소상공인 정책자금 융자',
      organization: '중소벤처기업부',
      category: 'operation',
      summary: '소상공인의 경영 안정과 성장을 위한 정책자금 지원',
      description: '소상공인(상시근로자 10인 미만)을 대상으로 최대 7천만원까지 저금리 융자를 지원합니다. 시설개선, 운영자금, 디지털 전환 등 다양한 용도로 사용 가능합니다.',
      support_amount: '최대 7,000만원',
      support_type: 'loan',
      eligibility_criteria: '- 사업자등록 후 6개월 이상 영업 중인 소상공인\n- 상시근로자 10인 미만\n- 연매출 10억원 이하\n- 신용등급 6등급 이상',
      required_documents: '- 사업자등록증\n- 재무제표\n- 신용등급 확인서\n- 사업계획서',
      business_type: ['음식점', '카페', '소매업', '서비스업'],
      target_area: ['전국'],
      application_start_date: '2024-01-02',
      application_end_date: nextYear.toISOString().split('T')[0],
      application_method: '온라인 신청 (소상공인마당)',
      application_url: 'https://www.semas.or.kr',
      contact_info: '소상공인시장진흥공단',
      phone_number: '1357',
      website_url: 'https://www.sbiz.or.kr',
      status: 'active',
      is_featured: true,
      tags: ['소상공인', '정책자금', '융자']
    },
    {
      title: '소상공인 스마트상점 기술보급',
      organization: '중소벤처기업부',
      category: 'facility',
      summary: '연매출 2억원 이하 소상공인을 위한 스마트상점 구축 지원',
      description: '키오스크, POS 시스템, 온라인몰 구축 등 디지털 전환을 위한 시설 및 장비를 지원합니다. 자부담 10%만 부담하면 됩니다.',
      support_amount: '최대 1,000만원 (자부담 10%)',
      support_type: 'grant',
      eligibility_criteria: '- 연매출 2억원 이하 소상공인\n- 사업자등록 후 1년 이상 영업 중',
      required_documents: '- 사업자등록증\n- 매출 증빙서류\n- 사업계획서',
      business_type: ['음식점', '카페', '소매업'],
      target_area: ['전국'],
      application_start_date: '2024-02-01',
      application_end_date: '2024-12-31',
      application_method: '온라인 신청',
      application_url: 'https://smartstore.sbiz.or.kr',
      contact_info: '소상공인시장진흥공단',
      phone_number: '1357',
      website_url: 'https://smartstore.sbiz.or.kr',
      status: 'active',
      is_featured: true,
      tags: ['스마트상점', '디지털전환', '키오스크']
    },
    {
      title: '백년가게 육성사업',
      organization: '중소벤처기업부',
      category: 'marketing',
      summary: '업력 30년 이상 소상공인을 위한 브랜드 개발 및 마케팅 지원',
      description: '오랜 전통을 가진 소상공인 가게의 브랜드 가치를 높이고 마케팅을 지원하여 지속가능한 경영을 돕습니다.',
      support_amount: '최대 3,000만원',
      support_type: 'grant',
      eligibility_criteria: '- 업력 30년 이상 소상공인\n- 사업자등록 후 30년 이상 영업 중',
      required_documents: '- 사업자등록증\n- 영업기간 증빙서류\n- 브랜드 개발 계획서',
      business_type: ['음식점', '소매업', '서비스업'],
      target_area: ['전국'],
      application_start_date: '2024-03-01',
      application_end_date: '2024-11-30',
      application_method: '온라인 신청',
      application_url: 'https://www.sbiz.or.kr',
      contact_info: '소상공인시장진흥공단',
      phone_number: '1357',
      website_url: 'https://www.sbiz.or.kr',
      status: 'active',
      is_featured: false,
      tags: ['백년가게', '브랜드', '마케팅']
    },
    {
      title: '착한가격업소 인센티브 지원',
      organization: '행정안전부',
      category: 'operation',
      summary: '착한가격업소로 지정된 업소에 대한 인센티브 지원',
      description: '물가안정에 기여하는 착한가격업소에 대해 상하수도료 감면, 쓰레기봉투 지원 등 다양한 인센티브를 제공합니다.',
      support_amount: '연간 최대 200만원 상당',
      support_type: 'grant',
      eligibility_criteria: '- 착한가격업소로 지정된 업체\n- 가격 안정 유지 업소',
      required_documents: '- 착한가격업소 지정서\n- 사업자등록증',
      business_type: ['음식점', '이미용업', '세탁업'],
      target_area: ['전국'],
      application_start_date: '2024-01-01',
      application_end_date: nextYear.toISOString().split('T')[0],
      application_method: '지자체별 상이',
      application_url: 'https://www.mois.go.kr',
      contact_info: '각 지자체 경제정책과',
      phone_number: '120',
      website_url: 'https://www.mois.go.kr',
      status: 'active',
      is_featured: false,
      tags: ['착한가격업소', '인센티브']
    },
    {
      title: '노란우산 희망장려금',
      organization: '중소기업중앙회',
      category: 'operation',
      summary: '노란우산 신규 가입 소상공인에게 제공되는 가입 장려금',
      description: '노란우산 공제에 신규 가입하는 소상공인에게 월 1만원씩 12개월간 총 12만원의 장려금을 지급합니다.',
      support_amount: '월 1만원 × 12개월 (총 12만원)',
      support_type: 'grant',
      eligibility_criteria: '- 노란우산 신규 가입 소상공인\n- 사업자등록 후 6개월 이상 영업 중',
      required_documents: '- 사업자등록증\n- 노란우산 가입 증빙서류',
      business_type: ['음식점', '카페', '소매업', '서비스업'],
      target_area: ['전국'],
      application_start_date: '2024-01-01',
      application_end_date: nextYear.toISOString().split('T')[0],
      application_method: '온라인 신청',
      application_url: 'https://www.yellowumbrella.or.kr',
      contact_info: '중소기업중앙회',
      phone_number: '1666-9988',
      website_url: 'https://www.yellowumbrella.or.kr',
      status: 'active',
      is_featured: false,
      tags: ['노란우산', '공제', '장려금']
    },
    {
      title: '일자리 안정자금',
      organization: '고용노동부',
      category: 'employment',
      summary: '소상공인 일자리 유지를 위한 인건비 지원',
      description: '소상공인의 일자리 안정을 위해 근로자 고용 유지 시 월 30만원의 인건비를 지원합니다.',
      support_amount: '월 30만원',
      support_type: 'grant',
      eligibility_criteria: '- 상시근로자 5인 이상 50인 미만 소상공인\n- 고용 유지 증빙',
      required_documents: '- 사업자등록증\n- 고용보험 가입 증명서\n- 고용 유지 증빙서류',
      business_type: ['음식점', '카페', '소매업', '서비스업', '제조업'],
      target_area: ['전국'],
      application_start_date: '2024-01-01',
      application_end_date: nextYear.toISOString().split('T')[0],
      application_method: '온라인 신청',
      application_url: 'https://www.moel.go.kr',
      contact_info: '고용노동부',
      phone_number: '1350',
      website_url: 'https://www.moel.go.kr',
      status: 'active',
      is_featured: false,
      tags: ['일자리', '인건비', '고용유지']
    }
  ];
}

/**
 * 실제 정책 데이터 크롤링/수집
 */
async function fetchRealPolicies() {
  const policies = [];
  const startTime = Date.now();
  
  try {
    // 1. 기업마당 API 호출 (공공데이터포털)
    // 환경변수가 있으면 사용, 없으면 기본값 사용 (개발용)
    // API 키: e45b26951c63da01a0d82653dd6101417c57f3812905e604bb4f60f80157bac8
    const apiKey = process.env.PUBLIC_DATA_KEY || 'e45b26951c63da01a0d82653dd6101417c57f3812905e604bb4f60f80157bac8';
    
    // API 키 유효성 검사
    if (!apiKey || apiKey.length < 20) {
      console.error('❌ API 키가 유효하지 않습니다.');
      console.error('❌ API 키 길이:', apiKey ? apiKey.length : 0);
      throw new Error('API 키가 설정되지 않았거나 유효하지 않습니다.');
    }
    
    console.log('\n🔑 ========== API 키 확인 ==========');
    console.log('🔑 API 키 사용:', apiKey ? `${apiKey.substring(0, 10)}...` : '없음');
    console.log('🔑 API 키 전체 길이:', apiKey ? apiKey.length : 0);
    console.log('🔑 API 키 유효성 확인:', apiKey && apiKey.length > 20 ? '✅ 유효' : '❌ 무효');
    console.log('🔑 환경변수 PUBLIC_DATA_KEY:', process.env.PUBLIC_DATA_KEY ? '설정됨' : '미설정 (기본값 사용)');
    console.log('=====================================\n');
    
    if (apiKey) {
      try {
        // 공공데이터포털 - K-Startup(한국창업진흥원) 사업공고 API
        // 엔드포인트: https://apis.data.go.kr/B552735/kisedKstartupService01
        // 서비스 메서드: getAnnouncementInformation01, getBusinessInformation01
        const apiEndpoints = [
          // K-Startup 사업공고 정보 조회 (20개 제한)
          {
            url: `https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=20&pageNo=1`,
            type: 'xml',
            source: 'k-startup',
            priority: 1,
            note: 'K-Startup 사업공고 정보 조회 (20개)',
            maxItems: 20
          },
          // 중소벤처기업부 사업공고 목록 조회 (20개 제한)
          {
            url: `https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2?serviceKey=${encodeURIComponent(apiKey)}&numOfRows=20&pageNo=1`,
            type: 'xml',
            source: 'mss-biz',
            priority: 2,
            note: '중소벤처기업부 사업공고 목록 (20개)',
            maxItems: 20
          }
        ];
        
        // 우선순위에 따라 정렬 (priority가 낮을수록 먼저 실행)
        apiEndpoints.sort((a, b) => (a.priority || 999) - (b.priority || 999));
        console.log('📋 정렬된 API 엔드포인트:', apiEndpoints.map(e => `${e.source} (${e.type})`).join(', '));
        
        let totalApiCalls = 0;
        let successfulApiCalls = 0;
        let failedApiCalls = 0;
        
        for (const endpoint of apiEndpoints) {
          totalApiCalls++;
          console.log(`\n🔄 [${totalApiCalls}/${apiEndpoints.length}] ${endpoint.source} 엔드포인트 처리 시작`);
          try {
            // 각 API에서 지정된 개수만 가져오기 (K-Startup 20개, 중소벤처기업부 20개)
            let allData = [];
            let currentPage = 1;
            let hasMorePages = true;
            const maxItems = endpoint.maxItems || 20; // 각 API별 최대 개수
            const maxPages = 1; // 1페이지만 가져오기 (20개씩)
            const perPage = maxItems; // 페이지당 가져올 개수
            
            console.log(`🔄 ${endpoint.source} 엔드포인트: ${maxItems}개 제한으로 데이터 수집 시작`);
            console.log(`🔗 요청 URL: ${endpoint.url}`);
            
            while (hasMorePages && currentPage <= maxPages && allData.length < maxItems) {
              // URL에서 page와 perPage 파라미터 업데이트
              let url = endpoint.url.replace(/[?&]page=\d+/, '').replace(/[?&]perPage=\d+/, '').replace(/[?&]pageNo=\d+/, '').replace(/[?&]numOfRows=\d+/, '');
              const separator = url.includes('?') ? '&' : '?';
              
              // 공공데이터포털 API (data.go.kr)는 pageNo와 numOfRows 사용
              let pageUrl;
              if (url.includes('apis.data.go.kr')) {
                pageUrl = `${url}${separator}pageNo=${currentPage}&numOfRows=${perPage}`;
              } else {
                // odcloud.kr API는 page와 perPage 사용
                pageUrl = `${url}${separator}page=${currentPage}&perPage=${perPage}`;
              }
              
              try {
                const requestStartTime = Date.now();
                console.log(`📡 API 요청 (${endpoint.source}, 페이지 ${currentPage}): ${pageUrl.substring(0, 150)}...`);
                
                const response = await axios.get(pageUrl, {
                  timeout: 30000, // 타임아웃 30초로 증가
                  headers: {
                    'Accept': endpoint.type === 'xml' ? 'application/xml' : 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                  },
                  validateStatus: function (status) {
                    return status >= 200 && status < 500; // 4xx도 받아서 에러 메시지 확인
                  }
                });
                
                const requestDuration = ((Date.now() - requestStartTime) / 1000).toFixed(2);
                console.log(`✅ API 응답 수신 (${endpoint.source}, 페이지 ${currentPage}): 상태 ${response.status}, 타입: ${typeof response.data}, 소요시간: ${requestDuration}초`);
                console.log(`📊 응답 데이터 크기: ${JSON.stringify(response.data).length} bytes`);
                
                // 에러 상태 코드 확인
                if (response.status !== 200) {
                  console.error(`❌ API 에러 응답: HTTP ${response.status}`);
                  console.error(`❌ 응답 내용:`, JSON.stringify(response.data).substring(0, 1000));
                  
                  // 4xx 에러인 경우 상세 정보 출력
                  if (response.status >= 400 && response.status < 500) {
                    console.error(`❌ 클라이언트 에러 (${response.status}): API 키 또는 요청 형식 문제 가능성`);
                    if (response.data && typeof response.data === 'object') {
                      console.error(`❌ 에러 상세:`, JSON.stringify(response.data, null, 2));
                    }
                  }
                  
                  hasMorePages = false;
                  continue;
                }
                
                // 응답 데이터 파싱
                let data = null;
                if (response.data) {
                  // JSON 응답인 경우
                  if (typeof response.data === 'object' && !Array.isArray(response.data)) {
                    // 다양한 응답 구조 시도
                    data = response.data.data || 
                           response.data.response?.body?.items?.item || 
                           response.data.response?.body?.items ||
                           response.data.items?.item ||
                           response.data.items || 
                           response.data.list ||
                           response.data.result?.items ||
                           response.data.result ||
                           response.data;
                    
                    // 디버깅: 응답 구조 확인 (첫 페이지만)
                    if (currentPage === 1) {
                      console.log(`🔍 JSON 응답 구조 확인 (${endpoint.source}):`, Object.keys(response.data));
                      if (response.data.response) {
                        console.log(`🔍 response 구조:`, Object.keys(response.data.response));
                      }
                      if (response.data.response?.body) {
                        console.log(`🔍 body 구조:`, Object.keys(response.data.response.body));
                      }
                      if (data && Array.isArray(data) && data.length > 0) {
                        console.log(`✅ 데이터 배열 확인: ${data.length}개 항목`);
                      } else if (data && typeof data === 'object') {
                        console.log(`⚠️ 데이터가 배열이 아님, 객체 타입:`, typeof data);
                      } else {
                        console.warn(`⚠️ 데이터를 찾을 수 없음`);
                      }
                    }
                    
                    // 페이지네이션 정보 확인
                    const totalCount = response.data.totalCount || 
                                      response.data.response?.body?.totalCount ||
                                      response.data.response?.body?.totalCount ||
                                      response.data.total ||
                                      response.data.count ||
                                      (response.data.response?.body ? parseInt(response.data.response.body.totalCount) : null);
                    
                    const currentCount = Array.isArray(data) ? data.length : (data ? 1 : 0);
                    
                    // 공공데이터포털 XML 응답의 경우 totalCount 확인
                    if (endpoint.type === 'xml' && typeof response.data === 'string') {
                      const totalMatch = response.data.match(/<totalCount>(\d+)<\/totalCount>/i) || 
                                        response.data.match(/<totalCount>(\d+)<\/totalCount>/i);
                      if (totalMatch) {
                        const xmlTotalCount = parseInt(totalMatch[1]);
                        const xmlTotalPages = Math.ceil(xmlTotalCount / perPage);
                        if (currentPage >= xmlTotalPages) {
                          hasMorePages = false;
                          console.log(`📄 XML 총 ${xmlTotalCount}개 중 ${allData.length}개 수집 완료 (${xmlTotalPages}페이지)`);
                        }
                      }
                    }
                    
                    // 총 개수가 있고 현재 페이지가 마지막 페이지인지 확인
                    if (totalCount) {
                      const totalPages = Math.ceil(totalCount / perPage);
                      if (currentPage >= totalPages) {
                        hasMorePages = false;
                        console.log(`📄 총 ${totalCount}개 중 ${allData.length}개 수집 완료 (${totalPages}페이지)`);
                      }
                    }
                  }
                  // 배열인 경우
                  else if (Array.isArray(response.data)) {
                    data = response.data;
                    if (data.length < perPage) {
                      hasMorePages = false;
                    }
                  }
                // XML 응답인 경우
                else if (typeof response.data === 'string' && response.data.includes('<')) {
                  console.log(`📄 XML 응답 수신 (페이지 ${currentPage}), 길이: ${response.data.length} bytes`);
                  
                  // 에러 응답 확인 (공공데이터포털 표준 형식)
                  if (response.data.includes('<resultCode>') || response.data.includes('<resultMsg>')) {
                    const resultCode = response.data.match(/<resultCode>(\d+)<\/resultCode>/i)?.[1];
                    const resultMsg = response.data.match(/<resultMsg>(.*?)<\/resultMsg>/i)?.[1];
                    if (resultCode && resultCode !== '00') {
                      console.error(`❌ API 에러 응답: ${resultCode} - ${resultMsg || '알 수 없는 오류'}`);
                      console.error(`❌ 전체 XML 응답:`, response.data.substring(0, 2000));
                      
                      // 일반적인 에러 코드 해석
                      if (resultCode === '01' || resultCode === '02') {
                        console.error(`💡 해석: 서비스 키가 유효하지 않거나 인증 실패`);
                        console.error(`💡 조치: API 키를 확인하고 공공데이터포털에서 재발급 받으세요`);
                      } else if (resultCode === '03' || resultCode === '04') {
                        console.error(`💡 해석: 요청 파라미터 오류`);
                        console.error(`💡 조치: API 엔드포인트 URL과 파라미터를 확인하세요`);
                      } else if (resultCode === '05') {
                        console.error(`💡 해석: 일일 호출 한도 초과`);
                        console.error(`💡 조치: 내일 다시 시도하거나 API 사용량을 확인하세요`);
                      }
                      
                      hasMorePages = false;
                      continue;
                    }
                  }
                  
                  // 공공데이터포털 에러 메시지 확인 (다른 형식)
                  if (response.data.includes('SERVICE ERROR') || response.data.includes('ERROR')) {
                    console.error(`❌ XML에 에러 메시지 포함됨`);
                    console.error(`❌ XML 샘플:`, response.data.substring(0, 2000));
                    hasMorePages = false;
                    continue;
                  }
                  
                  // XML 샘플 로그 (첫 페이지만)
                  if (currentPage === 1) {
                    console.log(`📄 XML 응답 샘플 (처음 500자): ${response.data.substring(0, 500)}`);
                  }
                  
                  data = parseXMLResponse(response.data);
                  console.log(`✅ XML 응답 파싱 완료 (페이지 ${currentPage}): ${data?.length || 0}개 항목`);
                  
                  if (data && data.length > 0 && currentPage === 1) {
                    console.log(`📋 첫 번째 항목 샘플:`, JSON.stringify(data[0], null, 2).substring(0, 300));
                  }
                  
                  if (!data || data.length === 0) {
                    console.log(`⚠️ XML 파싱 결과가 비어있음. 원본 XML 확인 필요.`);
                    if (currentPage === 1) {
                      console.log(`📄 전체 XML 응답 (디버깅용):`, response.data.substring(0, 2000));
                    }
                    hasMorePages = false;
                  }
                }
                }
                
                // 데이터가 배열이 아닌 경우 처리
                if (!Array.isArray(data) && data) {
                  // 단일 객체인 경우 배열로 변환
                  if (typeof data === 'object') {
                    data = [data];
                  } else {
                    data = [];
                  }
                }
                
                if (Array.isArray(data) && data.length > 0) {
                  allData = allData.concat(data);
                  // 모든 페이지 로그 출력 (50개씩이므로 로그가 많지 않음)
                  console.log(`✅ ${endpoint.type.toUpperCase()} 페이지 ${currentPage}: ${data.length}개 항목 수집 (누적: ${allData.length}개)`);
                  
                  // 첫 번째 항목 샘플 출력 (첫 페이지만)
                  if (currentPage === 1 && data.length > 0) {
                    console.log(`📋 첫 번째 항목 샘플:`, JSON.stringify(data[0], null, 2).substring(0, 300));
                  }
                  
                  // 데이터가 perPage보다 적으면 마지막 페이지
                  if (data.length < perPage) {
                    hasMorePages = false;
                    console.log(`📄 마지막 페이지 도달: ${allData.length}개 항목 수집 완료`);
                  }
                } else {
                  console.warn(`⚠️ 페이지 ${currentPage}: 데이터가 비어있거나 배열이 아님 (타입: ${typeof data}, 길이: ${Array.isArray(data) ? data.length : 'N/A'})`);
                  if (currentPage === 1) {
                    console.warn(`⚠️ 첫 페이지 응답 샘플:`, JSON.stringify(response.data).substring(0, 1000));
                  }
                  hasMorePages = false;
                  if (allData.length > 0) {
                    console.log(`📄 데이터 없음, 수집 완료: ${allData.length}개 항목`);
                  }
                }
                
                currentPage++;
                
                // API 호출 간격 (과도한 요청 방지)
                await new Promise(resolve => setTimeout(resolve, 200));
                
              } catch (pageError) {
                console.log(`⚠️ 페이지 ${currentPage} 요청 실패:`, pageError.message);
                hasMorePages = false;
              }
            }
            
            if (allData.length > 0) {
              successfulApiCalls++;
              console.log(`✅ ${endpoint.type.toUpperCase()} 엔드포인트에서 총 ${allData.length}개 항목 수집 완료`);
              console.log(`🔍 첫 번째 원본 데이터 샘플:`, JSON.stringify(allData[0], null, 2).substring(0, 500));
              console.log(`🔍 첫 번째 원본 데이터 키 목록:`, Object.keys(allData[0] || {}));
              
              let processedCount = 0;
              let filteredCount = 0;
              
              allData.forEach((item, index) => {
                processedCount++;
                
                // K-Startup API 필드 매핑 (우선) + 중소벤처기업부 사업공고 API 필드 매핑 + getbizList_v2 필드 매핑
                const title = item.title || item['biz_pbanc_nm'] || item['intg_pbanc_biz_nm'] || item['pbanc_pbanc_nm'] || 
                             item['사업명'] || item.pblancNm || item.사업명 || item['제목'] || item['pblancNm'] || item['pblancNmKr'] || item['pblancNmEn'] || '';
                // getbizList_v2의 dataContents에서 HTML 태그 제거하여 요약 추출
                const rawDataContents = item.dataContents || item['dataContents'] || '';
                const cleanDataContents = rawDataContents ? rawDataContents.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() : '';
                const summary = item.summary || cleanDataContents?.substring(0, 200) || item['pbanc_ctnt']?.substring(0, 200) || 
                               item['사업개요'] || item.bsnsSumryCn || item.사업개요 || item['요약'] || item['bsnsSumryCn'] || item['pblancSumryCn'] || item['pblancCn'] || '';
                const description = item.description || cleanDataContents || item['pbanc_ctnt'] || 
                                   item['지원내용'] || item.sportCn || item.지원내용 || item['내용'] || item['pblancCn'] || item['bsnsCn'] || summary;
                
                // 제목이 없으면 제외 (최소 조건)
                if (!title || title.trim() === '') {
                  if (index < 3) {
                    console.log(`⚠️ 항목 ${index + 1}: 제목 없음, 건너뜀`);
                  }
                  filteredCount++;
                  return;
                }
                
                // 뉴스 기사 필터링 (최소한만)
                const text = (title + ' ' + (summary || '') + ' ' + (description || '')).toLowerCase();
                const newsKeywords = ['뉴스', '기사', '보도', '발표'];
                const isNews = newsKeywords.some(keyword => text.includes(keyword) && text.length < 200); // 짧은 뉴스만 제외
                
                if (isNews) {
                  if (index < 3) {
                    console.log(`⚠️ 항목 ${index + 1}: 뉴스 기사로 판단, 건너뜀`);
                  }
                  filteredCount++;
                  return;
                }
                
                // 날짜 정보 추출 (K-Startup API 우선) + getbizList_v2 필드
                const startDate = item.application_start_date || item.applicationStartDate || item['applicationStartDate'] ||
                                 item['pbanc_rcpt_bgng_dt'] || item['신청시작일'] || item.rceptBeginDe || item.startDate || item.신청시작일 || item['rceptBeginDe'] || item['pblancBeginDe'] || '';
                const endDate = item.application_end_date || item.applicationEndDate || item['applicationEndDate'] ||
                               item['pbanc_rcpt_end_dt'] || item['신청마감일'] || item.rceptEndDe || item.endDate || item.신청마감일 || item['rceptEndDe'] || item['pblancEndDe'] || '';
                const publishDate = item['공고일'] || item.pblancDe || item.publishDate || item.공고일 || item['pblancDe'] || item['pblancRegistDe'] || '';
                
                // 날짜 형식 정규화
                const normalizeDate = (dateStr) => {
                  if (!dateStr) return null;
                  const cleaned = dateStr.toString().replace(/[.\s]/g, '-').replace(/--+/g, '-');
                  const match = cleaned.match(/(\d{4})[-\s]?(\d{2})[-\s]?(\d{2})/);
                  if (match) {
                    return `${match[1]}-${match[2]}-${match[3]}`;
                  }
                  return null;
                };
                
                const normalizedStart = normalizeDate(startDate);
                const normalizedEnd = normalizeDate(endDate);
                const normalizedPublish = normalizeDate(publishDate);
                
                // 중소벤처기업부 API는 모든 필터링 제외
                const isFromMssBiz = endpoint.source === 'mss-biz';
                
                // 날짜 필터링: 2010년 이전만 제외 (최근 15년 포함)
                if (!isFromMssBiz) {
                  const minYear = 2010;
                  const isVeryOld = normalizedStart && parseInt(normalizedStart.substring(0, 4)) < minYear ||
                                    normalizedEnd && parseInt(normalizedEnd.substring(0, 4)) < minYear ||
                                    normalizedPublish && parseInt(normalizedPublish.substring(0, 4)) < minYear;
                  
                  if (isVeryOld && (normalizedStart || normalizedEnd || normalizedPublish)) {
                    if (index < 3) {
                      console.log(`⚠️ 항목 ${index + 1}: 2010년 이전 공고, 건너뜀`);
                    }
                    filteredCount++;
                    return;
                  }
                }
                
                // 모든 정책 포함 (필터링 최소화)
                if (title) {
                  if (policies.length < 10 || policies.length % 10 === 0) {
                    console.log(`✅ 정책 추가: ${title.substring(0, 50)}... (누적: ${policies.length + 1}개)`);
                  }
                  // K-Startup API + 중소벤처기업부 사업공고 API 필드 매핑
          policies.push({
                    title: title,
                    organization: item.organization || item['pbanc_ntrp_nm'] || item['sprv_inst'] || 
                                 item['수행기관'] || item.excInsttNm || item.수행기관 || item['pblancInsttNm'] || '한국창업진흥원',
                    category: item.category || mapCategory(item['supt_biz_clsfc'] || item['지원분야'] || item.supportField || item.지원분야 || item['pblancSe'] || item['bsnsSe'] || ''),
                    summary: summary || title,
                    description: description || summary || title,
                    support_amount: item.support_amount || item['biz_supt_bdgt_info'] || item['지원규모'] || item.sportScle || item.supportAmount || item.지원규모 || '문의',
                    support_type: mapSupportType(item['지원유형'] || item.supportType || item.지원유형 || item['sportSe'] || item['pblancSe'] || ''),
                    eligibility_criteria: item.eligibility_criteria || item['biz_supt_trgt_info'] || item['aply_trgt_ctnt'] || item['aply_trgt'] || 
                                         item['지원자격'] || item.sportQualf || item.eligibility || item.지원자격 || item['sportQualf'] || item['pblancQualf'] || '별도 문의',
                    required_documents: item['필요서류'] || item.requiredDocs || item.필요서류 || '별도 문의',
                    business_type: item.business_type || (item['biz_enyy'] ? (Array.isArray(item['biz_enyy']) ? item['biz_enyy'] : [item['biz_enyy']]) : null) ||
                                 (item['대상업종'] ? (Array.isArray(item['대상업종']) ? item['대상업종'] : [item['대상업종']]) : ['음식점', '카페', '소매업', '서비스업']),
                    target_area: item.target_area || (item['supt_regin'] ? (Array.isArray(item['supt_regin']) ? item['supt_regin'] : [item['supt_regin']]) : null) ||
                               (item['지원지역'] ? (Array.isArray(item['지원지역']) ? item['지원지역'] : [item['지원지역']]) : ['전국']),
                    application_start_date: normalizedStart || null,
                    application_end_date: normalizedEnd || null,
                    application_method: item['aply_mthd_onli_rcpt_istc'] ? '온라인 신청' : 
                                       (item['신청방법'] || item.applicationMethod || item.신청방법 || item['rceptMth'] || '온라인 신청'),
                    application_url: item.application_url || item.viewUrl || item['viewUrl'] || item['biz_aply_url'] || item['aply_mthd_onli_rcpt_istc'] || 
                                   item['신청URL'] || item.reqstUrl || item.applicationUrl || item.신청URL || item['rceptUrl'] || null,
                    contact_info: item['pbanc_ntrp_nm'] || item.writerName || item['writerName'] || item.writerPosition || item['writerPosition'] ||
                                 item['문의처'] || item.rqutProcCn || item.contact || item.문의처 || item['rqutProcCn'] || '중소벤처기업부',
                    phone_number: item.phone_number || item.writerPhone || item['writerPhone'] || item['prch_cnpl_no'] || 
                                item['전화번호'] || item.phone || item.전화번호 || item['telno'] || null,
                    website_url: item.website_url || item.viewUrl || item['viewUrl'] || item['detl_pg_url'] || item['biz_gdnc_url'] || 
                               item['홈페이지'] || item.website || item.홈페이지 || item['homepage'] || null,
                    status: getStatus(normalizedEnd),
                    is_featured: false,
                    tags: ['실제데이터', '공공데이터포털', endpoint.source || 'k-startup'],
                    source: endpoint.source || 'bizinfo'
                  });
                }
              });
              
              // 데이터를 가져왔으면 로그 출력 (모든 엔드포인트 시도)
              const addedCount = policies.filter(p => p.source === (endpoint.source || 'bizinfo')).length;
              if (addedCount > 0) {
                console.log(`✅ ${endpoint.type.toUpperCase()} 엔드포인트 (${endpoint.source})에서 ${addedCount}개 정책 추가`);
                console.log(`📊 처리 통계: 전체 ${allData.length}개 중 ${addedCount}개 추가, ${filteredCount}개 필터링됨`);
              } else {
                console.error(`❌ ${endpoint.type.toUpperCase()} 엔드포인트 (${endpoint.source})에서 정책을 찾지 못함`);
                console.error(`📊 수집된 전체 데이터: ${allData.length}개, 필터링 후 정책: ${addedCount}개`);
                console.error(`📊 처리 통계: 전체 ${allData.length}개 중 ${processedCount}개 처리, ${filteredCount}개 필터링됨`);
                if (allData.length > 0 && addedCount === 0) {
                  console.error(`❌ 필터링이 너무 엄격하여 모든 데이터가 제외되었습니다!`);
                  console.error(`💡 첫 번째 원본 데이터:`, JSON.stringify(allData[0], null, 2).substring(0, 1000));
                  console.error(`💡 필터링 조건 완화 필요!`);
                }
              }
            }
          } catch (apiError) {
            failedApiCalls++;
            console.error(`❌ [${totalApiCalls}/${apiEndpoints.length}] API 엔드포인트 실패 (${endpoint.source}, ${endpoint.type}):`, apiError.message);
            if (apiError.response) {
              console.error(`❌ HTTP 상태: ${apiError.response.status}`);
              console.error(`❌ 응답 헤더:`, JSON.stringify(apiError.response.headers));
              console.error(`❌ 응답 데이터:`, JSON.stringify(apiError.response.data).substring(0, 1000));
            }
            if (apiError.request) {
              console.error(`❌ 요청은 전송되었지만 응답이 없음`);
              console.error(`❌ 요청 URL:`, apiError.config?.url);
            }
            if (apiError.code) {
              console.error(`❌ 에러 코드:`, apiError.code);
            }
            // 에러가 발생해도 다음 엔드포인트 계속 시도
            continue;
          }
        }
        
        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);
        
        console.log(`\n📋 ========== API 호출 요약 ==========`);
        console.log(`⏱️ 소요 시간: ${duration}초`);
        console.log(`📊 총 API 엔드포인트: ${totalApiCalls}개`);
        console.log(`✅ 성공: ${successfulApiCalls}개`);
        console.log(`❌ 실패: ${failedApiCalls}개`);
        console.log(`📋 총 ${policies.length}개의 정책 데이터 수집 완료`);
        
        // 소스별 통계 출력
        const sourceStats = {};
        policies.forEach(p => {
          const source = p.source || 'unknown';
          sourceStats[source] = (sourceStats[source] || 0) + 1;
        });
        console.log(`📊 소스별 정책 수:`, JSON.stringify(sourceStats, null, 2));
        
        // 실패한 경우 상세 정보
        if (failedApiCalls === totalApiCalls && totalApiCalls > 0) {
          console.error(`\n❌ ========== 심각한 문제 ==========`);
          console.error(`❌ 모든 API 호출이 실패했습니다!`);
          console.error(`💡 가능한 원인:`);
          console.error(`   1. API 키가 유효하지 않음`);
          console.error(`   2. 네트워크 연결 문제`);
          console.error(`   3. API 엔드포인트가 변경됨`);
          console.error(`   4. 서버에서 외부 API 호출 차단`);
          console.error(`====================================\n`);
        } else if (policies.length === 0 && successfulApiCalls > 0) {
          console.error(`\n❌ ========== 필터링 문제 ==========`);
          console.error(`❌ API 호출은 성공했지만 정책이 0개입니다!`);
          console.error(`💡 필터링이 너무 엄격하여 모든 데이터가 제외되었습니다.`);
          console.error(`💡 필터링 조건을 완화해야 합니다.`);
          console.error(`====================================\n`);
        }
        console.log(`========================================\n`);
        
        // 모든 엔드포인트 시도 후 결과 요약
        if (policies.length > 0) {
          console.log(`✅ 총 ${policies.length}개의 실제 정책 데이터를 가져왔습니다.`);
        } else {
          console.error('❌ 공공데이터포털 API에서 데이터를 가져오지 못했습니다.');
          console.error('💡 가능한 원인:');
          console.error('   1. API 키가 유효하지 않음');
          console.error('   2. API 엔드포인트가 변경됨');
          console.error('   3. 네트워크 오류');
          console.error('   4. 필터링이 너무 엄격함');
        }
        
        if (policies.length < 10) {
          console.warn(`⚠️ 정책 수가 적습니다 (${policies.length}개). 필터링이 너무 엄격할 수 있습니다.`);
          console.warn(`💡 조치: 필터링을 더 완화하거나 API 엔드포인트를 확인하세요.`);
        } else if (policies.length >= 50) {
          console.log(`✅ ${policies.length}개 정책 수집 완료 (목표: 50개)`);
        } else {
          console.log(`ℹ️ ${policies.length}개 정책 수집 (목표: 50개)`);
        }
      } catch (error) {
        console.error('기업마당 API 호출 실패:', error.message);
      }
    }
    
    // 2. K-Startup API는 위의 apiEndpoints에 포함되어 있음 (크롤링 제거)
    // API 키를 통해 공공데이터포털에서 K-Startup 데이터를 가져옵니다.
    console.log('ℹ️ K-Startup 데이터는 공공데이터포털 API를 통해 수집됩니다.');
    
    // 3. 실제 데이터가 없을 경우에만 내장 데이터 사용 (백업)
    // 하지만 실제 API 데이터가 있으면 내장 데이터는 제외
    if (policies.length === 0) {
      console.log('⚠️ 실제 데이터를 가져오지 못했습니다. 내장 데이터를 사용합니다.');
      const builtInPolicies = getBuiltInPolicies();
      policies.push(...builtInPolicies);
    } else {
      // 실제 데이터가 있으면 내장 샘플 데이터는 제외 (중복 방지)
      const builtInTitles = [
        '2024년 소상공인 정책자금 융자',
        '소상공인 스마트상점 기술보급',
        '백년가게 육성사업',
        '착한가격업소 인센티브 지원',
        '노란우산 희망장려금',
        '일자리 안정자금'
      ];
      const beforeCount = policies.length;
      const filteredPolicies = policies.filter(p => !builtInTitles.includes(p.title));
      const removedCount = beforeCount - filteredPolicies.length;
      if (removedCount > 0) {
        console.log(`🗑️ 내장 샘플 데이터 ${removedCount}개 제외 (실제 API 데이터만 사용)`);
      }
      policies.length = 0;
      policies.push(...filteredPolicies);
      
      // 정책 수 확인
      if (policies.length >= 50) {
        console.log(`✅ ${policies.length}개 정책 수집 완료`);
      } else if (policies.length > 0) {
        console.log(`ℹ️ ${policies.length}개 정책 수집 (목표: 50개)`);
      } else {
        console.warn(`⚠️ 수집된 정책이 없습니다. API 호출 또는 필터링을 확인하세요.`);
      }
    }
    
  } catch (error) {
    console.error('실제 데이터 수집 실패:', error);
    // 에러 발생 시 내장 데이터 사용
    const builtInPolicies = getBuiltInPolicies();
    policies.push(...builtInPolicies);
  }
  
  return policies;
}

/**
 * 카테고리 매핑
 */
function mapCategory(categoryText) {
  const mapping = {
    '창업': 'startup',
    '경영': 'operation',
    '인력': 'employment',
    '시설': 'facility',
    '마케팅': 'marketing',
    '교육': 'education',
    '기술': 'technology'
  };
  
  for (const [key, value] of Object.entries(mapping)) {
    if (categoryText && categoryText.includes(key)) {
      return value;
    }
  }
  return 'other';
}

/**
 * 지원유형 매핑
 */
function mapSupportType(typeText) {
  if (!typeText) return 'other';
  if (typeText.includes('보조') || typeText.includes('지원금')) return 'grant';
  if (typeText.includes('융자') || typeText.includes('대출')) return 'loan';
  if (typeText.includes('세제') || typeText.includes('세금')) return 'tax_benefit';
  if (typeText.includes('바우처')) return 'voucher';
  if (typeText.includes('컨설팅')) return 'consulting';
  return 'other';
}

/**
 * 상태 확인
 */
function getStatus(endDate) {
  if (!endDate) return 'active';
  const today = new Date();
  const end = new Date(endDate);
  if (end < today) return 'ended';
  if (end > today) return 'active';
  return 'active';
}

/**
 * XML 응답 파싱 (공공데이터포털 API용)
 * K-Startup API는 <col name="..."> 형식 사용
 */
function parseXMLResponse(xmlData) {
  const items = [];
  
  try {
    const dom = new JSDOM(xmlData, { contentType: 'text/xml' });
    const document = dom.window.document;
    
    // K-Startup API 형식: <results><data><item><col name="...">...</col></item></data></results>
    // 먼저 <col name="..."> 형식 확인
    const colItems = document.querySelectorAll('item');
    
    if (colItems.length > 0) {
      // K-Startup API 형식 처리
      colItems.forEach(itemNode => {
        const item = {};
        const colNodes = itemNode.querySelectorAll('col');
        
        colNodes.forEach(col => {
          const name = col.getAttribute('name');
          const text = (col.textContent || '').trim();
          
          if (!name || !text) return;
          
          // K-Startup API 필드 매핑
          // getAnnouncementInformation01 필드
          if (name === 'biz_pbanc_nm' || name === 'intg_pbanc_biz_nm' || name === 'pbanc_pbanc_nm') {
            item.title = text.replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
          }
          if (name === 'pbanc_ctnt' || name === 'pbanc_nm') {
            item.description = text;
            if (!item.summary) {
              item.summary = text.substring(0, 200);
            }
          }
          if (name === 'pbanc_ntrp_nm' || name === 'sprv_inst') {
            item.organization = text;
          }
          // getBusinessInformation01 필드
          if (name === 'supt_biz_titl_nm') {
            item.title = text;
          }
          if (name === 'supt_biz_intrd_info') {
            item.summary = text.substring(0, 200);
            if (!item.description) {
              item.description = text;
            }
          }
          if (name === 'biz_supt_ctnt') {
            item.description = text;
            if (!item.summary) {
              item.summary = text.substring(0, 200);
            }
          }
          if (name === 'biz_supt_bdgt_info') {
            item.support_amount = text;
          }
          if (name === 'biz_supt_trgt_info') {
            item.eligibility_criteria = text;
          }
          if (name === 'supt_biz_chrct') {
            if (!item.summary) {
              item.summary = text.substring(0, 200);
            }
          }
          if (name === 'pbanc_rcpt_bgng_dt') {
            // YYYYMMDD 형식을 YYYY-MM-DD로 변환
            if (text.length === 8) {
              item.application_start_date = `${text.substring(0, 4)}-${text.substring(4, 6)}-${text.substring(6, 8)}`;
            }
          }
          if (name === 'pbanc_rcpt_end_dt') {
            // YYYYMMDD 형식을 YYYY-MM-DD로 변환
            if (text.length === 8) {
              item.application_end_date = `${text.substring(0, 4)}-${text.substring(4, 6)}-${text.substring(6, 8)}`;
            }
          }
          if (name === 'detl_pg_url' || name === 'biz_gdnc_url') {
            item.website_url = text;
          }
          if (name === 'biz_aply_url' || name === 'aply_mthd_onli_rcpt_istc') {
            item.application_url = text;
          }
          if (name === 'prch_cnpl_no') {
            item.phone_number = text;
          }
          if (name === 'supt_biz_clsfc') {
            item.category = mapCategory(text);
          }
          if (name === 'supt_regin') {
            item.target_area = text.split(',').map(a => a.trim()).filter(a => a);
          }
          if (name === 'biz_enyy') {
            item.business_type = text.split(',').map(b => b.trim()).filter(b => b);
          }
          
          // getbizList_v2 필드 매핑
          if (name === 'title') {
            item.title = text.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
          }
          if (name === 'dataContents') {
            const cleanText = text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
            item.dataContents = cleanText;
            if (!item.description) {
              item.description = cleanText;
            }
            if (!item.summary) {
              item.summary = cleanText.substring(0, 200);
            }
          }
          if (name === 'applicationStartDate') {
            item.applicationStartDate = text;
            item.application_start_date = text;
          }
          if (name === 'applicationEndDate') {
            item.applicationEndDate = text;
            item.application_end_date = text;
          }
          if (name === 'viewUrl') {
            item.viewUrl = text.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
            if (!item.application_url) {
              item.application_url = item.viewUrl;
            }
            if (!item.website_url) {
              item.website_url = item.viewUrl;
            }
          }
          if (name === 'writerName') {
            item.writerName = text;
            if (!item.contact_info) {
              item.contact_info = text;
            }
          }
          if (name === 'writerPosition') {
            item.writerPosition = text;
          }
          if (name === 'writerPhone') {
            item.writerPhone = text;
            if (!item.phone_number) {
              item.phone_number = text;
            }
          }
          if (name === 'writerEmail') {
            item.writerEmail = text;
          }
          
          // 원본 데이터도 보존
          item[name] = text;
        });
        
        // 필수 필드 확인
        if (item.title) {
          items.push(item);
        }
      });
    } else {
      // 기존 형식 처리 (item, row, record 등)
      const itemNodes = document.querySelectorAll('item, row, record, body > items > item, response > body > items > item');
      
      itemNodes.forEach(node => {
        const item = {};
        
        // 모든 자식 노드를 순회하며 데이터 추출
        node.childNodes.forEach(child => {
          if (child.nodeType === 1) { // Element node
            const tagName = child.tagName.toLowerCase();
            const text = child.textContent?.trim() || '';
            
            // 한글 필드명과 영문 필드명 모두 지원
            // 중소벤처기업부 사업공고 API 필드 매핑 추가 + getbizList_v2 필드 매핑
            if (tagName === 'title' || tagName.includes('title') || tagName.includes('사업명') || tagName.includes('pblancnm') || tagName === 'pblancnmkr') {
              const cleanText = text.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
              item.title = cleanText;
              item['사업명'] = cleanText;
              item.pblancNm = cleanText;
              item.pblancNmKr = cleanText;
            }
            if (tagName === 'datacontents' || tagName === 'dataContents') {
              const cleanText = text.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/<!\[CDATA\[|\]\]>/g, '').trim();
              item.dataContents = cleanText;
              if (!item.description) {
                item.description = cleanText;
              }
              if (!item.summary) {
                item.summary = cleanText.substring(0, 200);
              }
            }
            if (tagName === 'applicationstartdate' || tagName === 'applicationStartDate') {
              item.applicationStartDate = text;
              item.application_start_date = text;
            }
            if (tagName === 'applicationenddate' || tagName === 'applicationEndDate') {
              item.applicationEndDate = text;
              item.application_end_date = text;
            }
            if (tagName === 'viewurl' || tagName === 'viewUrl') {
              const cleanUrl = text.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
              item.viewUrl = cleanUrl;
              if (!item.application_url) {
                item.application_url = cleanUrl;
              }
              if (!item.website_url) {
                item.website_url = cleanUrl;
              }
            }
            if (tagName === 'writername' || tagName === 'writerName') {
              item.writerName = text;
              if (!item.contact_info) {
                item.contact_info = text;
              }
            }
            if (tagName === 'writerposition' || tagName === 'writerPosition') {
              item.writerPosition = text;
            }
            if (tagName === 'writerphone' || tagName === 'writerPhone') {
              item.writerPhone = text;
              if (!item.phone_number) {
                item.phone_number = text;
              }
            }
            if (tagName === 'writeremail' || tagName === 'writerEmail') {
              item.writerEmail = text;
            }
            if (tagName.includes('org') || tagName.includes('기관') || tagName.includes('excinsttnm') || tagName === 'pblancinsttnm') {
              item.organization = text;
              item['수행기관'] = text;
              item.excInsttNm = text;
              item.pblancInsttNm = text;
            }
            if (tagName.includes('summary') || tagName.includes('개요') || tagName.includes('bsnssumrycn') || tagName === 'pblancsumrycn') {
              item.summary = text;
              item['사업개요'] = text;
              item.bsnsSumryCn = text;
              item.pblancSumryCn = text;
            }
            if (tagName.includes('content') || tagName.includes('내용') || tagName.includes('sportcn') || tagName === 'pblancncn' || tagName === 'bsnsncn') {
              item.description = text;
              item['지원내용'] = text;
              item.sportCn = text;
              item.pblancCn = text;
              item.bsnsCn = text;
            }
            if (tagName.includes('amount') || tagName.includes('규모') || tagName.includes('sportscle')) {
              item.supportAmount = text;
              item['지원규모'] = text;
              item.sportScle = text;
            }
            if (tagName.includes('start') || tagName.includes('시작') || tagName.includes('rceptbeginde') || tagName === 'pblancbeginde') {
              item.startDate = text;
              item['신청시작일'] = text;
              item.rceptBeginDe = text;
              item.pblancBeginDe = text;
            }
            if (tagName.includes('end') || tagName.includes('마감') || tagName.includes('rceptendde') || tagName === 'pblancendde') {
              item.endDate = text;
              item['신청마감일'] = text;
              item.rceptEndDe = text;
              item.pblancEndDe = text;
            }
            if (tagName.includes('url') || tagName.includes('링크') || tagName.includes('reqsturl') || tagName === 'rcepturl') {
              item.applicationUrl = text;
              item['신청URL'] = text;
              item.reqstUrl = text;
              item.rceptUrl = text;
            }
            if (tagName.includes('contact') || tagName.includes('문의') || tagName.includes('rqutproccn')) {
              item.contact = text;
              item['문의처'] = text;
              item.rqutProcCn = text;
            }
            if (tagName.includes('date') || tagName.includes('일') || tagName === 'pblancde' || tagName === 'pblancregistde') {
              item.publishDate = text;
              item['공고일'] = text;
              item.pblancDe = text;
              item.pblancRegistDe = text;
            }
            if (tagName.includes('phone') || tagName.includes('전화') || tagName === 'telno') {
              item.phone = text;
              item['전화번호'] = text;
              item.telno = text;
            }
            if (tagName.includes('method') || tagName.includes('방법') || tagName === 'rceptmth') {
              item.applicationMethod = text;
              item['신청방법'] = text;
              item.rceptMth = text;
            }
            
            // 모든 필드를 원본 형태로도 저장
            item[tagName] = text;
            item[child.tagName] = text;
          }
      });
      
      if (item.title || item['사업명'] || item.pblancNm || item.pblancNmKr) {
        items.push(item);
      }
    });
    }
    
    console.log(`📊 XML 파싱 결과: ${items.length}개 항목 추출`);
    if (items.length === 0) {
      console.log(`⚠️ XML에서 항목을 찾지 못함. XML 구조 확인 필요.`);
      console.log(`📄 XML 샘플 (처음 1000자):`, xmlData.substring(0, 1000));
      
      // 중소벤처기업부 API 구조 확인
      const bodyItems = document.querySelectorAll('body > items > item');
      const responseItems = document.querySelectorAll('response > body > items > item');
      console.log(`🔍 body > items > item: ${bodyItems.length}개`);
      console.log(`🔍 response > body > items > item: ${responseItems.length}개`);
    }
    
  } catch (error) {
    console.error('❌ XML 파싱 오류:', error.message);
    console.error('❌ XML 파싱 스택:', error.stack);
    // 간단한 정규식 파싱 시도
    console.log(`🔄 정규식 파싱 시도...`);
    const itemMatches = xmlData.match(/<item>[\s\S]*?<\/item>/g) || 
                       xmlData.match(/<row>[\s\S]*?<\/row>/g) || 
                       xmlData.match(/<record>[\s\S]*?<\/record>/g) || [];
    console.log(`📋 정규식으로 찾은 항목 수: ${itemMatches.length}`);
    itemMatches.forEach((itemXml, index) => {
      if (index < 3) { // 처음 3개만 로그
        console.log(`📄 항목 ${index + 1} 샘플:`, itemXml.substring(0, 200));
      }
      
      // 중소벤처기업부 API 필드 추출
      const title = (itemXml.match(/<pblancNmKr>(.*?)<\/pblancNmKr>/i) || 
                    itemXml.match(/<pblancNm>(.*?)<\/pblancNm>/i) ||
                    itemXml.match(/<title>(.*?)<\/title>/i) || 
                    itemXml.match(/<사업명>(.*?)<\/사업명>/i) || [])[1];
      const summary = (itemXml.match(/<pblancSumryCn>(.*?)<\/pblancSumryCn>/i) ||
                      itemXml.match(/<bsnsSumryCn>(.*?)<\/bsnsSumryCn>/i) ||
                      itemXml.match(/<summary>(.*?)<\/summary>/i) || [])[1];
      const startDate = (itemXml.match(/<pblancBeginDe>(.*?)<\/pblancBeginDe>/i) ||
                         itemXml.match(/<rceptBeginDe>(.*?)<\/rceptBeginDe>/i) || [])[1];
      const endDate = (itemXml.match(/<pblancEndDe>(.*?)<\/pblancEndDe>/i) ||
                      itemXml.match(/<rceptEndDe>(.*?)<\/rceptEndDe>/i) || [])[1];
      
      if (title) {
        const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
        items.push({
          title: cleanTitle,
          '사업명': cleanTitle,
          pblancNm: cleanTitle,
          pblancNmKr: cleanTitle,
          summary: summary ? summary.replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '',
          '사업개요': summary ? summary.replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '',
          '신청시작일': startDate ? startDate.replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '',
          '신청마감일': endDate ? endDate.replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '',
          rceptBeginDe: startDate ? startDate.replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '',
          rceptEndDe: endDate ? endDate.replace(/<!\[CDATA\[|\]\]>/g, '').trim() : ''
        });
      }
    });
    
    console.log(`✅ 정규식 파싱 완료: ${items.length}개 항목 추출`);
  }
  
  return items;
}

/**
 * RSS 파싱 (간단한 구현)
 */
function parseRSS(xmlData) {
  const items = [];
  const itemMatches = xmlData.match(/<item>[\s\S]*?<\/item>/g) || [];
  
  itemMatches.forEach(itemXml => {
    const title = (itemXml.match(/<title>(.*?)<\/title>/) || [])[1];
    const link = (itemXml.match(/<link>(.*?)<\/link>/) || [])[1];
    const description = (itemXml.match(/<description>(.*?)<\/description>/) || [])[1];
    
    if (title) {
      items.push({
        title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
        link: link?.replace(/<!\[CDATA\[|\]\]>/g, ''),
        description: description?.replace(/<!\[CDATA\[|\]\]>/g, '')
      });
    }
  });
  
  return items;
}

// K-Startup 크롤링 함수 제거 - API 키를 통해서만 데이터 수집

/**
 * 관련 정책 필터링
 */
function isRelevantPolicy(item) {
  const keywords = ['소상공인', '중소기업', '자영업', '창업', '지원금', '보조금', '융자', '바우처'];
  const text = (item.title + ' ' + item.description).toLowerCase();
  return keywords.some(keyword => text.includes(keyword));
}

/**
 * 실시간 크롤링 API
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
    console.log('\n========================================');
    console.log('📥 실제 정책 데이터 수집 요청 수신');
    console.log('📅 요청 시간:', new Date().toISOString());
    console.log('🌍 환경:', process.env.NODE_ENV || 'development');
    console.log('========================================\n');
    
    // 1. 실제 정책 데이터 수집
    const policies = await fetchRealPolicies();
    
    console.log('\n========================================');
    console.log('📤 실제 정책 데이터 수집 완료');
    console.log('📊 최종 수집된 정책 수:', policies.length);
    console.log('========================================\n');
    
    // 2. Supabase에 저장하지 않고 데이터만 반환 (클라이언트에서 저장)
    // 클라이언트에서 중복 체크 및 저장을 처리하도록 변경
    if (req.method === 'POST' && req.body.save) {
      return res.json({
        success: true,
        message: `${policies.length}개의 실제 정책 데이터를 수집했습니다.`,
        count: policies.length,
        data: policies,
        debug: {
          apiKeyLength: process.env.PUBLIC_DATA_KEY?.length || 0,
          apiKeySet: !!process.env.PUBLIC_DATA_KEY,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    // 3. 조회만 하는 경우
    return res.json({
      success: true,
      count: policies.length,
      data: policies,
      debug: {
        apiKeyLength: process.env.PUBLIC_DATA_KEY?.length || 0,
        apiKeySet: !!process.env.PUBLIC_DATA_KEY,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Fetch real policies error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 웹 스크래핑으로 실제 데이터 수집
 * puppeteer 사용 예제
 */
async function scrapeRealPolicies() {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const policies = [];
  
  try {
    // 소상공인마당 접속
    await page.goto('https://www.sbiz.or.kr/sup/cmm/board/viewBoardList.do?board_id=ANNOUNCE');
    await page.waitForSelector('.board_list');
    
    // 공지사항 목록 스크래핑
    const items = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.board_list tbody tr').forEach(row => {
        const title = row.querySelector('.subject a')?.textContent.trim();
        const date = row.querySelector('.date')?.textContent.trim();
        const link = row.querySelector('.subject a')?.href;
        
        if (title) {
          results.push({ title, date, link });
        }
      });
      return results;
    });
    
    // 각 항목 상세 정보 수집
    for (const item of items.slice(0, 10)) { // 최근 10개만
      if (item.link) {
        await page.goto(item.link);
        await page.waitForSelector('.board_view');
        
        const detail = await page.evaluate(() => {
          return {
            content: document.querySelector('.board_view .content')?.textContent.trim(),
            files: Array.from(document.querySelectorAll('.file_list a')).map(a => ({
              name: a.textContent.trim(),
              url: a.href
            }))
          };
        });
        
        policies.push({
          title: item.title,
          organization: '소상공인시장진흥공단',
          category: 'operation',
          summary: detail.content?.substring(0, 200),
          description: detail.content,
          application_url: item.link,
          status: 'active',
          source: 'sbiz.or.kr'
        });
      }
    }
    
  } catch (error) {
    console.error('Scraping error:', error);
  } finally {
    await browser.close();
  }
  
  return policies;
}
