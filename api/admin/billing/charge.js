/**
 * 결제 부과 API
 * 관리자가 선택한 최종 청구 금액을 기준으로 실제 PG사(토스페이먼츠)를 통해 자동 결제를 시도
 */

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

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

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: '결제 부과할 사용자 ID 목록이 필요합니다'
      });
    }

    console.log(`💳 결제 부과 시작: ${userIds.length}명, 월: ${month}`);

    const monthStart = `${month}-01`;
    const monthEnd = getMonthEnd(month);

    const results = {
      successCount: 0,
      failCount: 0,
      details: []
    };

    // 각 사용자별로 결제 부과
    for (const userId of userIds) {
      try {
        // 1. billing_history에서 최종 청구 금액 조회
        const { data: billingHistory, error: billingError } = await supabase
          .from('billing_history')
          .select('*')
          .eq('user_id', userId)
          .eq('billing_period_start', monthStart)
          .eq('billing_period_end', monthEnd)
          .single();

        if (billingError || !billingHistory) {
          throw new Error('청구 내역을 찾을 수 없습니다. 먼저 청구 금액을 계산해주세요.');
        }

        // 2. 최종 청구 금액 확인
        const finalAmount = billingHistory.total_price || 0;

        if (finalAmount <= 0) {
          // 0원이면 결제 불필요
          results.details.push({
            userId,
            success: true,
            message: '청구 금액이 0원이므로 결제를 건너뜁니다.',
            amount: 0
          });
          results.successCount++;
          continue;
        }

        // 3. 사용자 빌링키 조회
        const { data: userBilling, error: billingKeyError } = await supabase
          .from('user_billing')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .single();

        if (billingKeyError || !userBilling || !userBilling.billing_key) {
          // 빌링키가 없으면 결제 실패로 기록
          await updateBillingStatus(userId, monthStart, monthEnd, 'failed', '빌링키가 등록되지 않았습니다');
          
          results.details.push({
            userId,
            success: false,
            error: '빌링키가 등록되지 않았습니다',
            amount: finalAmount
          });
          results.failCount++;
          continue;
        }

        // 4. 토스페이먼츠 자동 결제 API 호출
        const paymentResult = await chargeWithTossPayments(
          userBilling.billing_key,
          userId,
          finalAmount,
          month
        );

        if (paymentResult.success) {
          // 결제 성공: billing_history 업데이트
          await updateBillingStatus(
            userId,
            monthStart,
            monthEnd,
            'charged',
            null,
            paymentResult.paymentKey,
            paymentResult.orderId
          );

          results.details.push({
            userId,
            success: true,
            message: '결제 성공',
            amount: finalAmount,
            paymentKey: paymentResult.paymentKey,
            orderId: paymentResult.orderId
          });
          results.successCount++;
        } else {
          // 결제 실패: billing_history 업데이트
          await updateBillingStatus(
            userId,
            monthStart,
            monthEnd,
            'failed',
            paymentResult.error || '결제 실패'
          );

          results.details.push({
            userId,
            success: false,
            error: paymentResult.error || '결제 실패',
            amount: finalAmount
          });
          results.failCount++;
        }

      } catch (error) {
        console.error(`❌ 사용자 ${userId} 결제 부과 실패:`, error);
        
        // 에러 발생 시 billing_history 업데이트
        const monthStart = `${month}-01`;
        const monthEnd = getMonthEnd(month);
        await updateBillingStatus(userId, monthStart, monthEnd, 'failed', error.message);

        results.details.push({
          userId,
          success: false,
          error: error.message
        });
        results.failCount++;
      }
    }

    console.log(`✅ 결제 부과 완료: 성공 ${results.successCount}명, 실패 ${results.failCount}명`);

    return res.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('❌ 결제 부과 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '결제 부과 중 오류가 발생했습니다'
    });
  }
};

/**
 * 토스페이먼츠 자동 결제 실행
 */
async function chargeWithTossPayments(billingKey, userId, amount, month) {
  try {
    // 테스트 모드 체크
    if (!process.env.TOSS_SECRET_KEY) {
      console.log('⚠️ 토스페이먼츠 키가 없어 테스트 모드로 진행합니다');
      return {
        success: true,
        paymentKey: `test_payment_${Date.now()}`,
        orderId: `ORDER_${Date.now()}_${userId.substring(0, 8)}`
      };
    }

    // 주문 ID 생성
    const orderId = `BILL_${month.replace('-', '')}_${userId.substring(0, 8)}_${Date.now()}`;
    const orderName = `사장픽 ${month}월 청구`;

    // 토스페이먼츠 빌링 결제 API 호출
    const response = await axios.post(
      `https://api.tosspayments.com/v1/billing/${billingKey}`,
      {
        customerKey: userId,
        amount: amount,
        orderId: orderId,
        orderName: orderName,
        customerEmail: null, // 필요시 추가
        customerName: null // 필요시 추가
      },
      {
        headers: {
          Authorization: `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.status === 'DONE') {
      return {
        success: true,
        paymentKey: response.data.paymentKey || null,
        orderId: orderId
      };
    } else {
      return {
        success: false,
        error: `결제 상태: ${response.data.status}`
      };
    }

  } catch (error) {
    console.error('토스페이먼츠 결제 오류:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || '결제 요청 실패'
    };
  }
}

/**
 * billing_history 상태 업데이트
 */
async function updateBillingStatus(userId, monthStart, monthEnd, status, failureReason, paymentKey, orderId) {
  const updateData = {
    payment_status: status,
    updated_at: new Date().toISOString()
  };

  if (status === 'charged') {
    updateData.payment_date = new Date().toISOString().split('T')[0];
    updateData.payment_method = 'auto';
    if (paymentKey) updateData.payment_key = paymentKey;
    if (orderId) updateData.order_id = orderId;
  } else if (status === 'failed') {
    updateData.failure_reason = failureReason || '결제 실패';
  }

  const { error } = await supabase
    .from('billing_history')
    .update(updateData)
    .eq('user_id', userId)
    .eq('billing_period_start', monthStart)
    .eq('billing_period_end', monthEnd);

  if (error) {
    console.error('billing_history 업데이트 오류:', error);
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

