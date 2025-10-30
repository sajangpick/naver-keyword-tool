// ============================================
// 사용자 분석 API
// ============================================
// 경로: /api/admin/analytics
// 설명: 관리자용 분석 통계 조회 API
// ============================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    // 관리자 권한 확인
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({ error: '인증에 실패했습니다.' });
    }

    // 프로필에서 관리자 권한 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_type, membership_level')
      .eq('id', user.id)
      .single();

    // user_type이 'admin' 또는 membership_level이 'admin'인 경우 관리자
    if (!profile || (profile.user_type !== 'admin' && profile.membership_level !== 'admin')) {
      return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    }

    // 쿼리 파라미터
    const { type, days = 7 } = req.query;

    // type에 따라 다른 데이터 반환
    switch (type) {
      case 'overview':
        return await getOverview(res, parseInt(days));
      
      case 'dau-mau':
        return await getDauMau(res, parseInt(days));
      
      case 'feature-usage':
        return await getFeatureUsage(res, parseInt(days));
      
      case 'funnel':
        return await getFunnelConversion(res);
      
      case 'hourly-activity':
        return await getHourlyActivity(res, parseInt(days));
      
      case 'popular-pages':
        return await getPopularPages(res, parseInt(days));
      
      case 'user-retention':
        return await getUserRetention(res);
      
      default:
        return res.status(400).json({ error: '잘못된 type 파라미터입니다.' });
    }

  } catch (error) {
    console.error('분석 통계 조회 오류:', error);
    return res.status(500).json({ 
      error: '서버 오류가 발생했습니다.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ============================================
// 통계 조회 함수들
// ============================================

/**
 * 전체 개요
 */
async function getOverview(res, days) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 총 이벤트 수
    const { count: totalEvents } = await supabase
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString());

    // 활성 사용자 수
    const { data: activeUsersData } = await supabase
      .from('user_events')
      .select('user_id')
      .gte('created_at', startDate.toISOString())
      .not('user_id', 'is', null);

    const activeUsers = new Set(activeUsersData?.map(e => e.user_id)).size;

    // 총 세션 수
    const { data: sessionsData } = await supabase
      .from('user_events')
      .select('session_id')
      .gte('created_at', startDate.toISOString());

    const totalSessions = new Set(sessionsData?.map(e => e.session_id)).size;

    // 블로그 생성 수
    const { count: blogsCreated } = await supabase
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'blog_created')
      .gte('created_at', startDate.toISOString());

    // 리뷰 답글 수
    const { count: reviewsReplied } = await supabase
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'review_replied')
      .gte('created_at', startDate.toISOString());

    // 크롤링 사용 수
    const { count: crawlingUsed } = await supabase
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'crawling_used')
      .gte('created_at', startDate.toISOString());

    // 신규 가입자 수
    const { count: newSignups } = await supabase
      .from('user_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'signup')
      .gte('created_at', startDate.toISOString());

    // 평균 세션 시간 계산
    const { data: sessionEndEvents } = await supabase
      .from('user_events')
      .select('event_data')
      .eq('event_name', 'session_end')
      .gte('created_at', startDate.toISOString());

    let avgSessionDuration = 0;
    if (sessionEndEvents && sessionEndEvents.length > 0) {
      const totalDuration = sessionEndEvents.reduce((sum, event) => {
        return sum + (event.event_data?.session_duration || 0);
      }, 0);
      avgSessionDuration = Math.floor(totalDuration / sessionEndEvents.length);
    }

    return res.json({
      timeRange: `${days}일`,
      totalEvents: totalEvents || 0,
      activeUsers: activeUsers || 0,
      totalSessions: totalSessions || 0,
      blogsCreated: blogsCreated || 0,
      reviewsReplied: reviewsReplied || 0,
      crawlingUsed: crawlingUsed || 0,
      newSignups: newSignups || 0,
      avgSessionDuration: avgSessionDuration
    });

  } catch (error) {
    console.error('개요 조회 실패:', error);
    return res.status(500).json({ error: '개요 조회 실패' });
  }
}

/**
 * DAU/MAU 통계
 */
async function getDauMau(res, days) {
  try {
    const stats = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - i);
      targetDate.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const { data } = await supabase
        .from('user_events')
        .select('user_id')
        .gte('created_at', targetDate.toISOString())
        .lt('created_at', nextDate.toISOString())
        .not('user_id', 'is', null);

      const dau = new Set(data?.map(e => e.user_id)).size;

      stats.push({
        date: targetDate.toISOString().split('T')[0],
        dau: dau
      });
    }

    // MAU 계산 (최근 30일)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: mauData } = await supabase
      .from('user_events')
      .select('user_id')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .not('user_id', 'is', null);

    const mau = new Set(mauData?.map(e => e.user_id)).size;

    return res.json({
      dailyStats: stats,
      mau: mau
    });

  } catch (error) {
    console.error('DAU/MAU 조회 실패:', error);
    return res.status(500).json({ error: 'DAU/MAU 조회 실패' });
  }
}

/**
 * 기능별 사용 통계
 */
async function getFeatureUsage(res, days) {
  try {
    const { data, error } = await supabase
      .rpc('get_feature_usage', { days: days });

    if (error) throw error;

    return res.json(data || []);

  } catch (error) {
    console.error('기능 사용 통계 조회 실패:', error);
    return res.status(500).json({ error: '기능 사용 통계 조회 실패' });
  }
}

/**
 * 퍼널 전환율
 */
async function getFunnelConversion(res) {
  try {
    const { data, error } = await supabase
      .rpc('get_funnel_conversion');

    if (error) throw error;

    return res.json(data || []);

  } catch (error) {
    console.error('퍼널 전환율 조회 실패:', error);
    return res.status(500).json({ error: '퍼널 전환율 조회 실패' });
  }
}

/**
 * 시간대별 활동
 */
async function getHourlyActivity(res, days) {
  try {
    const { data, error } = await supabase
      .rpc('get_hourly_activity', { days: days });

    if (error) throw error;

    // 0-23시 전체 데이터 준비
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      user_count: 0,
      event_count: 0
    }));

    // 실제 데이터로 채우기
    data?.forEach(item => {
      hourlyData[item.hour] = item;
    });

    return res.json(hourlyData);

  } catch (error) {
    console.error('시간대별 활동 조회 실패:', error);
    return res.status(500).json({ error: '시간대별 활동 조회 실패' });
  }
}

/**
 * 인기 페이지
 */
async function getPopularPages(res, days) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('user_events')
      .select('page_url, user_id')
      .eq('event_name', 'page_view')
      .gte('created_at', startDate.toISOString());

    if (error) throw error;

    // URL별 그룹화
    const pageStats = {};
    
    data?.forEach(event => {
      try {
        const url = new URL(event.page_url);
        const path = url.pathname;
        
        if (!pageStats[path]) {
          pageStats[path] = {
            path: path,
            views: 0,
            uniqueUsers: new Set()
          };
        }
        
        pageStats[path].views++;
        if (event.user_id) {
          pageStats[path].uniqueUsers.add(event.user_id);
        }
      } catch (err) {
        // URL 파싱 실패 시 무시
      }
    });

    // 통계 변환
    const stats = Object.values(pageStats).map(stat => ({
      path: stat.path,
      views: stat.views,
      uniqueUsers: stat.uniqueUsers.size
    }));

    // 조회수로 정렬
    stats.sort((a, b) => b.views - a.views);

    return res.json(stats.slice(0, 10)); // Top 10

  } catch (error) {
    console.error('인기 페이지 조회 실패:', error);
    return res.status(500).json({ error: '인기 페이지 조회 실패' });
  }
}

/**
 * 사용자 재방문율
 */
async function getUserRetention(res) {
  try {
    // 최근 30일간 가입한 사용자
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: signupEvents } = await supabase
      .from('user_events')
      .select('user_id, created_at')
      .eq('event_name', 'signup')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (!signupEvents || signupEvents.length === 0) {
      return res.json({ retentionRate: 0, returnedUsers: 0, totalUsers: 0 });
    }

    // 각 사용자의 재방문 확인
    let returnedUsers = 0;

    for (const signup of signupEvents) {
      const signupDate = new Date(signup.created_at);
      signupDate.setDate(signupDate.getDate() + 1); // 다음 날부터

      const { count } = await supabase
        .from('user_events')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', signup.user_id)
        .gte('created_at', signupDate.toISOString());

      if (count && count > 0) {
        returnedUsers++;
      }
    }

    const retentionRate = ((returnedUsers / signupEvents.length) * 100).toFixed(2);

    return res.json({
      retentionRate: parseFloat(retentionRate),
      returnedUsers: returnedUsers,
      totalUsers: signupEvents.length
    });

  } catch (error) {
    console.error('재방문율 조회 실패:', error);
    return res.status(500).json({ error: '재방문율 조회 실패' });
  }
}

