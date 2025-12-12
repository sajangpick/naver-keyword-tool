/**
 * 토큰 사용량 관리 API
 * 토큰 사용을 기록하고 한도를 체크합니다
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * 토큰 한도 체크 및 차감
 */
async function checkAndUpdateTokenLimit(userId, tokensToUse) {
  // 데모 모드일 때는 토큰 체크 우회
  if (userId === 'demo_user_12345' || !userId) {
    console.log('✅ [token-usage] 데모 모드 또는 userId 없음: 토큰 체크 우회');
    return {
      success: true,
      tokensUsed: 0,
      tokensRemaining: 999999,
      monthlyLimit: 999999
    };
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('membership_level, user_type')
        .eq('id', userId)
        .single();

      const membershipLevel = profile?.membership_level || 'seed';
      const userType = profile?.user_type || 'owner';

      // 관리자 설정에서 토큰 한도 조회 (최신 설정 우선)
      const { data: tokenConfigs } = await supabase
        .from('token_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      const tokenLimitKey = `${userType}_${membershipLevel}_limit`;
      const latestConfig = tokenConfigs || {};
      const monthlyLimit = latestConfig[tokenLimitKey] || 100;
      
      console.log(`✅ [token-usage] 새 사이클 생성 - 관리자 설정 한도: ${monthlyLimit} (${tokenLimitKey})`);

      // 새 사이클 생성
      const today = new Date();
      const cycleEnd = new Date(today);
      cycleEnd.setDate(cycleEnd.getDate() + 30);

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
          billing_amount: 0, // 씨앗 등급은 무료
          payment_status: 'completed'
        })
        .select()
        .single();

      if (createError) throw createError;
      
      return checkAndUpdateTokenLimit(userId, tokensToUse); // 재귀 호출
    }

    // 관리자 설정에서 최신 토큰 한도 가져오기 (우선 사용)
    const { data: profile } = await supabase
      .from('profiles')
      .select('membership_level, user_type')
      .eq('id', userId)
      .single();

    const userType = profile?.user_type || 'owner';
    const membershipLevel = profile?.membership_level || 'seed';
    const tokenLimitKey = `${userType}_${membershipLevel}_limit`;
    
    // 관리자 설정에서 최신 한도 조회
    let currentTokenLimit = cycle.monthly_token_limit; // 기본값: 사이클 값
    try {
      const { data: tokenConfigs } = await supabase
        .from('token_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (tokenConfigs && tokenConfigs[tokenLimitKey] !== undefined && tokenConfigs[tokenLimitKey] !== null) {
        currentTokenLimit = Number(tokenConfigs[tokenLimitKey]);
        console.log(`✅ [token-usage] 관리자 설정 한도 사용: ${currentTokenLimit} (${tokenLimitKey})`);
        
        // 사이클의 한도와 다르면 사이클 업데이트
        if (cycle.monthly_token_limit !== currentTokenLimit) {
          console.log(`🔄 [token-usage] 사이클 한도 업데이트: ${cycle.monthly_token_limit} → ${currentTokenLimit}`);
          await supabase
            .from('subscription_cycle')
            .update({
              monthly_token_limit: currentTokenLimit,
              tokens_remaining: currentTokenLimit - (cycle.tokens_used || 0),
              updated_at: new Date().toISOString()
            })
            .eq('id', cycle.id);
          console.log('✅ [token-usage] 사이클 한도 업데이트 완료');
        }
      }
    } catch (error) {
      console.log('⚠️ [token-usage] 관리자 설정 조회 실패, 사이클 값 사용:', error.message);
    }

    // 토큰 한도 체크 (관리자 설정 기준)
    const newTokensUsed = (cycle.tokens_used || 0) + tokensToUse;
    const tokensRemaining = currentTokenLimit - newTokensUsed;

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
        error: '토큰 한도를 초과했습니다',
        tokensUsed: cycle.tokens_used,
        monthlyLimit: currentTokenLimit, // 관리자 설정 값 반환
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
      monthlyLimit: currentTokenLimit, // 관리자 설정 값 반환
      tokensRemaining: tokensRemaining
    };

  } catch (error) {
    console.error('토큰 한도 체크 오류:', error);
    throw error;
  }
}

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // POST: 토큰 사용 기록
    if (req.method === 'POST') {
      const { 
        user_id,
        store_id,
        input_tokens = 0,
        output_tokens = 0,
        api_type = 'chatgpt',
        total_tokens
      } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: '사용자 ID가 필요합니다'
        });
      }

      const tokensUsed = total_tokens || (input_tokens + output_tokens);

      // 토큰 한도 체크 및 차감
      const limitCheck = await checkAndUpdateTokenLimit(user_id, tokensUsed);
      
      if (!limitCheck.success) {
        return res.status(403).json(limitCheck);
      }

      // 토큰 사용 기록 저장
      const { data: usageRecord, error: insertError } = await supabase
        .from('token_usage')
        .insert({
          user_id,
          store_id,
          tokens_used: tokensUsed,
          api_type,
          input_tokens,
          output_tokens,
          used_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(`✅ 토큰 사용 기록: ${user_id} - ${tokensUsed} 토큰`);

      return res.json({
        success: true,
        usage: usageRecord,
        remaining: limitCheck.tokensRemaining,
        limit: limitCheck.monthlyLimit,
        message: `${tokensUsed} 토큰이 사용되었습니다. 남은 토큰: ${limitCheck.tokensRemaining}`
      });
    }

    // GET: 토큰 사용 내역 조회
    if (req.method === 'GET') {
      const { user_id, limit = 10 } = req.query;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: '사용자 ID가 필요합니다'
        });
      }

      // 사용자 프로필 조회 (등급 확인) - 먼저 조회
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('membership_level, user_type')
        .eq('id', user_id)
        .single();

      // 현재 구독 사이클 조회 (먼저 조회하여 실제 한도 확인)
      const { data: cycle } = await supabase
        .from('subscription_cycle')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // 토큰 한도 조회 우선순위 (관리자 설정 우선):
      // 1. member_custom_token_limit (개인 맞춤 한도) - 최우선
      // 2. token_config (관리자 설정) - 관리자에서 설정한 값 사용
      // 3. subscription_cycle.monthly_token_limit (사이클 한도) - 참고용
      let currentTokenLimit = 0;
      const userType = profile?.user_type || 'owner';
      const membershipLevel = profile?.membership_level || 'seed';
      const tokenLimitKey = `${userType}_${membershipLevel}_limit`;
      
      console.log(`🔍 토큰 한도 조회 시작: user_id=${user_id}, userType=${userType}, level=${membershipLevel}, key=${tokenLimitKey}`);
      
      // 1단계: 개인 맞춤 토큰 한도 확인 (최우선)
      try {
        const { data: customLimit, error: customError } = await supabase
          .from('member_custom_token_limit')
          .select('custom_limit')
          .eq('member_id', user_id)
          .is('applied_until', null) // 적용 기간이 만료되지 않은 것만
          .or('applied_until.gte.' + new Date().toISOString().split('T')[0])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (!customError && customLimit && customLimit.custom_limit) {
          currentTokenLimit = Number(customLimit.custom_limit);
          console.log(`✅ 개인 맞춤 토큰 한도 사용: ${currentTokenLimit}`);
        } else {
          // 2단계: 관리자 설정(token_config)에서 최신 한도 조회 (우선 사용)
          try {
            const { data: tokenConfigs, error: configError } = await supabase
              .from('token_config')
              .select('*')
              .order('updated_at', { ascending: false })
              .limit(1);
            
            if (configError) {
              console.error('❌ token_config 조회 실패:', configError);
              // 3단계: 사이클 값 사용 (fallback)
              if (cycle && cycle.monthly_token_limit) {
                currentTokenLimit = Number(cycle.monthly_token_limit);
                console.log(`✅ 사이클 토큰 한도 사용 (fallback): ${currentTokenLimit}`);
              } else {
                currentTokenLimit = 100;
              }
            } else if (!tokenConfigs || tokenConfigs.length === 0) {
              console.warn('⚠️ token_config 데이터가 없습니다. 사이클 값 또는 기본값 사용');
              // 3단계: 사이클 값 사용 (fallback)
              if (cycle && cycle.monthly_token_limit) {
                currentTokenLimit = Number(cycle.monthly_token_limit);
                console.log(`✅ 사이클 토큰 한도 사용 (fallback): ${currentTokenLimit}`);
              } else {
                currentTokenLimit = 100;
              }
            } else {
              const latestTokenConfig = tokenConfigs[0];
              console.log('✅ token_config 조회 성공 (관리자 설정):', JSON.stringify(latestTokenConfig, null, 2));
              
              // 관리자 설정에서 한도 가져오기
              const limitValue = latestTokenConfig[tokenLimitKey];
              console.log(`🔍 관리자 설정 ${tokenLimitKey} 값:`, limitValue, '(타입:', typeof limitValue, ')');
              
              if (limitValue !== undefined && limitValue !== null && limitValue !== 0) {
                currentTokenLimit = Number(limitValue);
                console.log(`✅ 관리자 설정 토큰 한도 사용: ${currentTokenLimit} (${tokenLimitKey})`);
                
                // 사이클의 한도와 다르면 사이클 업데이트 (관리자 설정 반영)
                if (cycle && cycle.monthly_token_limit !== currentTokenLimit) {
                  console.log(`🔄 사이클 한도 업데이트: ${cycle.monthly_token_limit} → ${currentTokenLimit}`);
                  await supabase
                    .from('subscription_cycle')
                    .update({
                      monthly_token_limit: currentTokenLimit,
                      tokens_remaining: currentTokenLimit - (cycle.tokens_used || 0),
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', cycle.id);
                  console.log('✅ 사이클 한도 업데이트 완료');
                }
              } else {
                console.warn(`⚠️ ${tokenLimitKey} 값이 ${limitValue}입니다. 사이클 값 사용`);
                // 3단계: 사이클 값 사용 (fallback)
                if (cycle && cycle.monthly_token_limit) {
                  currentTokenLimit = Number(cycle.monthly_token_limit);
                  console.log(`✅ 사이클 토큰 한도 사용 (fallback): ${currentTokenLimit}`);
                } else {
                  currentTokenLimit = 100;
                }
              }
            }
          } catch (error) {
            console.error('❌ token_config에서 최신 한도 조회 실패:', error.message);
            // 3단계: 사이클 값 사용 (fallback)
            if (cycle && cycle.monthly_token_limit) {
              currentTokenLimit = Number(cycle.monthly_token_limit);
              console.log(`✅ 사이클 토큰 한도 사용 (fallback): ${currentTokenLimit}`);
            } else {
              currentTokenLimit = 100;
            }
          }
        }
      } catch (error) {
        console.error('❌ 개인 맞춤 토큰 한도 조회 실패:', error.message);
        // 에러 발생 시 관리자 설정 또는 사이클 값 사용
        try {
          const { data: tokenConfigs } = await supabase
            .from('token_config')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1);
          
          if (tokenConfigs && tokenConfigs.length > 0) {
            const limitValue = tokenConfigs[0][tokenLimitKey];
            if (limitValue !== undefined && limitValue !== null && limitValue !== 0) {
              currentTokenLimit = Number(limitValue);
              console.log(`✅ 관리자 설정 토큰 한도 사용 (fallback): ${currentTokenLimit}`);
            } else if (cycle && cycle.monthly_token_limit) {
              currentTokenLimit = Number(cycle.monthly_token_limit);
              console.log(`✅ 사이클 토큰 한도 사용 (fallback): ${currentTokenLimit}`);
            } else {
              currentTokenLimit = 100;
            }
          } else if (cycle && cycle.monthly_token_limit) {
            currentTokenLimit = Number(cycle.monthly_token_limit);
            console.log(`✅ 사이클 토큰 한도 사용 (fallback): ${currentTokenLimit}`);
          } else {
            currentTokenLimit = 100;
          }
        } catch (configErr) {
          if (cycle && cycle.monthly_token_limit) {
            currentTokenLimit = Number(cycle.monthly_token_limit);
            console.log(`✅ 사이클 토큰 한도 사용 (fallback): ${currentTokenLimit}`);
          } else {
            currentTokenLimit = 100;
          }
        }
      }
      
      console.log(`✅ 최종 토큰 한도: ${currentTokenLimit} (사용자: ${userType}_${membershipLevel})`);

      // 토큰 사용 내역 조회
      const { data: usage, error: fetchError } = await supabase
        .from('token_usage')
        .select('*')
        .eq('user_id', user_id)
        .order('used_at', { ascending: false })
        .limit(parseInt(limit));

      if (fetchError) throw fetchError;

      // 토큰 사용량 계산
      const tokensUsed = cycle?.tokens_used || 0;
      let tokensRemaining = 0;
      
      if (cycle) {
        // 사이클이 있으면 사이클의 남은 토큰 사용
        tokensRemaining = cycle.tokens_remaining || 0;
      } else {
        // 사이클이 없으면 최신 한도가 남은 토큰
        tokensRemaining = currentTokenLimit;
      }

      return res.json({
        success: true,
        usage: usage || [],
        cycle: cycle || null,
        summary: {
          monthlyLimit: currentTokenLimit, // 최신 토큰 한도 사용 (관리자 설정 반영)
          tokensUsed: tokensUsed,
          tokensRemaining: tokensRemaining,
          isExceeded: cycle?.is_exceeded || false
        }
      });
    }

    return res.status(405).json({
      success: false,
      error: '허용되지 않은 메소드입니다'
    });

  } catch (error) {
    console.error('❌ 토큰 사용량 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '토큰 사용량 처리 중 오류가 발생했습니다'
    });
  }
};
