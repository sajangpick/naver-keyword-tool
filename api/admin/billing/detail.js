/**
 * 청구 상세 정보 조회 API
 * 특정 사용자의 작업 크레딧 사용 상세 기록 조회
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
    const userId = req.query.userId;
    const month = req.query.month || getCurrentMonth();

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: '사용자 ID가 필요합니다'
      });
    }

    const monthStart = `${month}-01`;
    const monthEnd = getMonthEnd(month);

    // 1. 사용자 프로필 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, membership_level')
      .eq('id', userId)
      .single();

    if (profileError) {
      throw profileError;
    }

    // 2. 구독 정보 조회
    const { data: subscription } = await supabase
      .from('user_subscription')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    // 3. 가격 설정 조회
    const { data: pricingConfig } = await supabase
      .from('pricing_config')
      .select('*')
      .single();

    let planType = subscription?.plan_type || profile?.membership_level || 'seed';
    let minimumFee = subscription?.monthly_fee || 0;

    if (!subscription && pricingConfig) {
      const minimumFeeKey = `owner_${planType}_minimum_fee`;
      if (pricingConfig[minimumFeeKey] !== undefined) {
        minimumFee = pricingConfig[minimumFeeKey];
      }
    }

    // 4. 작업 크레딧 사용 기록 조회
    const { data: usageRecords, error: usageError } = await supabase
      .from('work_credit_usage')
      .select('*')
      .eq('user_id', userId)
      .gte('usage_date', monthStart)
      .lte('usage_date', monthEnd)
      .order('usage_date', { ascending: false })
      .order('used_at', { ascending: false });

    if (usageError) {
      throw usageError;
    }

    // 5. 응답 데이터 구성
    const detail = {
      userId: userId,
      userEmail: profile?.email || null,
      planType: planType,
      minimumFee: minimumFee,
      usageRecords: (usageRecords || []).map(record => ({
        usageDate: record.usage_date || record.used_at?.split('T')[0] || null,
        serviceType: record.service_type || null,
        workCreditsUsed: record.work_credits_used || 0,
        aiModel: record.ai_model || null
      }))
    };

    return res.json({
      success: true,
      data: detail
    });

  } catch (error) {
    console.error('❌ 청구 상세 정보 조회 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '청구 상세 정보 조회 중 오류가 발생했습니다'
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

