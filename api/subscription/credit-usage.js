/**
 * 크레딧 사용량 관리 API
 * 크레딧 사용을 기록하고 한도를 체크합니다
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

      // 관리자 설정에서 크레딧 한도 조회 (최신 설정 우선)
      const { data: creditConfigs } = await supabase
        .from('credit_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      const creditLimitKey = `${userType}_${membershipLevel}_limit`;
      const latestConfig = creditConfigs || {};
      const monthlyLimit = latestConfig[creditLimitKey] || 100;
      
      console.log(`✅ [credit-usage] 새 사이클 생성 - 관리자 설정 한도: ${monthlyLimit} (${creditLimitKey})`);

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
          monthly_credit_limit: monthlyLimit,
          credits_used: 0,
          credits_remaining: monthlyLimit,
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('membership_level, user_type')
      .eq('id', userId)
      .single();

    const userType = profile?.user_type || 'owner';
    const membershipLevel = profile?.membership_level || 'seed';
    const creditLimitKey = `${userType}_${membershipLevel}_limit`;
    
    // 관리자 설정에서 최신 한도 조회
    let currentCreditLimit = cycle.monthly_credit_limit; // 기본값: 사이클 값
    try {
      const { data: creditConfigs } = await supabase
        .from('credit_config')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      if (creditConfigs && creditConfigs[creditLimitKey] !== undefined && creditConfigs[creditLimitKey] !== null) {
        currentCreditLimit = Number(creditConfigs[creditLimitKey]);
        console.log(`✅ [credit-usage] 관리자 설정 한도 사용: ${currentCreditLimit} (${creditLimitKey})`);
        
        // 사이클의 한도와 다르면 사이클 업데이트
        if (cycle.monthly_credit_limit !== currentCreditLimit) {
          console.log(`🔄 [credit-usage] 사이클 한도 업데이트: ${cycle.monthly_credit_limit} → ${currentCreditLimit}`);
          await supabase
            .from('subscription_cycle')
            .update({
              monthly_credit_limit: currentCreditLimit,
              credits_remaining: currentCreditLimit - (cycle.credits_used || 0),
              updated_at: new Date().toISOString()
            })
            .eq('id', cycle.id);
          console.log('✅ [credit-usage] 사이클 한도 업데이트 완료');
        }
      }
    } catch (error) {
      console.log('⚠️ [credit-usage] 관리자 설정 조회 실패, 사이클 값 사용:', error.message);
    }

    // 크레딧 한도 체크 (관리자 설정 기준)
    const newCreditsUsed = (cycle.credits_used || 0) + creditsToUse;
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
          credits_remaining: 0
        })
        .eq('id', cycle.id);

      return {
        success: false,
        error: '크레딧 한도를 초과했습니다',
        creditsUsed: cycle.credits_used,
        monthlyLimit: currentCreditLimit, // 관리자 설정 값 반환
        creditsRemaining: 0
      };
    }

    // 크레딧 사용량 업데이트
    const { error: updateError } = await supabase
      .from('subscription_cycle')
      .update({
        credits_used: newCreditsUsed,
        credits_remaining: creditsRemaining,
        updated_at: new Date().toISOString()
      })
      .eq('id', cycle.id);

    if (updateError) throw updateError;

    return {
      success: true,
      creditsUsed: newCreditsUsed,
      monthlyLimit: currentCreditLimit, // 관리자 설정 값 반환
      creditsRemaining: creditsRemaining
    };

  } catch (error) {
    console.error('크레딧 한도 체크 오류:', error);
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
    // POST: 크레딧 사용 기록
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

      const creditsUsed = total_tokens || (input_tokens + output_tokens);

      // 크레딧 한도 체크 및 차감
      const limitCheck = await checkAndUpdateCreditLimit(user_id, creditsUsed);
      
      if (!limitCheck.success) {
        return res.status(403).json(limitCheck);
      }

      // 크레딧 사용 기록 저장
      const { data: usageRecord, error: insertError } = await supabase
        .from('credit_usage')
        .insert({
          user_id,
          store_id,
          credits_used: creditsUsed,
          api_type,
          input_tokens,
          output_tokens,
          used_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(`✅ 크레딧 사용 기록: ${user_id} - ${creditsUsed} 크레딧`);

      return res.json({
        success: true,
        usage: usageRecord,
        remaining: limitCheck.creditsRemaining,
        limit: limitCheck.monthlyLimit,
        message: `${creditsUsed} 크레딧이 사용되었습니다. 남은 크레딧: ${limitCheck.creditsRemaining}`
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

      // 크레딧 한도 조회 우선순위 (관리자 설정 우선):
      // 1. member_custom_credit_limit (개인 맞춤 한도) - 최우선
      // 2. credit_config (관리자 설정) - 관리자에서 설정한 값 사용
      // 3. subscription_cycle.monthly_credit_limit (사이클 한도) - 참고용
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
          .single();
        
        if (!customError && customLimit && customLimit.custom_limit) {
          currentCreditLimit = Number(customLimit.custom_limit);
          console.log(`✅ 개인 맞춤 크레딧 한도 사용: ${currentCreditLimit}`);
        } else {
          // 2단계: 관리자 설정(credit_config)에서 최신 한도 조회 (우선 사용)
          try {
            const { data: creditConfigs, error: configError } = await supabase
              .from('credit_config')
              .select('*')
              .order('updated_at', { ascending: false })
              .limit(1);
            
            if (configError) {
              console.error('❌ credit_config 조회 실패:', configError);
              // 3단계: 사이클 값 사용 (fallback)
              if (cycle && cycle.monthly_credit_limit) {
                currentCreditLimit = Number(cycle.monthly_credit_limit);
                console.log(`✅ 사이클 크레딧 한도 사용 (fallback): ${currentCreditLimit}`);
              } else {
                currentCreditLimit = 100;
              }
            } else if (!creditConfigs || creditConfigs.length === 0) {
              console.warn('⚠️ credit_config 데이터가 없습니다. 사이클 값 또는 기본값 사용');
              // 3단계: 사이클 값 사용 (fallback)
              if (cycle && cycle.monthly_credit_limit) {
                currentCreditLimit = Number(cycle.monthly_credit_limit);
                console.log(`✅ 사이클 크레딧 한도 사용 (fallback): ${currentCreditLimit}`);
              } else {
                currentCreditLimit = 100;
              }
            } else {
              const latestCreditConfig = creditConfigs[0];
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
            .limit(1);
          
          if (creditConfigs && creditConfigs.length > 0) {
            const limitValue = creditConfigs[0][creditLimitKey];
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

      // 크레딧 사용 내역 조회
      const { data: usage, error: fetchError } = await supabase
        .from('credit_usage')
        .select('*')
        .eq('user_id', user_id)
        .order('used_at', { ascending: false })
        .limit(parseInt(limit));

      if (fetchError) throw fetchError;

      // 크레딧 사용량 계산
      const creditsUsed = cycle?.credits_used || 0;
      let creditsRemaining = 0;
      
      if (cycle) {
        // 사이클이 있으면 사이클의 남은 크레딧 사용
        creditsRemaining = cycle.credits_remaining || 0;
      } else {
        // 사이클이 없으면 최신 한도가 남은 크레딧
        creditsRemaining = currentCreditLimit;
      }

      return res.json({
        success: true,
        usage: usage || [],
        cycle: cycle || null,
        summary: {
          monthlyLimit: currentCreditLimit, // 최신 크레딧 한도 사용 (관리자 설정 반영)
          creditsUsed: creditsUsed,
          creditsRemaining: creditsRemaining,
          isExceeded: cycle?.is_exceeded || false
        }
      });
    }

    return res.status(405).json({
      success: false,
      error: '허용되지 않은 메소드입니다'
    });

  } catch (error) {
    console.error('❌ 크레딧 사용량 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '크레딧 사용량 처리 중 오류가 발생했습니다'
    });
  }
};

