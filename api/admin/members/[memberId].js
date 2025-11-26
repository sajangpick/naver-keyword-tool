/**
 * 회원 개별 관리 API
 * PUT: 회원 정보 수정
 * DELETE: 회원 삭제
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 생성 함수 (매 요청마다 새로 생성하여 스키마 캐시 문제 방지)
function getSupabaseClient() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return null;
    }
    // 매번 새 클라이언트 생성하여 스키마 캐시 문제 방지
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            db: {
                schema: 'public'
            },
            auth: {
                persistSession: false
            }
        }
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

    // 매 요청마다 새 Supabase 클라이언트 생성 (스키마 캐시 문제 방지)
    const supabase = getSupabaseClient();
    
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
            const { reset_usage } = updates;

            console.log('[Admin Member Update] 받은 요청 데이터:', JSON.stringify(updates, null, 2));

            // 허용된 필드만 업데이트 (role과 reset_usage는 profiles 테이블에 없으므로 제외)
            const allowedFields = [
                'name',
                'business_name',
                'phone',
                'user_type',
                'membership_level',  // 추가: 등급 변경 지원
                'user_level',
                'review_count',
                'blog_count',
                'is_active'
            ];

            // profiles 테이블에 없는 필드들 (명시적으로 제외)
            const excludedFields = ['role', 'reset_usage'];

            const dataToUpdate = {};
            Object.keys(updates).forEach(key => {
                // role과 reset_usage는 명시적으로 제외 (테이블에 없음)
                if (excludedFields.includes(key)) {
                    console.log(`[Admin Member Update] 필드 제외: ${key} (테이블에 없음)`);
                    return;
                }
                if (allowedFields.includes(key)) {
                    dataToUpdate[key] = updates[key];
                } else {
                    console.log(`[Admin Member Update] 허용되지 않은 필드: ${key}`);
                }
            });

            console.log('[Admin Member Update] 업데이트할 데이터:', JSON.stringify(dataToUpdate, null, 2));

            if (Object.keys(dataToUpdate).length === 0 && !reset_usage) {
                return res.status(400).json({
                    success: false,
                    error: 'No valid fields to update'
                });
            }

            dataToUpdate.updated_at = new Date().toISOString();

            // 프로필 업데이트 (스키마 캐시 문제 방지를 위해 .select() 없이 업데이트만 수행)
            const { error: updateError } = await supabase
                .from('profiles')
                .update(dataToUpdate)
                .eq('id', memberId);

            if (updateError) {
                console.error('[Admin Member Update] Supabase Update Error:', updateError);
                console.error('[Admin Member Update] Error Code:', updateError.code);
                console.error('[Admin Member Update] Error Details:', updateError.details);
                console.error('[Admin Member Update] Error Hint:', updateError.hint);
                
                // role 관련 에러인 경우 명시적으로 안내
                let errorMessage = updateError.message || 'Failed to update member';
                if (updateError.message && updateError.message.includes('role')) {
                    errorMessage = 'role 컬럼이 profiles 테이블에 없습니다. role 필드는 전송하지 마세요.';
                }
                
                return res.status(500).json({
                    success: false,
                    error: errorMessage
                });
            }

            // 업데이트 성공 후 별도로 조회 (스키마 캐시 문제 방지)
            const { data, error: selectError } = await supabase
                .from('profiles')
                .select('id, name, email, user_type, membership_level, created_at, updated_at')
                .eq('id', memberId)
                .single();

            if (selectError) {
                console.error('[Admin Member Update] Select Error (non-critical):', selectError);
                // 업데이트는 성공했으므로 빈 데이터로 반환
            }

            // 사용량 초기화 (이번 달 사용량 삭제)
            if (reset_usage) {
                const now = new Date();
                const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                firstDayOfMonth.setHours(0, 0, 0, 0);

                // 이번 달 리뷰 답글 이벤트 삭제
                const { error: reviewError } = await supabase
                    .from('user_events')
                    .delete()
                    .eq('user_id', memberId)
                    .eq('event_name', 'review_replied')
                    .gte('created_at', firstDayOfMonth.toISOString());

                if (reviewError) {
                    console.error('[Admin Member Update] Review usage reset error:', reviewError);
                }

                // 이번 달 블로그 생성 이벤트 삭제
                const { error: blogError } = await supabase
                    .from('user_events')
                    .delete()
                    .eq('user_id', memberId)
                    .eq('event_name', 'blog_created')
                    .gte('created_at', firstDayOfMonth.toISOString());

                if (blogError) {
                    console.error('[Admin Member Update] Blog usage reset error:', blogError);
                }
            }

            return res.status(200).json({
                success: true,
                data: data,
                message: '회원 정보가 수정되었습니다.' + (reset_usage ? ' (사용량 초기화 완료)' : '')
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

