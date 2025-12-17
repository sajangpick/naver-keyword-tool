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
 * 데모 모드 확인
 */
function isDemoMode(req) {
  // 헤더에서 데모 모드 확인
  const demoHeader = req.headers['x-demo-mode'];
  if (demoHeader === 'true') {
    return true;
  }
  
  // body에서 데모 모드 확인
  if (req.body?.demoMode === true || req.body?.isDemoMode === true) {
    return true;
  }
  
  return false;
}

/**
 * 사용자 ID 추출 (다양한 소스에서)
 */
async function extractUserId(req) {
  try {
    // 데모 모드일 때는 데모 사용자 ID 반환
    if (isDemoMode(req)) {
      return 'demo_user_12345';
    }

    // 1. 요청 body에서 직접 전달된 경우
    if (req.body?.userId || req.body?.user_id) {
      const userId = req.body.userId || req.body.user_id;
      // 데모 사용자 ID인 경우
      if (userId === 'demo_user_12345') {
        return userId;
      }
      return userId;
    }

    // 2. Authorization 헤더에서 추출
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // 데모 토큰인 경우
      if (token === 'demo_token') {
        return 'demo_user_12345';
      }
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) return user.id;
    }

    // 3. 쿠키에서 추출
    const cookies = req.headers.cookie;
    if (cookies) {
      const userIdMatch = cookies.match(/userId=([^;]+)/);
      if (userIdMatch) {
        const userId = userIdMatch[1];
        if (userId === 'demo_user_12345') {
          return userId;
        }
        return userId;
      }
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
async function checkAndUpdateTokenLimit(userId, tokensToUse, isDemoMode = false) {
  // 데모 모드일 때는 토큰 체크 우회
  if (isDemoMode || userId === 'demo_user_12345' || !userId) {
    console.log('✅ [token-tracker] 데모 모드 또는 userId 없음: 토큰 체크 우회');
    return {
      success: true,
      tokensUsed: 0,
      tokensRemaining: 999999,
      monthlyLimit: 999999
    };
  }

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

      // 사용자 프로필 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type, membership_level')
        .eq('id', userId)
        .single();

      const userType = profile?.user_type || 'owner';
      const membershipLevel = profile?.membership_level || 'seed';
      
      // token_config에서 최신 토큰 한도 가져오기
      let monthlyLimit = 100; // 기본값
      try {
        const { data: tokenConfig } = await supabase
          .from('token_config')
          .select('*')
          .single();

        if (tokenConfig) {
          const tokenLimitKey = `${userType}_${membershipLevel}_limit`;
          monthlyLimit = tokenConfig[tokenLimitKey] || monthlyLimit;
        }
      } catch (error) {
        console.log('⚠️ token_config 조회 실패, 기본값 사용:', error.message);
      }

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
      
      return checkAndUpdateTokenLimit(userId, tokensToUse, isDemoMode); // 재귀 호출
    }

    // 토큰 한도 체크
    const newTokensUsed = (cycle.tokens_used || 0) + tokensToUse;
    const tokensRemaining = cycle.monthly_token_limit - newTokensUsed;

    // token_config에서 최신 토큰 한도 가져오기 (관리자 설정 반영)
    let currentTokenLimit = cycle.monthly_token_limit;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('membership_level, user_type')
        .eq('id', userId)
        .single();

      if (profile) {
        const userType = profile.user_type || 'owner';
        const membershipLevel = profile.membership_level || 'seed';
        const tokenLimitKey = `${userType}_${membershipLevel}_limit`;
        
        const { data: latestTokenConfig } = await supabase
          .from('token_config')
          .select(tokenLimitKey)
          .single();
        
        if (latestTokenConfig && latestTokenConfig[tokenLimitKey] !== undefined) {
          currentTokenLimit = latestTokenConfig[tokenLimitKey];
        }
      }
    } catch (error) {
      // 에러 발생 시 사이클의 값 사용
      console.log('⚠️ token_config에서 최신 한도 조회 실패, 사이클 값 사용:', error.message);
    }

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
        error: `토큰 한도를 초과했습니다. 월 토큰 한도: ${currentTokenLimit}`,
        tokensUsed: cycle.tokens_used,
        monthlyLimit: currentTokenLimit,
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
      monthlyLimit: currentTokenLimit // 최신 토큰 한도 사용
    };

  } catch (error) {
    console.error('❌ 토큰 한도 체크 오류:', error);
    throw error;
  }
}

/**
 * 토큰 사용량 기록 및 한도 체크
 */
async function trackTokenUsage(userId, usage, apiType = 'chatgpt', storeId = null, isDemoMode = false) {
  try {
    // 데모 모드일 때는 토큰 추적 우회
    if (isDemoMode || userId === 'demo_user_12345' || !userId) {
      console.log('✅ [token-tracker] 데모 모드 또는 userId 없음: 토큰 추적 우회');
      return { 
        success: true, 
        tracked: false,
        tokensUsed: 0,
        remaining: 999999,
        limit: 999999
      };
    }

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
    const limitCheck = await checkAndUpdateTokenLimit(userId, totalTokens, isDemoMode);
    
    if (!limitCheck.success) {
      console.error('❌ 토큰 사용량 기록 실패:', limitCheck.error);
      return {
        success: false,
        error: limitCheck.error,
        exceeded: true,
        remaining: 0
      };
    }

    // 토큰 사용 기록 저장 (내부 추적용)
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

    // 작업 크레딧 변환 및 기록
    try {
      // apiType을 기반으로 서비스 타입 및 작업 크레딧 결정 (작업당 고정 크레딧)
      const serviceTypeMapping = {
        'chatgpt-blog': { serviceType: 'blog_writing', creditWeight: 5 },
        'blog': { serviceType: 'blog_writing', creditWeight: 5 },
        'review-reply': { serviceType: 'review_reply', creditWeight: 1 },
        'review-reply-promo': { serviceType: 'review_reply', creditWeight: 1 },
        'naver-auto-reply': { serviceType: 'review_reply', creditWeight: 1 },
        'reply': { serviceType: 'review_reply', creditWeight: 1 },
        'video': { serviceType: 'video_generation', creditWeight: 10 },
        'video-generation': { serviceType: 'video_generation', creditWeight: 10 },
        'gemini-veo-video': { serviceType: 'video_generation', creditWeight: 10 }, // 영상 생성
        'ai-news-recommend': { serviceType: 'news', creditWeight: 1 }, // 뉴스 추천
        'news-ai-summary': { serviceType: 'news', creditWeight: 1 }, // 뉴스 요약
        'chat': { serviceType: 'review_reply', creditWeight: 1 }, // 채팅은 리뷰 답글과 동일
        'keyword': { serviceType: 'review_reply', creditWeight: 1 },
        'recipe': { serviceType: 'review_reply', creditWeight: 1 }
      };

      const serviceInfo = serviceTypeMapping[apiType] || { 
        serviceType: 'review_reply', 
        creditWeight: 1 
      };

      // 작업 크레딧 계산 (기능별 가중치 적용)
      // 실제로는 작업 단위당 크레딧이므로, 1회 작업 = 가중치 크레딧
      // 예: 블로그 작성 1회 = 5 크레딧, 리뷰 답글 1회 = 1 크레딧
      const workCreditsUsed = serviceInfo.creditWeight;

      // 작업 크레딧 사용 기록 저장
      const { error: creditInsertError } = await supabase
        .from('work_credit_usage')
        .insert({
          user_id: userId,
          store_id: storeId,
          service_type: serviceInfo.serviceType,
          work_credits_used: workCreditsUsed,
          input_tokens: usage.prompt_tokens || usage.input_tokens || 0,
          output_tokens: usage.completion_tokens || usage.output_tokens || 0,
          ai_model: apiType.includes('chatgpt') ? 'chatgpt' : (apiType.includes('gemini') ? 'gemini' : 'claude'),
          used_at: new Date().toISOString()
        });

      if (creditInsertError) {
        console.error('❌ 작업 크레딧 사용 기록 저장 실패:', creditInsertError);
      } else {
        console.log(`✅ 작업 크레딧 사용 기록: ${workCreditsUsed} 크레딧 (${serviceInfo.serviceType})`);
      }

      // ⚠️ 중요: subscription_cycle 테이블의 credits_used 업데이트
      // work_credit_usage에만 기록하고 subscription_cycle을 업데이트하지 않으면 크레딧이 소진되지 않음
      try {
        console.log(`🔄 [token-tracker] 크레딧 차감 시작: userId=${userId}, workCreditsUsed=${workCreditsUsed}, serviceType=${serviceInfo.serviceType}, apiType=${apiType}`);
        const { checkAndUpdateCreditLimit } = require('../subscription/token-usage');
        const creditUpdateResult = await checkAndUpdateCreditLimit(userId, workCreditsUsed);
        
        if (creditUpdateResult && creditUpdateResult.success) {
          console.log(`✅ [token-tracker] 크레딧 차감 완료: ${workCreditsUsed} 크레딧 (남은 크레딧: ${creditUpdateResult.creditsRemaining}/${creditUpdateResult.monthlyLimit})`);
        } else {
          const errorMsg = creditUpdateResult?.error || '알 수 없는 오류';
          console.error(`❌ [token-tracker] 크레딧 차감 실패: ${errorMsg}`);
          console.error(`❌ [token-tracker] 실패 상세:`, {
            creditUpdateResult,
            userId,
            workCreditsUsed,
            serviceType: serviceInfo.serviceType,
            apiType: apiType
          });
          // 크레딧 차감 실패는 심각한 문제이므로 에러를 다시 throw하지 않지만 로깅은 강화
        }
      } catch (creditUpdateError) {
        console.error('❌ [token-tracker] 크레딧 차감 중 예외 발생:', creditUpdateError);
        console.error('❌ [token-tracker] 예외 상세:', {
          message: creditUpdateError.message,
          stack: creditUpdateError.stack?.split('\n').slice(0, 10).join('\n'),
          code: creditUpdateError.code,
          details: creditUpdateError.details,
          hint: creditUpdateError.hint,
          userId,
          workCreditsUsed,
          serviceType: serviceInfo.serviceType,
          apiType: apiType
        });
        // 크레딧 차감 실패해도 토큰 추적은 성공으로 처리 (기록은 이미 저장됨)
        // 하지만 이는 심각한 문제이므로 관리자가 확인할 수 있도록 로그를 남김
      }
    } catch (creditError) {
      console.error('❌ 작업 크레딧 변환 오류:', creditError);
      // 작업 크레딧 기록 실패해도 토큰 추적은 성공으로 처리
    }

    console.log(`✅ 토큰 사용 기록: ${totalTokens} 토큰 (남은 토큰: ${limitCheck.tokensRemaining}/${limitCheck.monthlyLimit})`);

    // 기능 사용 기록도 함께 저장 (feature_usage_log)
    try {
      // apiType을 기반으로 기능 타입 매핑
      const featureMapping = {
        'chatgpt-blog': { featureType: 'blog', featureName: '블로그', actionType: 'create' },
        'review-reply': { featureType: 'review', featureName: '리뷰', actionType: 'generate' },
        'naver-auto-reply': { featureType: 'review', featureName: '리뷰', actionType: 'generate' },
        'reply': { featureType: 'review', featureName: '리뷰', actionType: 'generate' },
        'ai-news-recommend': { featureType: 'news', featureName: '뉴스', actionType: 'recommend' },
        'news-ai-summary': { featureType: 'news', featureName: '뉴스', actionType: 'summary' },
        'chat': { featureType: 'chat', featureName: '채팅', actionType: 'use' },
        'keyword': { featureType: 'keyword', featureName: '키워드검색', actionType: 'search' },
        'recipe': { featureType: 'recipe', featureName: '레시피', actionType: 'generate' },
        'video': { featureType: 'video', featureName: '영상', actionType: 'generate' }
      };

      const featureInfo = featureMapping[apiType] || { 
        featureType: 'other', 
        featureName: '기타', 
        actionType: 'use' 
      };

      // 사용자 프로필 정보 가져오기 (이메일, 이름)
      let userEmail = null;
      let userName = null;
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, name, store_name')
          .eq('id', userId)
          .single();

        if (profile) {
          userEmail = profile.email || null;
          userName = profile.name || profile.store_name || null;
        }
      } catch (profileError) {
        console.log('[token-tracker] 프로필 조회 실패 (기능 사용 기록):', profileError.message);
      }

      // 기능 사용 기록 저장
      const { error: featureLogError } = await supabase
        .from('feature_usage_log')
        .insert({
          user_id: userId,
          user_email: userEmail,
          user_name: userName,
          feature_type: featureInfo.featureType,
          feature_name: featureInfo.featureName,
          action_type: featureInfo.actionType,
          action_details: {
            api_type: apiType,
            tokens_used: totalTokens,
            input_tokens: usage.prompt_tokens || usage.input_tokens || 0,
            output_tokens: usage.completion_tokens || usage.output_tokens || 0
          },
          page_url: null, // 서버 사이드에서는 페이지 URL을 알 수 없음
          page_title: null,
          device_type: null, // 서버 사이드에서는 기기 정보를 알 수 없음
          browser: null,
          browser_version: null,
          user_agent: null,
          ip_address: null
        });

      if (featureLogError) {
        console.error('❌ 기능 사용 기록 저장 실패:', featureLogError);
        // 기능 사용 기록 실패해도 토큰 추적은 성공으로 처리
      } else {
        console.log(`✅ 기능 사용 기록 저장: ${featureInfo.featureName} (${featureInfo.actionType})`);
      }
    } catch (featureLogError) {
      console.error('❌ 기능 사용 기록 저장 중 오류:', featureLogError);
      // 기능 사용 기록 실패해도 토큰 추적은 성공으로 처리
    }

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
async function checkTokenLimit(userId, estimatedTokens = 100, isDemoMode = false) {
  try {
    // 데모 모드일 때는 토큰 체크 우회
    if (isDemoMode || userId === 'demo_user_12345' || !userId) {
      console.log('✅ [token-tracker] 데모 모드 또는 userId 없음: 토큰 한도 체크 우회');
      return {
        success: true,
        hasLimit: false,
        isUnlimited: true,
        remaining: null,
        limit: null,
        monthlyLimit: null,
        tokensRemaining: null
      };
    }

    if (!userId) {
      return { success: true, hasLimit: true };
    }

    if (!supabase) {
      console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다');
      return { success: true, hasLimit: true };
    }

    // 1. 전체 토큰 사용 제어 확인 (컬럼이 없어도 에러 없이 처리)
    try {
      const { data: tokenConfig } = await supabase
        .from('token_config')
        .select('token_usage_enabled')
        .single();

      if (tokenConfig && tokenConfig.token_usage_enabled === false) {
        return {
          success: false,
          hasLimit: false,
          error: '관리자에 의해 토큰 사용이 일시적으로 제한되었습니다. 잠시 후 다시 시도해주세요.',
          remaining: 0,
          limit: 0
        };
      }
    } catch (error) {
      // 컬럼이 없는 경우 무시하고 계속 진행
      console.log('⚠️ token_usage_enabled 컬럼이 없습니다. 기본값(true)으로 진행합니다.');
    }

    // 2. 사용자 프로필 조회 (등급 확인)
    const { data: profile } = await supabase
      .from('profiles')
      .select('membership_level, user_type')
      .eq('id', userId)
      .single();

    if (profile) {
      const userType = profile.user_type || 'owner';
      const membershipLevel = profile.membership_level || 'seed';
      const enabledKey = `${userType}_${membershipLevel}_enabled`;

      // 해당 등급의 토큰 사용 활성화 여부 확인 (컬럼이 없어도 에러 없이 처리)
      try {
        const { data: levelConfig } = await supabase
          .from('token_config')
          .select(enabledKey)
          .single();

        if (levelConfig && levelConfig[enabledKey] === false) {
          return {
            success: false,
            hasLimit: false,
            error: `관리자에 의해 ${membershipLevel} 등급의 토큰 사용이 제한되었습니다. 관리자에게 문의해주세요.`,
            remaining: 0,
            limit: 0
          };
        }
      } catch (error) {
        // 컬럼이 없는 경우 무시하고 계속 진행 (기본값: 활성화)
        console.log(`⚠️ ${enabledKey} 컬럼이 없습니다. 기본값(true)으로 진행합니다.`);
      }
    }

    // 3. token_config에서 최신 토큰 한도 먼저 가져오기 (관리자 설정 우선 사용)
    let currentTokenLimit = 100; // 기본값
    const userType = profile?.user_type || 'owner';
    const membershipLevel = profile?.membership_level || 'seed';
    const tokenLimitKey = `${userType}_${membershipLevel}_limit`;
    
    console.log(`🔍 [token-tracker] 토큰 한도 조회 시작: userId=${userId}, userType=${userType}, level=${membershipLevel}, key=${tokenLimitKey}`);
    
    // 4. 현재 구독 사이클 조회 (먼저 조회)
    const { data: cycle } = await supabase
      .from('subscription_cycle')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 관리자 설정에서 최신 한도 가져오기 (우선 사용)
    try {
      // token_config 조회 (여러 행이 있을 수 있으므로 최신 것 가져오기)
      const { data: tokenConfigs, error: configError } = await supabase
        .from('token_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);
      
      if (configError) {
        console.error('❌ [token-tracker] token_config 조회 실패:', configError);
        // 사이클 값 사용 (fallback)
        if (cycle && cycle.monthly_token_limit) {
          currentTokenLimit = Number(cycle.monthly_token_limit);
          console.log(`✅ [token-tracker] 사이클 토큰 한도 사용 (fallback): ${currentTokenLimit}`);
        }
      } else if (!tokenConfigs || tokenConfigs.length === 0) {
        console.warn('⚠️ [token-tracker] token_config 데이터가 없습니다. 사이클 값 사용');
        // 사이클 값 사용 (fallback)
        if (cycle && cycle.monthly_token_limit) {
          currentTokenLimit = Number(cycle.monthly_token_limit);
          console.log(`✅ [token-tracker] 사이클 토큰 한도 사용 (fallback): ${currentTokenLimit}`);
        }
      } else {
        const latestTokenConfig = tokenConfigs[0];
        console.log('✅ [token-tracker] token_config 조회 성공 (관리자 설정):', JSON.stringify(latestTokenConfig, null, 2));
        
        const limitValue = latestTokenConfig[tokenLimitKey];
        console.log(`🔍 [token-tracker] 관리자 설정 ${tokenLimitKey} 값:`, limitValue, '(타입:', typeof limitValue, ')');
        
        if (limitValue !== undefined && limitValue !== null && limitValue !== 0) {
          currentTokenLimit = Number(limitValue);
          console.log(`✅ [token-tracker] 관리자 설정 토큰 한도 사용: ${currentTokenLimit} (${tokenLimitKey})`);
          
          // 사이클의 한도와 다르면 사이클 업데이트 (관리자 설정 반영)
          if (cycle && cycle.monthly_token_limit !== currentTokenLimit) {
            console.log(`🔄 [token-tracker] 사이클 한도 업데이트: ${cycle.monthly_token_limit} → ${currentTokenLimit}`);
            await supabase
              .from('subscription_cycle')
              .update({
                monthly_token_limit: currentTokenLimit,
                tokens_remaining: currentTokenLimit - (cycle.tokens_used || 0),
                updated_at: new Date().toISOString()
              })
              .eq('id', cycle.id);
            console.log('✅ [token-tracker] 사이클 한도 업데이트 완료');
          }
        } else {
          console.warn(`⚠️ [token-tracker] ${tokenLimitKey} 값이 ${limitValue}입니다. 사이클 값 사용`);
          // 사이클 값 사용 (fallback)
          if (cycle && cycle.monthly_token_limit) {
            currentTokenLimit = Number(cycle.monthly_token_limit);
            console.log(`✅ [token-tracker] 사이클 토큰 한도 사용 (fallback): ${currentTokenLimit}`);
          }
        }
      }
    } catch (error) {
      // 컬럼이 없거나 에러 발생 시 사이클 값 사용
      console.error('❌ [token-tracker] token_config에서 최신 한도 조회 실패:', error.message);
      if (cycle && cycle.monthly_token_limit) {
        currentTokenLimit = Number(cycle.monthly_token_limit);
        console.log(`✅ [token-tracker] 사이클 토큰 한도 사용 (fallback): ${currentTokenLimit}`);
      }
    }

    // 무제한 토큰 체크 (사이클 확인 전에 먼저 체크)
    let normalizedLevel = (membershipLevel || '').toLowerCase();
    if (normalizedLevel === 'free') {
      normalizedLevel = 'seed';
    }
    const isAdmin = normalizedLevel === 'admin' || userType === 'admin';
    const tokensLimitNum = Number(currentTokenLimit) || 0;
    const isUnlimited = isAdmin || tokensLimitNum >= 999999;
    
    console.log(`🔍 [token-tracker] 무제한 체크 상세:`, {
      userId,
      membershipLevel,
      normalizedLevel,
      userType,
      isAdmin,
      currentTokenLimit,
      tokensLimitNum,
      isUnlimited,
      cycle_exists: !!cycle,
      cycle_monthly_token_limit: cycle?.monthly_token_limit,
      cycle_tokens_remaining: cycle?.tokens_remaining
    });
    
    if (isUnlimited) {
      console.log(`✅ [token-tracker] 무제한 토큰 사용자 - 토큰 체크 건너뜀: userId=${userId}, isAdmin=${isAdmin}, limit=${currentTokenLimit}`);
      return {
        success: true,
        hasLimit: false,
        isUnlimited: true,
        remaining: null,
        limit: null,
        monthlyLimit: null,
        tokensRemaining: null
      };
    }
    
    if (!cycle) {
      // 사이클이 없으면 관리자 설정 한도로 허용
      console.log(`✅ [token-tracker] 사이클이 없습니다. 관리자 설정 토큰 한도: ${currentTokenLimit}`);
      return { success: true, hasLimit: true, monthlyLimit: currentTokenLimit };
    }
    
    console.log(`✅ [token-tracker] 최종 토큰 한도: ${currentTokenLimit} (관리자 설정, 사이클 값: ${cycle.monthly_token_limit})`);
    
    if (cycle.is_exceeded) {
      return {
        success: false,
        hasLimit: false,
        error: `토큰 한도를 초과했습니다. 구독을 업그레이드해주세요. 월 토큰 한도: ${currentTokenLimit}`,
        remaining: 0,
        limit: currentTokenLimit,
        monthlyLimit: currentTokenLimit,
        tokensRemaining: 0
      };
    }

    // tokens_remaining이 null이거나 계산 필요할 수 있음
    let tokensRemaining = cycle.tokens_remaining;
    if (tokensRemaining === null || tokensRemaining === undefined) {
      tokensRemaining = currentTokenLimit - (cycle.tokens_used || 0);
    }
    
    // 무제한 토큰 재확인 (tokens_remaining이 매우 큰 값일 수도 있음)
    if (tokensRemaining >= 999999 || currentTokenLimit >= 999999) {
      console.log(`✅ [token-tracker] 무제한 토큰 재확인 - tokens_remaining=${tokensRemaining}, limit=${currentTokenLimit}`);
      return {
        success: true,
        hasLimit: false,
        isUnlimited: true,
        remaining: null,
        limit: null,
        monthlyLimit: null,
        tokensRemaining: null
      };
    }
    
    if (tokensRemaining < estimatedTokens) {
      return {
        success: false,
        hasLimit: false,
        error: `남은 토큰(${tokensRemaining})이 부족합니다. 필요 토큰: ${estimatedTokens}. 월 토큰 한도: ${currentTokenLimit}`,
        remaining: tokensRemaining,
        limit: currentTokenLimit,
        monthlyLimit: currentTokenLimit,
        tokensRemaining: tokensRemaining
      };
    }

    return {
      success: true,
      hasLimit: true,
      remaining: cycle.tokens_remaining,
      limit: currentTokenLimit,
      monthlyLimit: currentTokenLimit,
      tokensRemaining: cycle.tokens_remaining
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
  tokenTrackerMiddleware,
  isDemoMode
};
