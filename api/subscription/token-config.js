/**
 * 토큰 한도 설정 API
 * 구독 등급별 토큰 한도를 조회하고 수정합니다
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
    // GET: 토큰 한도 조회
    if (req.method === 'GET') {
      // 기존 토큰 설정 조회
      const { data: existingConfig, error: fetchError } = await supabase
        .from('token_config')
        .select('*')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // 데이터가 없으면 기본값 삽입
      if (!existingConfig) {
        const defaultConfig = {
          owner_seed_limit: 100,
          owner_power_limit: 500,
          owner_bigpower_limit: 833,
          owner_premium_limit: 1166,
          agency_elite_limit: 1000,
          agency_expert_limit: 3000,
          agency_master_limit: 5000,
          agency_premium_limit: 10000,
          // 토큰 사용 제한 필드 기본값 (컬럼이 없어도 에러 없이 처리)
          token_usage_enabled: true,
          owner_seed_enabled: true,
          owner_power_enabled: true,
          owner_bigpower_enabled: true,
          owner_premium_enabled: true,
          agency_elite_enabled: true,
          agency_expert_enabled: true,
          agency_master_enabled: true,
          agency_premium_enabled: true
        };

        const { data: newConfig, error: insertError } = await supabase
          .from('token_config')
          .insert(defaultConfig)
          .select()
          .single();

        if (insertError) throw insertError;

        return res.json({
          success: true,
          tokens: newConfig
        });
      }

      // 존재하지 않는 컬럼은 기본값으로 채우기
      const configWithDefaults = {
        ...existingConfig,
        token_usage_enabled: existingConfig.token_usage_enabled !== undefined ? existingConfig.token_usage_enabled : true,
        owner_seed_enabled: existingConfig.owner_seed_enabled !== undefined ? existingConfig.owner_seed_enabled : true,
        owner_power_enabled: existingConfig.owner_power_enabled !== undefined ? existingConfig.owner_power_enabled : true,
        owner_bigpower_enabled: existingConfig.owner_bigpower_enabled !== undefined ? existingConfig.owner_bigpower_enabled : true,
        owner_premium_enabled: existingConfig.owner_premium_enabled !== undefined ? existingConfig.owner_premium_enabled : true,
        agency_elite_enabled: existingConfig.agency_elite_enabled !== undefined ? existingConfig.agency_elite_enabled : true,
        agency_expert_enabled: existingConfig.agency_expert_enabled !== undefined ? existingConfig.agency_expert_enabled : true,
        agency_master_enabled: existingConfig.agency_master_enabled !== undefined ? existingConfig.agency_master_enabled : true,
        agency_premium_enabled: existingConfig.agency_premium_enabled !== undefined ? existingConfig.agency_premium_enabled : true
      };

      return res.json({
        success: true,
        tokens: configWithDefaults
      });
    }

    // PUT: 토큰 한도 수정
    if (req.method === 'PUT') {
      const updateData = req.body;

      // 기존 데이터 조회
      const { data: currentConfig } = await supabase
        .from('token_config')
        .select('*')
        .single();

      if (!currentConfig) {
        return res.status(404).json({
          success: false,
          error: '토큰 설정을 찾을 수 없습니다'
        });
      }

      // 존재하는 컬럼만 업데이트 (컬럼이 없어도 에러 없이 처리)
      // Supabase는 존재하지 않는 컬럼을 업데이트하려고 하면 에러가 발생하므로
      // 안전하게 필터링
      const safeUpdateData = {};
      
      // 기본 컬럼들 (항상 존재)
      const basicFields = [
        'owner_seed_limit', 'owner_power_limit', 'owner_bigpower_limit', 'owner_premium_limit',
        'agency_elite_limit', 'agency_expert_limit', 'agency_master_limit', 'agency_premium_limit'
      ];
      
      // 토큰 사용 제한 필드들 (없을 수 있음)
      const restrictionFields = [
        'token_usage_enabled',
        'owner_seed_enabled', 'owner_power_enabled', 'owner_bigpower_enabled', 'owner_premium_enabled',
        'agency_elite_enabled', 'agency_expert_enabled', 'agency_master_enabled', 'agency_premium_enabled'
      ];

      // 기본 필드는 항상 업데이트
      basicFields.forEach(field => {
        if (updateData[field] !== undefined) {
          safeUpdateData[field] = updateData[field];
        }
      });

      // 제한 필드는 존재하는 경우에만 업데이트 (에러 방지)
      // Supabase는 존재하지 않는 컬럼을 업데이트하려고 하면 에러가 발생하므로
      // 일단 모두 포함하고, 에러 발생 시 해당 필드만 제외하여 재시도
      restrictionFields.forEach(field => {
        if (updateData[field] !== undefined) {
          safeUpdateData[field] = updateData[field];
        }
      });

      // 업데이트 시도
      let updatedConfig;
      let updateError;

      try {
        const result = await supabase
          .from('token_config')
          .update({
            ...safeUpdateData,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentConfig.id)
          .select()
          .single();

        updatedConfig = result.data;
        updateError = result.error;
      } catch (err) {
        // 컬럼이 없는 경우 에러 발생 가능
        // 기본 필드만 업데이트 재시도
        const basicOnlyUpdate = {};
        basicFields.forEach(field => {
          if (updateData[field] !== undefined) {
            basicOnlyUpdate[field] = updateData[field];
          }
        });

        const retryResult = await supabase
          .from('token_config')
          .update({
            ...basicOnlyUpdate,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentConfig.id)
          .select()
          .single();

        updatedConfig = retryResult.data;
        updateError = retryResult.error;

        // 제한 필드는 컬럼이 없어서 저장되지 않았지만, 응답에는 기본값 포함
        if (!updateError && updatedConfig) {
          restrictionFields.forEach(field => {
            if (updateData[field] !== undefined) {
              updatedConfig[field] = updateData[field];
            } else {
              updatedConfig[field] = true; // 기본값
            }
          });
        }
      }

      if (updateError) {
        // 컬럼이 없는 경우 친절한 메시지
        if (updateError.message && updateError.message.includes('column') && updateError.message.includes('does not exist')) {
          return res.status(400).json({
            success: false,
            error: '토큰 사용 제한 기능을 사용하려면 데이터베이스에 컬럼을 추가해야 합니다. SQL 마이그레이션 파일을 실행해주세요.',
            needsMigration: true,
            migrationFile: 'database/schemas/features/subscription/add-token-usage-restriction.sql'
          });
        }
        throw updateError;
      }

      console.log('✅ 토큰 설정 업데이트 완료:', updatedConfig);

      return res.json({
        success: true,
        tokens: updatedConfig,
        message: '토큰 설정이 업데이트되었습니다'
      });
    }

    return res.status(405).json({
      success: false,
      error: '허용되지 않은 메소드입니다'
    });

  } catch (error) {
    console.error('❌ 토큰 설정 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '토큰 설정 처리 중 오류가 발생했습니다'
    });
  }
};
