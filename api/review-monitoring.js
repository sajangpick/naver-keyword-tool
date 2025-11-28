/**
 * 리뷰 모니터링 자동 크롤링 API
 * 
 * 기능:
 * 1. 등록된 모든 플레이스 크롤링
 * 2. 새 리뷰 감지 (DB와 비교)
 * 3. 긴급 리뷰 판별 (1-2점)
 * 4. 카카오톡 알림 발송
 */

const { createClient } = require('@supabase/supabase-js');
const { sendUrgentReviewAlert, sendHighRatingAlert } = require('./kakao-alimtalk');

// Puppeteer 설정 (환경별)
const isProduction = process.env.NODE_ENV === "production";

let chromium, puppeteer;
if (isProduction) {
    // Render/Vercel: @sparticuz/chromium 사용
    chromium = require("@sparticuz/chromium");
    puppeteer = require("puppeteer-core");
} else {
    // 로컬: 일반 puppeteer 사용
    puppeteer = require("puppeteer");
}

// Supabase 클라이언트
let supabase = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

/**
 * 플레이스 ID 추출
 */
function extractPlaceId(url) {
    if (!url) return null;
    
    // https://m.place.naver.com/restaurant/1234567890
    // https://map.naver.com/v5/entry/place/1234567890
    const patterns = [
        /\/restaurant\/(\d+)/,
        /\/place\/(\d+)/,
        /\/entry\/place\/(\d+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    return null;
}

/**
 * 네이버 플레이스 리뷰 크롤링 (4종 전체)
 * @param {string} placeUrl - 플레이스 URL
 * @param {boolean} isFirstCrawl - 최초 크롤링 여부 (true면 알림 안 보냄)
 */
async function crawlPlaceReviews(placeUrl, isFirstCrawl = false) {
    let browser = null;
    
    try {
        console.log(`[크롤링 시작] ${placeUrl} (최초: ${isFirstCrawl})`);
        
        // 플레이스 ID 추출
        const placeId = extractPlaceId(placeUrl);
        if (!placeId) {
            throw new Error('유효하지 않은 플레이스 URL');
        }
        
        // 브라우저 실행
        let launchOptions;
        if (isProduction) {
            // Render/Vercel: chromium 사용
            const executablePath = await chromium.executablePath();
            launchOptions = {
                args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
                defaultViewport: { width: 412, height: 915 },
                executablePath,
                headless: chromium.headless,
            };
        } else {
            // 로컬: 일반 puppeteer
            launchOptions = {
                args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
                defaultViewport: { width: 412, height: 915 },
                headless: true,
            };
        }
        
        browser = await puppeteer.launch(launchOptions);
        const page = await browser.newPage();
        await page.setUserAgent(
            'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
        );
        page.setDefaultTimeout(30000);
        
        // 4종 크롤링 (실패해도 계속 진행)
        const allReviews = [];
        
        // 1. 방문자 리뷰
        try {
            const visitorReviews = await crawlVisitorReviews(page, placeId);
            allReviews.push(...visitorReviews);
            console.log(`✅ 방문자 리뷰: ${visitorReviews.length}개`);
        } catch (error) {
            console.error('❌ 방문자 리뷰 크롤링 실패:', error.message);
        }
        
        // 2. 블로그 리뷰
        try {
            const blogReviews = await crawlBlogReviews(page, placeId);
            allReviews.push(...blogReviews);
            console.log(`✅ 블로그 리뷰: ${blogReviews.length}개`);
        } catch (error) {
            console.error('❌ 블로그 리뷰 크롤링 실패:', error.message);
        }
        
        // 3. 영수증 리뷰
        try {
            const receiptReviews = await crawlReceiptReviews(page, placeId);
            allReviews.push(...receiptReviews);
            console.log(`✅ 영수증 리뷰: ${receiptReviews.length}개`);
        } catch (error) {
            console.error('❌ 영수증 리뷰 크롤링 실패:', error.message);
        }
        
        // 4. 새소식
        try {
            const news = await crawlPlaceNews(page, placeId);
            allReviews.push(...news);
            console.log(`✅ 새소식: ${news.length}개`);
        } catch (error) {
            console.error('❌ 새소식 크롤링 실패:', error.message);
        }
        
        console.log(`[크롤링 완료] 총 ${allReviews.length}개 수집`);
        
        return {
            success: true,
            reviews: allReviews,
            total: allReviews.length,
            isFirstCrawl
        };
        
    } catch (error) {
        console.error('[크롤링 실패]', error);
        return {
            success: false,
            error: error.message,
            reviews: [],
            isFirstCrawl
        };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * 1. 방문자 리뷰 크롤링
 */
async function crawlVisitorReviews(page, placeId) {
    try {
        const url = `https://m.place.naver.com/restaurant/${placeId}/review/visitor`;
        console.log('[방문자 리뷰 크롤링]', url);
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const reviews = await page.evaluate((pid) => {
            const items = document.querySelectorAll('.list_review > li, .place_section_content li, .YeINN');
            const results = [];
            
            items.forEach((el, index) => {
                try {
                    // 평점
                    const stars = el.querySelectorAll('.star_score .star_fill, .rating_star.active, .c-stars__item.active');
                    const rating = stars ? stars.length : 0;
                    
                    // 내용
                    const contentEl = el.querySelector('.review_text, .review_content, .place_section_content, .zPfVt');
                    const content = contentEl ? contentEl.textContent.trim() : '';
                    
                    // 작성자
                    const authorEl = el.querySelector('.reviewer_name, .user_name, .YzBgS');
                    const reviewer_name = authorEl ? authorEl.textContent.trim() : '익명';
                    
                    // 날짜
                    const timeEl = el.querySelector('.review_time, .date, .time');
                    const timeText = timeEl ? timeEl.textContent.trim() : '';
                    
                    if (content && content.length > 5) {
                        results.push({
                            type: 'visitor',
                            external_id: `visitor_${pid}_${Date.now()}_${index}`,
                            rating: rating || 0,
                            content: content.substring(0, 500),
                            reviewer_name: reviewer_name || '익명',
                            reviewed_at: new Date().toISOString()
                        });
                    }
                } catch (err) {
                    console.error('파싱 오류:', err);
                }
            });
            
            return results;
        }, placeId);
        
        console.log(`[방문자 리뷰] ${reviews.length}개 수집`);
        return reviews;
        
    } catch (error) {
        console.error('[방문자 리뷰 크롤링 실패]', error);
        return [];
    }
}

/**
 * 2. 블로그 리뷰 크롤링
 */
async function crawlBlogReviews(page, placeId) {
    try {
        const url = `https://m.place.naver.com/restaurant/${placeId}/review/ugc`;
        console.log('[블로그 리뷰 크롤링]', url);
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const reviews = await page.evaluate((pid) => {
            const items = document.querySelectorAll('.list_review > li, .place_section_content .item, .UORsJ');
            const results = [];
            
            items.forEach((el, index) => {
                try {
                    // 블로그는 평점 없음
                    const rating = 0;
                    
                    // 내용
                    const contentEl = el.querySelector('.review_text, .content, .zPfVt');
                    const content = contentEl ? contentEl.textContent.trim() : '';
                    
                    // 작성자 (블로그 제목)
                    const titleEl = el.querySelector('.title, .blog_title, .YzBgS');
                    const reviewer_name = titleEl ? titleEl.textContent.trim() : '블로그';
                    
                    if (content && content.length > 10) {
                        results.push({
                            type: 'blog',
                            external_id: `blog_${pid}_${Date.now()}_${index}`,
                            rating: 0,
                            content: content.substring(0, 500),
                            reviewer_name: reviewer_name || '블로그',
                            reviewed_at: new Date().toISOString()
                        });
                    }
                } catch (err) {
                    console.error('파싱 오류:', err);
                }
            });
            
            return results;
        }, placeId);
        
        console.log(`[블로그 리뷰] ${reviews.length}개 수집`);
        return reviews;
        
    } catch (error) {
        console.error('[블로그 리뷰 크롤링 실패]', error);
        return [];
    }
}

/**
 * 3. 영수증 리뷰 크롤링
 */
async function crawlReceiptReviews(page, placeId) {
    try {
        const url = `https://m.place.naver.com/restaurant/${placeId}/review/receipt`;
        console.log('[영수증 리뷰 크롤링]', url);
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const reviews = await page.evaluate((pid) => {
            const items = document.querySelectorAll('.list_review > li, .place_section_content li, .YeINN');
            const results = [];
            
            items.forEach((el, index) => {
                try {
                    // 평점
                    const stars = el.querySelectorAll('.star_score .star_fill, .c-stars__item.active');
                    const rating = stars ? stars.length : 0;
                    
                    // 내용
                    const contentEl = el.querySelector('.review_text, .content, .zPfVt');
                    const content = contentEl ? contentEl.textContent.trim() : '';
                    
                    // 작성자
                    const authorEl = el.querySelector('.reviewer_name, .user, .YzBgS');
                    const reviewer_name = authorEl ? authorEl.textContent.trim() : '영수증리뷰';
                    
                    if (content && content.length > 5) {
                        results.push({
                            type: 'receipt',
                            external_id: `receipt_${pid}_${Date.now()}_${index}`,
                            rating: rating || 0,
                            content: content.substring(0, 500),
                            reviewer_name: reviewer_name || '영수증리뷰',
                            reviewed_at: new Date().toISOString()
                        });
                    }
                } catch (err) {
                    console.error('파싱 오류:', err);
                }
            });
            
            return results;
        }, placeId);
        
        console.log(`[영수증 리뷰] ${reviews.length}개 수집`);
        return reviews;
        
    } catch (error) {
        console.error('[영수증 리뷰 크롤링 실패]', error);
        return [];
    }
}

/**
 * 4. 새소식 크롤링
 */
async function crawlPlaceNews(page, placeId) {
    try {
        const url = `https://m.place.naver.com/restaurant/${placeId}/feed`;
        console.log('[새소식 크롤링]', url);
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const news = await page.evaluate((pid) => {
            const items = document.querySelectorAll('.place_section_content .item, .feed_item, .UORsJ');
            const results = [];
            
            items.forEach((el, index) => {
                try {
                    // 새소식은 평점 없음
                    const rating = 0;
                    
                    // 내용
                    const contentEl = el.querySelector('.text, .content, .zPfVt');
                    const content = contentEl ? contentEl.textContent.trim() : '';
                    
                    if (content && content.length > 10) {
                        results.push({
                            type: 'news',
                            external_id: `news_${pid}_${Date.now()}_${index}`,
                            rating: 0,
                            content: content.substring(0, 500),
                            reviewer_name: '사장님',
                            reviewed_at: new Date().toISOString()
                        });
                    }
                } catch (err) {
                    console.error('파싱 오류:', err);
                }
            });
            
            return results;
        }, placeId);
        
        console.log(`[새소식] ${news.length}개 수집`);
        return news;
        
    } catch (error) {
        console.error('[새소식 크롤링 실패]', error);
        return [];
    }
}

/**
 * 새 리뷰 필터링 (DB에 없는 것만)
 */
async function filterNewReviews(monitoringId, reviews) {
    if (!reviews || reviews.length === 0) return [];
    
    try {
        // DB에서 기존 리뷰 ID 목록 가져오기
        const { data: existingAlerts } = await supabase
            .from('review_alerts')
            .select('review_external_id')
            .eq('monitoring_id', monitoringId);
        
        const existingIds = new Set(
            (existingAlerts || []).map(a => a.review_external_id)
        );
        
        // 새로운 리뷰만 필터링
        const newReviews = reviews.filter(r => !existingIds.has(r.external_id));
        
        console.log(`[새 리뷰] 전체: ${reviews.length}, 신규: ${newReviews.length}`);
        
        return newReviews;
        
    } catch (error) {
        console.error('[새 리뷰 필터링 실패]', error);
        return reviews; // 에러 시 전체 반환
    }
}

/**
 * 키워드 감지
 */
function detectKeywords(content, keywords) {
    if (!keywords || keywords.length === 0) return [];
    
    const detected = [];
    for (const keyword of keywords) {
        if (content.includes(keyword)) {
            detected.push(keyword);
        }
    }
    return detected;
}

/**
 * 리뷰 저장 및 알림 발송
 * @param {boolean} skipAlert - true면 알림 발송 건너뜀 (최초 크롤링)
 */
async function processNewReview(userId, monitoringId, monitoring, review, skipAlert = false) {
    try {
        // 긴급 여부 판별
        const isUrgent = review.rating <= 2;
        const isHighRating = review.rating === 5;
        
        // 키워드 감지
        const detectedKeywords = monitoring.alert_keywords 
            ? detectKeywords(review.content, monitoring.alert_keywords)
            : [];
        
        // 감정 분석 (간단)
        const sentiment = review.rating >= 4 ? 'positive' 
                        : review.rating <= 2 ? 'negative' 
                        : 'neutral';
        
        // DB에 저장
        const { data: alert, error } = await supabase
            .from('review_alerts')
            .insert({
                user_id: userId,
                monitoring_id: monitoringId,
                review_type: review.type,
                review_external_id: review.external_id,
                rating: review.rating,
                content: review.content,
                reviewer_name: review.reviewer_name,
                reviewed_at: review.reviewed_at,
                is_urgent: isUrgent,
                detected_keywords: detectedKeywords,
                sentiment: sentiment
            })
            .select()
            .single();
        
        if (error) {
            console.error('[리뷰 저장 실패]', error);
            return { success: false, error: error.message };
        }
        
        console.log('[리뷰 저장 완료]', alert.id);
        
        // 알림 발송 조건 체크
        let shouldSendAlert = false;
        
        if (isUrgent && monitoring.alert_on_low_rating) {
            shouldSendAlert = true;
            console.log('[긴급 알림 발송 예정]', review.rating + '점');
        } else if (isHighRating && monitoring.alert_on_high_rating) {
            shouldSendAlert = true;
            console.log('[고평점 알림 발송 예정]', review.rating + '점');
        } else if (detectedKeywords.length > 0 && monitoring.alert_on_keywords) {
            shouldSendAlert = true;
            console.log('[키워드 감지 알림 발송 예정]', detectedKeywords);
        }
        
        // 카카오톡 알림 발송 (skipAlert이면 건너뜀)
        if (shouldSendAlert && !skipAlert) {
            const alertData = {
                id: alert.id,
                place_name: monitoring.place_name || '내 가게',
                place_url: monitoring.place_url,
                rating: review.rating,
                content: review.content,
                reviewer_name: review.reviewer_name,
                reviewed_at: review.reviewed_at
            };
            
            if (isUrgent) {
                await sendUrgentReviewAlert(userId, alertData);
            } else if (isHighRating) {
                await sendHighRatingAlert(userId, alertData);
            }
        }
        
        if (skipAlert) {
            console.log('[알림 건너뜀] 최초 크롤링');
        }
        
        return { success: true, alert };
        
    } catch (error) {
        console.error('[리뷰 처리 실패]', error);
        return { success: false, error: error.message };
    }
}

/**
 * 단일 모니터링 크롤링 실행
 */
async function crawlSingleMonitoring(monitoring) {
    const startTime = Date.now();
    
    try {
        console.log(`\n[크롤링 시작] ${monitoring.place_name || monitoring.place_url}`);
        
        // 1. 리뷰 크롤링 (isFirstCrawl 플래그 전달)
        const isFirstCrawl = monitoring.isFirstCrawl || false;
        const crawlResult = await crawlPlaceReviews(monitoring.place_url, isFirstCrawl);
        
        if (!crawlResult.success) {
            throw new Error(crawlResult.error);
        }
        
        // 2. 새 리뷰 필터링
        const newReviews = await filterNewReviews(monitoring.id, crawlResult.reviews);
        
        // 3. 새 리뷰 처리 (저장 + 알림)
        let processedCount = 0;
        for (const review of newReviews) {
            // ⚠️ isFirstCrawl이면 알림 안 보냄!
            const skipAlert = crawlResult.isFirstCrawl;
            
            const result = await processNewReview(
                monitoring.user_id,
                monitoring.id,
                monitoring,
                review,
                skipAlert  // 추가!
            );
            if (result.success) processedCount++;
        }
        
        // 4. 모니터링 정보 업데이트
        await supabase
            .from('review_monitoring')
            .update({
                last_crawled_at: new Date().toISOString(),
                last_review_count: crawlResult.total,
                crawl_error_count: 0
            })
            .eq('id', monitoring.id);
        
        // 5. 크롤링 로그 저장
        const duration = Math.floor((Date.now() - startTime) / 1000);
        await supabase
            .from('review_crawl_logs')
            .insert({
                monitoring_id: monitoring.id,
                status: 'success',
                reviews_found: crawlResult.total,
                new_reviews: newReviews.length,
                started_at: new Date(startTime).toISOString(),
                completed_at: new Date().toISOString(),
                duration_seconds: duration
            });
        
        console.log(`[크롤링 완료] 신규 ${newReviews.length}개, 처리 ${processedCount}개`);
        
        return {
            success: true,
            monitoring_id: monitoring.id,
            total_reviews: crawlResult.total,
            new_reviews: newReviews.length,
            processed: processedCount
        };
        
    } catch (error) {
        console.error(`[크롤링 실패]`, error);
        
        // 에러 카운트 증가
        await supabase
            .from('review_monitoring')
            .update({
                crawl_error_count: (monitoring.crawl_error_count || 0) + 1
            })
            .eq('id', monitoring.id);
        
        // 에러 로그 저장
        const duration = Math.floor((Date.now() - startTime) / 1000);
        await supabase
            .from('review_crawl_logs')
            .insert({
                monitoring_id: monitoring.id,
                status: 'failed',
                error_message: error.message,
                started_at: new Date(startTime).toISOString(),
                completed_at: new Date().toISOString(),
                duration_seconds: duration
            });
        
        return {
            success: false,
            monitoring_id: monitoring.id,
            error: error.message
        };
    }
}

/**
 * 모든 활성화된 모니터링 크롤링
 */
async function crawlAllMonitorings() {
    try {
        console.log('\n========================================');
        console.log('🔍 리뷰 모니터링 자동 크롤링 시작');
        console.log('========================================\n');
        
        // 활성화된 모니터링 목록 가져오기
        const { data: monitorings, error } = await supabase
            .from('review_monitoring')
            .select('*')
            .eq('monitoring_enabled', true);
        
        if (error) {
            throw new Error('모니터링 목록 조회 실패: ' + error.message);
        }
        
        if (!monitorings || monitorings.length === 0) {
            console.log('[알림] 활성화된 모니터링이 없습니다.');
            return {
                success: true,
                total: 0,
                results: []
            };
        }
        
        console.log(`[대상] ${monitorings.length}개 모니터링\n`);
        
        // 각 모니터링 크롤링 (순차 실행)
        const results = [];
        for (const monitoring of monitorings) {
            const result = await crawlSingleMonitoring(monitoring);
            results.push(result);
            
            // 과부하 방지를 위해 잠시 대기 (1초)
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 요약 통계
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const totalNewReviews = results.reduce((sum, r) => sum + (r.new_reviews || 0), 0);
        
        console.log('\n========================================');
        console.log('✅ 크롤링 완료');
        console.log('========================================');
        console.log(`성공: ${successful} / 실패: ${failed}`);
        console.log(`신규 리뷰: ${totalNewReviews}개`);
        console.log('========================================\n');
        
        return {
            success: true,
            total: monitorings.length,
            successful,
            failed,
            total_new_reviews: totalNewReviews,
            results
        };
        
    } catch (error) {
        console.error('[전체 크롤링 실패]', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = async (req, res) => {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // GET: 크롤링 상태 조회
        if (req.method === 'GET') {
            const { userId } = req.query;
            
            if (!userId) {
                return res.status(400).json({ error: 'userId is required' });
            }
            
            // 사용자의 모니터링 정보 조회
            const { data, error } = await supabase
                .from('review_monitoring')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            
            res.json({
                success: true,
                monitoring: data || null
            });
            return;
        }

        // POST: 크롤링 실행
        if (req.method === 'POST') {
            const { action, userId, monitoringId } = req.body;
            
            if (action === 'crawl_all') {
                // 전체 크롤링 (Cron에서 호출)
                const result = await crawlAllMonitorings();
                res.json(result);
                
            } else if (action === 'crawl_single' && monitoringId) {
                // 단일 크롤링 (테스트용)
                const { data: monitoring } = await supabase
                    .from('review_monitoring')
                    .select('*')
                    .eq('id', monitoringId)
                    .single();
                
                if (!monitoring) {
                    return res.status(404).json({ error: 'Monitoring not found' });
                }
                
                const result = await crawlSingleMonitoring(monitoring);
                res.json(result);
                
            } else if (action === 'create_monitoring' && userId) {
                // 모니터링 생성/업데이트
                const {
                    placeUrl,
                    placeName,
                    alertLowRating,
                    alertHighRating,
                    alertKeywords,
                    keywordsList
                } = req.body;
                
                const placeId = extractPlaceId(placeUrl);
                const keywords = keywordsList 
                    ? keywordsList.split(',').map(k => k.trim()).filter(k => k)
                    : [];
                
                // 기존 모니터링 확인
                const { data: existing } = await supabase
                    .from('review_monitoring')
                    .select('id')
                    .eq('user_id', userId)
                    .single();
                
                if (existing) {
                    // 업데이트
                    const { data, error } = await supabase
                        .from('review_monitoring')
                        .update({
                            place_url: placeUrl,
                            place_id: placeId,
                            place_name: placeName,
                            monitoring_enabled: true,
                            alert_on_low_rating: alertLowRating,
                            alert_on_high_rating: alertHighRating,
                            alert_on_keywords: alertKeywords,
                            alert_keywords: keywords,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existing.id)
                        .select()
                        .single();
                    
                    if (error) throw error;
                    
                    res.json({ success: true, monitoring: data, created: false });
                } else {
                    // 신규 생성
                    const { data, error } = await supabase
                        .from('review_monitoring')
                        .insert({
                            user_id: userId,
                            place_url: placeUrl,
                            place_id: placeId,
                            place_name: placeName,
                            monitoring_enabled: true,
                            alert_on_low_rating: alertLowRating,
                            alert_on_high_rating: alertHighRating,
                            alert_on_keywords: alertKeywords,
                            alert_keywords: keywords
                        })
                        .select()
                        .single();
                    
                    if (error) throw error;
                    
                    // ✅ 최초 크롤링 실행 (isFirstCrawl = true, 알림 안 보냄)
                    setTimeout(async () => {
                        const monitoringWithFlag = { ...data, isFirstCrawl: true };
                        await crawlSingleMonitoring(monitoringWithFlag);
                        console.log(`[최초 크롤링 완료] ${data.place_name}`);
                    }, 1000);
                    
                    res.json({ success: true, monitoring: data, created: true });
                }
                
            } else if (action === 'fetch_recent_reviews') {
                const { placeUrl, limit = 5 } = req.body;
                if (!placeUrl) {
                    return res.status(400).json({
                        success: false,
                        error: 'placeUrl is required'
                    });
                }

                const normalizedLimit = Math.min(Math.max(parseInt(limit, 10) || 5, 1), 10);
                const crawlResult = await crawlPlaceReviews(placeUrl, false);

                if (!crawlResult.success) {
                    return res.status(500).json({
                        success: false,
                        error: crawlResult.error || '리뷰를 불러오지 못했습니다.'
                    });
                }

                const reviews = Array.isArray(crawlResult.reviews) ? crawlResult.reviews : [];
                const prioritized = reviews.filter(r => ['visitor', 'receipt'].includes(r.type));
                const selected = (prioritized.length > 0 ? prioritized : reviews).slice(0, normalizedLimit);

                res.json({
                    success: true,
                    placeUrl,
                    total: crawlResult.total,
                    fetchedAt: new Date().toISOString(),
                    reviews: selected
                });

            } else {
                res.status(400).json({ error: 'Invalid action' });
            }
        }

    } catch (error) {
        console.error('[API 오류]', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Cron에서 직접 호출할 수 있도록 export
module.exports.crawlAllMonitorings = crawlAllMonitorings;

