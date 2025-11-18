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
          agency_premium_limit: 10000
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

      return res.json({
        success: true,
        tokens: existingConfig
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

      // 업데이트
      const { data: updatedConfig, error: updateError } = await supabase
        .from('token_config')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentConfig.id)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log('✅ 토큰 한도 업데이트 완료:', updatedConfig);

      return res.json({
        success: true,
        tokens: updatedConfig,
        message: '토큰 한도가 업데이트되었습니다'
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
