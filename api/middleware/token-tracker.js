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
 * 토큰 사용량 기록 및 한도 체크
 */
async function trackTokenUsage(userId, usage, apiType = 'chatgpt', storeId = null) {
  try {
    if (!userId) {
      console.warn('⚠️ 사용자 ID가 없어 토큰 추적을 건너뜁니다');
      return { success: true, tracked: false };
    }

    const totalTokens = usage.total_tokens || 
                       (usage.prompt_tokens + usage.completion_tokens) ||
                       (usage.input_tokens + usage.output_tokens) || 0;

    if (totalTokens === 0) {
      console.warn('⚠️ 토큰 사용량이 0입니다');
      return { success: true, tracked: false };
    }

    // 토큰 사용량 기록 API 호출
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:5000'}/api/subscription/token-usage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId,
        store_id: storeId,
        input_tokens: usage.prompt_tokens || usage.input_tokens || 0,
        output_tokens: usage.completion_tokens || usage.output_tokens || 0,
        total_tokens: totalTokens,
        api_type: apiType
      })
    });

    const result = await response.json();

    if (!result.success) {
      console.error('❌ 토큰 사용량 기록 실패:', result.error);
      
      // 토큰 한도 초과인 경우
      if (response.status === 403) {
        return {
          success: false,
          error: result.error,
          exceeded: true,
          remaining: 0
        };
      }
      
      return result;
    }

    console.log(`✅ 토큰 사용 기록: ${totalTokens} 토큰 (남은 토큰: ${result.remaining}/${result.limit})`);

    return {
      success: true,
      tracked: true,
      tokensUsed: totalTokens,
      remaining: result.remaining,
      limit: result.limit
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

    // 현재 구독 상태 조회
    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:5000'}/api/subscription/token-usage?user_id=${userId}`, {
      method: 'GET'
    });

    const result = await response.json();

    if (!result.success) {
      console.error('토큰 한도 체크 실패:', result.error);
      return { success: true, hasLimit: true }; // 실패 시에도 서비스 제공
    }

    const { summary } = result;
    
    if (summary.isExceeded) {
      return {
        success: false,
        hasLimit: false,
        error: '토큰 한도를 초과했습니다. 구독을 업그레이드해주세요.',
        remaining: 0,
        limit: summary.monthlyLimit
      };
    }

    if (summary.tokensRemaining < estimatedTokens) {
      return {
        success: false,
        hasLimit: false,
        error: `남은 토큰(${summary.tokensRemaining})이 부족합니다. 필요 토큰: ${estimatedTokens}`,
        remaining: summary.tokensRemaining,
        limit: summary.monthlyLimit
      };
    }

    return {
      success: true,
      hasLimit: true,
      remaining: summary.tokensRemaining,
      limit: summary.monthlyLimit
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
