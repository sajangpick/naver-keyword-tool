/**
 * 결제 처리 핸들러
 * 토스페이먼츠/아임포트 연동용
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const crypto = require('crypto');

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    // 5. 결제 내역 사전 생성
    const { data: payment, error: paymentError } = await supabase
      .from('payment_history')
      .insert({
        user_id: userId,
        order_id: orderId,
        amount: amount,
        status: 'pending',
        method: paymentMethod,
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

    // 3. 결제 완료 처리
    const { error: updateError } = await supabase
      .from('payment_history')
      .update({
        status: 'done',
        payment_key: paymentKey,
        approved_at: new Date().toISOString()
      })
      .eq('order_id', orderId);

    if (updateError) throw updateError;

    // 4. 구독 활성화
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
    const { data: payment } = await supabase
      .from('payment_history')
      .select('*')
      .eq('order_id', orderId)
      .single();

    // 2. 사용자 정보 업데이트
    const planType = extractPlanFromAmount(payment.amount);
    
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        membership_level: planType,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // 3. 새 구독 사이클 생성
    const { data: tokenConfig } = await supabase
      .from('token_config')
      .select('*')
      .single();

    const tokenKey = `owner_${planType}_limit`;
    const monthlyTokens = tokenConfig[tokenKey] || 100;

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);

    const { error: cycleError } = await supabase
      .from('subscription_cycle')
      .insert({
        user_id: userId,
        user_type: 'owner',
        cycle_start_date: startDate.toISOString().split('T')[0],
        cycle_end_date: endDate.toISOString().split('T')[0],
        monthly_token_limit: monthlyTokens,
        tokens_used: 0,
        tokens_remaining: monthlyTokens,
        status: 'active',
        billing_amount: payment.amount,
        payment_status: 'completed'
      });

    if (cycleError) throw cycleError;

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
    70000: 'premium'
  };
  return planMap[amount] || 'seed';
}

/**
 * 웹훅 처리
 */
async function handleWebhook(req, res) {
  // PG사 웹훅 서명 검증
  const signature = req.headers['x-webhook-signature'];
  
  // TODO: 서명 검증 로직
  
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

  // TODO: PG사 API로 실제 취소 처리

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
