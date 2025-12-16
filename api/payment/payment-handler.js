/**
 * 결제 처리 핸들러
 * 토스페이먼츠/아임포트 연동용
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const crypto = require('crypto');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const action = req.body.action || req.query.action;

    switch (action) {
      case 'create-payment':
        return await createPayment(req, res);
      case 'verify-payment':
        return await verifyPayment(req, res);
      case 'webhook':
        return await handleWebhook(req, res);
      case 'cancel-payment':
        return await cancelPayment(req, res);
      default:
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 액션입니다'
        });
    }
  } catch (error) {
    console.error('❌ 결제 처리 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * 결제 요청 생성
 */
async function createPayment(req, res) {
  const { userId, planType, paymentMethod } = req.body;

  try {
    // 1. 사용자 정보 조회
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) throw userError;

    // 2. 가격 정보 조회
    const { data: pricing } = await supabase
      .from('pricing_config')
      .select('*')
      .single();

    // 3. 결제 금액 계산
    const priceKey = `${user.user_type}_${planType}_price`;
    const amount = pricing[priceKey] || 0;

    if (amount === 0 && planType !== 'seed') {
      return res.status(400).json({
        success: false,
        error: '잘못된 플랜 유형입니다'
      });
    }

    // 4. 주문 ID 생성
    const orderId = `ORD_${Date.now()}_${userId.substring(0, 8)}`;

    // 5. 결제 내역 사전 생성 (planType 저장)
    const { data: payment, error: paymentError } = await supabase
      .from('payment_history')
      .insert({
        user_id: userId,
        order_id: orderId,
        amount: amount,
        status: 'pending',
        method: paymentMethod,
        plan_type: planType, // 플랜 타입 저장
        requested_at: new Date().toISOString()
      })
      .select()
      .single();

    if (paymentError) throw paymentError;

    // 6. 결제 URL 생성 (토스페이먼츠 예시)
    let paymentUrl = '';
    
    if (process.env.TOSS_CLIENT_KEY) {
      // 토스페이먼츠 결제 요청
      const tossResponse = await axios.post(
        'https://api.tosspayments.com/v1/payments',
        {
          amount,
          orderId,
          orderName: `사장픽 ${planType} 플랜`,
          successUrl: `${process.env.BASE_URL}/payment/success?orderId=${orderId}`,
          failUrl: `${process.env.BASE_URL}/payment/fail?orderId=${orderId}`,
          customerEmail: user.email,
          customerName: user.name || '고객'
        },
        {
          headers: {
            Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      paymentUrl = tossResponse.data.checkout.url;
    } else {
      // 테스트 모드: 자동 승인
      console.log('⚠️ 결제 테스트 모드 - 실제 결제 없이 진행');
      paymentUrl = `/payment/test-success?orderId=${orderId}`;
    }

    return res.json({
      success: true,
      orderId,
      amount,
      paymentUrl,
      payment
    });

  } catch (error) {
    console.error('결제 생성 오류:', error);
    throw error;
  }
}

/**
 * 결제 검증 및 완료 처리
 */
async function verifyPayment(req, res) {
  const { orderId, paymentKey } = req.body;

  try {
    // 1. 결제 내역 조회
    const { data: payment, error: paymentError } = await supabase
      .from('payment_history')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (paymentError) throw paymentError;

    if (payment.status === 'done') {
      return res.json({
        success: false,
        error: '이미 완료된 결제입니다'
      });
    }

    // 2. PG사 결제 검증 (토스페이먼츠 예시)
    let verified = false;
    
    if (process.env.TOSS_SECRET_KEY && paymentKey) {
      try {
        const tossResponse = await axios.post(
          `https://api.tosspayments.com/v1/payments/${paymentKey}`,
          { orderId, amount: payment.amount },
          {
            headers: {
              Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
              'Content-Type': 'application/json'
            }
          }
        );

        verified = tossResponse.data.status === 'DONE';
      } catch (error) {
        console.error('토스페이먼츠 검증 실패:', error);
      }
    } else {
      // 테스트 모드: 자동 승인
      console.log('⚠️ 테스트 모드 - 자동 결제 승인');
      verified = true;
    }

    if (!verified) {
      return res.json({
        success: false,
        error: '결제 검증에 실패했습니다'
      });
    }

    // 3. 결제 완료 처리 (중요: 결제가 실제로 완료된 경우에만 'done' 상태로 변경)
    const { error: updateError } = await supabase
      .from('payment_history')
      .update({
        status: 'done',
        payment_key: paymentKey || null,
        approved_at: new Date().toISOString()
      })
      .eq('order_id', orderId);

    if (updateError) throw updateError;

    // 4. 결제 완료 확인 후 구독 활성화 (결제 상태가 'done'일 때만 등급 변경)
    const { data: verifiedPayment } = await supabase
      .from('payment_history')
      .select('*')
      .eq('order_id', orderId)
      .single();
    
    if (!verifiedPayment || verifiedPayment.status !== 'done') {
      throw new Error('결제 완료 상태 확인 실패 - 등급 변경하지 않음');
    }

    // 5. 구독 활성화 (결제 완료 확인 후)
    await activateSubscription(payment.user_id, orderId);

    return res.json({
      success: true,
      message: '결제가 완료되었습니다',
      orderId
    });

  } catch (error) {
    console.error('결제 검증 오류:', error);
    throw error;
  }
}

/**
 * 구독 활성화
 */
async function activateSubscription(userId, orderId) {
  try {
    // 1. 결제 정보 조회
    const { data: payment, error: paymentQueryError } = await supabase
      .from('payment_history')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (paymentQueryError) throw paymentQueryError;
    
    // 중요: 결제 상태가 'done'이 아닌 경우 등급 변경하지 않음
    if (payment.status !== 'done') {
      console.error(`❌ 결제 상태가 'done'이 아니므로 등급 변경하지 않음: ${payment.status}`);
      throw new Error(`결제가 완료되지 않았습니다. 현재 상태: ${payment.status}`);
    }

    // 2. 플랜 타입 확인 (plan_type이 있으면 사용, 없으면 금액으로 추출)
    let planType = payment.plan_type || extractPlanFromAmount(payment.amount);
    
    if (!planType) {
      throw new Error('플랜 타입을 확인할 수 없습니다');
    }
    
    console.log(`✅ 결제 완료 확인 - 등급 변경 시작: ${userId} → ${planType}`);
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        membership_level: planType,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // 3. 가격 및 크레딧 설정 조회 (작업 크레딧 시스템)
    const { data: pricingConfig } = await supabase
      .from('pricing_config')
      .select('*')
      .single();

    const { data: tokenConfigs } = await supabase
      .from('token_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    const tokenConfig = tokenConfigs || {};

    // 사용자 타입 확인 (기본값: owner)
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', userId)
      .single();

    const userType = profile?.user_type || 'owner';
    
    // 대행사 등급 매핑 (elite/expert/master → starter/pro/enterprise)
    const levelMapping = {
      'elite': 'starter',
      'expert': 'pro',
      'master': 'enterprise'
    };
    const mappedPlanType = levelMapping[planType] || planType;
    
    const priceKey = `${userType}_${planType}_price`;
    const tokenKey = `${userType}_${planType}_limit`;
    
    // 포함된 크레딧 키 (작업 크레딧 시스템)
    // 대행사는 매핑된 등급명 사용, 식당 대표는 원래 등급명 사용
    const includedCreditsKey = userType === 'agency' 
      ? `${userType}_${mappedPlanType}_included_credits`
      : `${userType}_${planType}_included_credits`;

    // 가격 및 포함된 크레딧 계산
    const monthlyFee = pricingConfig?.[priceKey] || payment.amount || 0;
    
    // 포함된 크레딧 우선 사용 (pricing_config의 included_credits)
    // 없으면 token_config의 limit 사용 (하위 호환성)
    const monthlyCredits = pricingConfig?.[includedCreditsKey] || 
                          tokenConfig?.[tokenKey] || 
                          100;

    const excessCreditRate = pricingConfig?.[`${userType}_${planType}_excess_rate`] || 1.2;

    console.log(`✅ [payment] 포함된 크레딧: ${monthlyCredits} (${includedCreditsKey})`);

    // 4. user_subscription 테이블에 구독 정보 저장
    // 기존 구독이 있으면 비활성화
    await supabase
      .from('user_subscription')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    // 새 구독 정보 저장
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);

    const { error: subscriptionError } = await supabase
      .from('user_subscription')
      .insert({
        user_id: userId,
        plan_type: planType,
        monthly_fee: monthlyFee,
        included_credits: monthlyCredits,
        excess_credit_rate: excessCreditRate,
        subscription_start_date: startDate.toISOString().split('T')[0],
        subscription_end_date: endDate.toISOString().split('T')[0],
        is_active: true,
        auto_renew: true
      });

    if (subscriptionError) {
      console.warn('⚠️ user_subscription 저장 실패 (무시):', subscriptionError);
      // 기존 테이블 구조와의 호환성을 위해 계속 진행
    } else {
      console.log(`✅ user_subscription 저장 완료: ${userId} - ${planType}`);
    }

    // 5. subscription_cycle 테이블에도 저장 (작업 크레딧 시스템)
    const { error: cycleError } = await supabase
      .from('subscription_cycle')
      .insert({
        user_id: userId,
        user_type: userType,
        cycle_start_date: startDate.toISOString().split('T')[0],
        cycle_end_date: endDate.toISOString().split('T')[0],
        days_in_cycle: 30,
        monthly_token_limit: monthlyCredits, // 하위 호환성
        tokens_used: 0,
        tokens_remaining: monthlyCredits,
        included_credits: monthlyCredits, // 작업 크레딧 시스템
        credits_used: 0,
        credits_remaining: monthlyCredits,
        status: 'active',
        billing_amount: monthlyFee,
        payment_status: 'completed'
      });

    if (cycleError) {
      console.warn('⚠️ subscription_cycle 저장 실패 (무시):', cycleError);
    }

    console.log(`✅ 구독 활성화 완료: ${userId} - ${planType}`);

  } catch (error) {
    console.error('구독 활성화 오류:', error);
    throw error;
  }
}

/**
 * 금액으로 플랜 타입 추출
 */
function extractPlanFromAmount(amount) {
  const planMap = {
    0: 'seed',
    30000: 'power',
    50000: 'bigpower',
    100000: 'premium'
  };
  return planMap[amount] || 'seed';
}

/**
 * 웹훅 처리
 */
async function handleWebhook(req, res) {
  // PG사 웹훅 서명 검증
  const signature = req.headers['x-webhook-signature'];
  
  // PG사별 서명 검증 구현 (토스페이먼츠 예시)
  // const expectedSignature = crypto
  //   .createHmac('sha256', process.env.WEBHOOK_SECRET)
  //   .update(JSON.stringify(req.body))
  //   .digest('hex');
  // if (signature !== expectedSignature) {
  //   return res.status(401).json({ error: 'Invalid signature' });
  // }
  
  const { eventType, data } = req.body;

  switch (eventType) {
    case 'PAYMENT.DONE':
      await verifyPayment({ body: data }, res);
      break;
    case 'PAYMENT.FAILED':
      await handleFailedPayment(data);
      break;
    case 'PAYMENT.CANCELED':
      await handleCanceledPayment(data);
      break;
  }

  return res.json({ received: true });
}

/**
 * 결제 실패 처리
 */
async function handleFailedPayment(data) {
  await supabase
    .from('payment_history')
    .update({
      status: 'failed',
      failed_at: new Date().toISOString(),
      failure_reason: data.failureMessage
    })
    .eq('order_id', data.orderId);
}

/**
 * 결제 취소 처리
 */
async function cancelPayment(req, res) {
  const { orderId } = req.body;

  // PG사 API로 실제 취소 처리
  // 토스페이먼츠 예시:
  // if (process.env.TOSS_SECRET_KEY) {
  //   await axios.post(
  //     `https://api.tosspayments.com/v1/payments/${payment.payment_key}/cancel`,
  //     { cancelReason },
  //     {
  //       headers: {
  //         Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
  //       },
  //     }
  //   );
  // }

  const { error } = await supabase
    .from('payment_history')
    .update({
      status: 'canceled'
    })
    .eq('order_id', orderId);

  if (error) throw error;

  return res.json({
    success: true,
    message: '결제가 취소되었습니다'
  });
}
