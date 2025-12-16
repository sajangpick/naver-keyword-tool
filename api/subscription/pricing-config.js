/**
 * 가격 설정 API
 * 구독 등급별 가격을 조회하고 수정합니다
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

    // GET: 가격 설정 조회
    if (req.method === 'GET') {
      // 기존 가격 설정 조회
      const { data: existingConfig, error: fetchError } = await supabase
        .from('pricing_config')
        .select('*')
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // 데이터가 없으면 빈 값으로 초기화 (사용자가 직접 입력하도록)
      if (!existingConfig) {
        const emptyConfig = {
          owner_seed_price: 0,
          owner_power_price: 0,
          owner_bigpower_price: 0,
          owner_premium_price: 0,
          agency_elite_price: 0,
          agency_expert_price: 0,
          agency_master_price: 0,
          agency_premium_price: 0
        };

        const { data: newConfig, error: insertError } = await supabase
          .from('pricing_config')
          .insert(emptyConfig)
          .select()
          .single();

        if (insertError) throw insertError;

        return res.json({
          success: true,
          pricing: newConfig
        });
      }

      return res.json({
        success: true,
        pricing: existingConfig
      });
    }

    // PUT: 가격 설정 수정
    if (req.method === 'PUT') {
      const updateData = req.body;

      // 기존 데이터 조회
      const { data: currentConfig } = await supabase
        .from('pricing_config')
        .select('*')
        .single();

      if (!currentConfig) {
        return res.status(404).json({
          success: false,
          error: '가격 설정을 찾을 수 없습니다'
        });
      }

      // 업데이트
      const { data: updatedConfig, error: updateError } = await supabase
        .from('pricing_config')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentConfig.id)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log('✅ 가격 설정 업데이트 완료:', updatedConfig);

      return res.json({
        success: true,
        pricing: updatedConfig,
        message: '가격 설정이 업데이트되었습니다'
      });
    }

    return res.status(405).json({
      success: false,
      error: '허용되지 않은 메소드입니다'
    });

  } catch (error) {
    console.error('❌ 가격 설정 API 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '가격 설정 처리 중 오류가 발생했습니다'
    });
  }
};
