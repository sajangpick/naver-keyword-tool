/**
 * 작업 크레딧 사용량 관리 API
 * 작업 크레딧 사용을 기록하고 한도를 체크합니다
 * 작업 크레딧 = 토큰 수 × 가중치 (기능별로 다름)
 */

const { createClient } = require('@supabase/supabase-js');
const { isDemoMode } = require('../middleware/credit-tracker');

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * 크레딧 한도 체크 및 차감
 * 다른 모듈에서도 사용 가능하도록 export
 */
async function checkAndUpdateCreditLimit(userId, creditsToUse) {
  // 데모 모드일 때는 크레딧 체크 우회
  if (userId === 'demo_user_12345' || !userId) {
    console.log('✅ [credit-usage] 데모 모드 또는 userId 없음: 크레딧 체크 우회');
    return {
      success: true,
      creditsUsed: 0,
      creditsRemaining: 999999,
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
      .maybeSingle();

    if (cycleError || !cycle) {
      // 구독 사이클이 없으면 새로 생성 (기본: 씨앗 등급)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('membership_level, user_type')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError) {
        console.error('❌ [credit-usage] 프로필 조회 실패:', profileError);
      }

      const membershipLevel = profile?.membership_level || 'seed';
      const userType = profile?.user_type || 'owner';

      // 관리자 설정에서 크레딧 한도 조회 (최신 설정 우선)
      const { data: creditConfigs, error: configError } = await supabase
        .from('credit_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const creditLimitKey = `${userType}_${membershipLevel}_limit`;
      const latestConfig = creditConfigs || {};
      const monthlyLimit = latestConfig[creditLimitKey] || 100;
      
      console.log(`✅ [credit-usage] 새 사이클 생성 - 관리자 설정 한도: ${monthlyLimit} (${creditLimitKey})`);

      // pricing_config에서 포함된 크레딧 조회 (우선순위)
      const { data: pricingConfig, error: pricingError } = await supabase
        .from('pricing_config')
        .select('*')
        .maybeSingle();
      
      const includedCreditsKey = `${userType}_${membershipLevel}_included_credits`;
      const actualIncludedCredits = (!pricingError && pricingConfig && pricingConfig[includedCreditsKey]) ? Number(pricingConfig[includedCreditsKey]) : monthlyLimit;

      // 새 사이클 생성 (작업 크레딧 시스템)
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
          monthly_token_limit: actualIncludedCredits, // 하위 호환성
          tokens_used: 0,
          tokens_remaining: actualIncludedCredits,
          included_credits: actualIncludedCredits, // 작업 크레딧 시스템
          credits_used: 0,
          credits_remaining: actualIncludedCredits,
          status: 'active',
          billing_amount: 0, // 씨앗 등급은 무료
          payment_status: 'completed'
        })
        .select()
        .single();

      if (createError) throw createError;
      
      return checkAndUpdateCreditLimit(userId, creditsToUse); // 재귀 호출
    }

    // 관리자 설정에서 최신 크레딧 한도 가져오기 (우선 사용)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('membership_level, user_type')
      .eq('id', userId)
      .maybeSingle();
    
    if (profileError) {
      console.error('❌ [credit-usage] 프로필 조회 실패:', profileError);
    }

    const userType = profile?.user_type || 'owner';
    const membershipLevel = profile?.membership_level || 'seed';
    const creditLimitKey = `${userType}_${membershipLevel}_limit`;
    
    // 작업 크레딧 시스템: included_credits 우선 사용
    let currentCreditLimit = cycle.included_credits || cycle.monthly_token_limit || 0;
    
    try {
      // pricing_config에서 포함된 크레딧 조회 (최우선)
      const { data: pricingConfig, error: pricingError } = await supabase
        .from('pricing_config')
        .select('*')
        .maybeSingle();
      
      if (!pricingError && pricingConfig) {
        const includedCreditsKey = `${userType}_${membershipLevel}_included_credits`;
        if (pricingConfig[includedCreditsKey] !== undefined && pricingConfig[includedCreditsKey] !== null) {
          currentCreditLimit = Number(pricingConfig[includedCreditsKey]);
          console.log(`✅ [credit-usage] pricing_config 포함 크레딧 사용: ${currentCreditLimit}`);
        } else {
          // pricing_config에 값이 없으면 credit_config 조회
          const { data: creditConfigs, error: configError } = await supabase
            .from('credit_config')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (!configError && creditConfigs && creditConfigs[creditLimitKey] !== undefined && creditConfigs[creditLimitKey] !== null) {
            currentCreditLimit = Number(creditConfigs[creditLimitKey]);
            console.log(`✅ [credit-usage] 관리자 설정 한도 사용: ${currentCreditLimit}`);
          }
        }
      } else {
        // pricing_config 조회 실패하거나 없으면 credit_config 조회
        const { data: creditConfigs, error: configError } = await supabase
          .from('credit_config')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!configError && creditConfigs && creditConfigs[creditLimitKey] !== undefined && creditConfigs[creditLimitKey] !== null) {
          currentCreditLimit = Number(creditConfigs[creditLimitKey]);
          console.log(`✅ [credit-usage] 관리자 설정 한도 사용: ${currentCreditLimit}`);
        }
      }
      
      // 사이클 업데이트 (포함 크레딧 값과 다를 경우)
      if (cycle.included_credits !== currentCreditLimit) {
        console.log(`🔄 [credit-usage] 사이클 포함 크레딧 업데이트: ${cycle.included_credits || 0} → ${currentCreditLimit}`);
        await supabase
          .from('subscription_cycle')
          .update({
            included_credits: currentCreditLimit,
            credits_remaining: currentCreditLimit - (cycle.credits_used || 0),
            monthly_token_limit: currentCreditLimit, // 하위 호환성
            tokens_remaining: currentCreditLimit - (cycle.credits_used || 0),
            updated_at: new Date().toISOString()
          })
          .eq('id', cycle.id);
        console.log('✅ [credit-usage] 사이클 포함 크레딧 업데이트 완료');
      }
    } catch (error) {
      console.log('⚠️ [credit-usage] 관리자 설정 조회 실패, 사이클 값 사용:', error.message);
    }

    // 크레딧 한도 체크 (작업 크레딧 기준)
    const currentCreditsUsed = cycle.credits_used || cycle.tokens_used || 0;
    const newCreditsUsed = currentCreditsUsed + creditsToUse;
    const creditsRemaining = currentCreditLimit - newCreditsUsed;

    if (creditsRemaining < 0) {
      // 한도 초과
      await supabase
        .from('subscription_cycle')
        .update({
          status: 'exceeded',
          is_exceeded: true,
          exceeded_at: new Date().toISOString(),
          credits_used: newCreditsUsed,
          credits_remaining: 0,
          tokens_used: newCreditsUsed, // 하위 호환성
          tokens_remaining: 0
        })
        .eq('id', cycle.id);

      return {
        success: false,
        error: '작업 크레딧 한도를 초과했습니다',
        creditsUsed: cycle.credits_used || cycle.tokens_used || 0,
        monthlyLimit: currentCreditLimit,
        creditsRemaining: 0
      };
    }

    // 크레딧 사용량 업데이트 (작업 크레딧 시스템)
    console.log(`🔄 [credit-usage] subscription_cycle 업데이트 시작: cycle.id=${cycle.id}, userId=${userId}, 현재 credits_used=${cycle.credits_used || 0}, 새로운 credits_used=${newCreditsUsed}, credits_remaining=${creditsRemaining}`);
    
    const { data: updatedCycle, error: updateError } = await supabase
      .from('subscription_cycle')
      .update({
        credits_used: newCreditsUsed,
        credits_remaining: creditsRemaining,
        tokens_used: newCreditsUsed, // 하위 호환성
        tokens_remaining: creditsRemaining,
        updated_at: new Date().toISOString()
      })
      .eq('id', cycle.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ [credit-usage] subscription_cycle 업데이트 실패:', updateError);
      console.error('❌ [credit-usage] 업데이트 실패 상세:', {
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint,
        cycle_id: cycle.id,
        userId: userId,
        creditsToUse: creditsToUse,
        newCreditsUsed: newCreditsUsed,
        creditsRemaining: creditsRemaining
      });
      throw updateError;
    }

    console.log(`✅ [credit-usage] subscription_cycle 업데이트 완료: cycle.id=${cycle.id}, credits_used=${updatedCycle?.credits_used || newCreditsUsed}, credits_remaining=${updatedCycle?.credits_remaining || creditsRemaining}`);

    return {
      success: true,
      creditsUsed: newCreditsUsed,
      monthlyLimit: currentCreditLimit, // 관리자 설정 값 반환
      creditsRemaining: creditsRemaining
    };

  } catch (error) {
    console.error('❌ [credit-usage] 크레딧 한도 체크 오류:', error);
    console.error('❌ [credit-usage] 오류 상세:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      userId,
      creditsToUse
    });
    throw error;
  }
}

// 함수를 export하여 다른 모듈에서 사용 가능하도록
// 기본 export는 API 핸들러, named export는 함수
const apiHandler = async (req, res) => {
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
    // POST: 크레딧 사용 기록
    if (req.method === 'POST') {
      const { 
        user_id,
        store_id,
        service_type = 'review_reply', // 'review_reply', 'blog_writing', 'video_generation'
        input_tokens = 0,
        output_tokens = 0,
        api_type = 'chatgpt',
        total_tokens,
        ai_model
      } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: '사용자 ID가 필요합니다'
        });
      }

      // 작업 크레딧 가중치 조회 (작업당 고정 크레딧)
      const { data: workCreditConfig, error: workCreditConfigError } = await supabase
        .from('work_credit_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (workCreditConfigError) {
        console.error('❌ [credit-usage] work_credit_config 조회 실패:', workCreditConfigError);
      }
      
      // 작업당 고정 크레딧 (토큰 수와 무관하게 작업 1회당 차감)
      // 리뷰 답글: 1 크레딧, 블로그 작성: 5 크레딧, 영상 생성: 10 크레딧
      const creditMapping = {
        'review_reply': workCreditConfig?.review_reply_credit || 1,
        'blog_writing': workCreditConfig?.blog_writing_credit || 5,
        'video_generation': workCreditConfig?.video_generation_credit || 10
      };
      
      const workCreditsUsed = creditMapping[service_type] || 1; // 작업당 고정 크레딧 (토큰 수와 무관)

      // 크레딧 한도 체크 및 차감 (작업 크레딧 기준)
      const limitCheck = await checkAndUpdateCreditLimit(user_id, workCreditsUsed);
      
      if (!limitCheck.success) {
        return res.status(403).json(limitCheck);
      }

      // 작업 크레딧 사용 기록 저장 (work_credit_usage 테이블)
      const { data: usageRecord, error: insertError } = await supabase
        .from('work_credit_usage')
        .insert({
          user_id,
          store_id,
          service_type,
          work_credits_used: workCreditsUsed,
          input_tokens,
          output_tokens,
          ai_model: ai_model || api_type,
          usage_date: new Date().toISOString().split('T')[0],
          used_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const tokenCount = total_tokens || (input_tokens + output_tokens);
      console.log(`✅ 작업 크레딧 사용 기록: ${user_id} - ${workCreditsUsed} 크레딧 (${service_type}, 작업당 고정 크레딧)`);

      return res.json({
        success: true,
        usage: usageRecord,
        remaining: limitCheck.creditsRemaining,
        limit: limitCheck.monthlyLimit,
        workCreditsUsed,
        tokenCount,
        message: `${workCreditsUsed} 작업 크레딧이 사용되었습니다 (${service_type} 1회 작업). 남은 크레딧: ${limitCheck.creditsRemaining}`
      });
    }

    // GET: 크레딧 사용 내역 조회
    if (req.method === 'GET') {
      const { user_id, limit = 10 } = req.query;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: '사용자 ID가 필요합니다'
        });
      }

      // 데모 모드일 때는 무제한 크레딧 반환
      const demoMode = isDemoMode(req);
      if (demoMode || user_id === 'demo_user_12345') {
        console.log('✅ [credit-usage] 데모 모드 감지: 무제한 크레딧 반환');
        return res.json({
          success: true,
          usage: [],
          cycle: null,
          summary: {
            monthlyLimit: 999999,
            creditsUsed: 0,
            creditsRemaining: 999999,
            isExceeded: false
          }
        });
      }

      // 사용자 프로필 조회 (등급 확인) - 먼저 조회
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('membership_level, user_type')
        .eq('id', user_id)
        .maybeSingle();

      if (profileError) {
        console.error('❌ [credit-usage] 프로필 조회 실패:', profileError);
      }

      // 현재 구독 사이클 조회 (먼저 조회하여 실제 한도 확인)
      const { data: cycle, error: cycleError } = await supabase
        .from('subscription_cycle')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cycleError) {
        console.error('❌ [credit-usage] 구독 사이클 조회 실패:', cycleError);
      }

      // 작업 크레딧 한도 조회 우선순위:
      // 1. member_custom_credit_limit (개인 맞춤 한도) - 최우선
      // 2. pricing_config.included_credits (포함된 크레딧) - 작업 크레딧 시스템
      // 3. credit_config (관리자 설정) - 관리자에서 설정한 값 사용
      // 4. subscription_cycle.included_credits (사이클 포함 크레딧) - 작업 크레딧 시스템
      let currentCreditLimit = 0;
      const userType = profile?.user_type || 'owner';
      const membershipLevel = profile?.membership_level || 'seed';
      const creditLimitKey = `${userType}_${membershipLevel}_limit`;
      
      console.log(`🔍 크레딧 한도 조회 시작: user_id=${user_id}, userType=${userType}, level=${membershipLevel}, key=${creditLimitKey}`);
      
      // 1단계: 개인 맞춤 크레딧 한도 확인 (최우선)
      try {
        const { data: customLimit, error: customError } = await supabase
          .from('member_custom_credit_limit')
          .select('custom_limit')
          .eq('member_id', user_id)
          .is('applied_until', null) // 적용 기간이 만료되지 않은 것만
          .or('applied_until.gte.' + new Date().toISOString().split('T')[0])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!customError && customLimit && customLimit.custom_limit) {
          currentCreditLimit = Number(customLimit.custom_limit);
          console.log(`✅ 개인 맞춤 크레딧 한도 사용: ${currentCreditLimit}`);
        } else {
          // 2단계: pricing_config에서 포함된 크레딧 조회 (우선순위 높음)
          try {
            const { data: pricingConfig, error: pricingError } = await supabase
              .from('pricing_config')
              .select('*')
              .maybeSingle();
            
            if (!pricingError && pricingConfig) {
              const includedCreditsKey = `${userType}_${membershipLevel}_included_credits`;
              if (pricingConfig[includedCreditsKey] !== undefined && pricingConfig[includedCreditsKey] !== null) {
                currentCreditLimit = Number(pricingConfig[includedCreditsKey]);
                console.log(`✅ pricing_config 포함 크레딧 사용: ${currentCreditLimit} (${includedCreditsKey})`);
              } else {
                // pricing_config에 값이 없으면 credit_config 조회
                throw new Error('pricing_config에 해당 값 없음');
              }
            } else {
              // pricing_config 조회 실패하거나 없으면 credit_config 조회
              throw new Error('pricing_config 조회 실패');
            }
          } catch (pricingErr) {
            // 3단계: 관리자 설정(credit_config)에서 최신 한도 조회
            try {
              const { data: creditConfigs, error: configError } = await supabase
                .from('credit_config')
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              if (configError) {
                console.error('❌ credit_config 조회 실패:', configError);
                // 4단계: 사이클 값 사용 (fallback)
                if (cycle && cycle.monthly_credit_limit) {
                  currentCreditLimit = Number(cycle.monthly_credit_limit);
                  console.log(`✅ 사이클 크레딧 한도 사용 (fallback): ${currentCreditLimit}`);
                } else {
                  currentCreditLimit = 100;
                }
              } else if (!creditConfigs) {
                console.warn('⚠️ credit_config 데이터가 없습니다. 사이클 값 또는 기본값 사용');
                // 4단계: 사이클 값 사용 (fallback)
                if (cycle && cycle.monthly_credit_limit) {
                  currentCreditLimit = Number(cycle.monthly_credit_limit);
                  console.log(`✅ 사이클 크레딧 한도 사용 (fallback): ${currentCreditLimit}`);
                } else {
                  currentCreditLimit = 100;
                }
              } else {
                const latestCreditConfig = creditConfigs;
                console.log('✅ credit_config 조회 성공 (관리자 설정):', JSON.stringify(latestCreditConfig, null, 2));
                
                // 관리자 설정에서 한도 가져오기
                const limitValue = latestCreditConfig[creditLimitKey];
                console.log(`🔍 관리자 설정 ${creditLimitKey} 값:`, limitValue, '(타입:', typeof limitValue, ')');
                
                if (limitValue !== undefined && limitValue !== null && limitValue !== 0) {
                  currentCreditLimit = Number(limitValue);
                  console.log(`✅ 관리자 설정 크레딧 한도 사용: ${currentCreditLimit} (${creditLimitKey})`);
                  
                  // 사이클의 한도와 다르면 사이클 업데이트 (관리자 설정 반영)
                  if (cycle && cycle.monthly_credit_limit !== currentCreditLimit) {
                    console.log(`🔄 사이클 한도 업데이트: ${cycle.monthly_credit_limit} → ${currentCreditLimit}`);
                    await supabase
                      .from('subscription_cycle')
                      .update({
                        monthly_credit_limit: currentCreditLimit,
                        credits_remaining: currentCreditLimit - (cycle.credits_used || 0),
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', cycle.id);
                    console.log('✅ 사이클 한도 업데이트 완료');
                  }
                } else {
                  console.warn(`⚠️ ${creditLimitKey} 값이 ${limitValue}입니다. 사이클 값 사용`);
                  // 4단계: 사이클 값 사용 (fallback)
                  if (cycle && cycle.monthly_credit_limit) {
                    currentCreditLimit = Number(cycle.monthly_credit_limit);
                    console.log(`✅ 사이클 크레딧 한도 사용 (fallback): ${currentCreditLimit}`);
                  } else {
                    currentCreditLimit = 100;
                  }
                }
              }
            } catch (error) {
            console.error('❌ credit_config에서 최신 한도 조회 실패:', error.message);
            // 3단계: 사이클 값 사용 (fallback)
            if (cycle && cycle.monthly_credit_limit) {
              currentCreditLimit = Number(cycle.monthly_credit_limit);
              console.log(`✅ 사이클 크레딧 한도 사용 (fallback): ${currentCreditLimit}`);
            } else {
              currentCreditLimit = 100;
            }
          }
        }
      } catch (error) {
        console.error('❌ 개인 맞춤 크레딧 한도 조회 실패:', error.message);
        // 에러 발생 시 관리자 설정 또는 사이클 값 사용
        try {
          const { data: creditConfigs } = await supabase
            .from('credit_config')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (creditConfigs) {
            const limitValue = creditConfigs[creditLimitKey];
            if (limitValue !== undefined && limitValue !== null && limitValue !== 0) {
              currentCreditLimit = Number(limitValue);
              console.log(`✅ 관리자 설정 크레딧 한도 사용 (fallback): ${currentCreditLimit}`);
            } else if (cycle && cycle.monthly_credit_limit) {
              currentCreditLimit = Number(cycle.monthly_credit_limit);
              console.log(`✅ 사이클 크레딧 한도 사용 (fallback): ${currentCreditLimit}`);
            } else {
              currentCreditLimit = 100;
            }
          } else if (cycle && cycle.monthly_credit_limit) {
            currentCreditLimit = Number(cycle.monthly_credit_limit);
            console.log(`✅ 사이클 크레딧 한도 사용 (fallback): ${currentCreditLimit}`);
          } else {
            currentCreditLimit = 100;
          }
        } catch (configErr) {
          if (cycle && cycle.monthly_credit_limit) {
            currentCreditLimit = Number(cycle.monthly_credit_limit);
            console.log(`✅ 사이클 크레딧 한도 사용 (fallback): ${currentCreditLimit}`);
          } else {
            currentCreditLimit = 100;
          }
        }
      }
      
      console.log(`✅ 최종 크레딧 한도: ${currentCreditLimit} (사용자: ${userType}_${membershipLevel})`);

      // 작업 크레딧 사용 내역 조회 (work_credit_usage 테이블)
      let usage = [];
      let fetchError = null;
      
      try {
        const { data: usageData, error: usageError } = await supabase
          .from('work_credit_usage')
          .select('*')
          .eq('user_id', user_id)
          .order('used_at', { ascending: false })
          .limit(parseInt(limit) || 10);

        if (usageError) {
          console.error('❌ [credit-usage] work_credit_usage 조회 실패:', usageError);
          console.error('❌ [credit-usage] 에러 상세:', {
            message: usageError.message,
            code: usageError.code,
            details: usageError.details,
            hint: usageError.hint
          });
          fetchError = usageError;
        } else {
          usage = usageData || [];
          console.log(`✅ [credit-usage] work_credit_usage 조회 성공: ${usage.length}개 내역`);
        }
      } catch (error) {
        console.error('❌ [credit-usage] work_credit_usage 조회 중 예외 발생:', error);
        fetchError = error;
      }

      // 작업 크레딧 사용량 계산 (작업 크레딧 시스템)
      const creditsUsed = cycle?.credits_used || cycle?.tokens_used || 0;
      const includedCredits = cycle?.included_credits || cycle?.monthly_token_limit || currentCreditLimit;
      let creditsRemaining = 0;
      
      if (cycle) {
        // 사이클이 있으면 사이클의 남은 작업 크레딧 사용
        creditsRemaining = cycle.credits_remaining !== undefined ? cycle.credits_remaining : (includedCredits - creditsUsed);
      } else {
        // 사이클이 없으면 최신 한도가 남은 크레딧
        creditsRemaining = currentCreditLimit;
      }

      // fetchError가 있어도 사용 내역은 빈 배열로 반환 (테이블이 없거나 에러가 발생해도 계속 진행)
      const response = {
        success: true,
        usage: usage || [],
        cycle: cycle || null,
        summary: {
          monthlyLimit: includedCredits || currentCreditLimit, // 포함된 작업 크레딧 (관리자 설정 반영)
          includedCredits: includedCredits,
          creditsUsed: creditsUsed,
          creditsRemaining: creditsRemaining,
          isExceeded: cycle?.is_exceeded || false
        }
      };
      
      // 에러가 발생했지만 사용 내역 조회는 실패했을 수 있음 (경고만 추가)
      if (fetchError) {
        response.warning = '사용 내역 조회 중 오류가 발생했습니다. 크레딧 정보는 정상적으로 표시됩니다.';
        console.warn('⚠️ [credit-usage] 사용 내역 조회 실패했지만 계속 진행:', fetchError.message);
      }
      
      console.log(`✅ [credit-usage] GET 요청 완료: user_id=${user_id}, usage_count=${usage.length}, credits_used=${creditsUsed}, credits_remaining=${creditsRemaining}`);
      
      return res.json(response);
    }

    return res.status(405).json({
      success: false,
      error: '허용되지 않은 메소드입니다'
    });

  } catch (error) {
    console.error('❌ [credit-usage] 크레딧 사용량 API 최상위 오류:', error);
    console.error('❌ [credit-usage] 오류 상세:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack?.split('\n').slice(0, 10).join('\n')
    });
    
    // 에러 발생 시에도 기본값 반환 (500 에러 대신)
    return res.status(200).json({
      success: false,
      error: error.message || '크레딧 사용량 처리 중 오류가 발생했습니다',
      usage: [],
      cycle: null,
      summary: {
        monthlyLimit: 0,
        includedCredits: 0,
        creditsUsed: 0,
        creditsRemaining: 0,
        isExceeded: false
      }
    });
  }
};

// 기본 export는 API 핸들러
module.exports = apiHandler;
// named export는 함수
module.exports.checkAndUpdateCreditLimit = checkAndUpdateCreditLimit;
