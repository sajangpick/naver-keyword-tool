/**
 * 회원 개별 관리 API
 * PUT: 회원 정보 수정
 * DELETE: 회원 삭제
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
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
        const { memberId } = req.query;

        if (!memberId) {
            return res.status(400).json({
                success: false,
                error: 'memberId is required'
            });
        }

        // PUT: 회원 정보 수정
        if (req.method === 'PUT') {
            const updates = req.body;

            // 허용된 필드만 업데이트
            const allowedFields = [
                'name',
                'business_name',
                'phone',
                'user_type',
                'user_level',
                'review_count',
                'blog_count',
                'is_active'
            ];

            const dataToUpdate = {};
            Object.keys(updates).forEach(key => {
                if (allowedFields.includes(key)) {
                    dataToUpdate[key] = updates[key];
                }
            });

            if (Object.keys(dataToUpdate).length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid fields to update'
                });
            }

            dataToUpdate.updated_at = new Date().toISOString();

            const { data, error } = await supabase
                .from('profiles')
                .update(dataToUpdate)
                .eq('id', memberId)
                .select()
                .single();

            if (error) {
                console.error('[Admin Member Update] Error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update member'
                });
            }

            return res.status(200).json({
                success: true,
                data: data,
                message: '회원 정보가 수정되었습니다.'
            });
        }

        // DELETE: 회원 삭제
        if (req.method === 'DELETE') {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', memberId);

            if (error) {
                console.error('[Admin Member Delete] Error:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to delete member'
                });
            }

            return res.status(200).json({
                success: true,
                message: '회원이 삭제되었습니다.'
            });
        }

        // GET: 개별 회원 조회 (필요 시)
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', memberId)
                .single();

            if (error) {
                console.error('[Admin Member Get] Error:', error);
                return res.status(404).json({
                    success: false,
                    error: 'Member not found'
                });
            }

            return res.status(200).json({
                success: true,
                data: data
            });
        }

        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });

    } catch (error) {
        console.error('[Admin Member API] Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};

