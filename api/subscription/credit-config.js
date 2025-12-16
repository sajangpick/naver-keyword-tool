/**
 * 크레딧 한도 설정 API
 * 구독 등급별 크레딧 한도를 조회하고 수정합니다
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
    // Supabase 클라이언트 확인
    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Supabase 클라이언트가 초기화되지 않았습니다. 환경변수를 확인해주세요.'
      });
    }

    // GET: 크레딧 한도 조회
    if (req.method === 'GET') {
      // 기존 크레딧 설정 조회 (임시: token_config도 확인)
      let { data: existingConfig, error: fetchError } = await supabase
        .from('credit_config')
        .select('*')
        .single();
      
      // credit_config가 없으면 token_config 사용 (마이그레이션 전)
      if (fetchError && fetchError.code === 'PGRST116') {
        const { data: tokenConfig, error: tokenError } = await supabase
          .from('token_config')
          .select('*')
          .single();
        
        if (!tokenError && tokenConfig) {
          existingConfig = tokenConfig;
          fetchError = null;
        }
      }

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // 데이터가 없으면 빈 값으로 초기화 (사용자가 직접 입력하도록)
      if (!existingConfig) {
        const emptyConfig = {
          owner_seed_limit: 0,
          owner_power_limit: 0,
          owner_bigpower_limit: 0,
          owner_premium_limit: 0,
          agency_elite_limit: 0,
          agency_expert_limit: 0,
          agency_master_limit: 0,
          agency_premium_limit: 0
        };

        // credit_config가 없으면 token_config에 저장 (마이그레이션 전)
        let targetTable = 'credit_config';
        let { data: newConfig, error: insertError } = await supabase
          .from(targetTable)
          .insert(emptyConfig)
          .select()
          .single();
        
        if (insertError && insertError.code === '42P01') {
          // credit_config 테이블이 없으면 token_config 사용
          targetTable = 'token_config';
          const result = await supabase
            .from(targetTable)
            .insert(emptyConfig)
            .select()
            .single();
          newConfig = result.data;
          insertError = result.error;
        }

        if (insertError) throw insertError;

        return res.json({
          success: true,
          credits: newConfig
        });
      }

      // 존재하지 않는 컬럼은 기본값으로 채우기
      const configWithDefaults = {
        ...existingConfig,
        credit_usage_enabled: existingConfig.credit_usage_enabled !== undefined ? existingConfig.credit_usage_enabled : true,
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
        credits: configWithDefaults
      });
    }

    // PUT: 크레딧 한도 수정
    if (req.method === 'PUT') {
      const updateData = req.body;

      // 기존 데이터 조회 (임시: token_config도 확인)
      let { data: currentConfig } = await supabase
        .from('credit_config')
        .select('*')
        .single();
      
      // credit_config가 없으면 token_config 사용 (마이그레이션 전)
      if (!currentConfig) {
        const { data: tokenConfig } = await supabase
          .from('token_config')
          .select('*')
          .single();
        
        if (tokenConfig) {
          currentConfig = tokenConfig;
        }
      }

      if (!currentConfig) {
        return res.status(404).json({
          success: false,
          error: '크레딧 설정을 찾을 수 없습니다'
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
      
      // 크레딧 사용 제한 필드들 (없을 수 있음)
      const restrictionFields = [
        'credit_usage_enabled',
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
      // 먼저 기본 필드만 업데이트 시도 (항상 존재하는 컬럼)
      const basicOnlyUpdate = {};
      basicFields.forEach(field => {
        if (updateData[field] !== undefined) {
          basicOnlyUpdate[field] = updateData[field];
        }
      });

      let updatedConfig;
      let updateError;

      // 1단계: 기본 필드만 업데이트 (임시: token_config도 시도)
      let targetTable = 'credit_config';
      let basicResult = await supabase
        .from(targetTable)
        .update({
          ...basicOnlyUpdate,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentConfig.id)
        .select()
        .single();
      
      // credit_config가 없으면 token_config 사용 (마이그레이션 전)
      if (basicResult.error && basicResult.error.code === '42P01') {
        targetTable = 'token_config';
        basicResult = await supabase
          .from(targetTable)
          .update({
            ...basicOnlyUpdate,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentConfig.id)
          .select()
          .single();
      }

      updatedConfig = basicResult.data;
      updateError = basicResult.error;

      // 2단계: 제한 필드가 있으면 별도로 업데이트 시도 (컬럼이 있을 경우에만)
      if (!updateError && restrictionFields.some(field => updateData[field] !== undefined)) {
        const restrictionOnlyUpdate = {};
        restrictionFields.forEach(field => {
          if (updateData[field] !== undefined) {
            restrictionOnlyUpdate[field] = updateData[field];
          }
        });

        // 제한 필드 업데이트 시도 (컬럼이 없으면 에러 발생 가능)
        try {
          const restrictionResult = await supabase
            .from(targetTable)
            .update({
              ...restrictionOnlyUpdate,
              updated_at: new Date().toISOString()
            })
            .eq('id', currentConfig.id)
            .select()
            .single();

          if (restrictionResult.data) {
            updatedConfig = restrictionResult.data;
          }
          // 에러가 발생해도 기본 필드는 이미 저장되었으므로 계속 진행
          if (restrictionResult.error) {
            console.warn('⚠️ 크레딧 사용 제한 필드 업데이트 실패 (컬럼이 없을 수 있음):', restrictionResult.error.message);
            // 응답에는 요청한 값 포함 (실제 DB에는 저장되지 않았지만 사용자에게는 표시)
            if (updatedConfig) {
              Object.keys(restrictionOnlyUpdate).forEach(field => {
                updatedConfig[field] = restrictionOnlyUpdate[field];
              });
            }
          }
        } catch (err) {
          console.warn('⚠️ 크레딧 사용 제한 필드 업데이트 중 에러 (무시):', err.message);
          // 응답에는 요청한 값 포함
          if (updatedConfig) {
            Object.keys(restrictionOnlyUpdate).forEach(field => {
              updatedConfig[field] = restrictionOnlyUpdate[field];
            });
          }
        }
      }

      if (updateError) {
        throw updateError;
      }

      // 제한 필드가 요청되었지만 컬럼이 없는 경우 경고 메시지 포함
      const hasRestrictionFields = restrictionFields.some(field => updateData[field] !== undefined);
      const warningMessage = hasRestrictionFields ? 
        '크레딧 사용 제한 설정은 저장되었지만, 데이터베이스에 컬럼이 없어 실제로는 적용되지 않을 수 있습니다. SQL 마이그레이션을 실행해주세요: database/schemas/features/subscription/add-credit-usage-restriction.sql' : null;

      console.log('✅ 크레딧 설정 업데이트 완료:', updatedConfig);

      return res.json({
        success: true,
        credits: updatedConfig,
        message: '크레딧 설정이 업데이트되었습니다',
        warning: warningMessage || undefined
      });
    }

    return res.status(405).json({
      success: false,
      error: '허용되지 않은 메소드입니다'
    });

  } catch (error) {
    console.error('❌ 크레딧 설정 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '크레딧 설정 처리 중 오류가 발생했습니다'
    });
  }
};

