// ============================================
// 백엔드 에러 로깅 미들웨어
// ============================================
// 설명: API 에러를 자동으로 Supabase에 기록
// ============================================

const { createClient } = require('@supabase/supabase-js');

// Supabase 클라이언트 초기화
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

/**
 * 에러 타입 및 심각도 판단
 */
function classifyError(error, req) {
  let errorType = 'api';
  let severity = 'medium';
  
  const message = error.message ? error.message.toLowerCase() : '';
  
  // 타입 분류
  if (message.includes('database') || message.includes('postgres') || message.includes('supabase')) {
    errorType = 'database';
  } else if (message.includes('auth') || message.includes('unauthorized') || message.includes('forbidden')) {
    errorType = 'auth';
  } else if (message.includes('crawl') || message.includes('scrape') || message.includes('puppeteer')) {
    errorType = 'crawling';
  } else if (req.path.includes('/api/')) {
    errorType = 'api';
  }
  
  // 심각도 분류
  if (error.code === 'ECONNREFUSED' || message.includes('critical') || message.includes('fatal')) {
    severity = 'critical';
  } else if (error.statusCode >= 500 || message.includes('error')) {
    severity = 'high';
  } else if (error.statusCode >= 400 || message.includes('warning')) {
    severity = 'medium';
  } else {
    severity = 'low';
  }
  
  return { errorType, severity };
}

/**
 * 스택 트레이스 파싱
 */
function parseStack(stack) {
  if (!stack) return { filePath: null, lineNumber: null, functionName: null };
  
  try {
    const lines = stack.split('\n');
    
    // 첫 번째 유효한 스택 라인 찾기
    for (let line of lines) {
      // 예: "at functionName (file.js:123:45)"
      const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)/);
      if (match) {
        return {
          functionName: match[1] ? match[1].trim() : null,
          filePath: match[2],
          lineNumber: parseInt(match[3]),
          columnNumber: parseInt(match[4])
        };
      }
    }
  } catch (err) {
    // 파싱 실패 시 무시
  }
  
  return { filePath: null, lineNumber: null, functionName: null };
}

/**
 * 에러 정보를 Supabase에 저장
 */
async function logErrorToDatabase(errorData) {
  try {
    const { error } = await supabase
      .from('error_logs')
      .insert(errorData);
    
    if (error) {
      console.error('❌ 에러 로그 저장 실패:', error);
    } else if (process.env.NODE_ENV === 'development') {
      console.log('🔴 에러 로그 저장 완료:', {
        type: errorData.error_type,
        severity: errorData.severity,
        message: errorData.error_message.substring(0, 100)
      });
    }
  } catch (error) {
    console.error('❌ 에러 로그 저장 중 예외 발생:', error);
  }
}

/**
 * Express 에러 핸들러 미들웨어
 */
function errorHandler(err, req, res, next) {
  // 에러 타입 및 심각도 분류
  const { errorType, severity } = classifyError(err, req);
  
  // 스택 트레이스 파싱
  const stackInfo = parseStack(err.stack);
  
  // 에러 데이터 구성
  const errorData = {
    error_type: errorType,
    severity: severity,
    error_message: err.message || 'Unknown error',
    error_stack: err.stack || null,
    error_code: err.code || err.name || null,
    source: 'backend',
    file_path: stackInfo.filePath,
    line_number: stackInfo.lineNumber,
    column_number: stackInfo.columnNumber,
    function_name: stackInfo.functionName,
    user_id: req.user?.id || null,
    ip_address: req.ip || req.connection.remoteAddress || null,
    user_agent: req.headers['user-agent'] || null,
    request_method: req.method,
    request_url: req.originalUrl || req.url,
    request_body: req.method === 'POST' || req.method === 'PUT' 
      ? JSON.stringify(req.body).substring(0, 1000) // 최대 1000자
      : null,
    additional_data: {
      statusCode: err.statusCode || 500,
      headers: req.headers,
      query: req.query,
      params: req.params
    }
  };
  
  // 비동기로 에러 로깅 (응답 속도에 영향 없도록)
  logErrorToDatabase(errorData).catch(logErr => {
    console.error('에러 로깅 실패:', logErr);
  });
  
  // 에러 응답 (운영 환경에서는 상세 정보 숨김)
  const statusCode = err.statusCode || 500;
  const response = {
    error: err.message || 'Internal Server Error'
  };
  
  // 개발 환경에서만 스택 트레이스 노출
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = err.details;
  }
  
  res.status(statusCode).json(response);
}

/**
 * 404 에러 핸들러
 */
function notFoundHandler(req, res, next) {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

/**
 * 비동기 함수 래퍼 (에러 자동 캡처)
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next))
      .catch(next);
  };
}

/**
 * 수동 에러 로깅 함수
 */
async function logError(error, context = {}) {
  try {
    const { errorType, severity } = classifyError(error, {});
    const stackInfo = parseStack(error.stack);
    
    const errorData = {
      error_type: errorType,
      severity: severity,
      error_message: error.message || String(error),
      error_stack: error.stack || null,
      error_code: error.code || error.name || null,
      source: 'backend',
      file_path: stackInfo.filePath,
      line_number: stackInfo.lineNumber,
      function_name: stackInfo.functionName,
      additional_data: context
    };
    
    await logErrorToDatabase(errorData);
  } catch (err) {
    console.error('수동 에러 로깅 실패:', err);
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  logError
};

