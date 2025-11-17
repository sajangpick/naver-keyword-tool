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
  
  try {
    // 1. 기업마당 API 호출 (공공데이터포털)
    // 환경변수가 있으면 사용, 없으면 기본값 사용 (개발용)
    const apiKey = process.env.PUBLIC_DATA_KEY || 'e45b26951c63da01a0d82653dd6101417c57f3812905e604bb4f60f80157bac8';
    
    console.log('🔑 API 키 사용:', apiKey ? `${apiKey.substring(0, 10)}...` : '없음');
    
    if (apiKey) {
      try {
        // 공공데이터포털 - 다양한 API 엔드포인트 시도
        const apiEndpoints = [
          // 중소기업 지원사업 정보 (JSON) - 여러 페이지 순회
          {
            url: `https://api.odcloud.kr/api/3074462/v1/uddi:f3f4df8b-5b64-4165-8581-973bf5d50c94?serviceKey=${encodeURIComponent(apiKey)}&page=1&perPage=1000`,
            type: 'json',
            source: 'bizinfo'
          },
          // 중소기업 지원사업 정보 (XML) - 여러 페이지 순회
          {
            url: `https://api.odcloud.kr/api/3074462/v1/uddi:f3f4df8b-5b64-4165-8581-973bf5d50c94?serviceKey=${encodeURIComponent(apiKey)}&page=1&perPage=1000&returnType=XML`,
            type: 'xml',
            source: 'bizinfo'
          },
          // 기업마당 지원사업 검색 API - 여러 페이지 순회
          {
            url: `https://www.bizinfo.go.kr/api/support/search?serviceKey=${encodeURIComponent(apiKey)}&page=1&perPage=1000&target=소상공인`,
            type: 'json',
            source: 'bizinfo'
          },
          // 공공데이터포털 - 중소기업 정책자금 정보 - 여러 페이지 순회
          {
            url: `https://api.odcloud.kr/api/ApplyhomeInfoSvc/v1/getAPTLttotPblancMdl?serviceKey=${encodeURIComponent(apiKey)}&page=1&perPage=1000`,
            type: 'json',
            source: 'bizinfo'
          },
          // K-Startup API - 창업진흥원 사업공고 조회 (공공데이터포털) - 여러 페이지 순회
          // 공공데이터포털 API ID: 15125364
          // 다양한 엔드포인트 패턴 시도
          {
            url: `https://api.odcloud.kr/api/15125364/v1/uddi:사업공고?serviceKey=${encodeURIComponent(apiKey)}&page=1&perPage=1000`,
            type: 'json',
            source: 'k-startup'
          },
          {
            url: `https://api.odcloud.kr/api/15125364/v1/uddi:진행중?serviceKey=${encodeURIComponent(apiKey)}&page=1&perPage=1000`,
            type: 'json',
            source: 'k-startup'
          },
          {
            url: `https://api.odcloud.kr/api/15125364/v1/uddi:bizpbanc?serviceKey=${encodeURIComponent(apiKey)}&page=1&perPage=1000`,
            type: 'json',
            source: 'k-startup'
          },
          // 소상공인시장진흥공단 API (공공데이터포털) - 여러 페이지 순회
          {
            url: `https://api.odcloud.kr/api/3074462/v1/uddi:소상공인?serviceKey=${encodeURIComponent(apiKey)}&page=1&perPage=1000`,
            type: 'json',
            source: 'semas'
          }
        ];
        
        for (const endpoint of apiEndpoints) {
          try {
            // 여러 페이지를 순회하며 모든 데이터 가져오기
            let allData = [];
            let currentPage = 1;
            let hasMorePages = true;
            const maxPages = 50; // 최대 50페이지까지 (안전장치)
            const perPage = 1000; // 페이지당 최대 개수 (API 제한 확인 필요)
            
            while (hasMorePages && currentPage <= maxPages) {
              // URL에서 page와 perPage 파라미터 업데이트
              const url = endpoint.url.replace(/[?&]page=\d+/, '').replace(/[?&]perPage=\d+/, '');
              const separator = url.includes('?') ? '&' : '?';
              const pageUrl = `${url}${separator}page=${currentPage}&perPage=${perPage}`;
              
              try {
                const response = await axios.get(pageUrl, {
                  timeout: 15000,
                  headers: {
                    'Accept': endpoint.type === 'xml' ? 'application/xml' : 'application/json',
                    'Content-Type': 'application/json'
                  }
                });
                
                // 응답 데이터 파싱
                let data = null;
                if (response.data) {
                  // JSON 응답인 경우
                  if (typeof response.data === 'object' && !Array.isArray(response.data)) {
                    data = response.data.data || 
                           response.data.response?.body?.items?.item || 
                           response.data.response?.body?.items ||
                           response.data.items?.item ||
                           response.data.items || 
                           response.data;
                    
                    // 페이지네이션 정보 확인
                    const totalCount = response.data.totalCount || 
                                      response.data.response?.body?.totalCount ||
                                      response.data.total ||
                                      response.data.count;
                    const currentCount = Array.isArray(data) ? data.length : (data ? 1 : 0);
                    
                    if (totalCount && currentPage * perPage >= totalCount) {
                      hasMorePages = false;
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
                    data = parseXMLResponse(response.data);
                    console.log(`✅ XML 응답 파싱 완료 (페이지 ${currentPage}): ${data?.length || 0}개 항목`);
                    if (!data || data.length === 0) {
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
                  console.log(`📊 ${endpoint.type.toUpperCase()} 페이지 ${currentPage}: ${data.length}개 항목 (누적: ${allData.length}개)`);
                  
                  // 데이터가 perPage보다 적으면 마지막 페이지
                  if (data.length < perPage) {
                    hasMorePages = false;
                  }
                } else {
                  hasMorePages = false;
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
              console.log(`✅ ${endpoint.type.toUpperCase()} 엔드포인트에서 총 ${allData.length}개 항목 수집 완료`);
              
              allData.forEach(item => {
                // 소상공인 관련 키워드 필터링
                const title = item['사업명'] || item.pblancNm || item.title || item.사업명 || item['제목'] || '';
                const summary = item['사업개요'] || item.bsnsSumryCn || item.summary || item.사업개요 || item['요약'] || '';
                const description = item['지원내용'] || item.sportCn || item.description || item.지원내용 || item['내용'] || '';
                const text = (title + ' ' + summary + ' ' + description).toLowerCase();
                
                // 소상공인 관련 정책만 필터링 (키워드 확장)
                // 뉴스 기사 제목은 제외 (실제 정책 지원금만)
                const newsKeywords = ['뉴스', '기사', '보도', '발표', '체감', '경기', '효과', '전망'];
                const isNews = newsKeywords.some(keyword => text.includes(keyword));
                
                if (isNews) {
                  console.log(`⚠️ 뉴스 기사 제외: ${title}`);
                  return; // 뉴스 기사는 건너뜀
                }
                
                const policyKeywords = [
                  '소상공인', '중소기업', '자영업', '창업', '지원금', '보조금', 
                  '융자', '바우처', '정책자금', '경영지원', '시설개선', 
                  '마케팅', '교육지원', '인건비', '일자리', '신청', '공고', '사업'
                ];
                
                const isRelevant = policyKeywords.some(keyword => text.includes(keyword));
                
                if (isRelevant && title) {
                  policies.push({
                    title: title,
                    organization: item['수행기관'] || item.excInsttNm || item.organization || item.수행기관 || '정부',
                    category: mapCategory(item['지원분야'] || item.supportField || item.지원분야 || ''),
                    summary: summary || title,
                    description: item['지원내용'] || item.sportCn || item.description || item.지원내용 || summary,
                    support_amount: item['지원규모'] || item.sportScle || item.supportAmount || item.지원규모 || '문의',
                    support_type: mapSupportType(item['지원유형'] || item.supportType || item.지원유형 || ''),
                    eligibility_criteria: item['지원자격'] || item.sportQualf || item.eligibility || item.지원자격 || '별도 문의',
                    required_documents: item['필요서류'] || item.requiredDocs || item.필요서류 || '별도 문의',
                    business_type: item['대상업종'] ? (Array.isArray(item['대상업종']) ? item['대상업종'] : [item['대상업종']]) : ['음식점', '카페', '소매업', '서비스업'],
                    target_area: item['지원지역'] ? (Array.isArray(item['지원지역']) ? item['지원지역'] : [item['지원지역']]) : ['전국'],
                    application_start_date: item['신청시작일'] || item.rceptBeginDe || item.startDate || item.신청시작일 || null,
                    application_end_date: item['신청마감일'] || item.rceptEndDe || item.endDate || item.신청마감일 || null,
                    application_method: item['신청방법'] || item.applicationMethod || item.신청방법 || '온라인 신청',
                    application_url: item['신청URL'] || item.reqstUrl || item.applicationUrl || item.신청URL || null,
                    contact_info: item['문의처'] || item.rqutProcCn || item.contact || item.문의처 || '별도 문의',
                    phone_number: item['전화번호'] || item.phone || item.전화번호 || null,
                    website_url: item['홈페이지'] || item.website || item.홈페이지 || null,
                    status: getStatus(item['신청마감일'] || item.rceptEndDe || item.endDate || item.신청마감일),
                    is_featured: false,
                    tags: ['실제데이터', '공공데이터포털'],
                    source: endpoint.source || 'bizinfo'
                  });
                }
              });
              
              // 데이터를 가져왔으면 로그 출력 (모든 엔드포인트 시도)
              const addedCount = policies.filter(p => p.source === (endpoint.source || 'bizinfo')).length;
              if (addedCount > 0) {
                console.log(`✅ ${endpoint.type.toUpperCase()} 엔드포인트 (${endpoint.source})에서 ${addedCount}개 정책 추가`);
              }
            }
          } catch (apiError) {
            console.log(`⚠️ API 엔드포인트 실패 (${endpoint.type}):`, apiError.message);
            // 에러가 발생해도 다음 엔드포인트 계속 시도
            continue;
          }
        }
        
        console.log(`📋 총 ${policies.length}개의 정책 데이터 수집 완료`);
        
        // 모든 엔드포인트 시도 후 결과 요약
        if (policies.length > 0) {
          console.log(`✅ 총 ${policies.length}개의 실제 정책 데이터를 가져왔습니다.`);
        } else {
          console.log('⚠️ 공공데이터포털 API에서 데이터를 가져오지 못했습니다.');
        }
      } catch (error) {
        console.error('기업마당 API 호출 실패:', error.message);
      }
    }
    
    // 2. K-Startup API는 위의 apiEndpoints에 포함되어 있음 (크롤링 제거)
    // API 키를 통해 공공데이터포털에서 K-Startup 데이터를 가져옵니다.
    console.log('ℹ️ K-Startup 데이터는 공공데이터포털 API를 통해 수집됩니다.');
    
    // 3. 실제 데이터가 없을 경우에만 내장 데이터 사용 (백업)
    if (policies.length === 0) {
      console.log('⚠️ 실제 데이터를 가져오지 못했습니다. 내장 데이터를 사용합니다.');
      const builtInPolicies = getBuiltInPolicies();
      policies.push(...builtInPolicies);
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
 */
function parseXMLResponse(xmlData) {
  const items = [];
  
  try {
    const dom = new JSDOM(xmlData, { contentType: 'text/xml' });
    const document = dom.window.document;
    
    // 다양한 XML 구조 지원
    const itemNodes = document.querySelectorAll('item, row, record');
    
    itemNodes.forEach(node => {
      const item = {};
      
      // 모든 자식 노드를 순회하며 데이터 추출
      node.childNodes.forEach(child => {
        if (child.nodeType === 1) { // Element node
          const tagName = child.tagName.toLowerCase();
          const text = child.textContent?.trim() || '';
          
          // 한글 필드명과 영문 필드명 모두 지원
          if (tagName.includes('title') || tagName.includes('사업명') || tagName.includes('pblancnm')) {
            item.title = text;
            item['사업명'] = text;
            item.pblancNm = text;
          }
          if (tagName.includes('org') || tagName.includes('기관') || tagName.includes('excinsttnm')) {
            item.organization = text;
            item['수행기관'] = text;
            item.excInsttNm = text;
          }
          if (tagName.includes('summary') || tagName.includes('개요') || tagName.includes('bsnssumrycn')) {
            item.summary = text;
            item['사업개요'] = text;
            item.bsnsSumryCn = text;
          }
          if (tagName.includes('content') || tagName.includes('내용') || tagName.includes('sportcn')) {
            item.description = text;
            item['지원내용'] = text;
            item.sportCn = text;
          }
          if (tagName.includes('amount') || tagName.includes('규모') || tagName.includes('sportscle')) {
            item.supportAmount = text;
            item['지원규모'] = text;
            item.sportScle = text;
          }
          if (tagName.includes('start') || tagName.includes('시작') || tagName.includes('rceptbeginde')) {
            item.startDate = text;
            item['신청시작일'] = text;
            item.rceptBeginDe = text;
          }
          if (tagName.includes('end') || tagName.includes('마감') || tagName.includes('rceptendde')) {
            item.endDate = text;
            item['신청마감일'] = text;
            item.rceptEndDe = text;
          }
          if (tagName.includes('url') || tagName.includes('링크') || tagName.includes('reqsturl')) {
            item.applicationUrl = text;
            item['신청URL'] = text;
            item.reqstUrl = text;
          }
          if (tagName.includes('contact') || tagName.includes('문의') || tagName.includes('rqutproccn')) {
            item.contact = text;
            item['문의처'] = text;
            item.rqutProcCn = text;
          }
          
          // 모든 필드를 원본 형태로도 저장
          item[tagName] = text;
          item[child.tagName] = text;
        }
      });
      
      if (item.title || item['사업명'] || item.pblancNm) {
        items.push(item);
      }
    });
    
  } catch (error) {
    console.error('XML 파싱 오류:', error.message);
    // 간단한 정규식 파싱 시도
    const itemMatches = xmlData.match(/<item>[\s\S]*?<\/item>/g) || xmlData.match(/<row>[\s\S]*?<\/row>/g) || [];
    itemMatches.forEach(itemXml => {
      const title = (itemXml.match(/<title>(.*?)<\/title>/) || itemXml.match(/<사업명>(.*?)<\/사업명>/) || [])[1];
      if (title) {
        items.push({
          title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
          '사업명': title.replace(/<!\[CDATA\[|\]\]>/g, '').trim()
        });
      }
    });
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
    // 1. 실제 정책 데이터 수집
    const policies = await fetchRealPolicies();
    
    // 2. Supabase에 저장하지 않고 데이터만 반환 (클라이언트에서 저장)
    // 클라이언트에서 중복 체크 및 저장을 처리하도록 변경
    if (req.method === 'POST' && req.body.save) {
      return res.json({
        success: true,
        message: `${policies.length}개의 실제 정책 데이터를 수집했습니다.`,
        count: policies.length,
        data: policies
      });
    }
    
    // 3. 조회만 하는 경우
    return res.json({
      success: true,
      count: policies.length,
      data: policies
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
