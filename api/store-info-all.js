/**
 * 통합 가게 정보 조회 API
 * 
 * GET: profiles (기본 정보) + store_promotions (심도 있는 정보) 통합 조회
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
let supabase = null;
if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

module.exports = async (req, res) => {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });
    }

    if (!supabase) {
        return res.status(500).json({
            success: false,
            error: 'Database connection not configured'
        });
    }

    try {
        const { userId } = req.query;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId is required'
            });
        }

        // profiles 정보 조회 (기본 정보)
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('store_place_url, store_name, store_address, store_business_hours, store_phone_number, store_main_menu, store_landmarks, store_keywords')
            .eq('id', userId)
            .single();

        if (profileError) {
            console.error('[Store Info All GET] Profile Error:', profileError);
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // store_promotions 정보 조회 (심도 있는 정보)
        const { data: promotionData, error: promotionError } = await supabase
            .from('store_promotions')
            .select('*')
            .eq('user_id', userId)
            .single();

        // promotionError는 무시 (데이터 없을 수 있음)

        // 작성 개수 계산
        const filledCount = promotionData ? countFilledFields(promotionData) : 0;

        return res.status(200).json({
            success: true,
            data: {
                basic: {
                    store_place_url: profileData.store_place_url,
                    store_name: profileData.store_name,
                    store_address: profileData.store_address,
                    store_business_hours: profileData.store_business_hours,
                    store_phone_number: profileData.store_phone_number,
                    store_main_menu: profileData.store_main_menu,
                    store_landmarks: profileData.store_landmarks,
                    store_keywords: profileData.store_keywords
                },
                promotion: promotionData || null
            },
            hasPromotion: !!promotionData,
            filledCount: filledCount,
            totalCount: 7
        });

    } catch (error) {
        console.error('[Store Info All API] Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

/**
 * 작성된 필드 개수 계산
 */
function countFilledFields(data) {
    let count = 0;
    
    if (data.signature_menu && data.signature_menu.trim().length > 0) count++;
    if (data.special_ingredients && data.special_ingredients.trim().length > 0) count++;
    if (data.atmosphere_facilities && data.atmosphere_facilities.trim().length > 0) count++;
    if (data.owner_story && data.owner_story.trim().length > 0) count++;
    if (data.recommended_situations && data.recommended_situations.trim().length > 0) count++;
    if (data.sns_photo_points && data.sns_photo_points.trim().length > 0) count++;
    if (data.special_events && data.special_events.trim().length > 0) count++;
    
    return count;
}

