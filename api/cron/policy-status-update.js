/**
 * 정책 상태 자동 업데이트 크론 작업
 * 매일 자정에 실행되어 마감일이 지난 정책을 'ended' 상태로 업데이트합니다
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

/**
 * 마감일이 지난 정책을 'ended' 상태로 업데이트
 */
async function updateExpiredPolicies() {
  try {
    if (!supabase) {
      console.error('❌ Supabase 클라이언트가 초기화되지 않았습니다.');
      return {
        success: false,
        error: 'Database service unavailable'
      };
    }

    console.log('🔄 정책 상태 업데이트 작업 시작...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // 1. 마감일이 지났지만 아직 'ended' 상태가 아닌 정책 조회
    const { data: expiredPolicies, error: fetchError } = await supabase
      .from('policy_supports')
      .select('id, title, application_end_date, status')
      .not('application_end_date', 'is', null)
      .lt('application_end_date', todayStr)
      .neq('status', 'ended');

    if (fetchError) {
      console.error('❌ 정책 조회 실패:', fetchError);
      throw fetchError;
    }

    console.log(`📊 마감일이 지난 정책 수: ${expiredPolicies?.length || 0}`);

    if (!expiredPolicies || expiredPolicies.length === 0) {
      console.log('✅ 업데이트할 정책이 없습니다.');
      return {
        success: true,
        updated: 0,
        total: 0
      };
    }

    // 2. 상태를 'ended'로 업데이트
    const policyIds = expiredPolicies.map(p => p.id);
    const { data: updatedData, error: updateError } = await supabase
      .from('policy_supports')
      .update({ 
        status: 'ended',
        updated_at: new Date().toISOString()
      })
      .in('id', policyIds)
      .select('id, title');

    if (updateError) {
      console.error('❌ 정책 상태 업데이트 실패:', updateError);
      throw updateError;
    }

    console.log(`✅ ${updatedData?.length || 0}개 정책이 'ended' 상태로 업데이트되었습니다.`);
    
    if (updatedData && updatedData.length > 0) {
      console.log('📋 업데이트된 정책 목록:');
      updatedData.forEach(policy => {
        console.log(`  - ${policy.title} (ID: ${policy.id})`);
      });
    }

    return {
      success: true,
      updated: updatedData?.length || 0,
      total: expiredPolicies.length,
      policies: updatedData
    };

  } catch (error) {
    console.error('❌ 정책 상태 업데이트 작업 실패:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 모듈로 export (크론 작업에서 사용)
module.exports = updateExpiredPolicies;

// 직접 실행 시 (테스트용)
if (require.main === module) {
  updateExpiredPolicies()
    .then(result => {
      console.log('📊 작업 결과:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ 작업 실행 실패:', error);
      process.exit(1);
    });
}

