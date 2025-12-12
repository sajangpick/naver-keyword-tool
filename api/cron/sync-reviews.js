// 네이버 스마트플레이스 리뷰 동기화 크론잡
// 10분마다 자동 실행되어 새 리뷰를 가져옵니다

const { createClient } = require('@supabase/supabase-js');
const CryptoJS = require('crypto-js');

// Puppeteer 환경 설정 (Render/Vercel 호환)
const isProduction = process.env.NODE_ENV === 'production';
let chromium, puppeteer;

if (isProduction) {
  // Render/Vercel: @sparticuz/chromium 사용 (경량 Chromium 바이너리)
  chromium = require('@sparticuz/chromium');
  puppeteer = require('puppeteer-core');
} else {
  // 로컬: 일반 puppeteer 사용 (자동 Chrome 다운로드)
  puppeteer = require('puppeteer');
}

// Supabase 클라이언트 초기화
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

// 암호화 키
const ENCRYPTION_KEY = process.env.NAVER_ENCRYPTION_KEY || 'default-key-change-in-production';

// 복호화 함수
function decrypt(encryptedText) {
  const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// 쿠키 문자열을 배열로 변환
function parseCookies(cookieString) {
  try {
    return JSON.parse(cookieString);
  } catch {
    return [];
  }
}

// 리뷰 크롤링 함수
async function crawlReviews(connection) {
  let launchOptions;
  
  if (isProduction) {
    // Render/Vercel: chromium 사용
    const executablePath = await chromium.executablePath();
    launchOptions = {
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      defaultViewport: { width: 1920, height: 1080 },
      executablePath,
      headless: chromium.headless,
    };
  } else {
    // 로컬: 일반 puppeteer
    launchOptions = {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      headless: true,
    };
  }
  
  const browser = await puppeteer.launch(launchOptions);

  const page = await browser.newPage();

  try {
    // 세션 쿠키 설정
    const cookies = parseCookies(connection.session_cookies || '[]');
    if (cookies.length > 0) {
      await page.setCookie(...cookies);
    }

    // 스마트플레이스 리뷰 관리 페이지로 이동
    const reviewUrl = `https://m.place.naver.com/my-place/${connection.place_id}/review`;
    await page.goto(reviewUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 로그인 필요 여부 확인
    const isLoginRequired = await page.evaluate(() => {
      return document.body.textContent.includes('로그인') || 
             document.body.textContent.includes('로그인이 필요');
    });

    if (isLoginRequired) {
      // 로그인 필요 시 재로그인 시도
      const naverId = decrypt(connection.naver_id_encrypted);
      const naverPassword = decrypt(connection.naver_password_encrypted);

      await page.goto('https://nid.naver.com/nidlogin.login', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await page.waitForSelector('#id', { timeout: 10000 });
      await page.type('#id', naverId, { delay: 100 });
      await page.waitForSelector('#pw', { timeout: 10000 });
      await page.type('#pw', naverPassword, { delay: 100 });
      await page.click('#log\\.login');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });

      // 리뷰 페이지로 다시 이동
      await page.goto(reviewUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // 새 쿠키 저장
      const newCookies = await page.cookies();
      await supabase
        .from('naver_place_connections')
        .update({ session_cookies: JSON.stringify(newCookies) })
        .eq('id', connection.id);
    }

    // 리뷰 목록 크롤링
    await page.waitForSelector('.review_list, .review-item, [class*="review"]', {
      timeout: 10000
    }).catch(() => {
      console.log('[크롤링] 리뷰 목록 선택자를 찾을 수 없습니다. 다른 선택자 시도...');
    });

    // 리뷰 데이터 추출
    const reviews = await page.evaluate(() => {
      const reviewElements = document.querySelectorAll('.review_list li, .review-item, [class*="review"]');
      const results = [];

      reviewElements.forEach((element, index) => {
        if (index >= 50) return; // 최대 50개만

        try {
          // 별점 추출
          const ratingElement = element.querySelector('.rating, [class*="star"], [class*="rating"]');
          const rating = ratingElement ? 
            parseInt(ratingElement.textContent.match(/\d/)?.[0] || '5') : 5;

          // 리뷰 내용 추출
          const textElement = element.querySelector('.review_text, .text, [class*="text"]');
          const reviewText = textElement?.textContent?.trim() || '';

          // 작성자명 추출
          const nameElement = element.querySelector('.name, .author, [class*="name"]');
          const reviewerName = nameElement?.textContent?.trim() || '익명';

          // 작성일 추출
          const dateElement = element.querySelector('.date, .time, [class*="date"]');
          const reviewDate = dateElement?.textContent?.trim() || new Date().toISOString();

          // 리뷰 ID 추출 (data 속성 또는 클래스에서)
          const reviewId = element.getAttribute('data-review-id') || 
                          element.id || 
                          `review-${Date.now()}-${index}`;

          if (reviewText) {
            results.push({
              reviewId,
              rating,
              reviewText,
              reviewerName,
              reviewDate
            });
          }
        } catch (error) {
          console.error('리뷰 추출 오류:', error);
        }
      });

      return results;
    });

    await browser.close();

    // 새 리뷰 필터링 (DB에 없는 것만)
    const existingReviewIds = new Set();
    const { data: existingReviews } = await supabase
      .from('naver_reviews')
      .select('naver_review_id')
      .eq('connection_id', connection.id);

    if (existingReviews) {
      existingReviews.forEach(r => existingReviewIds.add(r.naver_review_id));
    }

    const newReviews = reviews.filter(r => !existingReviewIds.has(r.reviewId));

    // 새 리뷰 DB에 저장
    if (newReviews.length > 0) {
      const reviewsToInsert = newReviews.map(review => ({
        connection_id: connection.id,
        user_id: connection.user_id,
        naver_review_id: review.reviewId,
        reviewer_name: review.reviewerName,
        rating: review.rating,
        review_text: review.reviewText,
        review_date: new Date(review.reviewDate).toISOString(),
        reply_status: 'pending'
      }));

      const { error: insertError } = await supabase
        .from('naver_reviews')
        .insert(reviewsToInsert);

      if (insertError) {
        console.error('[크롤링] 리뷰 저장 실패:', insertError);
        throw insertError;
      }
    }

    // 통계 업데이트
    const { count: totalCount } = await supabase
      .from('naver_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connection.id);

    const { count: pendingCount } = await supabase
      .from('naver_reviews')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connection.id)
      .eq('reply_status', 'pending');

    await supabase
      .from('naver_place_connections')
      .update({
        total_reviews: totalCount || 0,
        pending_replies: pendingCount || 0,
        last_sync_at: new Date().toISOString()
      })
      .eq('id', connection.id);

    return {
      success: true,
      newReviewsCount: newReviews.length,
      totalReviewsFound: reviews.length
    };

  } catch (error) {
    await browser.close();
    throw error;
  }
}

module.exports = async (req, res) => {
  try {
    // Vercel Cron Secret 확인 (선택사항)
    const cronSecret = req.headers['authorization'];
    if (process.env.CRON_SECRET && cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    console.log('[크론잡] 네이버 리뷰 동기화 시작');

    // 활성화된 모든 연동 정보 가져오기
    const { data: connections, error } = await supabase
      .from('naver_place_connections')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('[크론잡] 연동 정보 조회 실패:', error);
      return res.status(500).json({
        success: false,
        error: '연동 정보 조회 실패: ' + error.message
      });
    }

    if (!connections || connections.length === 0) {
      console.log('[크론잡] 활성화된 연동이 없습니다');
      return res.json({
        success: true,
        message: '활성화된 연동이 없습니다',
        processed: 0
      });
    }

    // 각 연동마다 크롤링 (배치 처리: 5개씩, 각 요청 사이 2-3초 딜레이)
    const results = [];
    const batchSize = 5;

    for (let i = 0; i < connections.length; i += batchSize) {
      const batch = connections.slice(i, i + batchSize);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (connection) => {
          const startTime = Date.now();
          let logId = null;

          try {
            // 크롤링 로그 시작
            const { data: log } = await supabase
              .from('review_crawl_logs')
              .insert({
                connection_id: connection.id,
                user_id: connection.user_id,
                status: 'processing',
                started_at: new Date().toISOString()
              })
              .select()
              .single();

            logId = log?.id;

            // 크롤링 실행 (최대 3회 재시도)
            let lastError = null;
            for (let retry = 0; retry < 3; retry++) {
              try {
                const result = await crawlReviews(connection);
                
                // 로그 완료
                if (logId) {
                  await supabase
                    .from('review_crawl_logs')
                    .update({
                      status: 'success',
                      new_reviews_count: result.newReviewsCount,
                      total_reviews_found: result.totalReviewsFound,
                      execution_time_ms: Date.now() - startTime,
                      completed_at: new Date().toISOString()
                    })
                    .eq('id', logId);
                }

                return {
                  connectionId: connection.id,
                  placeName: connection.place_name,
                  success: true,
                  ...result
                };
              } catch (error) {
                lastError = error;
                if (retry < 2) {
                  await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기 후 재시도
                }
              }
            }

            throw lastError;

          } catch (error) {
            console.error(`[크론잡] 크롤링 실패 (연동 ID: ${connection.id}):`, error);
            
            // 로그 실패 기록
            if (logId) {
              await supabase
                .from('review_crawl_logs')
                .update({
                  status: 'failed',
                  error_message: error.message,
                  execution_time_ms: Date.now() - startTime,
                  completed_at: new Date().toISOString()
                })
                .eq('id', logId);
            }

            return {
              connectionId: connection.id,
              placeName: connection.place_name,
              success: false,
              error: error.message
            };
          }
        })
      );

      results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : r.reason));

      // 다음 배치 전 대기 (마지막 배치가 아니면)
      if (i + batchSize < connections.length) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3초 대기
      }
    }

    console.log(`[크론잡] 네이버 리뷰 동기화 완료 - 처리: ${results.length}개`);

    res.json({
      success: true,
      message: '리뷰 동기화 완료',
      processed: results.length,
      results
    });

  } catch (error) {
    console.error('[크론잡] 오류:', error);
    res.status(500).json({
      success: false,
      error: '크론잡 실행 중 오류: ' + error.message
    });
  }
};

