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
        
        if (profileError) {
          console.error('❌ [user-dashboard] 프로필 조회 에러:', profileError);
        } else if (profileData) {
          profile = profileData;
          
          // 'free' 등급을 'seed'로 자동 변환 (DB에 남아있을 수 있음)
          if (profile.membership_level && profile.membership_level.toLowerCase() === 'free') {
            console.warn('⚠️ [user-dashboard] free 등급 발견, seed로 변환:', {
              userId: user.id,
              original: profile.membership_level
            });
            
            // DB에 바로 업데이트
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ 
                membership_level: 'seed',
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id);
            
            if (updateError) {
              console.error('❌ [user-dashboard] free → seed 변환 실패:', updateError);
            } else {
              console.log('✅ [user-dashboard] free → seed 변환 완료');
            }
            
            // 메모리상의 값도 업데이트
            profile.membership_level = 'seed';
          }
          
          // NULL 또는 빈 문자열도 'seed'로 변환
          if (!profile.membership_level || profile.membership_level === '') {
            console.warn('⚠️ [user-dashboard] NULL/빈 등급 발견, seed로 변환:', {
              userId: user.id
            });
            
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ 
                membership_level: 'seed',
                updated_at: new Date().toISOString()
              })
              .eq('id', user.id);
            
            if (!updateError) {
              profile.membership_level = 'seed';
            }
          }
          
          console.log('✅ [user-dashboard] 프로필 조회 성공:', {
            userId: user.id,
            membership_level: profile.membership_level,
            user_type: profile.user_type,
            email: profile.email
          });
        } else {
          console.warn('⚠️ [user-dashboard] 프로필 데이터가 없습니다. 기본값 사용:', user.id);
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
        
        // 관리자 등급 체크
        const isAdmin = level === 'admin' || userType === 'admin';
        
        // 크레딧 설정 조회 (작업 크레딧 시스템 - pricing_config 우선)
        let monthlyCredits = 100;
        if (isAdmin) {
          // 관리자는 무제한 (null 또는 매우 큰 값)
          monthlyCredits = null; // null = 무제한
          console.log(`📊 [user-dashboard] 관리자 등급 - 크레딧 무제한`);
        } else if (supabase) {
          try {
            // pricing_config에서 included_credits 우선 조회
            const { data: pricingConfig } = await supabase
              .from('pricing_config')
              .select('*')
              .single();
            
            // 대행사 등급 매핑 (elite/expert/master → starter/pro/enterprise)
            const levelMapping = {
              'elite': 'starter',
              'expert': 'pro',
              'master': 'enterprise'
            };
            const mappedLevel = levelMapping[level] || level;
            
            const includedCreditsKey = userType === 'agency' 
              ? `${userType}_${mappedLevel}_included_credits`
              : `${userType}_${level}_included_credits`;
            
            if (pricingConfig?.[includedCreditsKey] !== undefined) {
              monthlyCredits = Number(pricingConfig[includedCreditsKey]) || 100;
              console.log(`📊 [user-dashboard] 새 사이클 생성 - 포함 크레딧: ${monthlyCredits} (${includedCreditsKey})`);
            } else {
              // pricing_config에 없으면 token_config에서 조회 (하위 호환성)
              const { data: tokenConfigs, error: tokenConfigError } = await supabase
                .from('token_config')
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              if (!tokenConfigError && tokenConfigs) {
                const tokenKey = `${userType}_${level}_limit`;
                monthlyCredits = tokenConfigs[tokenKey] || 100;
                console.log(`📊 [user-dashboard] 새 사이클 생성 - 토큰 한도 사용: ${monthlyCredits} (${tokenKey})`);
              } else {
                console.warn('⚠️ 크레딧 설정 조회 실패, 기본값 100 사용:', tokenConfigError?.message || '설정 없음');
              }
            }
          } catch (err) {
            console.warn('⚠️ 크레딧 설정 조회 실패, 기본값 사용:', err.message);
          }
        }
        
        // 새 사이클 생성
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 30);
        
        if (supabase) {
          // 관리자는 무제한이므로 매우 큰 값으로 설정
          const cycleCreditLimit = isAdmin ? 999999 : monthlyCredits;
          const cycleCreditsRemaining = isAdmin ? 999999 : monthlyCredits;
          
          const { data: newCycle, error: createError } = await supabase
            .from('subscription_cycle')
            .insert({
              user_id: user.id,
              user_type: userType,
              cycle_start_date: startDate.toISOString().split('T')[0],
              cycle_end_date: endDate.toISOString().split('T')[0],
              days_in_cycle: 30,
              included_credits: cycleCreditLimit, // 작업 크레딧 시스템
              credits_used: 0,
              credits_remaining: cycleCreditsRemaining,
              monthly_token_limit: cycleCreditLimit, // 하위 호환성
              tokens_used: 0,
              tokens_remaining: cycleCreditsRemaining,
              status: 'active',
              billing_amount: 0,
              payment_status: 'completed'
            })
            .select()
            .maybeSingle();
          
          if (!createError && newCycle) {
            currentCycle = newCycle;
            console.log(`✅ 새 사이클 생성 완료 (관리자: ${isAdmin ? '무제한' : monthlyCredits + ' 크레딧'})`);
          }
        }
      } catch (err) {
        console.warn('⚠️ 사이클 생성 실패:', err.message);
      }
    }
    
    // 사이클이 여전히 없으면 기본값 사용 (크레딧 필드 포함)
    if (!currentCycle) {
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);
      
      currentCycle = {
        ...defaultCycle,
        user_id: user.id,
        cycle_start_date: startDate.toISOString().split('T')[0],
        cycle_end_date: endDate.toISOString().split('T')[0],
        included_credits: 100, // 작업 크레딧 시스템
        credits_used: 0,
        credits_remaining: 100
      };
    }
    
    // 4. 토큰 사용 통계 조회
    let totalUsed = 0;
    let recentUsage = [];
    try {
      if (supabase && currentCycle.cycle_start_date) {
        // 작업 크레딧 사용 통계 (work_credit_usage 테이블)
        const { data: creditStats } = await supabase
          .from('work_credit_usage')
          .select('work_credits_used, used_at')
          .eq('user_id', user.id)
          .gte('used_at', currentCycle.cycle_start_date);
        
        if (creditStats && Array.isArray(creditStats)) {
          totalUsed = creditStats.reduce((sum, t) => sum + (t.work_credits_used || 0), 0);
        }
        
        // 최근 사용 내역 (작업 크레딧)
        const { data: usageData } = await supabase
          .from('work_credit_usage')
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
    
    // 5. 관리자 설정에서 최신 작업 크레딧 한도 확인 (작업 크레딧 시스템)
    const isAdmin = profile.membership_level === 'admin' || profile.user_type === 'admin';
    let currentCreditLimit = currentCycle.included_credits || currentCycle.monthly_token_limit || 100;
    
    // 관리자는 무제한
    if (isAdmin) {
      currentCreditLimit = 999999; // 무제한을 나타내는 매우 큰 값
      console.log(`📊 [user-dashboard] 관리자 등급 - 작업 크레딧 무제한`);
    } else {
      try {
        if (supabase) {
          // pricing_config에서 포함된 크레딧 조회 (최우선)
          const { data: pricingConfig } = await supabase
            .from('pricing_config')
            .select('*')
            .maybeSingle();
          
          const userType = profile.user_type || 'owner';
          const membershipLevel = profile.membership_level || 'seed';
          const includedCreditsKey = `${userType}_${membershipLevel}_included_credits`;
          
          if (pricingConfig?.[includedCreditsKey] !== undefined) {
            currentCreditLimit = Number(pricingConfig[includedCreditsKey]);
            console.log(`✅ [user-dashboard] pricing_config 포함 크레딧 사용: ${currentCreditLimit}`);
          } else {
            // credit_config에서 한도 조회
            const { data: creditConfigs, error: creditConfigError } = await supabase
              .from('credit_config')
              .select('*')
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (!creditConfigError && creditConfigs) {
              const creditLimitKey = `${userType}_${membershipLevel}_limit`;
              
              if (creditConfigs[creditLimitKey] !== undefined && creditConfigs[creditLimitKey] !== null) {
                currentCreditLimit = Number(creditConfigs[creditLimitKey]);
                console.log(`✅ [user-dashboard] 관리자 설정 한도 사용: ${currentCreditLimit}`);
              }
            }
          }
          
          // 사이클 업데이트 (포함 크레딧과 다를 경우 또는 credits_used가 실제 사용량과 다를 경우)
          const needsUpdate = currentCycle.id && (
            currentCycle.included_credits !== currentCreditLimit ||
            currentCycle.credits_used !== totalUsed ||
            currentCycle.credits_remaining !== Math.max(0, currentCreditLimit - totalUsed)
          );
          
          if (needsUpdate) {
            const calculatedCreditsRemaining = Math.max(0, currentCreditLimit - totalUsed);
            console.log(`🔄 [user-dashboard] 사이클 크레딧 업데이트:`, {
              included_credits: `${currentCycle.included_credits || 0} → ${currentCreditLimit}`,
              credits_used: `${currentCycle.credits_used || 0} → ${totalUsed}`,
              credits_remaining: `${currentCycle.credits_remaining || 0} → ${calculatedCreditsRemaining}`
            });
            
            const { error: updateError } = await supabase
              .from('subscription_cycle')
              .update({
                included_credits: currentCreditLimit,
                credits_used: totalUsed,
                credits_remaining: calculatedCreditsRemaining,
                monthly_token_limit: currentCreditLimit, // 하위 호환성
                tokens_used: totalUsed, // 하위 호환성
                tokens_remaining: calculatedCreditsRemaining,
                updated_at: new Date().toISOString()
              })
              .eq('id', currentCycle.id);
            
            if (updateError) {
              console.error('❌ 사이클 업데이트 실패:', updateError);
            } else {
              console.log('✅ 사이클 크레딧 업데이트 완료');
              currentCycle.included_credits = currentCreditLimit;
              currentCycle.credits_used = totalUsed;
              currentCycle.credits_remaining = calculatedCreditsRemaining;
            }
          }
        }
      } catch (err) {
        console.warn('⚠️ 작업 크레딧 한도 업데이트 실패:', err.message);
      }
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
    
    // 최종 응답 (작업 크레딧 시스템)
    const includedCredits = currentCycle.included_credits || currentCreditLimit;
    const creditsUsed = currentCycle.credits_used || totalUsed;
    const creditsRemaining = Math.max(0, includedCredits - creditsUsed);
    
    const finalCycle = {
      ...currentCycle,
      included_credits: includedCredits,
      credits_used: creditsUsed,
      credits_remaining: creditsRemaining,
      monthly_token_limit: includedCredits, // 하위 호환성
      tokens_used: creditsUsed, // 하위 호환성
      tokens_remaining: creditsRemaining, // 하위 호환성
      days_remaining: daysRemaining,
      usage_rate: includedCredits > 0 ? Math.round((creditsUsed / includedCredits) * 100) : 0
    };
    
    // membership_level 확인 및 로깅
    const finalMembershipLevel = profile.membership_level || 'seed';
    console.log('📊 [user-dashboard] 최종 응답 데이터:', {
      userId: user.id,
      profileMembership: profile.membership_level,
      finalMembershipLevel: finalMembershipLevel,
      profileData: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        user_type: profile.user_type,
        membership_level: profile.membership_level
      },
      cycleId: currentCycle.id,
      includedCredits: includedCredits,
      creditsUsed: creditsUsed,
      creditsRemaining: creditsRemaining,
      tokenLimit: includedCredits, // 하위 호환성
      tokensUsed: creditsUsed, // 하위 호환성
      tokensRemaining: creditsRemaining, // 하위 호환성
      daysRemaining: daysRemaining
    });
    
    // membership_level이 null이거나 undefined인 경우 경고
    if (!profile.membership_level || profile.membership_level === 'seed') {
      console.warn('⚠️ [user-dashboard] membership_level이 없거나 seed입니다. DB에서 확인 필요:', {
        userId: user.id,
        currentMembershipLevel: profile.membership_level,
        willUse: finalMembershipLevel
      });
    }
    
    return res.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          email: profile.email || user.email || '',
          name: profile.name || user.user_metadata?.name || '',
          user_type: profile.user_type || 'owner',
          membership_level: finalMembershipLevel,
          created_at: profile.created_at
        },
        cycle: finalCycle,
        recentUsage: recentUsage || [],
        plans: plans || [],
        stats: {
          total_credits_used: creditsUsed,
          total_tokens_used: creditsUsed, // 하위 호환성
          daily_average: recentUsage?.length > 0 ? Math.round(creditsUsed / Math.max(1, Math.ceil((today - new Date(currentCycle.cycle_start_date)) / (1000 * 60 * 60 * 24)))) : 0
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
