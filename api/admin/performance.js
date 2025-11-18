// ============================================
// 성능 모니터링 API
// ============================================
// 경로: /api/admin/performance
// 설명: 관리자용 성능 통계 조회 API
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
    const { type, hours = 24 } = req.query;

    // type에 따라 다른 데이터 반환
    switch (type) {
      case 'overview':
        return await getOverview(res, parseInt(hours));
      
      case 'api-stats':
        return await getApiStats(res, parseInt(hours));
      
      case 'page-stats':
        return await getPageStats(res, parseInt(hours));
      
      case 'crawl-stats':
        return await getCrawlStats(res, parseInt(hours));
      
      case 'slow-apis':
        return await getSlowApis(res, parseInt(hours));
      
      case 'error-rate':
        return await getErrorRate(res, parseInt(hours));
      
      default:
        return res.status(400).json({ error: '잘못된 type 파라미터입니다.' });
    }

  } catch (error) {
    console.error('성능 통계 조회 오류:', error);
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
 * 전체 개요 통계
 */
async function getOverview(res, hours) {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hours);

  // API 통계
  const { data: apiData, error: apiError } = await supabase
    .from('api_performance')
    .select('response_time_ms, status_code')
    .gte('created_at', startTime.toISOString());

  // 페이지 통계
  const { data: pageData, error: pageError } = await supabase
    .from('page_performance')
    .select('load_complete_ms')
    .gte('created_at', startTime.toISOString());

  // 크롤링 통계
  const { data: crawlData, error: crawlError } = await supabase
    .from('crawling_performance')
    .select('success, bot_detected')
    .gte('created_at', startTime.toISOString());

  if (apiError || pageError || crawlError) {
    return res.status(500).json({ error: '통계 조회 실패' });
  }

  // 통계 계산
  const totalApiRequests = apiData?.length || 0;
  const apiErrors = apiData?.filter(d => d.status_code >= 400).length || 0;
  const avgApiResponseTime = totalApiRequests > 0
    ? Math.round(apiData.reduce((sum, d) => sum + d.response_time_ms, 0) / totalApiRequests)
    : 0;

  const totalPageLoads = pageData?.length || 0;
  const avgPageLoadTime = totalPageLoads > 0
    ? Math.round(pageData.reduce((sum, d) => sum + d.load_complete_ms, 0) / totalPageLoads)
    : 0;

  const totalCrawls = crawlData?.length || 0;
  const successfulCrawls = crawlData?.filter(d => d.success).length || 0;
  const botDetections = crawlData?.filter(d => d.bot_detected).length || 0;

  return res.json({
    timeRange: `${hours}시간`,
    api: {
      totalRequests: totalApiRequests,
      errorRate: totalApiRequests > 0 ? ((apiErrors / totalApiRequests) * 100).toFixed(2) + '%' : '0%',
      avgResponseTime: avgApiResponseTime + 'ms'
    },
    page: {
      totalLoads: totalPageLoads,
      avgLoadTime: avgPageLoadTime + 'ms'
    },
    crawling: {
      totalAttempts: totalCrawls,
      successRate: totalCrawls > 0 ? ((successfulCrawls / totalCrawls) * 100).toFixed(2) + '%' : '0%',
      botDetectionRate: totalCrawls > 0 ? ((botDetections / totalCrawls) * 100).toFixed(2) + '%' : '0%'
    }
  });
}

/**
 * API 상세 통계
 */
async function getApiStats(res, hours) {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hours);

  const { data, error } = await supabase
    .from('api_performance')
    .select('endpoint, response_time_ms, status_code, created_at')
    .gte('created_at', startTime.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(500).json({ error: 'API 통계 조회 실패' });
  }

  // 엔드포인트별 그룹화
  const endpointStats = {};
  
  data.forEach(item => {
    if (!endpointStats[item.endpoint]) {
      endpointStats[item.endpoint] = {
        endpoint: item.endpoint,
        requests: [],
        errors: 0
      };
    }
    
    endpointStats[item.endpoint].requests.push(item.response_time_ms);
    if (item.status_code >= 400) {
      endpointStats[item.endpoint].errors++;
    }
  });

  // 통계 계산
  const stats = Object.values(endpointStats).map(stat => {
    const requests = stat.requests.sort((a, b) => a - b);
    const total = requests.length;
    
    return {
      endpoint: stat.endpoint,
      totalRequests: total,
      avgResponseTime: Math.round(requests.reduce((a, b) => a + b, 0) / total),
      minResponseTime: requests[0],
      maxResponseTime: requests[total - 1],
      p95ResponseTime: requests[Math.floor(total * 0.95)],
      errorRate: ((stat.errors / total) * 100).toFixed(2) + '%'
    };
  });

  // 요청 수로 정렬
  stats.sort((a, b) => b.totalRequests - a.totalRequests);

  return res.json(stats);
}

/**
 * 페이지 로딩 통계
 */
async function getPageStats(res, hours) {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hours);

  const { data, error } = await supabase
    .from('page_performance')
    .select('page_url, load_complete_ms, device_type, browser')
    .gte('created_at', startTime.toISOString());

  if (error) {
    return res.status(500).json({ error: '페이지 통계 조회 실패' });
  }

  // URL별 그룹화
  const pageStats = {};
  
  data.forEach(item => {
    const url = new URL(item.page_url).pathname;
    
    if (!pageStats[url]) {
      pageStats[url] = {
        url: url,
        loadTimes: []
      };
    }
    
    pageStats[url].loadTimes.push(item.load_complete_ms);
  });

  // 통계 계산
  const stats = Object.values(pageStats).map(stat => {
    const times = stat.loadTimes.sort((a, b) => a - b);
    const total = times.length;
    
    return {
      url: stat.url,
      totalLoads: total,
      avgLoadTime: Math.round(times.reduce((a, b) => a + b, 0) / total),
      minLoadTime: times[0],
      maxLoadTime: times[total - 1],
      p95LoadTime: times[Math.floor(total * 0.95)]
    };
  });

  // 로드 수로 정렬
  stats.sort((a, b) => b.totalLoads - a.totalLoads);

  return res.json(stats);
}

/**
 * 크롤링 통계
 */
async function getCrawlStats(res, hours) {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hours);

  const { data, error } = await supabase
    .from('crawling_performance')
    .select('crawl_type, success, duration_ms, bot_detected, error_type')
    .gte('created_at', startTime.toISOString());

  if (error) {
    return res.status(500).json({ error: '크롤링 통계 조회 실패' });
  }

  // 타입별 그룹화
  const crawlStats = {};
  
  data.forEach(item => {
    if (!crawlStats[item.crawl_type]) {
      crawlStats[item.crawl_type] = {
        type: item.crawl_type,
        durations: [],
        successes: 0,
        failures: 0,
        botDetections: 0,
        errors: {}
      };
    }
    
    const stat = crawlStats[item.crawl_type];
    stat.durations.push(item.duration_ms);
    
    if (item.success) {
      stat.successes++;
    } else {
      stat.failures++;
      if (item.error_type) {
        stat.errors[item.error_type] = (stat.errors[item.error_type] || 0) + 1;
      }
    }
    
    if (item.bot_detected) {
      stat.botDetections++;
    }
  });

  // 통계 계산
  const stats = Object.values(crawlStats).map(stat => {
    const durations = stat.durations.sort((a, b) => a - b);
    const total = durations.length;
    
    return {
      type: stat.type,
      totalAttempts: total,
      successRate: ((stat.successes / total) * 100).toFixed(2) + '%',
      avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / total),
      botDetectionRate: ((stat.botDetections / total) * 100).toFixed(2) + '%',
      topErrors: Object.entries(stat.errors)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }))
    };
  });

  return res.json(stats);
}

/**
 * 느린 API Top 10
 */
async function getSlowApis(res, hours) {
  const { data, error } = await supabase
    .rpc('get_slow_apis', { minutes: hours * 60 });

  if (error) {
    return res.status(500).json({ error: '느린 API 조회 실패' });
  }

  return res.json(data || []);
}

/**
 * 시간대별 에러율
 */
async function getErrorRate(res, hours) {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hours);

  const { data, error } = await supabase
    .from('api_performance')
    .select('status_code, created_at')
    .gte('created_at', startTime.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    return res.status(500).json({ error: '에러율 조회 실패' });
  }

  // 1시간 단위로 그룹화
  const hourlyStats = {};
  
  data.forEach(item => {
    const hour = new Date(item.created_at).toISOString().slice(0, 13) + ':00';
    
    if (!hourlyStats[hour]) {
      hourlyStats[hour] = {
        hour,
        total: 0,
        errors: 0
      };
    }
    
    hourlyStats[hour].total++;
    if (item.status_code >= 400) {
      hourlyStats[hour].errors++;
    }
  });

  // 에러율 계산
  const stats = Object.values(hourlyStats).map(stat => ({
    hour: stat.hour,
    totalRequests: stat.total,
    errorRate: ((stat.errors / stat.total) * 100).toFixed(2)
  }));

  return res.json(stats);
}

