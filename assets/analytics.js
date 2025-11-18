// ============================================
// 사용자 분석 시스템 - 이벤트 추적
// ============================================
// 설명: 사용자 행동을 자동으로 추적하고 Supabase에 저장
// 사용법: <script src="/assets/analytics.js"></script>
// ============================================

(function() {
  'use strict';
  
  // Supabase 클라이언트 (mypage.html에서 초기화됨)
  const supabase = window.supabaseClient || window.supabase;
  
  if (!supabase || typeof supabase.from !== 'function') {
    console.warn('⚠️ Supabase 클라이언트가 초기화되지 않았습니다.');
    return;
  }
  
  // 세션 ID 생성/가져오기
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  
  // 세션 시작 시간
  const sessionStartTime = Date.now();
  
  // 페이지뷰 카운트
  let pageViewCount = 0;
  
  /**
   * 브라우저/디바이스 정보 수집
   */
  function getDeviceInfo() {
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
    
    let os = 'Unknown';
    if (ua.indexOf('Win') > -1) os = 'Windows';
    else if (ua.indexOf('Mac') > -1) os = 'MacOS';
    else if (ua.indexOf('Linux') > -1) os = 'Linux';
    else if (ua.indexOf('Android') > -1) os = 'Android';
    else if (ua.indexOf('iOS') > -1 || ua.indexOf('iPhone') > -1 || ua.indexOf('iPad') > -1) os = 'iOS';
    
    let deviceType = 'Desktop';
    if (/Mobile|Android|iPhone/i.test(ua)) deviceType = 'Mobile';
    else if (/Tablet|iPad/i.test(ua)) deviceType = 'Tablet';
    
    return {
      browser,
      browserVersion,
      os,
      deviceType,
      screenResolution: `${window.screen.width}x${window.screen.height}`
    };
  }
  
  /**
   * 이벤트 데이터를 Supabase에 전송
   */
  async function sendEvent(eventName, eventCategory, eventData = {}) {
    try {
      const deviceInfo = getDeviceInfo();
      const userId = window.currentUser?.id || null;
      
      const eventRecord = {
        event_name: eventName,
        event_category: eventCategory,
        user_id: userId,
        session_id: sessionId,
        is_authenticated: !!userId,
        page_url: window.location.href,
        page_title: document.title,
        referrer: document.referrer || null,
        browser: deviceInfo.browser,
        browser_version: deviceInfo.browserVersion,
        os: deviceInfo.os,
        device_type: deviceInfo.deviceType,
        screen_resolution: deviceInfo.screenResolution,
        event_data: eventData
      };
      
      const { error } = await supabase
        .from('user_events')
        .insert(eventRecord);
      
      if (error) {
        console.error('이벤트 전송 실패:', error);
      } else if (process.env.NODE_ENV === 'development') {
        // 개발 환경에서만 로그 출력
        console.log('📊 이벤트 전송:', eventName, eventData);
      }
    } catch (error) {
      console.error('이벤트 전송 오류:', error);
    }
  }
  
  /**
   * 페이지뷰 자동 추적
   */
  function trackPageView() {
    pageViewCount++;
    sendEvent('page_view', 'navigation', {
      page_view_count: pageViewCount,
      session_duration: Math.floor((Date.now() - sessionStartTime) / 1000)
    });
  }
  
  /**
   * 수동 이벤트 추적 함수
   */
  window.trackEvent = function(eventName, eventData = {}) {
    let category = 'user';
    
    // 이벤트 카테고리 자동 분류
    if (eventName.includes('blog')) category = 'blog';
    else if (eventName.includes('review')) category = 'review';
    else if (eventName.includes('crawl')) category = 'crawling';
    else if (eventName.includes('premium') || eventName.includes('signup')) category = 'premium';
    
    sendEvent(eventName, category, eventData);
  };
  
  /**
   * 주요 이벤트 자동 추적
   */
  
  // 페이지 로드 시
  window.addEventListener('load', function() {
    trackPageView();
  });
  
  // 페이지 이탈 시 (세션 종료)
  window.addEventListener('beforeunload', function() {
    const sessionDuration = Math.floor((Date.now() - sessionStartTime) / 1000);
    
    sendEvent('session_end', 'navigation', {
      session_duration: sessionDuration,
      page_views: pageViewCount
    });
  });
  
  // 클릭 이벤트 자동 추적 (data-track 속성)
  document.addEventListener('click', function(e) {
    const target = e.target.closest('[data-track]');
    if (target) {
      const eventName = target.dataset.track;
      const eventData = {};
      
      // data-track-* 속성 수집
      Array.from(target.attributes).forEach(attr => {
        if (attr.name.startsWith('data-track-')) {
          const key = attr.name.replace('data-track-', '');
          eventData[key] = attr.value;
        }
      });
      
      window.trackEvent(eventName, eventData);
    }
  });
  
  // 폼 제출 추적
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.dataset.track) {
      window.trackEvent(form.dataset.track, {
        form_id: form.id || 'unknown'
      });
    }
  });
  
  /**
   * 특정 이벤트 헬퍼 함수들
   */
  
  // 블로그 생성 추적
  window.trackBlogCreated = function(tab, keywordCount, aiUsed = false) {
    window.trackEvent('blog_created', {
      tab: tab,
      keyword_count: keywordCount,
      ai_recommendation_used: aiUsed,
      timestamp: new Date().toISOString()
    });
  };
  
  // 리뷰 답글 생성 추적
  window.trackReviewReplied = function(tone, reviewLength) {
    window.trackEvent('review_replied', {
      tone: tone,
      review_length: reviewLength,
      timestamp: new Date().toISOString()
    });
  };
  
  // 크롤링 사용 추적
  window.trackCrawlingUsed = function(type, success = true) {
    window.trackEvent('crawling_used', {
      type: type,
      success: success,
      timestamp: new Date().toISOString()
    });
  };
  
  // 로그인 추적
  window.trackLogin = function(method = 'kakao') {
    window.trackEvent('login', {
      method: method,
      timestamp: new Date().toISOString()
    });
  };
  
  // 회원가입 추적
  window.trackSignup = function(source = 'organic') {
    window.trackEvent('signup', {
      source: source,
      timestamp: new Date().toISOString()
    });
  };
  
  // 프리미엄 가입 추적
  window.trackPremiumSignup = function(plan, from = 'unknown') {
    window.trackEvent('premium_signup', {
      plan: plan,
      from: from,
      timestamp: new Date().toISOString()
    });
  };
  
  // 기능 사용 추적
  window.trackFeatureUsed = function(featureName, details = {}) {
    window.trackEvent('feature_used', {
      feature: featureName,
      ...details,
      timestamp: new Date().toISOString()
    });
  };
  
  // 에러 발생 추적 (중요한 에러만)
  window.trackUserError = function(errorType, errorMessage) {
    window.trackEvent('user_error', {
      error_type: errorType,
      error_message: errorMessage,
      timestamp: new Date().toISOString()
    });
  };
  
  /**
   * 페이지 체류 시간 측정
   */
  let pageEnterTime = Date.now();
  
  // 페이지 떠날 때 체류 시간 기록
  window.addEventListener('beforeunload', function() {
    const timeSpent = Math.floor((Date.now() - pageEnterTime) / 1000);
    
    if (timeSpent > 5) { // 5초 이상 머문 경우만 기록
      sendEvent('page_time_spent', 'navigation', {
        time_spent: timeSpent,
        page_url: window.location.href
      });
    }
  });
  
  /**
   * 스크롤 깊이 측정
   */
  let maxScrollDepth = 0;
  
  window.addEventListener('scroll', function() {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollDepth = (window.scrollY / scrollHeight) * 100;
    
    if (scrollDepth > maxScrollDepth) {
      maxScrollDepth = Math.floor(scrollDepth);
      
      // 25%, 50%, 75%, 100% 도달 시 이벤트 발생
      if ([25, 50, 75, 100].includes(maxScrollDepth)) {
        sendEvent('scroll_depth', 'engagement', {
          depth: maxScrollDepth + '%',
          page_url: window.location.href
        });
      }
    }
  });
  
  /**
   * 버튼 클릭 추적 (특정 클래스 자동 추적)
   */
  document.addEventListener('click', function(e) {
    const button = e.target.closest('.track-click');
    if (button) {
      const buttonText = button.textContent.trim();
      const buttonId = button.id || 'unknown';
      
      window.trackEvent('button_clicked', {
        button_text: buttonText,
        button_id: buttonId,
        page_url: window.location.href
      });
    }
  });
  
  // 전역 Analytics 객체 생성
  window.Analytics = {
    trackEvent: window.trackEvent,
    trackBlogCreated: window.trackBlogCreated,
    trackReviewReplied: window.trackReviewReplied,
    trackCrawlingUsed: window.trackCrawlingUsed,
    trackLogin: window.trackLogin,
    trackSignup: window.trackSignup,
    trackPremiumSignup: window.trackPremiumSignup,
    trackFeatureUsed: window.trackFeatureUsed,
    trackUserError: window.trackUserError,
    getSessionId: () => sessionId,
    getSessionDuration: () => Math.floor((Date.now() - sessionStartTime) / 1000)
  };
  
  console.log('✅ 사용자 분석 시스템 초기화 완료');
  
})();

