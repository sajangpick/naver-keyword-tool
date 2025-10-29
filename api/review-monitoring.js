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
 * 네이버 플레이스 리뷰 크롤링
 * (기존 chatgpt-blog.js의 크롤링 로직 활용)
 */
async function crawlPlaceReviews(placeUrl) {
    try {
        // TODO: 실제 크롤링 구현
        // 현재는 더미 데이터 반환
        
        console.log('[크롤링] 플레이스 URL:', placeUrl);
        
        // 실제로는 puppeteer로 크롤링
        // 지금은 테스트용 더미 데이터
        const dummyReviews = [
            {
                type: 'visitor',
                external_id: 'dummy_' + Date.now() + '_1',
                rating: 2,
                content: '음식은 맛있는데 직원이 불친절했어요. 다시는 안 갈 것 같습니다.',
                reviewer_name: '김철수',
                reviewed_at: new Date().toISOString()
            },
            {
                type: 'visitor',
                external_id: 'dummy_' + Date.now() + '_2',
                rating: 5,
                content: '정말 맛있어요! 사장님도 친절하시고 분위기도 좋아요. 강추합니다!',
                reviewer_name: '이영희',
                reviewed_at: new Date().toISOString()
            }
        ];
        
        return {
            success: true,
            reviews: dummyReviews,
            total: dummyReviews.length
        };
        
    } catch (error) {
        console.error('[크롤링 실패]', error);
        return {
            success: false,
            error: error.message,
            reviews: []
        };
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
 */
async function processNewReview(userId, monitoringId, monitoring, review) {
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
        
        // 카카오톡 알림 발송
        if (shouldSendAlert) {
            const alertData = {
                id: alert.id,
                place_name: monitoring.place_name || '내 가게',
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
        
        // 1. 리뷰 크롤링
        const crawlResult = await crawlPlaceReviews(monitoring.place_url);
        
        if (!crawlResult.success) {
            throw new Error(crawlResult.error);
        }
        
        // 2. 새 리뷰 필터링
        const newReviews = await filterNewReviews(monitoring.id, crawlResult.reviews);
        
        // 3. 새 리뷰 처리 (저장 + 알림)
        let processedCount = 0;
        for (const review of newReviews) {
            const result = await processNewReview(
                monitoring.user_id,
                monitoring.id,
                monitoring,
                review
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
                    
                    // 최초 크롤링 실행
                    setTimeout(() => crawlSingleMonitoring(data), 1000);
                    
                    res.json({ success: true, monitoring: data, created: true });
                }
                
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

