// ============================================
// 프론트엔드 성능 측정 유틸리티
// ============================================
// 설명: 페이지 로딩 시간, 사용자 환경 정보 자동 수집
// 사용법: <script src="/assets/performance-tracker.js"></script>
// ============================================

(function() {
  'use strict';
  
  // Supabase 클라이언트 (여러 방식으로 초기화될 수 있음)
  const supabase = window.supabaseClient || window.supabase || 
                   (window.authState && window.authState.supabase) || null;
  
  if (!supabase || typeof supabase.from !== 'function') {
    // 경고를 조용히 무시 (모든 페이지에서 Supabase가 필요한 것은 아님)
    // console.warn('⚠️ Supabase 클라이언트가 초기화되지 않았습니다.');
    return;
  }
  
  /**
   * 페이지 성능 데이터 수집
   */
  function collectPerformanceData() {
    try {
      // Performance API 지원 확인
      if (!window.performance || !window.performance.timing) {
        return null;
      }
      
      const timing = window.performance.timing;
      const navigation = window.performance.navigation;
      
      // 페이지 로딩 시간 계산
      const domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
      const loadComplete = timing.loadEventEnd - timing.navigationStart;
      const firstPaint = window.performance.getEntriesByType('paint')
        .find(entry => entry.name === 'first-paint')?.startTime || null;
      const firstContentfulPaint = window.performance.getEntriesByType('paint')
        .find(entry => entry.name === 'first-contentful-paint')?.startTime || null;
      
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
      
      // 화면 해상도
      const screenResolution = `${window.screen.width}x${window.screen.height}`;
      
      // 네트워크 정보 (지원하는 브라우저만)
      let connectionType = null;
      let networkDownlink = null;
      
      if (navigator.connection || navigator.mozConnection || navigator.webkitConnection) {
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        connectionType = conn.effectiveType || conn.type || null;
        networkDownlink = conn.downlink || null;
      }
      
      // 세션 ID (localStorage에 저장)
      let sessionId = localStorage.getItem('session_id');
      if (!sessionId) {
        sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('session_id', sessionId);
      }
      
      // 사용자 ID (로그인한 경우)
      const userId = window.currentUser?.id || null;
      
      return {
        page_url: window.location.href,
        page_title: document.title,
        dom_content_loaded_ms: Math.round(domContentLoaded),
        load_complete_ms: Math.round(loadComplete),
        first_paint_ms: firstPaint ? Math.round(firstPaint) : null,
        first_contentful_paint_ms: firstContentfulPaint ? Math.round(firstContentfulPaint) : null,
        user_id: userId,
        session_id: sessionId,
        browser: browser,
        browser_version: browserVersion,
        os: os,
        device_type: deviceType,
        screen_resolution: screenResolution,
        connection_type: connectionType,
        network_downlink: networkDownlink
      };
    } catch (error) {
      console.error('성능 데이터 수집 실패:', error);
      return null;
    }
  }
  
  /**
   * 성능 데이터를 Supabase에 저장
   */
  async function sendPerformanceData(data) {
    try {
      const { error } = await supabase
        .from('page_performance')
        .insert(data);
      
      if (error) {
        console.error('성능 데이터 저장 실패:', error);
      } else if (process.env.NODE_ENV === 'development') {
        // 개발 환경에서만 로그 출력
        console.log('✅ 성능 데이터 저장 완료:', {
          page: data.page_title,
          loadTime: data.load_complete_ms + 'ms',
          device: data.device_type
        });
      }
    } catch (error) {
      console.error('성능 데이터 전송 실패:', error);
    }
  }
  
  /**
   * 페이지 로드 완료 시 성능 데이터 수집 및 전송
   */
  window.addEventListener('load', function() {
    // 약간의 지연을 둬서 모든 리소스가 완전히 로드되도록 함
    setTimeout(function() {
      const perfData = collectPerformanceData();
      
      if (perfData) {
        sendPerformanceData(perfData);
      }
    }, 1000); // 1초 대기
  });
  
  /**
   * API 호출 성능 측정 래퍼 함수
   * 사용 예: const response = await trackApiCall('/api/chatgpt-blog', fetch(...))
   */
  window.trackApiCall = async function(endpoint, fetchPromise) {
    const startTime = performance.now();
    
    try {
      const response = await fetchPromise;
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      // 콘솔에 로그 출력
      if (process.env.NODE_ENV === 'development') {
        const emoji = response.ok ? '✅' : '❌';
        console.log(`${emoji} API: ${endpoint} - ${duration}ms`);
      }
      
      return response;
    } catch (error) {
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      
      console.error(`❌ API 에러: ${endpoint} - ${duration}ms`, error);
      throw error;
    }
  };
  
  /**
   * 사용자 상호작용 추적 (클릭, 입력 등)
   */
  window.trackUserAction = function(action, details = {}) {
    try {
      // 간단한 이벤트 로깅
      if (process.env.NODE_ENV === 'development') {
        console.log('👤 사용자 액션:', action, details);
      }
      
      // 추후 analytics 시스템과 연동 가능
      if (window.analytics && typeof window.analytics.track === 'function') {
        window.analytics.track(action, details);
      }
    } catch (error) {
      console.error('사용자 액션 추적 실패:', error);
    }
  };
  
  // 전역 변수로 노출
  window.PerformanceTracker = {
    collectPerformanceData,
    sendPerformanceData,
    trackApiCall: window.trackApiCall,
    trackUserAction: window.trackUserAction
  };
  
  console.log('✅ 성능 추적 시스템 초기화 완료');
  
})();

