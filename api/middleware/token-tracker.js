/**
 * 토큰 추적 미들웨어
 * 모든 AI API 호출 시 토큰 사용량을 자동으로 기록합니다
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.trim() !== '' && SUPABASE_KEY.trim() !== '') {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (error) {
    console.error('Supabase 클라이언트 초기화 실패:', error.message);
  }
}

/**
 * 사용자 ID 추출 (다양한 소스에서)
 */
async function extractUserId(req) {
  try {
    // 1. 요청 body에서 직접 전달된 경우
    if (req.body?.userId || req.body?.user_id) {
      return req.body.userId || req.body.user_id;
    }

    // 2. Authorization 헤더에서 추출
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) return user.id;
    }

    // 3. 쿠키에서 추출
    const cookies = req.headers.cookie;
    if (cookies) {
      const userIdMatch = cookies.match(/userId=([^;]+)/);
      if (userIdMatch) return userIdMatch[1];
    }

    return null;
  } catch (error) {
    console.error('사용자 ID 추출 실패:', error);
    return null;
  }
}

/**
 * 토큰 한도 체크 및 차감 (직접 Supabase 접근)
 */
async function checkAndUpdateTokenLimit(userId, tokensToUse) {
  if (!supabase) {
    console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다');
    return { success: false, error: 'Supabase 클라이언트 초기화 실패' };
  }

  try {
    // 사용자의 현재 구독 사이클 조회
    const { data: cycle, error: cycleError } = await supabase
      .from('subscription_cycle')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cycleError || !cycle) {
      // 구독 사이클이 없으면 새로 생성 (기본: 씨앗 등급)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const cycleEnd = new Date(today);
      cycleEnd.setDate(cycleEnd.getDate() + 30);

      // 사용자 타입 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', userId)
        .single();

      const userType = profile?.user_type || 'owner';
      const monthlyLimit = userType === 'owner' ? 10000 : 50000; // 기본 한도

      const { data: newCycle, error: createError } = await supabase
        .from('subscription_cycle')
        .insert({
          user_id: userId,
          user_type: userType,
          cycle_start_date: today.toISOString().split('T')[0],
          cycle_end_date: cycleEnd.toISOString().split('T')[0],
          days_in_cycle: 30,
          monthly_token_limit: monthlyLimit,
          tokens_used: 0,
          tokens_remaining: monthlyLimit,
          status: 'active',
          billing_amount: 0,
          payment_status: 'completed'
        })
        .select()
        .single();

      if (createError) throw createError;
      
      return checkAndUpdateTokenLimit(userId, tokensToUse); // 재귀 호출
    }

    // 토큰 한도 체크
    const newTokensUsed = (cycle.tokens_used || 0) + tokensToUse;
    const tokensRemaining = cycle.monthly_token_limit - newTokensUsed;

    if (tokensRemaining < 0) {
      // 한도 초과
      await supabase
        .from('subscription_cycle')
        .update({
          status: 'exceeded',
          is_exceeded: true,
          exceeded_at: new Date().toISOString(),
          tokens_used: newTokensUsed,
          tokens_remaining: 0
        })
        .eq('id', cycle.id);

      return {
        success: false,
        error: `토큰 한도를 초과했습니다. 월 토큰 한도: ${cycle.monthly_token_limit}`,
        tokensUsed: cycle.tokens_used,
        monthlyLimit: cycle.monthly_token_limit,
        tokensRemaining: 0
      };
    }

    // 토큰 사용량 업데이트
    const { error: updateError } = await supabase
      .from('subscription_cycle')
      .update({
        tokens_used: newTokensUsed,
        tokens_remaining: tokensRemaining,
        updated_at: new Date().toISOString()
      })
      .eq('id', cycle.id);

    if (updateError) throw updateError;

    return {
      success: true,
      tokensUsed: newTokensUsed,
      tokensRemaining: tokensRemaining,
      monthlyLimit: cycle.monthly_token_limit
    };

  } catch (error) {
    console.error('❌ 토큰 한도 체크 오류:', error);
    throw error;
  }
}

/**
 * 토큰 사용량 기록 및 한도 체크
 */
async function trackTokenUsage(userId, usage, apiType = 'chatgpt', storeId = null) {
  try {
    if (!userId) {
      console.warn('⚠️ 사용자 ID가 없어 토큰 추적을 건너뜁니다');
      return { success: true, tracked: false };
    }

    if (!supabase) {
      console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다');
      return { success: true, tracked: false };
    }

    const totalTokens = usage.total_tokens || 
                       (usage.prompt_tokens + usage.completion_tokens) ||
                       (usage.input_tokens + usage.output_tokens) || 0;

    if (totalTokens === 0) {
      console.warn('⚠️ 토큰 사용량이 0입니다');
      return { success: true, tracked: false };
    }

    // 토큰 한도 체크 및 차감
    const limitCheck = await checkAndUpdateTokenLimit(userId, totalTokens);
    
    if (!limitCheck.success) {
      console.error('❌ 토큰 사용량 기록 실패:', limitCheck.error);
      return {
        success: false,
        error: limitCheck.error,
        exceeded: true,
        remaining: 0
      };
    }

    // 토큰 사용 기록 저장
    const { data: usageRecord, error: insertError } = await supabase
      .from('token_usage')
      .insert({
        user_id: userId,
        store_id: storeId,
        tokens_used: totalTokens,
        api_type: apiType,
        input_tokens: usage.prompt_tokens || usage.input_tokens || 0,
        output_tokens: usage.completion_tokens || usage.output_tokens || 0,
        used_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ 토큰 사용 기록 저장 실패:', insertError);
      // 기록 저장 실패해도 한도는 이미 차감되었으므로 성공으로 처리
    }

    console.log(`✅ 토큰 사용 기록: ${totalTokens} 토큰 (남은 토큰: ${limitCheck.tokensRemaining}/${limitCheck.monthlyLimit})`);

    return {
      success: true,
      tracked: true,
      tokensUsed: totalTokens,
      remaining: limitCheck.tokensRemaining,
      limit: limitCheck.monthlyLimit
    };

  } catch (error) {
    console.error('❌ 토큰 추적 오류:', error);
    // 토큰 추적 실패해도 서비스는 계속 제공
    return { 
      success: true, 
      tracked: false, 
      error: error.message 
    };
  }
}

/**
 * 토큰 한도 사전 체크
 */
async function checkTokenLimit(userId, estimatedTokens = 100) {
  try {
    if (!userId) {
      return { success: true, hasLimit: true };
    }

    if (!supabase) {
      console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다');
      return { success: true, hasLimit: true };
    }

    // 현재 구독 사이클 조회
    const { data: cycle } = await supabase
      .from('subscription_cycle')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!cycle) {
      // 사이클이 없으면 기본 한도로 허용
      return { success: true, hasLimit: true };
    }

    if (cycle.is_exceeded) {
      return {
        success: false,
        hasLimit: false,
        error: `토큰 한도를 초과했습니다. 구독을 업그레이드해주세요. 월 토큰 한도: ${cycle.monthly_token_limit}`,
        remaining: 0,
        limit: cycle.monthly_token_limit
      };
    }

    if (cycle.tokens_remaining < estimatedTokens) {
      return {
        success: false,
        hasLimit: false,
        error: `남은 토큰(${cycle.tokens_remaining})이 부족합니다. 필요 토큰: ${estimatedTokens}. 월 토큰 한도: ${cycle.monthly_token_limit}`,
        remaining: cycle.tokens_remaining,
        limit: cycle.monthly_token_limit
      };
    }

    return {
      success: true,
      hasLimit: true,
      remaining: cycle.tokens_remaining,
      limit: cycle.monthly_token_limit
    };

  } catch (error) {
    console.error('토큰 한도 체크 오류:', error);
    return { success: true, hasLimit: true }; // 오류 시에도 서비스 제공
  }
}

/**
 * Express 미들웨어 래퍼
 */
function tokenTrackerMiddleware() {
  return async (req, res, next) => {
    // 원본 res.json 저장
    const originalJson = res.json;

    // res.json 오버라이드
    res.json = async function(data) {
      // AI 응답에 usage 정보가 있으면 토큰 추적
      if (data?.usage || data?.data?.usage) {
        const userId = await extractUserId(req);
        const usage = data.usage || data.data.usage;
        const apiType = req.path.includes('chatgpt') ? 'chatgpt' : 
                       req.path.includes('claude') ? 'claude' : 
                       req.path.includes('generate-reply') ? 'reply' : 'other';

        const trackingResult = await trackTokenUsage(userId, usage, apiType);
        
        // 토큰 추적 결과를 응답에 추가
        if (data.data) {
          data.data.tokenTracking = trackingResult;
        } else {
          data.tokenTracking = trackingResult;
        }
      }

      // 원본 res.json 호출
      return originalJson.call(this, data);
    };

    next();
  };
}

module.exports = {
  trackTokenUsage,
  checkTokenLimit,
  extractUserId,
  tokenTrackerMiddleware
};
