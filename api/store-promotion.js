/**
 * 내 가게 알리기 API
 * 
 * GET: 사용자의 내 가게 알리기 정보 조회
 * POST: 내 가게 알리기 저장/업데이트
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (!supabase) {
        return res.status(500).json({
            success: false,
            error: 'Database connection not configured'
        });
    }

    try {
        // GET: 내 가게 알리기 조회
        if (req.method === 'GET') {
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'userId is required'
                });
            }

            const { data, error } = await supabase
                .from('store_promotions')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = 데이터 없음
                console.error('[Store Promotion GET] Error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to fetch promotion info'
                });
            }

            // 작성 개수 계산
            const filledCount = data ? countFilledFields(data) : 0;

            return res.status(200).json({
                success: true,
                data: data || null,
                filledCount: filledCount,
                totalCount: 7
            });
        }

        // POST: 내 가게 알리기 저장
        if (req.method === 'POST') {
            const { userId, promotionData } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'userId is required'
                });
            }

            if (!promotionData) {
                return res.status(400).json({
                    success: false,
                    error: 'promotionData is required'
                });
            }

            // 데이터 준비
            const dataToSave = {
                user_id: userId,
                signature_menu: promotionData.signature_menu || null,
                special_ingredients: promotionData.special_ingredients || null,
                atmosphere_facilities: promotionData.atmosphere_facilities || null,
                owner_story: promotionData.owner_story || null,
                recommended_situations: promotionData.recommended_situations || null,
                sns_photo_points: promotionData.sns_photo_points || null,
                special_events: promotionData.special_events || null,
                updated_at: new Date().toISOString()
            };

            // upsert (있으면 업데이트, 없으면 삽입)
            const { data, error } = await supabase
                .from('store_promotions')
                .upsert(dataToSave, {
                    onConflict: 'user_id'
                })
                .select()
                .single();

            if (error) {
                console.error('[Store Promotion POST] Error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save promotion info'
                });
            }

            // 작성 개수 계산
            const filledCount = countFilledFields(data);

            return res.status(200).json({
                success: true,
                data: data,
                filledCount: filledCount,
                totalCount: 7,
                message: `저장 완료! (${filledCount}/7 항목 작성)`
            });
        }

        // 지원하지 않는 메소드
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });

    } catch (error) {
        console.error('[Store Promotion API] Error:', error);
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

