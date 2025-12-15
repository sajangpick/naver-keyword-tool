/**
 * 청구 목록 조회 API
 * 선택한 결제 주기의 모든 사용자 청구 정보를 조회
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const month = req.query.month || getCurrentMonth();

    const monthStart = `${month}-01`;
    const monthEnd = getMonthEnd(month);

    // billing_history에서 해당 월의 모든 청구 내역 조회
    const { data: billingHistories, error: billingError } = await supabase
      .from('billing_history')
      .select('*')
      .eq('billing_period_start', monthStart)
      .eq('billing_period_end', monthEnd)
      .order('created_at', { ascending: false });

    if (billingError) {
      throw billingError;
    }

    if (!billingHistories || billingHistories.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // 사용자 정보 조회
    const userIds = billingHistories.map(b => b.user_id);
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, membership_level')
      .in('id', userIds);

    if (profileError) {
      console.warn('프로필 조회 오류:', profileError);
    }

    const profileMap = {};
    if (profiles) {
      profiles.forEach(p => {
        profileMap[p.id] = p;
      });
    }

    // 응답 데이터 구성
    const billingData = billingHistories.map(billing => {
      const profile = profileMap[billing.user_id] || {};

      return {
        userId: billing.user_id,
        userEmail: profile.email || null,
        planType: billing.membership_level || profile.membership_level || 'seed',
        minimumFee: billing.base_price || 0,
        totalCreditsUsed: billing.credits_used || 0,
        actualUsageAmount: billing.actual_usage_amount || 0,
        finalBillingAmount: billing.total_price || 0,
        billingStatus: billing.payment_status || 'pending'
      };
    });

    return res.json({
      success: true,
      data: billingData
    });

  } catch (error) {
    console.error('❌ 청구 목록 조회 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '청구 목록 조회 중 오류가 발생했습니다'
    });
  }
};

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

