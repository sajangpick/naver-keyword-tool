// ============================================
// API 성능 측정 미들웨어
// ============================================
// 설명: 모든 API 요청의 응답 시간과 상태를 자동으로 기록
// ============================================

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * 성능 로깅 미들웨어
 * 모든 API 요청의 응답 시간을 측정하고 Supabase에 저장
 */
function performanceLogger(req, res, next) {
  const startTime = Date.now();
  
  // 원본 res.json 함수 저장
  const originalJson = res.json;
  const originalSend = res.send;
  const originalEnd = res.end;
  
  // 응답 완료 시 성능 로그 저장
  async function logPerformance(statusCode, responseData) {
    try {
      const endTime = Date.now();
      const responseTimeMs = endTime - startTime;
      
      // 성능 데이터 준비
      const perfData = {
        endpoint: req.path,
        method: req.method,
        response_time_ms: responseTimeMs,
        status_code: statusCode,
        user_id: req.user?.id || null,
        ip_address: req.ip || req.connection.remoteAddress || null,
        user_agent: req.headers['user-agent'] || null,
        request_size_bytes: req.headers['content-length'] ? parseInt(req.headers['content-length']) : null,
        response_size_bytes: responseData ? JSON.stringify(responseData).length : null
      };
      
      // 에러 응답인 경우 에러 메시지 추가
      if (statusCode >= 400 && responseData) {
        perfData.error_message = typeof responseData === 'string' 
          ? responseData 
          : responseData.error || responseData.message || null;
      }
      
      // Supabase에 비동기로 저장 (응답 속도에 영향 없도록)
      supabase
        .from('api_performance')
        .insert(perfData)
        .then(({ error }) => {
          if (error && process.env.NODE_ENV === 'development') {
            console.error('성능 로그 저장 실패:', error);
          }
        });
      
      // 콘솔에 로그 출력 (개발 환경)
      if (process.env.NODE_ENV === 'development') {
        const emoji = statusCode >= 400 ? '❌' : statusCode >= 300 ? '⚠️' : '✅';
        const time = responseTimeMs > 1000 ? `${emoji} ${responseTimeMs}ms 느림!` : `${emoji} ${responseTimeMs}ms`;
        console.log(`[API] ${req.method} ${req.path} ${statusCode} ${time}`);
      }
      
    } catch (error) {
      // 로깅 실패해도 응답에는 영향 없도록
      if (process.env.NODE_ENV === 'development') {
        console.error('성능 로깅 에러:', error);
      }
    }
  }
  
  // res.json 오버라이드
  res.json = function(data) {
    logPerformance(res.statusCode, data);
    return originalJson.call(this, data);
  };
  
  // res.send 오버라이드
  res.send = function(data) {
    logPerformance(res.statusCode, data);
    return originalSend.call(this, data);
  };
  
  // res.end 오버라이드
  res.end = function(data) {
    logPerformance(res.statusCode, data);
    return originalEnd.call(this, data);
  };
  
  next();
}

/**
 * 성능 통계 조회 함수
 */
async function getPerformanceStats(timeRangeMinutes = 60) {
  try {
    const { data, error } = await supabase
      .rpc('get_api_stats_last_hour');
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('성능 통계 조회 실패:', error);
    return null;
  }
}

/**
 * 느린 API 조회 함수
 */
async function getSlowApis(minutes = 60) {
  try {
    const { data, error } = await supabase
      .rpc('get_slow_apis', { minutes });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('느린 API 조회 실패:', error);
    return null;
  }
}

/**
 * 특정 엔드포인트 성능 통계
 */
async function getEndpointStats(endpoint, hours = 24) {
  try {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);
    
    const { data, error } = await supabase
      .from('api_performance')
      .select('response_time_ms, status_code, created_at')
      .eq('endpoint', endpoint)
      .gte('created_at', startTime.toISOString())
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // 통계 계산
    if (!data || data.length === 0) {
      return {
        endpoint,
        total_requests: 0,
        avg_response_ms: 0,
        min_response_ms: 0,
        max_response_ms: 0,
        p95_response_ms: 0,
        error_rate: 0
      };
    }
    
    const responseTimes = data.map(d => d.response_time_ms).sort((a, b) => a - b);
    const errorCount = data.filter(d => d.status_code >= 400).length;
    
    const stats = {
      endpoint,
      total_requests: data.length,
      avg_response_ms: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      min_response_ms: responseTimes[0],
      max_response_ms: responseTimes[responseTimes.length - 1],
      p95_response_ms: responseTimes[Math.floor(responseTimes.length * 0.95)],
      error_rate: ((errorCount / data.length) * 100).toFixed(2) + '%'
    };
    
    return stats;
  } catch (error) {
    console.error('엔드포인트 통계 조회 실패:', error);
    return null;
  }
}

module.exports = {
  performanceLogger,
  getPerformanceStats,
  getSlowApis,
  getEndpointStats
};

