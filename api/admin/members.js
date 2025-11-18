/**
 * 회원 관리 API
 * GET: 회원 목록 조회 (관리자 전용)
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
        const { user_type, search, page = 1, limit = 20 } = req.query;

        // 페이지네이션 계산
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // 쿼리 빌더
        let query = supabase
            .from('profiles')
            .select('*', { count: 'exact' });

        // 필터: 회원 유형
        if (user_type) {
            query = query.eq('user_type', user_type);
        }

        // 필터: 검색어 (이름 또는 이메일)
        if (search && search.trim()) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
        }

        // 정렬 및 페이지네이션
        query = query
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        const { data: members, error, count } = await query;

        if (error) {
            console.error('[Admin Members API] Error:', error);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch members'
            });
        }

        return res.status(200).json({
            success: true,
            members: members || [],
            total: count || 0,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil((count || 0) / parseInt(limit))
        });

    } catch (error) {
        console.error('[Admin Members API] Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

