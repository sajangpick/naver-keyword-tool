/**
 * 회원 관리 API
 * GET: 회원 목록 조회 (관리자 전용)
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 생성 함수 (매 요청마다 새로 생성)
function getSupabaseClient() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return null;
    }
    return createClient(
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

    // 매 요청마다 새 Supabase 클라이언트 생성
    const supabase = getSupabaseClient();
    
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

        // 이번 달 시작일 계산 (현재 달의 1일 00:00:00)
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        firstDayOfMonth.setHours(0, 0, 0, 0);

        // 각 회원의 실제 사용량 계산
        const membersWithUsage = await Promise.all(
            (members || []).map(async (member) => {
                try {
                    const userId = member.id;

                    // 이번 달 리뷰 답글 수 계산
                    const { count: reviewCount } = await supabase
                        .from('user_events')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', userId)
                        .eq('event_name', 'review_replied')
                        .gte('created_at', firstDayOfMonth.toISOString());

                    // 이번 달 블로그 생성 수 계산
                    const { count: blogCount } = await supabase
                        .from('user_events')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', userId)
                        .eq('event_name', 'blog_created')
                        .gte('created_at', firstDayOfMonth.toISOString());

                    // 실제 사용량으로 업데이트
                    return {
                        ...member,
                        monthly_review_count: reviewCount || 0,
                        monthly_blog_count: blogCount || 0
                    };
                } catch (err) {
                    console.error(`[Admin Members API] 회원 ${member.id} 사용량 계산 실패:`, err);
                    // 에러 발생 시 기본값 반환
                    return {
                        ...member,
                        monthly_review_count: 0,
                        monthly_blog_count: 0
                    };
                }
            })
        );

        return res.status(200).json({
            success: true,
            members: membersWithUsage || [],
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

