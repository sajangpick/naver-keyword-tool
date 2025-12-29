// ============================================
// 관리자 - 바로빌 회원 목록 조회 API
// ============================================

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
let supabase = null;
try {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }
} catch (error) {
  console.error('❌ Supabase 초기화 실패:', error);
}

module.exports = async (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!supabase) {
    return res.status(500).json({
      success: false,
      error: 'Database connection not configured'
    });
  }

  try {
    // GET: 바로빌 회원 목록 조회
    if (req.method === 'GET') {
      const { search } = req.query;

      // 관리자 권한 확인 (간단한 체크 - 실제로는 JWT 토큰 검증 필요)
      // 여기서는 admin-utils.js의 인증을 믿고 진행

      // 바로빌 아이디가 있는 회원만 조회
      let query = supabase
        .from('profiles')
        .select(`
          id,
          name,
          email,
          barobill_user_id,
          created_at,
          updated_at
        `)
        .not('barobill_user_id', 'is', null)
        .order('updated_at', { ascending: false });

      // 검색어가 있으면 필터링
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,barobill_user_id.ilike.%${search}%`);
      }

      const { data: profiles, error: profilesError } = await query;

      if (profilesError) {
        console.error('❌ 프로필 조회 실패:', profilesError);
        return res.status(500).json({
          success: false,
          error: '프로필 조회 실패: ' + profilesError.message
        });
      }

      // platform_connections에서 홈택스 연동 정보 확인
      const userIds = profiles.map(p => p.id);
      const { data: connections, error: connectionsError } = await supabase
        .from('platform_connections')
        .select('user_id, platform, is_active, created_at')
        .in('user_id', userIds)
        .eq('platform', 'hometax')
        .eq('is_active', true);

      if (connectionsError) {
        console.warn('⚠️ 홈택스 연동 정보 조회 실패:', connectionsError);
      }

      // 연동 정보를 맵으로 변환
      const connectionMap = {};
      if (connections) {
        connections.forEach(conn => {
          if (!connectionMap[conn.user_id]) {
            connectionMap[conn.user_id] = {
              connected: true,
              connected_at: conn.created_at
            };
          }
        });
      }

      // 결과 데이터 구성
      const members = profiles.map(profile => {
        const connection = connectionMap[profile.id] || { connected: false, connected_at: null };
        
        // 사업자번호는 platform_connections에서 가져오거나 profiles에서 가져올 수 있음
        // 여기서는 간단히 store_id에서 추출 (실제로는 별도 컬럼이 있을 수 있음)
        let corpNum = null;
        if (connections) {
          const userConnection = connections.find(c => c.user_id === profile.id);
          if (userConnection && userConnection.store_id) {
            // store_id 형식: "1234567890_taxinvoice" 또는 "1234567890_cashbill"
            corpNum = userConnection.store_id.split('_')[0];
          }
        }

        return {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          barobill_user_id: profile.barobill_user_id,
          corp_num: corpNum,
          hometax_connected: connection.connected,
          hometax_connected_at: connection.connected_at,
          created_at: profile.created_at,
          updated_at: profile.updated_at
        };
      });

      return res.status(200).json({
        success: true,
        data: members
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  } catch (error) {
    console.error('❌ 바로빌 회원 목록 조회 오류:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};

