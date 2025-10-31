/**
 * 구독 사이클 관리 API
 * 사용자의 구독 주기를 관리하고 자동 갱신을 처리합니다
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * 새 구독 사이클 생성
 */
async function createNewCycle(userId, membershipLevel = null) {
  try {
    // 사용자 프로필 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!profile) {
      throw new Error('사용자를 찾을 수 없습니다');
    }

    const level = membershipLevel || profile.membership_level || 'seed';
    const userType = profile.user_type || 'owner';

    // 가격 및 토큰 설정 조회
    const { data: pricingConfig } = await supabase
      .from('pricing_config')
      .select('*')
      .single();

    const { data: tokenConfig } = await supabase
      .from('token_config')
      .select('*')
      .single();

    // 개인 맞춤 설정 확인
    const { data: customPricing } = await supabase
      .from('member_custom_pricing')
      .select('*')
      .eq('member_id', userId)
      .single();

    const { data: customTokenLimit } = await supabase
      .from('member_custom_token_limit')
      .select('*')
      .eq('member_id', userId)
      .single();

    // 가격 및 토큰 계산
    const priceKey = `${userType}_${level}_price`;
    const tokenKey = `${userType}_${level}_limit`;
    
    const monthlyPrice = customPricing?.custom_price || pricingConfig?.[priceKey] || 0;
    const monthlyTokens = customTokenLimit?.custom_limit || tokenConfig?.[tokenKey] || 100;

    // 주기 날짜 계산
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 30);

    // 새 사이클 생성
    const { data: newCycle, error: createError } = await supabase
      .from('subscription_cycle')
      .insert({
        user_id: userId,
        user_type: userType,
        cycle_start_date: startDate.toISOString().split('T')[0],
        cycle_end_date: endDate.toISOString().split('T')[0],
        days_in_cycle: 30,
        monthly_token_limit: monthlyTokens,
        tokens_used: 0,
        tokens_remaining: monthlyTokens,
        status: 'active',
        billing_amount: monthlyPrice,
        payment_status: monthlyPrice === 0 ? 'completed' : 'pending'
      })
      .select()
      .single();

    if (createError) throw createError;

    // 청구 내역 생성
    if (monthlyPrice > 0) {
      await supabase
        .from('billing_history')
        .insert({
          user_id: userId,
          user_type: userType,
          membership_level: level,
          billing_period_start: startDate.toISOString().split('T')[0],
          billing_period_end: endDate.toISOString().split('T')[0],
          monthly_limit: monthlyTokens,
          tokens_used: 0,
          base_price: monthlyPrice,
          total_price: monthlyPrice,
          payment_status: 'pending'
        });
    }

    console.log(`✅ 새 구독 사이클 생성: ${userId} - ${level} 등급`);
    return newCycle;

  } catch (error) {
    console.error('구독 사이클 생성 오류:', error);
    throw error;
  }
}

/**
 * 만료된 사이클 갱신
 */
async function renewExpiredCycles() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 만료된 활성 사이클 조회
    const { data: expiredCycles, error } = await supabase
      .from('subscription_cycle')
      .select('*')
      .eq('status', 'active')
      .lte('cycle_end_date', today);

    if (error) throw error;

    const results = [];
    
    for (const cycle of expiredCycles || []) {
      // 기존 사이클 종료
      await supabase
        .from('subscription_cycle')
        .update({ 
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('id', cycle.id);

      // 사용자 프로필 조회
      const { data: profile } = await supabase
        .from('profiles')
        .select('membership_level')
        .eq('id', cycle.user_id)
        .single();

      // 새 사이클 생성
      const newCycle = await createNewCycle(cycle.user_id, profile?.membership_level);
      results.push(newCycle);

      console.log(`✅ 구독 갱신 완료: ${cycle.user_id}`);
    }

    return results;

  } catch (error) {
    console.error('구독 갱신 오류:', error);
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
    // GET: 구독 사이클 조회
    if (req.method === 'GET') {
      const { user_id } = req.query;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: '사용자 ID가 필요합니다'
        });
      }

      // 활성 구독 사이클 조회
      const { data: cycle, error: fetchError } = await supabase
        .from('subscription_cycle')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // 사이클이 없으면 새로 생성
      if (!cycle) {
        const newCycle = await createNewCycle(user_id);
        return res.json({
          success: true,
          cycle: newCycle,
          isNew: true
        });
      }

      // 만료 체크
      const today = new Date().toISOString().split('T')[0];
      if (cycle.cycle_end_date < today) {
        // 만료된 사이클 업데이트
        await supabase
          .from('subscription_cycle')
          .update({ status: 'expired' })
          .eq('id', cycle.id);

        // 새 사이클 생성
        const newCycle = await createNewCycle(user_id);
        return res.json({
          success: true,
          cycle: newCycle,
          renewed: true
        });
      }

      return res.json({
        success: true,
        cycle
      });
    }

    // POST: 새 구독 사이클 생성
    if (req.method === 'POST') {
      const { user_id, membership_level } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: '사용자 ID가 필요합니다'
        });
      }

      const newCycle = await createNewCycle(user_id, membership_level);

      return res.json({
        success: true,
        cycle: newCycle,
        message: '새 구독 사이클이 생성되었습니다'
      });
    }

    // PUT: 구독 갱신
    if (req.method === 'PUT' && req.query.action === 'renew') {
      const renewedCycles = await renewExpiredCycles();

      return res.json({
        success: true,
        renewed: renewedCycles.length,
        cycles: renewedCycles,
        message: `${renewedCycles.length}개의 구독이 갱신되었습니다`
      });
    }

    return res.status(405).json({
      success: false,
      error: '허용되지 않은 메소드입니다'
    });

  } catch (error) {
    console.error('❌ 구독 사이클 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '구독 사이클 처리 중 오류가 발생했습니다'
    });
  }
};
