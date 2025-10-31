/**
 * 사용자 대시보드 API
 * 구독 정보와 사용 현황을 안전하게 조회합니다
 */

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * 사용자 인증 및 ID 추출
 */
async function authenticateUser(req) {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    
    // Supabase 토큰 검증
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('인증 오류:', error);
    return null;
  }
}

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 사용자 인증
    const user = await authenticateUser(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: '인증이 필요합니다'
      });
    }

    // GET: 대시보드 데이터 조회
    if (req.method === 'GET') {
      const action = req.query.action || 'dashboard';

      switch (action) {
        case 'dashboard':
          return await getDashboardData(user, res);
        case 'billing':
          return await getBillingHistory(user, res);
        case 'usage':
          return await getTokenUsage(user, res);
        default:
          return res.status(400).json({
            success: false,
            error: '유효하지 않은 액션입니다'
          });
      }
    }

    // POST: 업그레이드 요청 등
    if (req.method === 'POST') {
      const action = req.body.action;

      switch (action) {
        case 'upgrade':
          return await requestUpgrade(user, req.body, res);
        case 'cancel':
          return await cancelSubscription(user, res);
        default:
          return res.status(400).json({
            success: false,
            error: '유효하지 않은 액션입니다'
          });
      }
    }

    return res.status(405).json({
      success: false,
      error: '허용되지 않은 메소드입니다'
    });

  } catch (error) {
    console.error('❌ 사용자 대시보드 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '대시보드 데이터 처리 중 오류가 발생했습니다'
    });
  }
};

/**
 * 대시보드 데이터 조회
 */
async function getDashboardData(user, res) {
  try {
    // 사용자 프로필 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;

    // 현재 구독 사이클 조회
    const { data: cycle, error: cycleError } = await supabase
      .from('subscription_cycle')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 사이클이 없으면 새로 생성
    if (!cycle) {
      const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:5000'}/api/subscription/cycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id })
      });
      
      const cycleResult = await response.json();
      if (!cycleResult.success) throw new Error(cycleResult.error);
      
      return res.json({
        success: true,
        data: {
          profile,
          cycle: cycleResult.cycle,
          isNew: true
        }
      });
    }

    // 토큰 사용 통계
    const startDate = cycle.cycle_start_date;
    const { data: tokenStats, error: statsError } = await supabase
      .from('token_usage')
      .select('tokens_used, used_at')
      .eq('user_id', user.id)
      .gte('used_at', startDate);

    const totalUsed = tokenStats?.reduce((sum, t) => sum + t.tokens_used, 0) || 0;

    // 최근 사용 내역
    const { data: recentUsage } = await supabase
      .from('token_usage')
      .select('*')
      .eq('user_id', user.id)
      .order('used_at', { ascending: false })
      .limit(10);

    // 가격 정보 조회
    const { data: pricingConfig } = await supabase
      .from('pricing_config')
      .select('*')
      .single();

    const { data: tokenConfig } = await supabase
      .from('token_config')
      .select('*')
      .single();

    // 플랜 정보 구성
    const userType = profile.user_type || 'owner';
    const plans = userType === 'owner' ? [
      { 
        id: 'seed', 
        name: '씨앗', 
        price: pricingConfig?.owner_seed_price || 0, 
        tokens: tokenConfig?.owner_seed_limit || 100,
        description: '무료 플랜'
      },
      { 
        id: 'power', 
        name: '파워', 
        price: pricingConfig?.owner_power_price || 30000,
        tokens: tokenConfig?.owner_power_limit || 500,
        description: '기본 플랜'
      },
      { 
        id: 'bigpower', 
        name: '빅파워', 
        price: pricingConfig?.owner_bigpower_price || 50000,
        tokens: tokenConfig?.owner_bigpower_limit || 833,
        description: '인기 플랜'
      },
      { 
        id: 'premium', 
        name: '프리미엄', 
        price: pricingConfig?.owner_premium_price || 70000,
        tokens: tokenConfig?.owner_premium_limit || 1166,
        description: '최고 플랜'
      }
    ] : [
      { 
        id: 'elite', 
        name: '엘리트', 
        price: pricingConfig?.agency_elite_price || 100000,
        tokens: tokenConfig?.agency_elite_limit || 1000,
        description: '시작 플랜'
      },
      { 
        id: 'expert', 
        name: '전문가', 
        price: pricingConfig?.agency_expert_price || 300000,
        tokens: tokenConfig?.agency_expert_limit || 3000,
        description: '기본 플랜'
      },
      { 
        id: 'master', 
        name: '마스터', 
        price: pricingConfig?.agency_master_price || 500000,
        tokens: tokenConfig?.agency_master_limit || 5000,
        description: '인기 플랜'
      },
      { 
        id: 'premium', 
        name: '프리미엄', 
        price: pricingConfig?.agency_premium_price || 1000000,
        tokens: tokenConfig?.agency_premium_limit || 10000,
        description: '최고 플랜'
      }
    ];

    // 다음 갱신일 계산
    const cycleEndDate = new Date(cycle.cycle_end_date);
    const today = new Date();
    const daysRemaining = Math.ceil((cycleEndDate - today) / (1000 * 60 * 60 * 24));

    return res.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          user_type: profile.user_type,
          membership_level: profile.membership_level,
          created_at: profile.created_at
        },
        cycle: {
          ...cycle,
          tokens_used: totalUsed,
          tokens_remaining: cycle.monthly_token_limit - totalUsed,
          days_remaining: daysRemaining,
          usage_rate: Math.round((totalUsed / cycle.monthly_token_limit) * 100)
        },
        plans,
        recentUsage,
        stats: {
          total_tokens_used: totalUsed,
          daily_average: recentUsage?.length > 0 ? 
            Math.round(totalUsed / Math.max(1, Math.ceil((today - new Date(cycle.cycle_start_date)) / (1000 * 60 * 60 * 24)))) : 0
        }
      }
    });

  } catch (error) {
    throw error;
  }
}

/**
 * 청구 내역 조회
 */
async function getBillingHistory(user, res) {
  try {
    const { data: billing, error } = await supabase
      .from('billing_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) throw error;

    return res.json({
      success: true,
      data: billing || []
    });

  } catch (error) {
    throw error;
  }
}

/**
 * 토큰 사용 내역 조회
 */
async function getTokenUsage(user, res) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const { data: usage, error, count } = await supabase
      .from('token_usage')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('used_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return res.json({
      success: true,
      data: usage || [],
      pagination: {
        total: count,
        limit,
        offset,
        hasMore: offset + limit < count
      }
    });

  } catch (error) {
    throw error;
  }
}

/**
 * 업그레이드 요청
 */
async function requestUpgrade(user, body, res) {
  try {
    const { target_level, reason } = body;

    if (!target_level) {
      return res.status(400).json({
        success: false,
        error: '목표 등급을 선택해주세요'
      });
    }

    // 현재 프로필 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('membership_level')
      .eq('id', user.id)
      .single();

    if (profile.membership_level === target_level) {
      return res.status(400).json({
        success: false,
        error: '이미 해당 등급입니다'
      });
    }

    // 업그레이드 요청 생성
    const { data: request, error } = await supabase
      .from('upgrade_requests')
      .insert({
        user_id: user.id,
        current_membership_level: profile.membership_level,
        requested_membership_level: target_level,
        reason: reason || '토큰 한도 증가 필요',
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      data: request,
      message: '업그레이드 요청이 접수되었습니다. 관리자 검토 후 연락드리겠습니다.'
    });

  } catch (error) {
    throw error;
  }
}

/**
 * 구독 취소 (다운그레이드)
 */
async function cancelSubscription(user, res) {
  try {
    // 씨앗 등급으로 다운그레이드
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        membership_level: 'seed',
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // 현재 사이클 종료
    const { error: cycleError } = await supabase
      .from('subscription_cycle')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (cycleError) throw cycleError;

    return res.json({
      success: true,
      message: '구독이 취소되었습니다. 씨앗(무료) 등급으로 변경됩니다.'
    });

  } catch (error) {
    throw error;
  }
}
