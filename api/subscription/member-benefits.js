/**
 * 기존 회원 혜택 관리 API
 * 기존 회원에게 특별 혜택을 제공합니다
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // GET: 기존 회원 현황 조회
    if (req.method === 'GET') {
      const action = req.query.action || 'status';

      if (action === 'status') {
        // 기존 회원 통계
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: existingMembers, error } = await supabase
          .from('profiles')
          .select('id, email, name, created_at, membership_level, user_type')
          .lt('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: true });

        if (error) throw error;

        // 등급별 분포
        const levelDistribution = existingMembers.reduce((acc, member) => {
          acc[member.membership_level || 'seed'] = (acc[member.membership_level || 'seed'] || 0) + 1;
          return acc;
        }, {});

        // 가입 기간별 분포
        const now = new Date();
        const periodDistribution = {
          '3개월 이상': 0,
          '1-3개월': 0,
          '1개월 미만': 0
        };

        existingMembers.forEach(member => {
          const createdAt = new Date(member.created_at);
          const daysDiff = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
          
          if (daysDiff >= 90) {
            periodDistribution['3개월 이상']++;
          } else if (daysDiff >= 30) {
            periodDistribution['1-3개월']++;
          } else {
            periodDistribution['1개월 미만']++;
          }
        });

        return res.json({
          success: true,
          total: existingMembers.length,
          levelDistribution,
          periodDistribution,
          members: existingMembers.slice(0, 10) // 최대 10명만 표시
        });
      }
    }

    // POST: 혜택 적용
    if (req.method === 'POST') {
      const { benefitType, targetGroup } = req.body;

      if (!benefitType) {
        return res.status(400).json({
          success: false,
          error: '혜택 유형을 선택해주세요'
        });
      }

      let result = { applied: 0, failed: 0, details: [] };

      switch (benefitType) {
        case 'bonus_tokens':
          // 보너스 토큰 지급
          result = await applyBonusTokens(targetGroup);
          break;

        case 'free_upgrade':
          // 무료 업그레이드
          result = await applyFreeUpgrade(targetGroup);
          break;

        case 'discount':
          // 할인 혜택
          result = await applyDiscount(targetGroup);
          break;

        case 'custom':
          // 맞춤 혜택
          const { memberIds, customBenefit } = req.body;
          result = await applyCustomBenefit(memberIds, customBenefit);
          break;

        default:
          return res.status(400).json({
            success: false,
            error: '유효하지 않은 혜택 유형입니다'
          });
      }

      return res.json({
        success: true,
        result,
        message: `${result.applied}명에게 혜택이 적용되었습니다`
      });
    }

    return res.status(405).json({
      success: false,
      error: '허용되지 않은 메소드입니다'
    });

  } catch (error) {
    console.error('❌ 회원 혜택 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '회원 혜택 처리 중 오류가 발생했습니다'
    });
  }
};

/**
 * 보너스 토큰 지급
 */
async function applyBonusTokens(targetGroup = '1month') {
  try {
    const now = new Date();
    let dateFilter;
    let bonusTokens;
    let validDays;

    switch (targetGroup) {
      case '3months':
        dateFilter = new Date(now.setMonth(now.getMonth() - 3));
        bonusTokens = 500;
        validDays = 90;
        break;
      case '1month':
        dateFilter = new Date(now.setMonth(now.getMonth() - 1));
        bonusTokens = 300;
        validDays = 60;
        break;
      default:
        dateFilter = new Date(now.setDate(now.getDate() - 7));
        bonusTokens = 100;
        validDays = 30;
    }

    // 대상 회원 조회
    const { data: members, error: fetchError } = await supabase
      .from('profiles')
      .select('id, membership_level')
      .lt('created_at', dateFilter.toISOString())
      .eq('membership_level', 'seed'); // seed 등급만

    if (fetchError) throw fetchError;

    let applied = 0;
    let failed = 0;

    // 각 회원에게 보너스 토큰 적용
    for (const member of members || []) {
      try {
        // 기존 맞춤 설정이 있는지 확인
        const { data: existing } = await supabase
          .from('member_custom_token_limit')
          .select('id')
          .eq('member_id', member.id)
          .single();

        if (!existing) {
          // 새로 추가
          const { error: insertError } = await supabase
            .from('member_custom_token_limit')
            .insert({
              member_id: member.id,
              custom_limit: 100 + bonusTokens, // 기본 100 + 보너스
              reason: `기존 회원 보너스 토큰 ${bonusTokens}개`,
              applied_from: new Date().toISOString().split('T')[0],
              applied_until: new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            });

          if (insertError) throw insertError;
          applied++;
        }
      } catch (err) {
        console.error(`회원 ${member.id} 처리 실패:`, err);
        failed++;
      }
    }

    return { applied, failed, total: members?.length || 0 };

  } catch (error) {
    console.error('보너스 토큰 지급 오류:', error);
    throw error;
  }
}

/**
 * 무료 업그레이드
 */
async function applyFreeUpgrade(targetGroup = '1month') {
  try {
    const now = new Date();
    const dateFilter = targetGroup === '3months' 
      ? new Date(now.setMonth(now.getMonth() - 3))
      : new Date(now.setMonth(now.getMonth() - 1));

    // seed 등급 회원을 power로 업그레이드
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        membership_level: 'power',
        updated_at: new Date().toISOString()
      })
      .lt('created_at', dateFilter.toISOString())
      .eq('membership_level', 'seed')
      .select();

    if (error) throw error;

    return { applied: data?.length || 0, failed: 0 };

  } catch (error) {
    console.error('무료 업그레이드 오류:', error);
    throw error;
  }
}

/**
 * 할인 혜택 적용
 */
async function applyDiscount(targetGroup = 'all') {
  try {
    const discountRate = 0.5; // 50% 할인
    const validDays = 30;

    // 대상 회원 조회
    const query = supabase
      .from('profiles')
      .select('id, membership_level');

    if (targetGroup !== 'all') {
      const dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 30);
      query.lt('created_at', dateFilter.toISOString());
    }

    const { data: members, error: fetchError } = await query
      .eq('membership_level', 'seed');

    if (fetchError) throw fetchError;

    let applied = 0;
    let failed = 0;

    for (const member of members || []) {
      try {
        // 기존 할인이 있는지 확인
        const { data: existing } = await supabase
          .from('member_custom_pricing')
          .select('id')
          .eq('member_id', member.id)
          .single();

        if (!existing) {
          // 할인 가격 적용
          const { error: insertError } = await supabase
            .from('member_custom_pricing')
            .insert({
              member_id: member.id,
              custom_price: 15000, // 파워 30000원의 50%
              discount_reason: '기존 회원 특별 할인 50%',
              applied_from: new Date().toISOString().split('T')[0],
              applied_until: new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
            });

          if (insertError) throw insertError;
          applied++;
        }
      } catch (err) {
        console.error(`회원 ${member.id} 할인 처리 실패:`, err);
        failed++;
      }
    }

    return { applied, failed, total: members?.length || 0 };

  } catch (error) {
    console.error('할인 적용 오류:', error);
    throw error;
  }
}

/**
 * 맞춤 혜택 적용
 */
async function applyCustomBenefit(memberIds, benefit) {
  // 특정 회원들에게 맞춤 혜택 적용
  // 구현 예정
  return { applied: 0, failed: 0 };
}
