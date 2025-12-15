/**
 * 청구 금액 미리 계산 API
 * 관리자가 선택한 결제 주기의 모든 사용자 또는 특정 사용자에 대해 최종 청구 금액을 미리 계산
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

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { month, userIds } = req.body;

    if (!month) {
      return res.status(400).json({
        success: false,
        error: '결제 주기(month)가 필요합니다'
      });
    }

    // 기존 청구 로직 활용
    const workCreditBilling = require('../../subscription/work-credit-billing');

    // 처리할 사용자 목록 결정
    let targetUserIds = [];

    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      // 특정 사용자만 처리
      targetUserIds = userIds;
    } else {
      // 모든 활성 사용자 처리
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .not('membership_level', 'is', null);

      if (profileError) {
        throw profileError;
      }

      targetUserIds = profiles.map(p => p.id);
    }

    console.log(`📊 청구 금액 계산 시작: ${targetUserIds.length}명, 월: ${month}`);

    const results = {
      processedCount: 0,
      successCount: 0,
      failCount: 0,
      errors: []
    };

    // 각 사용자별로 청구 금액 계산 및 billing_history 업데이트
    for (const userId of targetUserIds) {
      try {
        // 기존 청구 로직을 사용하여 계산
        const billingResult = await calculateBillingForUser(userId, month);

        if (!billingResult.success) {
          results.failCount++;
          results.errors.push({
            userId,
            error: billingResult.error
          });
          continue;
        }

        const billing = billingResult.billing;

        // billing_history 테이블에 저장 또는 업데이트
        const monthStart = `${month}-01`;
        const monthEnd = getMonthEnd(month);

        // 기존 청구 내역 확인
        const { data: existingBilling } = await supabase
          .from('billing_history')
          .select('*')
          .eq('user_id', userId)
          .eq('billing_period_start', monthStart)
          .eq('billing_period_end', monthEnd)
          .single();

        // 사용자 프로필 조회
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type, membership_level')
          .eq('id', userId)
          .single();

        const billingData = {
          user_id: userId,
          user_type: profile?.user_type || 'owner',
          membership_level: billing.planType,
          billing_period_start: monthStart,
          billing_period_end: monthEnd,
          included_credits: billing.includedCredits,
          credits_used: billing.totalCreditsUsed,
          excess_credits: billing.excessCredits,
          base_price: billing.minimumFee,
          actual_usage_amount: billing.actualUsageAmount,
          excess_fee: billing.excessFee,
          total_price: billing.totalAmount,
          payment_status: 'pending',
          updated_at: new Date().toISOString()
        };

        if (existingBilling) {
          // 기존 청구 내역 업데이트
          const { error: updateError } = await supabase
            .from('billing_history')
            .update(billingData)
            .eq('id', existingBilling.id);

          if (updateError) {
            throw updateError;
          }
        } else {
          // 새 청구 내역 생성
          billingData.created_at = new Date().toISOString();
          const { error: insertError } = await supabase
            .from('billing_history')
            .insert(billingData);

          if (insertError) {
            throw insertError;
          }
        }

        results.processedCount++;
        results.successCount++;

      } catch (error) {
        console.error(`❌ 사용자 ${userId} 청구 계산 실패:`, error);
        results.failCount++;
        results.errors.push({
          userId,
          error: error.message
        });
      }
    }

    console.log(`✅ 청구 금액 계산 완료: 성공 ${results.successCount}명, 실패 ${results.failCount}명`);

    return res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('❌ 청구 금액 미리 계산 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '청구 금액 계산 중 오류가 발생했습니다'
    });
  }
};

/**
 * 사용자별 청구 금액 계산 (내부 함수)
 */
async function calculateBillingForUser(userId, month) {
  try {
    // 1. 사용자 구독 정보 조회
    const { data: subscription, error: subError } = await supabase
      .from('user_subscription')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (subError && subError.code !== 'PGRST116') {
      throw subError;
    }

    // 2. 가격 설정 조회
    const { data: pricingConfig } = await supabase
      .from('pricing_config')
      .select('*')
      .single();

    // 구독 정보가 없으면 profiles에서 기본 정보 가져오기
    let planType = 'seed';
    let minimumFee = 0;
    let includedCredits = 0;
    let excessCreditRate = 1.2; // 기본값

    if (subscription) {
      planType = subscription.plan_type;
      minimumFee = subscription.monthly_fee;
      includedCredits = subscription.included_credits || 0;
      excessCreditRate = subscription.excess_credit_rate || 1.2;
    } else {
      // profiles에서 membership_level 확인
      const { data: profile } = await supabase
        .from('profiles')
        .select('membership_level')
        .eq('id', userId)
        .single();

      if (profile) {
        planType = profile.membership_level || 'seed';
        // 플랜별 기본값 설정
        const planDefaults = {
          seed: { fee: 0, credits: 0, rate: 1.2 },
          light: { fee: 0, credits: 0, rate: 1.2 },
          power: { fee: 30000, credits: 37500, rate: 0.8 },
          standard: { fee: 30000, credits: 37500, rate: 0.8 },
          bigpower: { fee: 50000, credits: 83333, rate: 0.6 },
          pro: { fee: 50000, credits: 83333, rate: 0.6 },
          premium: { fee: 100000, credits: 200000, rate: 0.5 }
        };
        const defaults = planDefaults[planType] || planDefaults.seed;
        minimumFee = defaults.fee;
        includedCredits = defaults.credits;
        excessCreditRate = defaults.rate;

        // pricing_config에서 값이 있으면 사용
        if (pricingConfig) {
          const minimumFeeKey = `owner_${planType}_minimum_fee`;
          const includedCreditsKey = `owner_${planType}_included_credits`;
          const excessRateKey = `owner_${planType}_excess_rate`;

          if (pricingConfig[minimumFeeKey] !== undefined) {
            minimumFee = pricingConfig[minimumFeeKey];
          }
          if (pricingConfig[includedCreditsKey] !== undefined) {
            includedCredits = pricingConfig[includedCreditsKey];
          }
          if (pricingConfig[excessRateKey] !== undefined) {
            excessCreditRate = pricingConfig[excessRateKey];
          }
        }
      }
    }

    // 3. 해당 월 작업 크레딧 사용량 조회
    const monthStart = `${month}-01`;
    const monthEnd = getMonthEnd(month);

    const { data: creditUsage, error: usageError } = await supabase
      .from('work_credit_usage')
      .select('work_credits_used')
      .eq('user_id', userId)
      .gte('usage_date', monthStart)
      .lte('usage_date', monthEnd);

    if (usageError) throw usageError;

    const totalCreditsUsed = creditUsage?.reduce((sum, record) => sum + (record.work_credits_used || 0), 0) || 0;

    // 4. 초과 작업 크레딧 계산
    const excessCredits = Math.max(0, totalCreditsUsed - includedCredits);

    // 5. 실제 사용 금액 계산 (총 사용 크레딧 × 초과 작업 크레딧당 단가)
    const actualUsageAmount = Math.floor(totalCreditsUsed * excessCreditRate);

    // 6. 최종 청구액 = max(월 최소 이용료, 실제 사용 금액)
    const totalAmount = Math.max(minimumFee, actualUsageAmount);

    // 7. 초과 요금 (실제 사용 금액이 최소 이용료보다 큰 경우)
    const excessFee = Math.max(0, actualUsageAmount - minimumFee);

    return {
      success: true,
      billing: {
        userId,
        billingMonth: month,
        planType,
        minimumFee,
        includedCredits,
        totalCreditsUsed,
        excessCredits,
        excessCreditRate,
        actualUsageAmount,
        excessFee,
        totalAmount,
        billingPeriodStart: monthStart,
        billingPeriodEnd: monthEnd
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 유틸리티 함수
 */
function getMonthEnd(month) {
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
}

