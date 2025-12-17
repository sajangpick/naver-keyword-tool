/**
 * 가게 정보 저장/조회 API
 * 
 * GET: 사용자의 저장된 가게 정보 조회
 * POST: 가게 정보 저장/업데이트
 */

const { createClient } = require('@supabase/supabase-js');
const cipher = require('../lib/cipher-service');

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
        // GET: 가게 정보 조회
        if (req.method === 'GET') {
            const { userId } = req.query;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'userId is required'
                });
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('store_place_url, store_name, store_address, store_business_hours, store_phone_number, store_main_menu, store_landmarks, store_keywords')
                .eq('id', userId)
                .single();

            if (error) {
                console.error('[Store Info GET] Error:', error);
                return res.status(404).json({
                    success: false,
                    error: 'User not found'
                });
            }

            // 전화번호 복호화 (DB에서 가져온 암호화된 값을 원래 번호로 복원)
            if (data && data.store_phone_number) {
                data.store_phone_number = cipher.decrypt(data.store_phone_number);
            }

            return res.status(200).json({
                success: true,
                data: data
            });
        }

        // POST: 가게 정보 저장
        if (req.method === 'POST') {
            const { userId, storeInfo } = req.body;

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'userId is required'
                });
            }

            if (!storeInfo) {
                return res.status(400).json({
                    success: false,
                    error: 'storeInfo is required'
                });
            }

            // 전화번호 암호화 (DB에 저장하기 전에 암호화)
            const encryptedPhoneNumber = storeInfo.phoneNumber 
                ? cipher.encrypt(storeInfo.phoneNumber) 
                : null;

            // profiles 테이블 업데이트
            const { data, error } = await supabase
                .from('profiles')
                .update({
                    store_place_url: storeInfo.placeUrl || null,
                    store_name: storeInfo.companyName || null,
                    store_address: storeInfo.companyAddress || null,
                    store_business_hours: storeInfo.businessHours || null,
                    store_phone_number: encryptedPhoneNumber,
                    store_main_menu: storeInfo.mainMenu || null,
                    store_landmarks: storeInfo.landmarks || null,
                    store_keywords: storeInfo.keywords || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)
                .select();

            // 응답 데이터의 전화번호는 복호화해서 반환 (사용자에게는 원래 번호를 보여줌)
            if (data && data[0]) {
                data[0].store_phone_number = encryptedPhoneNumber 
                    ? cipher.decrypt(encryptedPhoneNumber) 
                    : null;
            }

            if (error) {
                console.error('[Store Info POST] Error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save store info'
                });
            }

            return res.status(200).json({
                success: true,
                data: data[0]
            });
        }

        // 지원하지 않는 메소드
        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });

    } catch (error) {
        console.error('[Store Info API] Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

