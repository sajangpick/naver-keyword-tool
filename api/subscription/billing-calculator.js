/**
 * 월간 청구서 계산 API
 * 매월 말일 기준 사용량을 집계하여 청구서를 생성합니다
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
    console.error('❌ 청구서 계산 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '청구서 계산 중 오류가 발생했습니다'
    });
  }
};

/**
 * 월간 청구서 계산
 * @param {string} userId - 사용자 ID
 * @param {string} month - 청구 월 (YYYY-MM 형식, 없으면 현재 월)
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

    // 구독 정보가 없으면 profiles에서 기본 정보 가져오기
    let planType = 'seed';
    let monthlyFee = 0;
    let baseTokens = 30000;
    let excessTokenRate = 1000; // 1,000토큰당 1,000원

    if (subscription) {
      planType = subscription.plan_type;
      monthlyFee = subscription.monthly_fee;
      baseTokens = subscription.base_tokens;
      excessTokenRate = subscription.excess_token_rate || 1000;
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
          seed: { fee: 0, tokens: 30000 },
          light: { fee: 0, tokens: 30000 },
          power: { fee: 30000, tokens: 350000 },
          standard: { fee: 30000, tokens: 350000 },
          bigpower: { fee: 50000, tokens: 650000 },
          pro: { fee: 50000, tokens: 650000 },
          premium: { fee: 100000, tokens: 1500000 }
        };
        const defaults = planDefaults[planType] || planDefaults.seed;
        monthlyFee = defaults.fee;
        baseTokens = defaults.tokens;
      }
    }

    // 2. 해당 월 토큰 사용량 조회
    const monthStart = `${month}-01`;
    const monthEnd = getMonthEnd(month);

    const { data: tokenUsage, error: usageError } = await supabase
      .from('token_usage')
      .select('tokens_used')
      .eq('user_id', userId)
      .gte('usage_date', monthStart)
      .lte('usage_date', monthEnd);

    if (usageError) throw usageError;

    const totalTokensUsed = tokenUsage?.reduce((sum, record) => sum + (record.tokens_used || 0), 0) || 0;

    // 3. 초과 토큰 계산
    const excessTokens = Math.max(0, totalTokensUsed - baseTokens);

    // 4. 초과 요금 계산 (1,000토큰당 1,000원)
    const excessFee = Math.floor((excessTokens / 1000) * excessTokenRate);

    // 5. 총 청구액
    const totalAmount = monthlyFee + excessFee;

    return res.json({
      success: true,
      billing: {
        userId,
        billingMonth: month,
        planType,
        baseFee: monthlyFee,
        totalTokensUsed,
        baseTokens,
        excessTokens,
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
          monthly_limit: billing.baseTokens,
          tokens_used: billing.totalTokensUsed,
          is_exceeded: billing.excessTokens > 0,
          exceeded_amount: billing.excessTokens,
          excess_tokens: billing.excessTokens,
          base_price: billing.baseFee,
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
      // 사용자 정보 조회
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
          monthly_limit: billing.baseTokens,
          tokens_used: billing.totalTokensUsed,
          is_exceeded: billing.excessTokens > 0,
          exceeded_amount: billing.excessTokens,
          excess_tokens: billing.excessTokens,
          base_price: billing.baseFee,
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

    let planType = 'seed';
    let baseTokens = 30000;
    let excessTokenRate = 1000;

    if (subscription) {
      planType = subscription.plan_type;
      baseTokens = subscription.base_tokens;
      excessTokenRate = subscription.excess_token_rate || 1000;
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('membership_level')
        .eq('id', userId)
        .single();

      if (profile) {
        planType = profile.membership_level || 'seed';
        const planDefaults = {
          seed: { tokens: 30000 },
          light: { tokens: 30000 },
          power: { tokens: 350000 },
          standard: { tokens: 350000 },
          bigpower: { tokens: 650000 },
          pro: { tokens: 650000 },
          premium: { tokens: 1500000 }
        };
        baseTokens = (planDefaults[planType] || planDefaults.seed).tokens;
      }
    }

    // 2. 현재 월 사용량 조회
    const { data: tokenUsage } = await supabase
      .from('token_usage')
      .select('tokens_used')
      .eq('user_id', userId)
      .gte('usage_date', monthStart)
      .lte('usage_date', monthEnd);

    const totalTokensUsed = tokenUsage?.reduce((sum, record) => sum + (record.tokens_used || 0), 0) || 0;
    const tokensRemaining = Math.max(0, baseTokens - totalTokensUsed);
    const excessTokens = Math.max(0, totalTokensUsed - baseTokens);
    const estimatedExcessFee = Math.floor((excessTokens / 1000) * excessTokenRate);

    // 3. 사용률 계산
    const usagePercentage = baseTokens > 0 ? Math.min(100, (totalTokensUsed / baseTokens) * 100) : 0;

    return res.json({
      success: true,
      usage: {
        userId,
        planType,
        baseTokens,
        totalTokensUsed,
        tokensRemaining,
        excessTokens,
        estimatedExcessFee,
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
    // 구독 정보 조회
    const { data: subscription } = await supabase
      .from('user_subscription')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    let planType = 'seed';
    let monthlyFee = 0;
    let baseTokens = 30000;
    let excessTokenRate = 1000;

    if (subscription) {
      planType = subscription.plan_type;
      monthlyFee = subscription.monthly_fee;
      baseTokens = subscription.base_tokens;
      excessTokenRate = subscription.excess_token_rate || 1000;
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('membership_level')
        .eq('id', userId)
        .single();

      if (profile) {
        planType = profile.membership_level || 'seed';
        const planDefaults = {
          seed: { fee: 0, tokens: 30000 },
          light: { fee: 0, tokens: 30000 },
          power: { fee: 30000, tokens: 350000 },
          standard: { fee: 30000, tokens: 350000 },
          bigpower: { fee: 50000, tokens: 650000 },
          pro: { fee: 50000, tokens: 650000 },
          premium: { fee: 100000, tokens: 1500000 }
        };
        const defaults = planDefaults[planType] || planDefaults.seed;
        monthlyFee = defaults.fee;
        baseTokens = defaults.tokens;
      }
    }

    const monthStart = `${month}-01`;
    const monthEnd = getMonthEnd(month);

    const { data: tokenUsage } = await supabase
      .from('token_usage')
      .select('tokens_used')
      .eq('user_id', userId)
      .gte('usage_date', monthStart)
      .lte('usage_date', monthEnd);

    const totalTokensUsed = tokenUsage?.reduce((sum, record) => sum + (record.tokens_used || 0), 0) || 0;
    const excessTokens = Math.max(0, totalTokensUsed - baseTokens);
    const excessFee = Math.floor((excessTokens / 1000) * excessTokenRate);
    const totalAmount = monthlyFee + excessFee;

    return {
      success: true,
      billing: {
        userId,
        billingMonth: month,
        planType,
        baseFee: monthlyFee,
        totalTokensUsed,
        baseTokens,
        excessTokens,
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

