// ============================================
// 관리자 대시보드 API
// ============================================
// 경로: /api/admin/dashboard
// 설명: 대시보드용 통계 조회 API
// ============================================

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
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
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: '허용되지 않은 메서드입니다.' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: '인증에 실패했습니다.' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type, membership_level, role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.user_type !== 'admin' && profile.membership_level !== 'admin' && profile.role !== 'admin')) {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    const { type = 'main-stats' } = req.query;

    switch (type) {
      case 'main-stats':
        return await getMainStats(res);

      default:
        return res.status(400).json({ error: '잘못된 type 파라미터입니다.' });
    }

  } catch (error) {
    console.error('대시보드 API 오류:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
};

async function getMainStats(res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { data: userEventsToday } = await supabase
      .from('user_events')
      .select('user_id')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .not('user_id', 'is', null);

    const dau = new Set(userEventsToday?.map(event => event.user_id)).size;

    const { count: blogsCreated } = await supabase
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'blog_created')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    const { count: reviewsReplied } = await supabase
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'review_replied')
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString());

    return res.json({
      totalUsers: totalUsers || 0,
      dau: dau || 0,
      todayBlogs: blogsCreated || 0,
      todayReviews: reviewsReplied || 0
    });

  } catch (error) {
    console.error('대시보드 메인 통계 조회 실패:', error);
    return res.status(500).json({ error: '메인 통계 조회 실패' });
  }
}

