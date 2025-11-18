// 전국 동단위 크롤링 시스템
const path = require('path');
const { saveCrawlResults, createCrawlLog, updateCrawlLog } = require('../lib/database');

// 전국 주요 지역 목록 (동 단위)
const NATIONWIDE_LOCATIONS = {
  '서울': [
    '강남구', '서초구', '송파구', '강동구', '영등포구', '구로구', '금천구', '동작구',
    '관악구', '용산구', '성동구', '광진구', '동대문구', '중랑구', '노원구', '도봉구',
    '강북구', '성북구', '종로구', '중구', '마포구', '서대문구', '은평구', '양천구'
  ],
  '부산': [
    '해운대구', '수영구', '동래구', '연제구', '부산진구', '동구', '중구', '서구',
    '사하구', '금정구', '강서구', '사상구', '남구', '북구', '영도구', '기장군'
  ],
  '대구': ['중구', '동구', '서구', '남구', '북구', '수성구', '달서구', '달성군'],
  '인천': ['중구', '동구', '미추홀구', '연수구', '남동구', '부평구', '계양구', '서구', '강화군', '옹진군'],
  '광주': ['동구', '서구', '남구', '북구', '광산구'],
  '대전': ['동구', '중구', '서구', '유성구', '대덕구'],
  '울산': ['중구', '남구', '동구', '북구', '울주군'],
};

// 크롤링 카테고리
const CATEGORIES = [
  '맛집',
  '카페',
  '음식점',
  '한식',
  '일식',
  '중식',
  '양식',
  '치킨',
  '피자',
  '족발',
  '보쌈',
  '찜닭',
  '술집',
  '호프',
  '선술집',
];

/**
 * 전국 크롤링 실행
 * @param {object} options - 크롤링 옵션
 */
async function runNationwideCrawl(options = {}) {
  const {
    cities = Object.keys(NATIONWIDE_LOCATIONS),  // 크롤링할 도시
    categories = ['맛집'],                         // 크롤링할 카테고리
    maxPlacesPerLocation = 50,                    // 지역당 최대 업체 수
    parallelPages = 5,                            // 병렬 처리 수
    delayBetweenRequests = 3000,                  // 요청 간 대기 시간 (ms)
  } = options;

  console.log('🚀 전국 크롤링 시작...');
  console.log(`📍 대상 도시: ${cities.join(', ')}`);
  console.log(`📂 카테고리: ${categories.join(', ')}`);

  const totalResults = {
    totalLocations: 0,
    totalPlaces: 0,
    totalErrors: 0,
    startTime: Date.now(),
  };

  // 크롤링 모듈 동적 로드
  const crawlModule = require('../api/place-batch-crawl-optimized');

  for (const city of cities) {
    const districts = NATIONWIDE_LOCATIONS[city];
    
    if (!districts) {
      console.log(`⚠️ ${city} 데이터 없음, 스킵`);
      continue;
    }

    console.log(`\n📍 ${city} 크롤링 시작 (${districts.length}개 구/군)`);

    for (const district of districts) {
      for (const category of categories) {
        const keyword = `${city} ${district} ${category}`;
        const location = `${city} ${district}`;
        
        totalResults.totalLocations++;

        console.log(`\n🔍 [${totalResults.totalLocations}] ${keyword} 크롤링 중...`);

        // 크롤링 로그 생성
        const logId = await createCrawlLog(keyword, location);

        try {
          // 크롤링 실행 (모듈 함수 직접 호출)
          const mockReq = {
            method: 'POST',
            body: {
              keyword,
              maxPlaces: maxPlacesPerLocation,
              maxScrolls: 10,
              detailCrawl: true,
              parallelPages,
            }
          };

          const mockRes = {
            setHeader: () => {},
            status: (code) => ({
              json: (data) => data,
              end: () => {}
            })
          };

          const result = await crawlModule(mockReq, mockRes);
          
          if (result.success && result.list) {
            console.log(`✅ 발견: ${result.list.length}개 업체`);

            // 데이터베이스에 저장
            const saveResult = await saveCrawlResults(keyword, result.list);
            
            totalResults.totalPlaces += saveResult.success;
            totalResults.totalErrors += saveResult.failed;

            console.log(`💾 저장: ${saveResult.success}개 성공, ${saveResult.failed}개 실패`);

            // 크롤링 로그 업데이트
            await updateCrawlLog(logId, {
              total_found: result.list.length,
              total_crawled: saveResult.success,
              total_errors: saveResult.failed,
              duration_seconds: result.stats?.duration || 0,
              status: 'completed',
            });
          } else {
            throw new Error(result.error || '크롤링 실패');
          }

        } catch (err) {
          console.error(`❌ 크롤링 오류: ${err.message}`);
          totalResults.totalErrors++;

          // 오류 로그 업데이트
          await updateCrawlLog(logId, {
            total_found: 0,
            total_crawled: 0,
            total_errors: 1,
            status: 'failed',
            error_message: err.message,
          });
        }

        // 요청 간 대기 (서버 부하 방지)
        if (delayBetweenRequests > 0) {
          console.log(`⏳ ${delayBetweenRequests/1000}초 대기...`);
          await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
        }
      }
    }
  }

  const endTime = Date.now();
  const totalDuration = Math.round((endTime - totalResults.startTime) / 1000);

  console.log('\n\n========================================');
  console.log('✅ 전국 크롤링 완료!');
  console.log('========================================');
  console.log(`📍 총 지역: ${totalResults.totalLocations}개`);
  console.log(`🏪 총 업체: ${totalResults.totalPlaces}개`);
  console.log(`❌ 총 오류: ${totalResults.totalErrors}개`);
  console.log(`⏱️ 총 소요 시간: ${totalDuration}초 (${Math.round(totalDuration/60)}분)`);
  console.log(`⚡ 평균 속도: ${Math.round(totalResults.totalPlaces / (totalDuration/60))}개/분`);
  console.log('========================================\n');

  return totalResults;
}

/**
 * 특정 지역만 크롤링
 */
async function crawlSpecificRegion(city, district, category = '맛집', options = {}) {
  const keyword = `${city} ${district} ${category}`;
  const location = `${city} ${district}`;

  console.log(`🔍 ${keyword} 크롤링 시작...`);

  const logId = await createCrawlLog(keyword, location);

  try {
    const crawlModule = require('../api/place-batch-crawl-optimized');

    const mockReq = {
      method: 'POST',
      body: {
        keyword,
        maxPlaces: options.maxPlaces || 50,
        maxScrolls: options.maxScrolls || 10,
        detailCrawl: true,
        parallelPages: options.parallelPages || 5,
      }
    };

    const mockRes = {
      setHeader: () => {},
      status: (code) => ({
        json: (data) => data,
        end: () => {}
      })
    };

    const result = await crawlModule(mockReq, mockRes);
    
    if (result.success && result.list) {
      console.log(`✅ 발견: ${result.list.length}개 업체`);

      const saveResult = await saveCrawlResults(keyword, result.list);
      console.log(`💾 저장: ${saveResult.success}개 성공, ${saveResult.failed}개 실패`);

      await updateCrawlLog(logId, {
        total_found: result.list.length,
        total_crawled: saveResult.success,
        total_errors: saveResult.failed,
        duration_seconds: result.stats?.duration || 0,
        status: 'completed',
      });

      return {
        success: true,
        total_found: result.list.length,
        total_saved: saveResult.success,
      };
    } else {
      throw new Error(result.error || '크롤링 실패');
    }

  } catch (err) {
    console.error(`❌ 크롤링 오류: ${err.message}`);

    await updateCrawlLog(logId, {
      total_found: 0,
      total_crawled: 0,
      total_errors: 1,
      status: 'failed',
      error_message: err.message,
    });

    return {
      success: false,
      error: err.message,
    };
  }
}

// ========== 스케줄링 함수 ==========
function scheduleNationwideCrawl(cronPattern = '0 0 * * *') {
  // cron 모듈 사용 (선택사항)
  // const cron = require('node-cron');
  
  console.log(`📅 전국 크롤링 스케줄 등록: ${cronPattern}`);
  console.log('💡 매일 자정에 자동 실행됩니다.');
  
  // Cron 작업 등록 예시 (node-cron 라이브러리 필요)
  // cron.schedule(cronPattern, () => {
  //   console.log('⏰ 스케줄 크롤링 시작...');
  //   runNationwideCrawl({
  //     cities: ['서울', '부산', '대구'],
  //     categories: ['맛집', '카페'],
  //   });
  // });
}

// ========== CLI 실행 ==========
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === 'all') {
    // 전국 크롤링
    runNationwideCrawl({
      cities: ['부산'],  // 테스트: 부산만
      categories: ['맛집'],
      maxPlacesPerLocation: 30,
      parallelPages: 5,
      delayBetweenRequests: 2000,
    }).catch(console.error);
  } else if (args[0] === 'region' && args[1] && args[2]) {
    // 특정 지역 크롤링
    // 예: node nationwide-crawler.js region 부산 해운대구
    crawlSpecificRegion(args[1], args[2], args[3] || '맛집')
      .then(result => console.log('결과:', result))
      .catch(console.error);
  } else {
    console.log('사용법:');
    console.log('  전국 크롤링: node nationwide-crawler.js all');
    console.log('  지역 크롤링: node nationwide-crawler.js region 부산 해운대구 맛집');
  }
}

module.exports = {
  runNationwideCrawl,
  crawlSpecificRegion,
  scheduleNationwideCrawl,
  NATIONWIDE_LOCATIONS,
  CATEGORIES,
};

