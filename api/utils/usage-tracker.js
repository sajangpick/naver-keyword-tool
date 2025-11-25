/**
 * 사용량 추적 유틸리티
 * 리뷰 답글 및 블로그 포스팅 사용량을 profiles 테이블에 반영
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

/**
 * auth user id를 profiles id로 변환
 * @param {string} userId - auth user id 또는 profiles id
 * @returns {Promise<string|null>} profiles id
 */
async function resolveProfileId(userId) {
    if (!userId) return null;
    
    try {
        // 먼저 profiles.id로 직접 조회 시도
        const { data: profileById, error: errorById } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();
        
        if (profileById && !errorById) {
            return profileById.id; // 이미 profiles.id인 경우
        }
        
        // profiles.id가 아니면 auth user id로 간주하고 kakao_id나 email로 찾기
        // auth user id를 kakao_id로 사용하는 경우
        const { data: profileByKakaoId, error: errorByKakaoId } = await supabase
            .from('profiles')
            .select('id')
            .eq('kakao_id', userId)
            .single();
        
        if (profileByKakaoId && !errorByKakaoId) {
            return profileByKakaoId.id;
        }
        
        // email로 찾기 시도
        const { data: profileByEmail, error: errorByEmail } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', userId)
            .single();
        
        if (profileByEmail && !errorByEmail) {
            return profileByEmail.id;
        }
        
        // 찾지 못한 경우 원래 userId 반환 (혹시 모를 경우를 대비)
        console.warn('⚠️ profiles를 찾을 수 없어 원래 userId 사용:', userId);
        return userId;
        
    } catch (error) {
        console.error('❌ profileId 변환 실패:', error);
        return userId; // 에러 발생 시 원래 userId 반환
    }
}

/**
 * 리뷰 답글 사용량 증가
 * @param {string} userId - 사용자 ID (auth user id 또는 profiles id)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function incrementReviewUsage(userId) {
    if (!userId) {
        console.warn('⚠️ userId가 없어 리뷰 사용량을 증가시키지 않습니다.');
        return { success: false, error: 'userId가 필요합니다.' };
    }

    if (!supabase) {
        console.warn('⚠️ Supabase 클라이언트가 초기화되지 않아 리뷰 사용량을 증가시키지 않습니다.');
        return { success: false, error: 'Supabase 클라이언트가 초기화되지 않았습니다.' };
    }

    try {
        // userId를 profiles.id로 변환
        const profileId = await resolveProfileId(userId);
        if (!profileId) {
            console.error('❌ profiles.id를 찾을 수 없습니다:', userId);
            return { success: false, error: '프로필을 찾을 수 없습니다.' };
        }
        
        console.log(`🔍 userId 변환: ${userId} → ${profileId}`);
        
        // 현재 사용량 조회
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('monthly_review_count')
            .eq('id', profileId)
            .single();

        if (fetchError) {
            console.error('❌ 프로필 조회 실패:', fetchError);
            return { success: false, error: fetchError.message };
        }

        if (!profile) {
            console.error('❌ 프로필을 찾을 수 없습니다:', profileId);
            return { success: false, error: '프로필을 찾을 수 없습니다.' };
        }

        // 사용량 증가 (null이면 0으로 시작)
        const currentCount = profile.monthly_review_count || 0;
        const newCount = currentCount + 1;

        // 업데이트
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
                monthly_review_count: newCount,
                updated_at: new Date().toISOString()
            })
            .eq('id', profileId);

        if (updateError) {
            console.error('❌ 리뷰 사용량 업데이트 실패:', updateError);
            return { success: false, error: updateError.message };
        }

        console.log(`✅ 리뷰 사용량 증가: ${profileId} (${currentCount} → ${newCount})`);
        return { success: true, count: newCount };

    } catch (error) {
        console.error('❌ 리뷰 사용량 증가 중 오류:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 블로그 포스팅 사용량 증가
 * @param {string} userId - 사용자 ID (auth user id 또는 profiles id)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function incrementBlogUsage(userId) {
    if (!userId) {
        console.warn('⚠️ userId가 없어 블로그 사용량을 증가시키지 않습니다.');
        return { success: false, error: 'userId가 필요합니다.' };
    }

    if (!supabase) {
        console.warn('⚠️ Supabase 클라이언트가 초기화되지 않아 블로그 사용량을 증가시키지 않습니다.');
        return { success: false, error: 'Supabase 클라이언트가 초기화되지 않았습니다.' };
    }

    try {
        // userId를 profiles.id로 변환
        const profileId = await resolveProfileId(userId);
        if (!profileId) {
            console.error('❌ profiles.id를 찾을 수 없습니다:', userId);
            return { success: false, error: '프로필을 찾을 수 없습니다.' };
        }
        
        console.log(`🔍 userId 변환: ${userId} → ${profileId}`);
        
        // 현재 사용량 조회
        const { data: profile, error: fetchError } = await supabase
            .from('profiles')
            .select('monthly_blog_count')
            .eq('id', profileId)
            .single();

        if (fetchError) {
            console.error('❌ 프로필 조회 실패:', fetchError);
            return { success: false, error: fetchError.message };
        }

        if (!profile) {
            console.error('❌ 프로필을 찾을 수 없습니다:', profileId);
            return { success: false, error: '프로필을 찾을 수 없습니다.' };
        }

        // 사용량 증가 (null이면 0으로 시작)
        const currentCount = profile.monthly_blog_count || 0;
        const newCount = currentCount + 1;

        // 업데이트
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
                monthly_blog_count: newCount,
                updated_at: new Date().toISOString()
            })
            .eq('id', profileId);

        if (updateError) {
            console.error('❌ 블로그 사용량 업데이트 실패:', updateError);
            return { success: false, error: updateError.message };
        }

        console.log(`✅ 블로그 사용량 증가: ${profileId} (${currentCount} → ${newCount})`);
        return { success: true, count: newCount };

    } catch (error) {
        console.error('❌ 블로그 사용량 증가 중 오류:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    incrementReviewUsage,
    incrementBlogUsage
};

