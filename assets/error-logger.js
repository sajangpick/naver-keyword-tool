// ============================================
// 프론트엔드 에러 로깅 시스템
// ============================================
// 설명: JavaScript 에러, Promise 거부, 네트워크 에러 자동 캡처
// 사용법: <script src="/assets/error-logger.js"></script>
// ============================================

(function() {
  'use strict';
  
  // Supabase 클라이언트 가져오기 함수
  function getSupabaseClient() {
    // authState에서 supabase 클라이언트 가져오기
    if (window.authState?.supabase) {
      return window.authState.supabase;
    }
    // fallback: window.supabase 직접 사용
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      // 이미 생성된 클라이언트가 있는지 확인
      if (window.SUPABASE_CLIENT) {
        return window.SUPABASE_CLIENT;
      }
    }
    return null;
  }
  
  // 에러 로깅 큐 (배치 전송을 위해)
  let errorQueue = [];
  let isProcessing = false;
  let errorLoggingDisabled = false;
  
  /**
   * 에러 정보 수집
   */
  function collectErrorInfo(error, source, additionalData = {}) {
    try {
      // 브라우저 정보
      const ua = navigator.userAgent;
      let browser = 'Unknown';
      let browserVersion = '';
      
      if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edg') === -1) {
        browser = 'Chrome';
        browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || '';
      } else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
        browser = 'Safari';
        browserVersion = ua.match(/Version\/(\d+)/)?.[1] || '';
      } else if (ua.indexOf('Firefox') > -1) {
        browser = 'Firefox';
        browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || '';
      } else if (ua.indexOf('Edg') > -1) {
        browser = 'Edge';
        browserVersion = ua.match(/Edg\/(\d+)/)?.[1] || '';
      }
      
      // OS 정보
      let os = 'Unknown';
      if (ua.indexOf('Win') > -1) os = 'Windows';
      else if (ua.indexOf('Mac') > -1) os = 'MacOS';
      else if (ua.indexOf('Linux') > -1) os = 'Linux';
      else if (ua.indexOf('Android') > -1) os = 'Android';
      else if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) os = 'iOS';
      
      // 디바이스 타입
      let deviceType = 'Desktop';
      if (/Mobile|Android|iPhone/i.test(ua)) deviceType = 'Mobile';
      else if (/Tablet|iPad/i.test(ua)) deviceType = 'Tablet';
      
      // 에러 타입 및 심각도 판단
      let errorType = 'javascript';
      let severity = 'medium';
      
      if (error.message) {
        const msg = error.message.toLowerCase();
        
        // 타입 분류
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
          errorType = 'api';
        } else if (msg.includes('auth') || msg.includes('login') || msg.includes('permission')) {
          errorType = 'auth';
        } else if (msg.includes('database') || msg.includes('supabase')) {
          errorType = 'database';
        }
        
        // 심각도 분류
        if (msg.includes('critical') || msg.includes('fatal') || msg.includes('security')) {
          severity = 'critical';
        } else if (msg.includes('error') || msg.includes('failed')) {
          severity = 'high';
        } else if (msg.includes('warning')) {
          severity = 'medium';
        } else {
          severity = 'low';
        }
      }
      
      // 세션 ID
      let sessionId = localStorage.getItem('session_id');
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('session_id', sessionId);
      }
      
      // 사용자 ID (로그인한 경우)
      const userId = window.currentUser?.id || null;
      
      // 기본 에러 데이터 구성
      // 주의: 테이블에 없는 컬럼은 제외해야 저장이 성공합니다
      const errorData = {
        error_type: errorType,
        severity: severity,
        error_message: error.message || String(error),
        error_stack: error.stack || null,
        error_code: error.code || error.name || null,
        source: source,
        file_path: error.filename || additionalData.filename || window.location.pathname,
        line_number: error.lineno || additionalData.lineno || null,
        // column_number 컬럼이 테이블에 없으므로 제거
        // column_number: error.colno || additionalData.colno || null,
        function_name: extractFunctionName(error.stack),
        user_id: userId,
        session_id: sessionId,
        user_agent: ua,
        browser: browser,
        // browser_version 컬럼이 테이블에 없으면 주석 처리
        // browser_version: browserVersion,
        os: os,
        device_type: deviceType,
        page_url: window.location.href
      };
      
      // additional_data 컬럼이 있는 경우에만 추가
      // (테이블에 컬럼이 없으면 저장 실패하므로 조건부로 추가)
      // 주석: additional_data 컬럼이 테이블에 있으면 아래 주석을 해제하세요
      // errorData.additional_data = {
      //   ...additionalData,
      //   timestamp: new Date().toISOString(),
      //   referrer: document.referrer,
      //   viewport: `${window.innerWidth}x${window.innerHeight}`
      // };
      
      return errorData;
    } catch (err) {
      console.error('에러 정보 수집 실패:', err);
      return null;
    }
  }
  
  /**
   * 스택 트레이스에서 함수명 추출
   */
  function extractFunctionName(stack) {
    if (!stack) return null;
    
    try {
      const lines = stack.split('\n');
      for (let line of lines) {
        const match = line.match(/at\s+(\w+)/);
        if (match && match[1] !== 'Object' && match[1] !== 'Function') {
          return match[1];
        }
      }
    } catch (err) {
      // 무시
    }
    
    return null;
  }
  
  /**
   * 에러를 Supabase에 전송
   */
  async function sendErrorLog(errorData) {
    try {
      if (errorLoggingDisabled) {
        return;
      }
      const supabase = getSupabaseClient();
      
      // Supabase 클라이언트가 없으면 로그만 출력
      if (!supabase) {
        console.warn('⚠️ Supabase 클라이언트가 없어 에러 로그를 저장할 수 없습니다:', {
          type: errorData.error_type,
          message: errorData.error_message.substring(0, 100)
        });
        return;
      }
      
      // supabase.from이 함수인지 확인
      if (typeof supabase.from !== 'function') {
        console.warn('⚠️ Supabase 클라이언트가 올바르게 초기화되지 않았습니다.');
        return;
      }
      
      const { error } = await supabase
        .from('error_logs')
        .insert(errorData);
      
      if (error) {
        if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
          errorLoggingDisabled = true;
          console.warn('⚠️ error_logs 테이블 RLS 정책으로 인해 클라이언트 에러 로깅을 중단합니다. (관리자 전용 정책)');
        } else {
          console.error('에러 로그 저장 실패:', error);
        }
      } else if (process.env.NODE_ENV === 'development') {
        // 개발 환경에서만 로그 출력
        console.log('🔴 에러 로그 저장 완료:', {
          type: errorData.error_type,
          severity: errorData.severity,
          message: errorData.error_message.substring(0, 100)
        });
      }
    } catch (error) {
      console.error('에러 로그 전송 실패:', error);
    }
  }
  
  /**
   * 에러 큐 처리 (배치 전송)
   */
  async function processErrorQueue() {
    if (isProcessing || errorQueue.length === 0) return;
    
    isProcessing = true;
    
    try {
      const errors = errorQueue.splice(0, 10); // 최대 10개씩 전송
      
      for (const errorData of errors) {
        await sendErrorLog(errorData);
      }
    } catch (error) {
      console.error('에러 큐 처리 실패:', error);
    } finally {
      isProcessing = false;
      
      // 큐에 더 있으면 계속 처리
      if (errorQueue.length > 0) {
        setTimeout(processErrorQueue, 1000);
      }
    }
  }
  
  /**
   * 에러 로깅 (중복 방지 포함)
   */
  function logError(error, source, additionalData = {}) {
    try {
      // 같은 에러가 1초 이내에 여러 번 발생하면 무시 (중복 방지)
      const errorKey = `${error.message}_${error.filename}_${error.lineno}`;
      const lastLogTime = window._lastErrorTimes = window._lastErrorTimes || {};
      const now = Date.now();
      
      if (lastLogTime[errorKey] && now - lastLogTime[errorKey] < 1000) {
        return; // 1초 이내 중복 에러 무시
      }
      
      lastLogTime[errorKey] = now;
      
      // 에러 정보 수집
      const errorData = collectErrorInfo(error, source, additionalData);
      if (!errorData) return;
      
      // 큐에 추가
      errorQueue.push(errorData);
      
      // 큐 처리
      processErrorQueue();
      
    } catch (err) {
      console.error('에러 로깅 실패:', err);
    }
  }
  
  /**
   * 전역 JavaScript 에러 캡처
   */
  window.addEventListener('error', function(event) {
    logError(event.error || { message: event.message }, 'frontend', {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });
  
  /**
   * Promise 거부 에러 캡처
   */
  window.addEventListener('unhandledrejection', function(event) {
    const error = event.reason instanceof Error 
      ? event.reason 
      : { message: String(event.reason) };
    
    logError(error, 'frontend', {
      promiseRejection: true
    });
  });
  
  /**
   * 네트워크 에러 캡처 (fetch 래퍼)
   */
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    try {
      const response = await originalFetch(...args);
      
      // API 에러 (4xx, 5xx) 로깅
      if (!response.ok) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        const errorData = {
          message: `API Error: ${response.status} ${response.statusText}`,
          code: response.status,
          filename: url
        };
        
        logError(errorData, 'frontend', {
          apiError: true,
          statusCode: response.status,
          url: url
        });
      }
      
      return response;
    } catch (error) {
      // 네트워크 에러 로깅
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || 'unknown';
      
      logError(error, 'frontend', {
        networkError: true,
        url: url
      });
      
      throw error;
    }
  };
  
  /**
   * 수동 에러 로깅 함수
   */
  window.logError = function(error, additionalData = {}) {
    if (typeof error === 'string') {
      error = { message: error };
    }
    logError(error, 'frontend', additionalData);
  };
  
  /**
   * 페이지 언로드 시 남은 에러 전송
   */
  window.addEventListener('beforeunload', function() {
    if (errorQueue.length > 0) {
      // Beacon API를 사용하여 페이지 종료 시에도 전송
      const errors = errorQueue.splice(0, errorQueue.length);
      const blob = new Blob([JSON.stringify(errors)], { type: 'application/json' });
      navigator.sendBeacon('/api/log-errors', blob);
    }
  });
  
  // 전역 변수로 노출
  window.ErrorLogger = {
    logError: window.logError,
    getErrorQueue: () => errorQueue.length
  };
  
  console.log('✅ 에러 로깅 시스템 초기화 완료');
  
})();

