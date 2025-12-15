/**
 * 작업 크레딧 기반 빌링 계산 API
 * 토스페이먼츠 빌링 결제 심사용
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
    const action = req.body?.action || req.query?.action || 'calculate';

    switch (action) {
      case 'calculate':
        return await calculateMonthlyBill(req, res);
      case 'generate-invoice':
        return await generateInvoice(req, res);
      case 'get-current-usage':
        return await getCurrentUsage(req, res);
      default:
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 액션입니다'
        });
    }
  } catch (error) {
    console.error('❌ 작업 크레딧 빌링 계산 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '빌링 계산 중 오류가 발생했습니다'
    });
  }
};

/**
 * 월간 청구서 계산 (작업 크레딧 기반)
 * 청구 금액 = max(월 최소 이용료, 실제 사용 금액)
 * 실제 사용 금액 = 총 사용 크레딧 × 초과 작업 크레딧당 단가
 */
async function calculateMonthlyBill(req, res) {
  const userId = req.body?.userId || req.query?.userId;
  const month = req.body?.month || req.query?.month || getCurrentMonth();

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: '사용자 ID가 필요합니다'
    });
  }

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

    return res.json({
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
    });

  } catch (error) {
    console.error('청구서 계산 오류:', error);
    throw error;
  }
}

/**
 * 청구서 생성 및 저장
 */
async function generateInvoice(req, res) {
  const userId = req.body?.userId;
  const month = req.body?.month || getCurrentMonth();

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: '사용자 ID가 필요합니다'
    });
  }

  try {
    // 1. 청구서 계산
    const billingResult = await calculateMonthlyBillInternal(userId, month);
    if (!billingResult.success) {
      throw new Error(billingResult.error);
    }

    const billing = billingResult.billing;

    // 2. 기존 청구서 확인
    const { data: existingInvoice } = await supabase
      .from('billing_history')
      .select('*')
      .eq('user_id', userId)
      .eq('billing_month', month)
      .single();

    if (existingInvoice) {
      // 기존 청구서 업데이트
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('billing_history')
        .update({
          included_credits: billing.includedCredits,
          credits_used: billing.totalCreditsUsed,
          is_exceeded: billing.excessCredits > 0,
          excess_credits: billing.excessCredits,
          base_price: billing.minimumFee,
          actual_usage_amount: billing.actualUsageAmount,
          extra_charge: billing.excessFee,
          excess_fee: billing.excessFee,
          total_price: billing.totalAmount,
          payment_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingInvoice.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return res.json({
        success: true,
        invoice: updatedInvoice,
        message: '청구서가 업데이트되었습니다'
      });
    } else {
      // 새 청구서 생성
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type, membership_level')
        .eq('id', userId)
        .single();

      const { data: newInvoice, error: insertError } = await supabase
        .from('billing_history')
        .insert({
          user_id: userId,
          user_type: profile?.user_type || 'owner',
          membership_level: billing.planType,
          billing_month: month,
          billing_period_start: billing.billingPeriodStart,
          billing_period_end: billing.billingPeriodEnd,
          included_credits: billing.includedCredits,
          credits_used: billing.totalCreditsUsed,
          is_exceeded: billing.excessCredits > 0,
          excess_credits: billing.excessCredits,
          base_price: billing.minimumFee,
          actual_usage_amount: billing.actualUsageAmount,
          extra_charge: billing.excessFee,
          excess_fee: billing.excessFee,
          total_price: billing.totalAmount,
          payment_status: 'pending',
          invoice_issued_date: new Date().toISOString().split('T')[0]
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return res.json({
        success: true,
        invoice: newInvoice,
        message: '청구서가 생성되었습니다'
      });
    }

  } catch (error) {
    console.error('청구서 생성 오류:', error);
    throw error;
  }
}

/**
 * 현재 사용량 조회 (실시간)
 */
async function getCurrentUsage(req, res) {
  const userId = req.body?.userId || req.query?.userId;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: '사용자 ID가 필요합니다'
    });
  }

  try {
    const currentMonth = getCurrentMonth();
    const monthStart = `${currentMonth}-01`;
    const monthEnd = getMonthEnd(currentMonth);

    // 1. 구독 정보 조회
    const { data: subscription } = await supabase
      .from('user_subscription')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    // 2. 가격 설정 조회
    const { data: pricingConfig } = await supabase
      .from('pricing_config')
      .select('*')
      .single();

    let planType = 'seed';
    let minimumFee = 0;
    let includedCredits = 0;
    let excessCreditRate = 1.2;

    if (subscription) {
      planType = subscription.plan_type;
      minimumFee = subscription.monthly_fee;
      includedCredits = subscription.included_credits || 0;
      excessCreditRate = subscription.excess_credit_rate || 1.2;
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('membership_level')
        .eq('id', userId)
        .single();

      if (profile) {
        planType = profile.membership_level || 'seed';
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

    // 3. 현재 월 사용량 조회
    const { data: creditUsage } = await supabase
      .from('work_credit_usage')
      .select('work_credits_used')
      .eq('user_id', userId)
      .gte('usage_date', monthStart)
      .lte('usage_date', monthEnd);

    const totalCreditsUsed = creditUsage?.reduce((sum, record) => sum + (record.work_credits_used || 0), 0) || 0;
    const creditsRemaining = Math.max(0, includedCredits - totalCreditsUsed);
    const excessCredits = Math.max(0, totalCreditsUsed - includedCredits);
    const actualUsageAmount = Math.floor(totalCreditsUsed * excessCreditRate);
    const estimatedExcessFee = Math.max(0, actualUsageAmount - minimumFee);
    const estimatedTotalAmount = Math.max(minimumFee, actualUsageAmount);

    // 4. 사용률 계산
    const usagePercentage = includedCredits > 0 ? Math.min(100, (totalCreditsUsed / includedCredits) * 100) : 0;

    return res.json({
      success: true,
      usage: {
        userId,
        planType,
        minimumFee,
        includedCredits,
        totalCreditsUsed,
        creditsRemaining,
        excessCredits,
        excessCreditRate,
        actualUsageAmount,
        estimatedExcessFee,
        estimatedTotalAmount,
        usagePercentage: Math.round(usagePercentage * 100) / 100,
        currentMonth,
        monthStart,
        monthEnd
      }
    });

  } catch (error) {
    console.error('사용량 조회 오류:', error);
    throw error;
  }
}

/**
 * 내부 함수: 청구서 계산 (재사용)
 */
async function calculateMonthlyBillInternal(userId, month) {
  try {
    const { data: subscription } = await supabase
      .from('user_subscription')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    const { data: pricingConfig } = await supabase
      .from('pricing_config')
      .select('*')
      .single();

    let planType = 'seed';
    let minimumFee = 0;
    let includedCredits = 0;
    let excessCreditRate = 1.2;

    if (subscription) {
      planType = subscription.plan_type;
      minimumFee = subscription.monthly_fee;
      includedCredits = subscription.included_credits || 0;
      excessCreditRate = subscription.excess_credit_rate || 1.2;
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('membership_level')
        .eq('id', userId)
        .single();

      if (profile) {
        planType = profile.membership_level || 'seed';
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

    const monthStart = `${month}-01`;
    const monthEnd = getMonthEnd(month);

    const { data: creditUsage } = await supabase
      .from('work_credit_usage')
      .select('work_credits_used')
      .eq('user_id', userId)
      .gte('usage_date', monthStart)
      .lte('usage_date', monthEnd);

    const totalCreditsUsed = creditUsage?.reduce((sum, record) => sum + (record.work_credits_used || 0), 0) || 0;
    const excessCredits = Math.max(0, totalCreditsUsed - includedCredits);
    const actualUsageAmount = Math.floor(totalCreditsUsed * excessCreditRate);
    const totalAmount = Math.max(minimumFee, actualUsageAmount);
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
function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthEnd(month) {
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
}

