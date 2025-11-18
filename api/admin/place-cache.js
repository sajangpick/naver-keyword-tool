/**
 * 플레이스 캐시 관리 API
 * GET: 캐시 통계 조회
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
        // 전체 캐시 개수
        const { count: totalCount, error: countError } = await supabase
            .from('place_cache')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            console.error('[Place Cache Stats] Count Error:', countError);
        }

        // 오늘 생성된 캐시 개수
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: todayCount, error: todayError } = await supabase
            .from('place_cache')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', today.toISOString());

        if (todayError) {
            console.error('[Place Cache Stats] Today Error:', todayError);
        }

        // 총 크롤링 횟수 (crawl_count 합계)
        const { data: crawlData, error: crawlError } = await supabase
            .from('place_cache')
            .select('crawl_count');

        let totalCrawlCount = 0;
        if (!crawlError && crawlData) {
            totalCrawlCount = crawlData.reduce((sum, item) => sum + (item.crawl_count || 0), 0);
        }

        // 24시간 이내 만료되지 않은 캐시 개수 (유효한 캐시)
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
        const { count: validCount, error: validError } = await supabase
            .from('place_cache')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', twentyFourHoursAgo.toISOString());

        if (validError) {
            console.error('[Place Cache Stats] Valid Error:', validError);
        }

        return res.status(200).json({
            success: true,
            stats: {
                totalCaches: totalCount || 0,
                todayCaches: todayCount || 0,
                totalCrawls: totalCrawlCount,
                validCaches: validCount || 0,
                expiredCaches: (totalCount || 0) - (validCount || 0)
            }
        });

    } catch (error) {
        console.error('[Place Cache API] Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

