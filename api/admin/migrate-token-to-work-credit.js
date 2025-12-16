/**
 * 기존 token_usage 데이터를 work_credit_usage로 마이그레이션하는 API
 * 관리자 전용
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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { dryRun = false } = req.body || req.query;

    console.log('🔄 token_usage → work_credit_usage 마이그레이션 시작...');

    // 1. 기존 token_usage 데이터 조회
    const { data: tokenUsageRecords, error: tokenError } = await supabase
      .from('token_usage')
      .select('*')
      .not('user_id', 'is', null)
      .not('used_at', 'is', null)
      .order('used_at', { ascending: true });

    if (tokenError) {
      throw tokenError;
    }

    if (!tokenUsageRecords || tokenUsageRecords.length === 0) {
      return res.json({
        success: true,
        message: '변환할 token_usage 데이터가 없습니다',
        stats: {
          totalRecords: 0,
          converted: 0,
          skipped: 0
        }
      });
    }

    console.log(`📊 변환 대상: ${tokenUsageRecords.length}건`);

    const results = {
      totalRecords: tokenUsageRecords.length,
      converted: 0,
      skipped: 0,
      errors: []
    };

    // 2. 각 레코드를 work_credit_usage로 변환
    for (const record of tokenUsageRecords) {
      try {
        // api_type을 기반으로 서비스 타입 결정
        let serviceType = 'review_reply';
        let workCreditsUsed = 1;
        let aiModel = 'chatgpt';

        const apiType = (record.api_type || '').toLowerCase();

        if (apiType.includes('blog') || apiType.includes('chatgpt-blog')) {
          serviceType = 'blog_writing';
          workCreditsUsed = 5;
        } else if (apiType.includes('video') || apiType.includes('shorts')) {
          serviceType = 'video_generation';
          workCreditsUsed = 20;
        } else {
          serviceType = 'review_reply';
          workCreditsUsed = 1;
        }

        // ai_model 결정
        if (apiType.includes('gemini')) {
          aiModel = 'gemini';
        } else if (apiType.includes('claude')) {
          aiModel = 'claude';
        } else {
          aiModel = 'chatgpt';
        }

        // 중복 체크
        const { data: existing } = await supabase
          .from('work_credit_usage')
          .select('id')
          .eq('user_id', record.user_id)
          .eq('service_type', serviceType)
          .eq('used_at', record.used_at)
          .limit(1);

        if (existing && existing.length > 0) {
          results.skipped++;
          continue;
        }

        if (!dryRun) {
          // work_credit_usage에 삽입
          const { error: insertError } = await supabase
            .from('work_credit_usage')
            .insert({
              user_id: record.user_id,
              store_id: record.store_id || null,
              service_type: serviceType,
              work_credits_used: workCreditsUsed,
              input_tokens: record.input_tokens || null,
              output_tokens: record.output_tokens || null,
              ai_model: aiModel,
              usage_date: record.used_at ? record.used_at.split('T')[0] : null,
              used_at: record.used_at,
              created_at: record.used_at || new Date().toISOString()
            });

          if (insertError) {
            throw insertError;
          }
        }

        results.converted++;

      } catch (error) {
        console.error(`❌ 레코드 변환 실패 (${record.id}):`, error);
        results.errors.push({
          recordId: record.id,
          error: error.message
        });
      }
    }

    console.log(`✅ 마이그레이션 완료: ${results.converted}건 변환, ${results.skipped}건 건너뜀`);

    return res.json({
      success: true,
      message: dryRun ? '드라이런 모드: 실제 변환은 수행되지 않았습니다' : '마이그레이션 완료',
      stats: results
    });

  } catch (error) {
    console.error('❌ 마이그레이션 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '마이그레이션 중 오류가 발생했습니다'
    });
  }
};

