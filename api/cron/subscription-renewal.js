/**
 * 구독 자동 갱신 크론 작업
 * 매일 자정에 실행되어 만료된 구독을 갱신합니다
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * 만료된 구독 갱신
 */
async function renewExpiredSubscriptions() {
  try {
    console.log('🔄 구독 갱신 작업 시작...');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 1. 만료된 구독 조회
    const { data: expiredCycles, error: fetchError } = await supabase
      .from('subscription_cycle')
      .select('*')
      .eq('status', 'active')
      .lte('cycle_end_date', todayStr);

    if (fetchError) throw fetchError;

    console.log(`📊 만료된 구독 수: ${expiredCycles?.length || 0}`);

    const results = {
      renewed: [],
      failed: [],
      total: expiredCycles?.length || 0
    };

    // 2. 각 만료된 구독 처리
    for (const cycle of expiredCycles || []) {
      try {
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
          .select('*')
          .eq('id', cycle.user_id)
          .single();

        if (!profile) {
          results.failed.push({
            user_id: cycle.user_id,
            reason: '프로필을 찾을 수 없음'
          });
          continue;
        }

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
          .eq('member_id', cycle.user_id)
          .single();

        const { data: customTokenLimit } = await supabase
          .from('member_custom_token_limit')
          .select('*')
          .eq('member_id', cycle.user_id)
          .single();

        // 가격 및 토큰 계산
        const userType = profile.user_type || 'owner';
        const level = profile.membership_level || 'seed';
        const priceKey = `${userType}_${level}_price`;
        const tokenKey = `${userType}_${level}_limit`;
        
        const monthlyPrice = customPricing?.custom_price || pricingConfig?.[priceKey] || 0;
        const monthlyTokens = customTokenLimit?.custom_limit || tokenConfig?.[tokenKey] || 100;

        // 새 사이클 시작/종료 날짜
        const newStartDate = new Date(cycle.cycle_end_date);
        newStartDate.setDate(newStartDate.getDate() + 1); // 종료일 다음날부터
        const newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + 30); // 30일 후

        // 새 구독 사이클 생성
        const { data: newCycle, error: createError } = await supabase
          .from('subscription_cycle')
          .insert({
            user_id: cycle.user_id,
            user_type: userType,
            cycle_start_date: newStartDate.toISOString().split('T')[0],
            cycle_end_date: newEndDate.toISOString().split('T')[0],
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
        const { error: billingError } = await supabase
          .from('billing_history')
          .insert({
            user_id: cycle.user_id,
            user_type: userType,
            membership_level: level,
            billing_period_start: newStartDate.toISOString().split('T')[0],
            billing_period_end: newEndDate.toISOString().split('T')[0],
            monthly_limit: monthlyTokens,
            tokens_used: cycle.tokens_used || 0, // 이전 사이클 사용량
            base_price: monthlyPrice,
            total_price: monthlyPrice,
            payment_status: monthlyPrice === 0 ? 'completed' : 'pending',
            leftover_tokens: cycle.tokens_remaining || 0,
            leftover_action: 'expired' // 남은 토큰은 소멸
          });

        if (billingError) {
          console.warn('청구 내역 생성 실패:', billingError);
        }

        results.renewed.push({
          user_id: cycle.user_id,
          old_cycle_id: cycle.id,
          new_cycle_id: newCycle.id,
          membership_level: level,
          tokens: monthlyTokens,
          price: monthlyPrice
        });

        console.log(`✅ 갱신 완료: ${profile.email || cycle.user_id} (${level})`);

      } catch (error) {
        console.error(`❌ 갱신 실패 (${cycle.user_id}):`, error);
        results.failed.push({
          user_id: cycle.user_id,
          reason: error.message
        });
      }
    }

    // 3. 결과 요약
    console.log('📊 갱신 작업 완료:', {
      총_대상: results.total,
      성공: results.renewed.length,
      실패: results.failed.length
    });

    return results;

  } catch (error) {
    console.error('❌ 구독 갱신 작업 오류:', error);
    throw error;
  }
}

/**
 * 토큰 한도 초과 사용자 알림
 */
async function notifyTokenExceeded() {
  try {
    // 토큰 90% 이상 사용한 사용자 조회
    const { data: cycles } = await supabase
      .from('subscription_cycle')
      .select('*')
      .eq('status', 'active');

    const warningUsers = [];
    
    for (const cycle of cycles || []) {
      const usageRate = (cycle.tokens_used || 0) / cycle.monthly_token_limit;
      
      if (usageRate >= 0.9 && !cycle.is_exceeded) {
        warningUsers.push({
          user_id: cycle.user_id,
          usage_rate: Math.round(usageRate * 100),
          tokens_used: cycle.tokens_used,
          tokens_limit: cycle.monthly_token_limit
        });
        
        // 알림 플래그 업데이트 (중복 알림 방지)
        await supabase
          .from('subscription_cycle')
          .update({ 
            warning_sent: true,
            warning_sent_at: new Date().toISOString()
          })
          .eq('id', cycle.id);
      }
    }

    if (warningUsers.length > 0) {
      console.log(`⚠️ 토큰 한도 경고 대상: ${warningUsers.length}명`);
      // TODO: 실제 알림 발송 (이메일, 카카오톡 등)
    }

    return warningUsers;

  } catch (error) {
    console.error('토큰 한도 알림 오류:', error);
    return [];
  }
}

/**
 * 일일 통계 기록
 */
async function recordDailyStats() {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // 오늘의 토큰 사용량 집계
    const { data: todayUsage } = await supabase
      .from('token_usage')
      .select('tokens_used')
      .gte('used_at', `${today}T00:00:00`)
      .lt('used_at', `${today}T23:59:59`);

    const totalTokensToday = todayUsage?.reduce((sum, u) => sum + u.tokens_used, 0) || 0;

    // 활성 사용자 수
    const { data: activeUsers } = await supabase
      .from('subscription_cycle')
      .select('user_id')
      .eq('status', 'active');

    // 통계 저장 (나중에 대시보드용)
    console.log(`📊 일일 통계:`, {
      날짜: today,
      총_토큰_사용량: totalTokensToday,
      활성_사용자: activeUsers?.length || 0,
      평균_토큰_사용: activeUsers?.length ? Math.round(totalTokensToday / activeUsers.length) : 0
    });

  } catch (error) {
    console.error('통계 기록 오류:', error);
  }
}

// API 엔드포인트로 노출 (수동 실행용)
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
    // 관리자 권한 체크 (선택사항)
    // TODO: 관리자 인증 구현

    const action = req.query.action || 'renew';

    let result;
    
    switch (action) {
      case 'renew':
        result = await renewExpiredSubscriptions();
        break;
      case 'notify':
        result = await notifyTokenExceeded();
        break;
      case 'stats':
        result = await recordDailyStats();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 액션입니다'
        });
    }

    return res.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('크론 작업 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// 독립 실행용 내보내기
module.exports.renewExpiredSubscriptions = renewExpiredSubscriptions;
module.exports.notifyTokenExceeded = notifyTokenExceeded;
module.exports.recordDailyStats = recordDailyStats;
