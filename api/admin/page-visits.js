/**
 * 관리자 페이지 접속 기록 조회 API
 * 회원들의 페이지 접속 기록을 조회합니다.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.trim() !== '' && SUPABASE_KEY.trim() !== '') {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (error) {
    console.error('[page-visits] Supabase 클라이언트 초기화 실패:', error.message);
  }
}

module.exports = async (req, res) => {
  // CORS 설정
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: '허용되지 않은 메서드입니다.' });
  }

  try {
    // 인증 확인
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: '인증에 실패했습니다.' });
    }

    // 관리자 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type, membership_level')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.user_type !== 'admin' && profile.membership_level !== 'admin')) {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    if (!supabase) {
      return res.status(503).json({ error: 'Supabase가 설정되지 않았습니다' });
    }

    // 쿼리 파라미터
    const {
      userId,
      pagePath,
      deviceType,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = req.query || {};

    // 쿼리 빌드
    let query = supabase
      .from('page_visits')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // 필터 적용
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (pagePath) {
      query = query.eq('page_path', pagePath);
    }
    if (deviceType) {
      query = query.eq('device_type', deviceType);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // 페이지네이션
    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('[page-visits] 조회 실패:', error);
      return res.status(500).json({ error: '접속 기록 조회 중 오류가 발생했습니다.' });
    }

    return res.status(200).json({
      success: true,
      data: data || [],
      pagination: {
        total: count || 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    console.error('[page-visits] 예외 발생:', error);
    return res.status(500).json({
      error: error.message || '접속 기록 조회 중 오류가 발생했습니다',
    });
  }
};

