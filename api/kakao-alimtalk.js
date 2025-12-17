/**
 * 카카오 알림톡 발송 API
 * 
 * 리뷰 알림을 카카오 알림톡으로 발송
 */

const { createClient } = require('@supabase/supabase-js');
const cipher = require('../lib/cipher-service');

// Supabase 클라이언트
let supabase = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

// 카카오 알림톡 설정
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const KAKAO_SENDER_KEY = process.env.KAKAO_SENDER_KEY;  // 발신 프로필 키

/**
 * 발송 제한 체크 및 카운트 관리
 * @param {string} userId - 사용자 ID
 * @returns {object} { canSend: boolean, reason: string }
 */
async function checkAndUpdateAlertLimit(userId) {
    try {
        if (!supabase) {
            console.error('[발송 제한] Supabase 클라이언트 없음');
            return { canSend: false, reason: 'no_supabase' };
        }
        
        // 1. 현재 설정 조회
        const { data: monitoring, error } = await supabase
            .from('review_monitoring')
            .select('daily_alert_limit, alert_count_today, last_alert_date')
            .eq('user_id', userId)
            .single();
        
        if (error || !monitoring) {
            console.log('[발송 제한] 모니터링 설정 없음:', error?.message);
            return { canSend: false, reason: 'no_monitoring' };
        }
        
        // 2. 발송 제한이 0이면 알림 끄기
        if (monitoring.daily_alert_limit === 0) {
            console.log('[발송 제한] 알림 꺼짐 (limit=0)');
            return { canSend: false, reason: 'alert_disabled' };
        }
        
        // 3. 날짜 체크 (자정 지나면 초기화)
        const today = new Date().toISOString().split('T')[0];
        const lastDate = monitoring.last_alert_date 
            ? new Date(monitoring.last_alert_date).toISOString().split('T')[0]
            : null;
        
        let currentCount = monitoring.alert_count_today || 0;
        
        if (lastDate !== today) {
            // 날짜 바뀜 → 초기화
            console.log('[발송 제한] 날짜 변경, 카운트 초기화');
            currentCount = 0;
            
            await supabase
                .from('review_monitoring')
                .update({
                    alert_count_today: 0,
                    last_alert_date: today
                })
                .eq('user_id', userId);
        }
        
        // 4. 한도 체크
        if (currentCount >= monitoring.daily_alert_limit) {
            console.log(`[발송 제한] 오늘 한도 초과 (${currentCount}/${monitoring.daily_alert_limit})`);
            return { canSend: false, reason: 'daily_limit_exceeded' };
        }
        
        // 5. 발송 가능 → 카운트 +1
        console.log(`[발송 제한] 발송 가능 (${currentCount + 1}/${monitoring.daily_alert_limit})`);
        
        await supabase
            .from('review_monitoring')
            .update({
                alert_count_today: currentCount + 1,
                last_alert_date: today
            })
            .eq('user_id', userId);
        
        return { canSend: true, reason: 'ok' };
        
    } catch (error) {
        console.error('[발송 제한 체크 실패]', error);
        return { canSend: false, reason: 'error' };
    }
}

/**
 * 카카오 알림톡 발송
 * 
 * @param {string} phone - 수신자 전화번호 (01012345678)
 * @param {string} templateCode - 템플릿 코드
 * @param {object} variables - 템플릿 변수
 */
async function sendAlimtalk(phone, templateCode, variables) {
    try {
        // 카카오 알림톡 API 엔드포인트
        const url = 'https://kapi.kakao.com/v1/alimtalk/send';
        
        // 요청 데이터
        const data = {
            sender_key: KAKAO_SENDER_KEY,
            template_code: templateCode,
            receiver: phone,
            message: buildMessage(templateCode, variables),
            button: [
                {
                    name: getButtonName(templateCode),
                    type: 'WL',  // 웹링크
                    url_mobile: 'https://www.sajangpick.co.kr/mypage.html#reviews',
                    url_pc: 'https://www.sajangpick.co.kr/mypage.html#reviews'
                }
            ]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `KakaoAK ${KAKAO_REST_API_KEY}`,
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(`Kakao API Error: ${JSON.stringify(result)}`);
        }

        return { success: true, data: result };

    } catch (error) {
        console.error('알림톡 발송 실패:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 템플릿 코드에 맞는 메시지 생성
 */
function buildMessage(templateCode, variables) {
    switch (templateCode) {
        case 'review_urgent_001':
            return `🚨 긴급 리뷰 알림

[${variables.place_name}]에 ${variables.rating}점 리뷰가 등록되었습니다.

"${variables.review_content}"

작성자: ${variables.reviewer_name}
작성일: ${variables.reviewed_at}

지금 바로 답글을 달아 상황을 개선하세요!`;

        case 'review_high_001':
            return `⭐⭐⭐⭐⭐ 5점 리뷰!

[${variables.place_name}]에 만점 리뷰가 등록되었습니다.

"${variables.review_content}"

작성자: ${variables.reviewer_name}
작성일: ${variables.reviewed_at}

감사 답글을 작성해서 고객 만족도를 높이세요!`;

        case 'review_summary_001':
            return `📊 오늘의 리뷰 요약

[${variables.place_name}]

신규 리뷰: ${variables.new_reviews}개
평균 평점: ${variables.avg_rating}점
긴급 리뷰: ${variables.urgent_reviews}개
답글 대기: ${variables.pending_replies}개

오늘도 고객 관리 화이팅!`;

        default:
            throw new Error(`Unknown template code: ${templateCode}`);
    }
}

/**
 * 템플릿 코드에 맞는 버튼명 반환
 */
function getButtonName(templateCode) {
    switch (templateCode) {
        case 'review_urgent_001':
        case 'review_high_001':
            return '답글 작성하기';
        case 'review_summary_001':
            return '자세히 보기';
        default:
            return '확인하기';
    }
}

/**
 * 긴급 리뷰 알림 발송
 */
async function sendUrgentReviewAlert(userId, review) {
    try {
        console.log('[알림톡] 긴급 리뷰 발송 시도:', review.id);
        
        // ✅ 발송 제한 체크 (맨 앞에 추가!)
        const limitCheck = await checkAndUpdateAlertLimit(userId);
        if (!limitCheck.canSend) {
            console.log(`[알림톡 건너뜀] ${limitCheck.reason}`);
            return { success: false, reason: limitCheck.reason };
        }
        
        // 사용자 전화번호 가져오기
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('phone, phone_number')
            .eq('id', userId)
            .single();

        let phoneNumber = profile?.phone_number || profile?.phone;
        
        // 전화번호 복호화 (DB에 암호화되어 저장된 경우)
        if (phoneNumber) {
            phoneNumber = cipher.decrypt(phoneNumber);
        }
        
        if (error || !phoneNumber) {
            console.error('전화번호를 찾을 수 없습니다:', userId);
            return { success: false, error: 'Phone number not found' };
        }

        // 알림톡 발송
        const result = await sendAlimtalk(
            phoneNumber,
            'review_urgent_001',
            {
                place_name: review.place_name,
                rating: review.rating,
                review_content: review.content.substring(0, 50) + (review.content.length > 50 ? '...' : ''),
                reviewer_name: review.reviewer_name || '익명',
                reviewed_at: new Date(review.reviewed_at).toLocaleDateString('ko-KR')
            }
        );

        // 발송 기록 저장
        if (result.success) {
            await supabase
                .from('review_alerts')
                .update({ 
                    kakao_sent: true,
                    kakao_sent_at: new Date().toISOString()
                })
                .eq('id', review.id);
        }

        return result;

    } catch (error) {
        console.error('긴급 리뷰 알림 발송 오류:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 고평점 리뷰 알림 발송
 */
async function sendHighRatingAlert(userId, review) {
    try {
        console.log('[알림톡] 고평점 리뷰 발송 시도:', review.id);
        
        // ✅ 발송 제한 체크
        const limitCheck = await checkAndUpdateAlertLimit(userId);
        if (!limitCheck.canSend) {
            console.log(`[알림톡 건너뜀] ${limitCheck.reason}`);
            return { success: false, reason: limitCheck.reason };
        }
        
        const { data: profile } = await supabase
            .from('profiles')
            .select('phone, phone_number')
            .eq('id', userId)
            .single();

        let phoneNumber = profile?.phone_number || profile?.phone;
        
        // 전화번호 복호화 (DB에 암호화되어 저장된 경우)
        if (phoneNumber) {
            phoneNumber = cipher.decrypt(phoneNumber);
        }
        
        if (!phoneNumber) {
            console.error('전화번호를 찾을 수 없습니다:', userId);
            return { success: false, error: 'Phone number not found' };
        }

        const result = await sendAlimtalk(
            phoneNumber,
            'review_high_001',
            {
                place_name: review.place_name,
                review_content: review.content.substring(0, 50) + (review.content.length > 50 ? '...' : ''),
                reviewer_name: review.reviewer_name || '익명',
                reviewed_at: new Date(review.reviewed_at).toLocaleDateString('ko-KR')
            }
        );

        if (result.success) {
            await supabase
                .from('review_alerts')
                .update({ 
                    kakao_sent: true,
                    kakao_sent_at: new Date().toISOString()
                })
                .eq('id', review.id);
        }

        return result;

    } catch (error) {
        console.error('고평점 리뷰 알림 발송 오류:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 일일 요약 알림 발송
 */
async function sendDailySummary(userId, summary) {
    try {
        const { data: profile } = await supabase
            .from('profiles')
            .select('phone')
            .eq('id', userId)
            .single();

        if (!profile?.phone) {
            return { success: false, error: 'Phone number not found' };
        }

        const result = await sendAlimtalk(
            profile.phone,
            'review_summary_001',
            {
                place_name: summary.place_name,
                new_reviews: summary.new_reviews,
                avg_rating: summary.avg_rating.toFixed(1),
                urgent_reviews: summary.urgent_reviews,
                pending_replies: summary.pending_replies
            }
        );

        return result;

    } catch (error) {
        console.error('일일 요약 발송 오류:', error);
        return { success: false, error: error.message };
    }
}

module.exports = async (req, res) => {
    // CORS 헤더
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { type, userId, data } = req.body;

        if (!type || !userId) {
            return res.status(400).json({ 
                error: 'type and userId are required' 
            });
        }

        // 타입별 처리
        let result;
        switch (type) {
            case 'urgent_review':
                result = await sendUrgentReviewAlert(userId, data);
                break;
            case 'high_rating':
                result = await sendHighRatingAlert(userId, data);
                break;
            case 'daily_summary':
                result = await sendDailySummary(userId, data);
                break;
            default:
                return res.status(400).json({ error: 'Invalid type' });
        }

        if (!result.success) {
            return res.status(500).json({ 
                error: '알림톡 발송 실패',
                details: result.error
            });
        }

        res.json({ 
            success: true,
            message: '알림톡이 발송되었습니다'
        });

    } catch (error) {
        console.error('알림톡 API 오류:', error);
        res.status(500).json({ 
            error: '서버 오류가 발생했습니다',
            details: error.message
        });
    }
};

// 함수 export (크롤링 시스템에서 직접 호출 가능)
module.exports.sendUrgentReviewAlert = sendUrgentReviewAlert;
module.exports.sendHighRatingAlert = sendHighRatingAlert;
module.exports.sendDailySummary = sendDailySummary;

