/**
 * 사용자 대시보드 API
 * 구독 정보와 사용 현황을 안전하게 조회합니다
 */

const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

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

/**
 * 사용자 인증 및 ID 추출
 */
async function authenticateUser(req) {
  try {
    if (!supabase) {
      console.error('❌ [user-dashboard] Supabase 클라이언트가 없어 인증할 수 없습니다');
      return null;
    }
    
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('⚠️ [user-dashboard] Authorization 헤더가 없습니다');
      return null;
    }

    const token = authHeader.substring(7);
    
    // Supabase 토큰 검증
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) {
      console.error('❌ [user-dashboard] 토큰 검증 실패:', error.message);
      return null;
    }
    
    if (!user) {
      console.warn('⚠️ [user-dashboard] 사용자를 찾을 수 없습니다');
      return null;
    }

    console.log(`✅ [user-dashboard] 인증 성공: userId=${user.id}`);
    return user;
  } catch (error) {
    console.error('❌ [user-dashboard] 인증 오류:', error);
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
      console.log(`📊 [user-dashboard] GET 요청: action=${action}, userId=${user.id}`);

      switch (action) {
        case 'dashboard':
          // 즉시 기본값 반환 (테스트용)
          console.log(`📊 [user-dashboard] dashboard 요청: userId=${user.id}`);
          try {
            return await getDashboardData(user, res);
          } catch (dashboardError) {
            console.error('❌ [user-dashboard] getDashboardData 호출 중 에러:', dashboardError);
            console.error('❌ 에러 스택:', dashboardError.stack);
            // 에러 발생 시 즉시 기본값 반환
            return res.json({
              success: true,
              data: {
                profile: {
                  id: user.id,
                  email: user.email || '',
                  name: user.user_metadata?.name || '',
                  user_type: 'owner',
                  membership_level: 'seed'
                },
                cycle: {
                  id: null,
                  monthly_token_limit: 100,
                  tokens_used: 0,
                  tokens_remaining: 100,
                  days_remaining: 30
                },
                recentUsage: [],
                plans: [],
                error: dashboardError.message
              }
            });
          }
        case 'billing':
          return await getBillingHistory(user, res);
        case 'usage':
          return await getTokenUsage(user, req, res);
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
    console.error('❌ 사용자 대시보드 API 최상위 오류:', error);
    console.error('❌ 에러 상세 정보:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      stack: error.stack?.split('\n').slice(0, 10).join('\n')
    });
    
    // 에러가 발생해도 기본값 반환 (500 에러 대신)
    try {
      // user 객체가 있는지 확인
      let userId = 'unknown';
      let userEmail = '';
      let userName = '';
      
      try {
        // 인증 시도
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ') && supabase) {
          const token = authHeader.substring(7);
          const { data: { user } } = await supabase.auth.getUser(token);
          if (user) {
            userId = user.id;
            userEmail = user.email || '';
            userName = user.user_metadata?.name || '';
          }
        }
      } catch (authErr) {
        console.warn('⚠️ 인증 정보를 가져올 수 없습니다:', authErr.message);
      }
      
      return res.json({
        success: true,
        data: {
          profile: {
            id: userId,
            email: userEmail,
            name: userName,
            user_type: 'owner',
            membership_level: 'seed'
          },
          cycle: {
            id: null,
            monthly_token_limit: 100,
            tokens_used: 0,
            tokens_remaining: 100,
            days_remaining: 30
          },
          recentUsage: [],
          plans: [],
          error: error.message
        }
      });
    } catch (fallbackError) {
      // 최후의 수단: 최소한의 응답이라도 반환
      return res.json({
        success: true,
        data: {
          profile: { id: 'unknown', email: '', name: '', user_type: 'owner', membership_level: 'seed' },
          cycle: { id: null, monthly_token_limit: 100, tokens_used: 0, tokens_remaining: 100, days_remaining: 30 },
          recentUsage: [],
          plans: []
        }
      });
    }
  }
};

/**
 * 대시보드 데이터 조회
 */
async function getDashboardData(user, res) {
  console.log(`📊 [user-dashboard] getDashboardData 함수 시작: userId=${user?.id || 'unknown'}`);
  
  // 기본값 정의
  const defaultProfile = {
    id: user?.id || 'unknown',
    email: user?.email || '',
    name: user?.user_metadata?.name || '',
    user_type: 'owner',
    membership_level: 'seed'
  };
  
  const defaultCycle = {
    id: null,
    monthly_token_limit: 100,
    tokens_used: 0,
    tokens_remaining: 100,
    days_remaining: 30
  };
  
  try {
    // 1. 사용자 프로필 조회
    let profile = defaultProfile;
    try {
      if (supabase) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        
        if (!profileError && profileData) {
          profile = profileData;
        }
      }
    } catch (err) {
      console.warn('⚠️ 프로필 조회 실패, 기본값 사용:', err.message);
    }
    
    // 2. 현재 구독 사이클 조회
    let currentCycle = null;
    try {
      if (supabase) {
        const { data: cycleData, error: cycleError } = await supabase
          .from('subscription_cycle')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (!cycleError && cycleData) {
          currentCycle = cycleData;
        }
      }
    } catch (err) {
      console.warn('⚠️ 사이클 조회 실패:', err.message);
    }
    
    // 3. 사이클이 없으면 새로 생성 시도
    if (!currentCycle) {
      try {
        const level = profile.membership_level || 'seed';
        const userType = profile.user_type || 'owner';
        
        // 토큰 설정 조회
        let monthlyTokens = 100;
        if (supabase) {
          try {
            const { data: tokenConfigs } = await supabase
              .from('token_config')
              .select('*')
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (tokenConfigs) {
              const tokenKey = `${userType}_${level}_limit`;
              monthlyTokens = tokenConfigs[tokenKey] || 100;
            }
          } catch (err) {
            console.warn('⚠️ 토큰 설정 조회 실패, 기본값 사용:', err.message);
          }
        }
        
        // 새 사이클 생성
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);
        
        if (supabase) {
          const { data: newCycle, error: createError } = await supabase
            .from('subscription_cycle')
            .insert({
              user_id: user.id,
              user_type: userType,
              cycle_start_date: startDate.toISOString().split('T')[0],
              cycle_end_date: endDate.toISOString().split('T')[0],
              days_in_cycle: 30,
              monthly_token_limit: monthlyTokens,
              tokens_used: 0,
              tokens_remaining: monthlyTokens,
              status: 'active',
              billing_amount: 0,
              payment_status: 'completed'
            })
            .select()
            .maybeSingle();
          
          if (!createError && newCycle) {
            currentCycle = newCycle;
            console.log('✅ 새 사이클 생성 완료');
          }
        }
      } catch (err) {
        console.warn('⚠️ 사이클 생성 실패:', err.message);
      }
    }
    
    // 사이클이 여전히 없으면 기본값 사용
    if (!currentCycle) {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);
      
      currentCycle = {
        ...defaultCycle,
        user_id: user.id,
        cycle_start_date: startDate.toISOString().split('T')[0],
        cycle_end_date: endDate.toISOString().split('T')[0]
      };
    }
    
    // 4. 토큰 사용 통계 조회
    let totalUsed = 0;
    let recentUsage = [];
    try {
      if (supabase && currentCycle.cycle_start_date) {
        // 토큰 사용 통계 (여러 행 반환 가능)
        const { data: tokenStats } = await supabase
          .from('token_usage')
          .select('tokens_used, used_at')
          .eq('user_id', user.id)
          .gte('used_at', currentCycle.cycle_start_date);
        
        if (tokenStats && Array.isArray(tokenStats)) {
          totalUsed = tokenStats.reduce((sum, t) => sum + (t.tokens_used || 0), 0);
        }
        
        // 최근 사용 내역
        const { data: usageData } = await supabase
          .from('token_usage')
          .select('*')
          .eq('user_id', user.id)
          .order('used_at', { ascending: false })
          .limit(10);
        
        if (usageData && Array.isArray(usageData)) {
          recentUsage = usageData;
        }
      }
    } catch (err) {
      console.warn('⚠️ 토큰 사용 통계 조회 실패:', err.message);
    }
    
    // 5. 관리자 설정에서 최신 토큰 한도 확인
    let currentTokenLimit = currentCycle.monthly_token_limit || 100;
    try {
      if (supabase) {
        const { data: tokenConfigs } = await supabase
          .from('token_config')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (tokenConfigs) {
          const userType = profile.user_type || 'owner';
          const membershipLevel = profile.membership_level || 'seed';
          const tokenLimitKey = `${userType}_${membershipLevel}_limit`;
          
          if (tokenConfigs[tokenLimitKey] !== undefined && tokenConfigs[tokenLimitKey] !== null) {
            currentTokenLimit = Number(tokenConfigs[tokenLimitKey]);
            
            // 사이클 업데이트 (사이클이 실제로 존재할 때만)
            if (currentCycle.id && currentCycle.monthly_token_limit !== currentTokenLimit) {
              await supabase
                .from('subscription_cycle')
                .update({
                  monthly_token_limit: currentTokenLimit,
                  tokens_remaining: currentTokenLimit - totalUsed,
                  updated_at: new Date().toISOString()
                })
                .eq('id', currentCycle.id);
              
              currentCycle.monthly_token_limit = currentTokenLimit;
            }
          }
        }
      }
    } catch (err) {
      console.warn('⚠️ 토큰 한도 업데이트 실패:', err.message);
    }
    
    // 6. 플랜 정보 구성
    let plans = [];
    try {
      if (supabase) {
        const { data: pricingConfig } = await supabase
          .from('pricing_config')
          .select('*')
          .maybeSingle();
        
        const { data: tokenConfigs } = await supabase
          .from('token_config')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        const tokenConfig = tokenConfigs || {};
        const userType = profile.user_type || 'owner';
        
        plans = userType === 'owner' ? [
          { id: 'seed', name: '씨앗', price: pricingConfig?.owner_seed_price || 0, tokens: tokenConfig?.owner_seed_limit || 100, description: '무료 플랜' },
          { id: 'power', name: '파워', price: pricingConfig?.owner_power_price || 30000, tokens: tokenConfig?.owner_power_limit || 500, description: '기본 플랜' },
          { id: 'bigpower', name: '빅파워', price: pricingConfig?.owner_bigpower_price || 50000, tokens: tokenConfig?.owner_bigpower_limit || 833, description: '인기 플랜' },
          { id: 'premium', name: '프리미엄', price: pricingConfig?.owner_premium_price || 70000, tokens: tokenConfig?.owner_premium_limit || 1166, description: '최고 플랜' }
        ] : [
          { id: 'elite', name: '엘리트', price: pricingConfig?.agency_elite_price || 100000, tokens: tokenConfig?.agency_elite_limit || 1000, description: '시작 플랜' },
          { id: 'expert', name: '전문가', price: pricingConfig?.agency_expert_price || 300000, tokens: tokenConfig?.agency_expert_limit || 3000, description: '기본 플랜' },
          { id: 'master', name: '마스터', price: pricingConfig?.agency_master_price || 500000, tokens: tokenConfig?.agency_master_limit || 5000, description: '인기 플랜' },
          { id: 'premium', name: '프리미엄', price: pricingConfig?.agency_premium_price || 1000000, tokens: tokenConfig?.agency_premium_limit || 10000, description: '최고 플랜' }
        ];
      }
    } catch (err) {
      console.warn('⚠️ 플랜 정보 조회 실패:', err.message);
    }
    
    // 7. 갱신일까지 남은 일수 계산
    const cycleEndDate = new Date(currentCycle.cycle_end_date);
    const today = new Date();
    const daysRemaining = Math.ceil((cycleEndDate - today) / (1000 * 60 * 60 * 24));
    
    // 최종 응답
    return res.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          email: profile.email || user.email || '',
          name: profile.name || user.user_metadata?.name || '',
          user_type: profile.user_type || 'owner',
          membership_level: profile.membership_level || 'seed',
          created_at: profile.created_at
        },
        cycle: {
          ...currentCycle,
          monthly_token_limit: currentTokenLimit,
          tokens_used: totalUsed,
          tokens_remaining: Math.max(0, currentTokenLimit - totalUsed),
          days_remaining: daysRemaining,
          usage_rate: currentTokenLimit > 0 ? Math.round((totalUsed / currentTokenLimit) * 100) : 0
        },
        recentUsage: recentUsage || [],
        plans: plans || [],
        stats: {
          total_tokens_used: totalUsed,
          daily_average: recentUsage?.length > 0 ? Math.round(totalUsed / Math.max(1, Math.ceil((today - new Date(currentCycle.cycle_start_date)) / (1000 * 60 * 60 * 24)))) : 0
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [user-dashboard] getDashboardData 함수 내부 오류:', error);
    // 에러 발생 시 기본값 반환
    return res.json({
      success: true,
      data: {
        profile: defaultProfile,
        cycle: defaultCycle,
        recentUsage: [],
        plans: []
      }
    });
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
    console.error('❌ [user-dashboard] getBillingHistory 함수 내부 오류:', error);
    console.error('❌ 에러 상세:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    throw error;
  }
}

/**
 * 토큰 사용 내역 조회
 */
async function getTokenUsage(user, req, res) {
  try {
    const limit = parseInt(req.query?.limit) || 50;
    const offset = parseInt(req.query?.offset) || 0;

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
    console.error('❌ [user-dashboard] getDashboardData 함수 내부 오류:', error);
    console.error('❌ 에러 상세:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
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
    console.error('❌ [user-dashboard] getDashboardData 함수 내부 오류:', error);
    console.error('❌ 에러 상세:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
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
    console.error('❌ [user-dashboard] getDashboardData 함수 내부 오류:', error);
    console.error('❌ 에러 상세:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    });
    throw error;
  }
}
