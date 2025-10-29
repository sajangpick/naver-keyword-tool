/**
 * 카카오 알림톡 API
 * 
 * 리뷰 알림을 카카오 알림톡으로 발송
 * 
 * 참고: https://developers.kakao.com/docs/latest/ko/message/message-template
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트
let supabase = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

/**
 * 카카오톡 메시지 발송
 */
async function sendKakaoMessage(accessToken, message) {
    try {
        const response = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                template_object: JSON.stringify(message)
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(`Kakao API Error: ${JSON.stringify(data)}`);
        }

        return { success: true, data };
    } catch (error) {
        console.error('카카오톡 메시지 발송 실패:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 긴급 리뷰 알림 메시지 생성
 */
function createUrgentReviewMessage(review) {
    const stars = '⭐'.repeat(review.rating);
    
    return {
        object_type: 'text',
        text: `🚨 긴급 리뷰 알림!\n\n${stars} ${review.rating}점 리뷰가 등록되었습니다\n\n"${review.content.substring(0, 50)}${review.content.length > 50 ? '...' : ''}"\n\n지금 바로 답글을 달아주세요!`,
        link: {
            web_url: 'https://www.sajangpick.co.kr/mypage.html#reviews',
            mobile_web_url: 'https://www.sajangpick.co.kr/mypage.html#reviews'
        },
        button_title: '답글 달기'
    };
}

/**
 * 고평점 리뷰 알림 메시지 생성
 */
function createHighRatingMessage(review) {
    return {
        object_type: 'text',
        text: `⭐⭐⭐⭐⭐ 5점 리뷰!\n\n"${review.content.substring(0, 50)}${review.content.length > 50 ? '...' : ''}"\n\n감사 답글을 작성해보세요!`,
        link: {
            web_url: 'https://www.sajangpick.co.kr/mypage.html#reviews',
            mobile_web_url: 'https://www.sajangpick.co.kr/mypage.html#reviews'
        },
        button_title: '답글 작성'
    };
}

/**
 * 일일 요약 메시지 생성
 */
function createDailySummaryMessage(summary) {
    return {
        object_type: 'text',
        text: `📊 오늘의 리뷰 요약\n\n신규 리뷰: ${summary.newReviews}개\n평균 평점: ${summary.avgRating}점\n긴급 리뷰: ${summary.urgentReviews}개\n답글 대기: ${summary.pendingReplies}개`,
        link: {
            web_url: 'https://www.sajangpick.co.kr/mypage.html#reviews',
            mobile_web_url: 'https://www.sajangpick.co.kr/mypage.html#reviews'
        },
        button_title: '자세히 보기'
    };
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
        const { userId, messageType, data } = req.body;

        if (!userId || !messageType) {
            return res.status(400).json({ 
                error: 'userId and messageType are required' 
            });
        }

        // 사용자의 카카오 Access Token 가져오기
        // TODO: Supabase profiles 테이블에 kakao_access_token 저장 필요
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('kakao_access_token')
            .eq('id', userId)
            .single();

        if (profileError || !profile?.kakao_access_token) {
            return res.status(404).json({ 
                error: 'Kakao access token not found. Please login again.' 
            });
        }

        // 메시지 타입별 처리
        let message;
        switch (messageType) {
            case 'urgent_review':
                message = createUrgentReviewMessage(data);
                break;
            case 'high_rating':
                message = createHighRatingMessage(data);
                break;
            case 'daily_summary':
                message = createDailySummaryMessage(data);
                break;
            default:
                return res.status(400).json({ error: 'Invalid message type' });
        }

        // 카카오톡 메시지 발송
        const result = await sendKakaoMessage(profile.kakao_access_token, message);

        if (!result.success) {
            return res.status(500).json({ 
                error: '카카오톡 메시지 발송 실패',
                details: result.error
            });
        }

        res.json({ 
            success: true,
            message: '카카오톡 메시지가 발송되었습니다'
        });

    } catch (error) {
        console.error('카카오톡 메시지 API 오류:', error);
        res.status(500).json({ 
            error: '서버 오류가 발생했습니다',
            details: error.message
        });
    }
};

