/**
 * 토큰 사용량 관리 API
 * 토큰 사용을 기록하고 한도를 체크합니다
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * 토큰 한도 체크 및 차감
 */
async function checkAndUpdateTokenLimit(userId, tokensToUse) {
  try {
    // 사용자의 현재 구독 사이클 조회
    const { data: cycle, error: cycleError } = await supabase
      .from('subscription_cycle')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cycleError || !cycle) {
      // 구독 사이클이 없으면 새로 생성 (기본: 씨앗 등급)
      const { data: profile } = await supabase
        .from('profiles')
        .select('membership_level, user_type')
        .eq('id', userId)
        .single();

      const membershipLevel = profile?.membership_level || 'seed';
      const userType = profile?.user_type || 'owner';

      // 토큰 한도 조회
      const { data: tokenConfig } = await supabase
        .from('token_config')
        .select('*')
        .single();

      const tokenLimitKey = `${userType}_${membershipLevel}_limit`;
      const monthlyLimit = tokenConfig?.[tokenLimitKey] || 100;

      // 새 사이클 생성
      const today = new Date();
      const cycleEnd = new Date(today);
      cycleEnd.setDate(cycleEnd.getDate() + 30);

      const { data: newCycle, error: createError } = await supabase
        .from('subscription_cycle')
        .insert({
          user_id: userId,
          user_type: userType,
          cycle_start_date: today.toISOString().split('T')[0],
          cycle_end_date: cycleEnd.toISOString().split('T')[0],
          days_in_cycle: 30,
          monthly_token_limit: monthlyLimit,
          tokens_used: 0,
          tokens_remaining: monthlyLimit,
          status: 'active',
          billing_amount: 0, // 씨앗 등급은 무료
          payment_status: 'completed'
        })
        .select()
        .single();

      if (createError) throw createError;
      
      return checkAndUpdateTokenLimit(userId, tokensToUse); // 재귀 호출
    }

    // 토큰 한도 체크
    const newTokensUsed = (cycle.tokens_used || 0) + tokensToUse;
    const tokensRemaining = cycle.monthly_token_limit - newTokensUsed;

    if (tokensRemaining < 0) {
      // 한도 초과
      await supabase
        .from('subscription_cycle')
        .update({
          status: 'exceeded',
          is_exceeded: true,
          exceeded_at: new Date().toISOString(),
          tokens_used: newTokensUsed,
          tokens_remaining: 0
        })
        .eq('id', cycle.id);

      return {
        success: false,
        error: '토큰 한도를 초과했습니다',
        tokensUsed: cycle.tokens_used,
        monthlyLimit: cycle.monthly_token_limit,
        tokensRemaining: 0
      };
    }

    // 토큰 사용량 업데이트
    const { error: updateError } = await supabase
      .from('subscription_cycle')
      .update({
        tokens_used: newTokensUsed,
        tokens_remaining: tokensRemaining,
        updated_at: new Date().toISOString()
      })
      .eq('id', cycle.id);

    if (updateError) throw updateError;

    return {
      success: true,
      tokensUsed: newTokensUsed,
      monthlyLimit: cycle.monthly_token_limit,
      tokensRemaining: tokensRemaining
    };

  } catch (error) {
    console.error('토큰 한도 체크 오류:', error);
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
    // POST: 토큰 사용 기록
    if (req.method === 'POST') {
      const { 
        user_id,
        store_id,
        input_tokens = 0,
        output_tokens = 0,
        api_type = 'chatgpt',
        total_tokens
      } = req.body;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: '사용자 ID가 필요합니다'
        });
      }

      const tokensUsed = total_tokens || (input_tokens + output_tokens);

      // 토큰 한도 체크 및 차감
      const limitCheck = await checkAndUpdateTokenLimit(user_id, tokensUsed);
      
      if (!limitCheck.success) {
        return res.status(403).json(limitCheck);
      }

      // 토큰 사용 기록 저장
      const { data: usageRecord, error: insertError } = await supabase
        .from('token_usage')
        .insert({
          user_id,
          store_id,
          tokens_used: tokensUsed,
          api_type,
          input_tokens,
          output_tokens,
          used_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log(`✅ 토큰 사용 기록: ${user_id} - ${tokensUsed} 토큰`);

      return res.json({
        success: true,
        usage: usageRecord,
        remaining: limitCheck.tokensRemaining,
        limit: limitCheck.monthlyLimit,
        message: `${tokensUsed} 토큰이 사용되었습니다. 남은 토큰: ${limitCheck.tokensRemaining}`
      });
    }

    // GET: 토큰 사용 내역 조회
    if (req.method === 'GET') {
      const { user_id, limit = 10 } = req.query;

      if (!user_id) {
        return res.status(400).json({
          success: false,
          error: '사용자 ID가 필요합니다'
        });
      }

      // 사용자 프로필 조회 (등급 확인) - 먼저 조회
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('membership_level, user_type')
        .eq('id', user_id)
        .single();

      // token_config에서 최신 토큰 한도 가져오기 (관리자 설정 반영) - 항상 최신 값 사용
      let currentTokenLimit = 0;
      const userType = profile?.user_type || 'owner';
      const membershipLevel = profile?.membership_level || 'seed';
      const tokenLimitKey = `${userType}_${membershipLevel}_limit`;
      
      console.log(`🔍 토큰 한도 조회 시작: user_id=${user_id}, userType=${userType}, level=${membershipLevel}, key=${tokenLimitKey}`);
      
      try {
        const { data: latestTokenConfig, error: configError } = await supabase
          .from('token_config')
          .select('*')
          .single();
        
        if (configError) {
          console.error('❌ token_config 조회 실패:', configError);
        } else {
          console.log('✅ token_config 전체 데이터:', JSON.stringify(latestTokenConfig, null, 2));
        }
        
        if (latestTokenConfig) {
          // tokenLimitKey로 직접 조회
          const limitValue = latestTokenConfig[tokenLimitKey];
          console.log(`🔍 ${tokenLimitKey} 값:`, limitValue, '(타입:', typeof limitValue, ')');
          
          if (limitValue !== undefined && limitValue !== null) {
            currentTokenLimit = Number(limitValue);
            console.log(`✅ 최신 토큰 한도 설정 완료: ${currentTokenLimit} (${tokenLimitKey})`);
          } else {
            console.warn(`⚠️ ${tokenLimitKey} 값이 undefined/null입니다. 기본값 사용: 100`);
            currentTokenLimit = 100;
          }
        } else {
          console.warn('⚠️ token_config 데이터가 없습니다. 기본값 사용: 100');
          currentTokenLimit = 100;
        }
      } catch (error) {
        // 컬럼이 없거나 에러 발생 시 기본값 사용
        console.error('❌ token_config에서 최신 한도 조회 실패:', error.message);
        console.error('❌ 에러 상세:', error);
        currentTokenLimit = 100;
      }
      
      // 최종 확인: currentTokenLimit이 0이면 안 됨
      if (currentTokenLimit === 0) {
        console.warn('⚠️ currentTokenLimit이 0입니다. 기본값 100으로 설정');
        currentTokenLimit = 100;
      }
      
      console.log(`✅ 최종 토큰 한도: ${currentTokenLimit}`);

      // 현재 구독 사이클 조회
      const { data: cycle } = await supabase
        .from('subscription_cycle')
        .select('*')
        .eq('user_id', user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // 토큰 사용 내역 조회
      const { data: usage, error: fetchError } = await supabase
        .from('token_usage')
        .select('*')
        .eq('user_id', user_id)
        .order('used_at', { ascending: false })
        .limit(parseInt(limit));

      if (fetchError) throw fetchError;

      // 토큰 사용량 계산
      const tokensUsed = cycle?.tokens_used || 0;
      let tokensRemaining = 0;
      
      if (cycle) {
        // 사이클이 있으면 사이클의 남은 토큰 사용
        tokensRemaining = cycle.tokens_remaining || 0;
      } else {
        // 사이클이 없으면 최신 한도가 남은 토큰
        tokensRemaining = currentTokenLimit;
      }

      return res.json({
        success: true,
        usage: usage || [],
        cycle: cycle || null,
        summary: {
          monthlyLimit: currentTokenLimit, // 최신 토큰 한도 사용 (관리자 설정 반영)
          tokensUsed: tokensUsed,
          tokensRemaining: tokensRemaining,
          isExceeded: cycle?.is_exceeded || false
        }
      });
    }

    return res.status(405).json({
      success: false,
      error: '허용되지 않은 메소드입니다'
    });

  } catch (error) {
    console.error('❌ 토큰 사용량 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '토큰 사용량 처리 중 오류가 발생했습니다'
    });
  }
};
