/**
 * 페이지 접속 기록 자동 추적 스크립트
 * 모든 페이지에서 자동으로 접속 기록을 저장합니다.
 * 
 * 사용법: HTML <head>에 추가
 * <script src="/assets/page-visit-tracker.js"></script>
 */

(function() {
  'use strict';

  // 중복 실행 방지
  if (window.__PAGE_VISIT_TRACKER_LOADED__) return;
  window.__PAGE_VISIT_TRACKER_LOADED__ = true;

  // 세션 ID 생성/가져오기
  function getSessionId() {
    let sessionId = sessionStorage.getItem('page_visit_session_id');
    if (!sessionId) {
      sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('page_visit_session_id', sessionId);
    }
    return sessionId;
  }

  // 사용자 ID 가져오기
  async function getUserId() {
    try {
      // auth-state.js에서 사용자 정보 가져오기
      if (window.authState?.supabase) {
        const { data: { session } } = await window.authState.supabase.auth.getSession();
        if (session?.user?.id) {
          return session.user.id;
        }
      }

      // localStorage에서 사용자 정보 가져오기
      const userData = localStorage.getItem('userData');
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          return parsed.id || null;
        } catch {
          return null;
        }
      }

      return null;
    } catch (error) {
      console.warn('[page-visit-tracker] 사용자 ID 가져오기 실패:', error);
      return null;
    }
  }

  // 접속 기록 저장
  async function savePageVisit() {
    try {
      console.log('[page-visit-tracker] 🔄 접속 기록 저장 시작');
      
      const userId = await getUserId();
      const sessionId = getSessionId();
      const pageUrl = window.location.href;
      const pageTitle = document.title;
      const referrer = document.referrer || null;

      // API 엔드포인트 결정
      const isLocalDev = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';
      const apiBaseUrl = isLocalDev 
        ? 'http://127.0.0.1:3003'
        : window.location.origin;

      console.log('[page-visit-tracker] 📡 API 호출 정보:', {
        apiBaseUrl,
        pageUrl,
        pageTitle,
        userId: userId || '익명',
        sessionId
      });

      // 이전 페이지의 체류 시간 계산 (localStorage에 저장된 이전 방문 시간 사용)
      let durationSeconds = null;
      const lastVisitTime = localStorage.getItem('last_page_visit_time');
      if (lastVisitTime) {
        durationSeconds = Math.floor((Date.now() - parseInt(lastVisitTime)) / 1000);
        // 이전 페이지의 체류 시간 업데이트 (비동기, 실패해도 무시)
        updatePreviousPageDuration(apiBaseUrl, sessionId, durationSeconds).catch(() => {});
      }

      // 현재 방문 시간 저장
      localStorage.setItem('last_page_visit_time', Date.now().toString());

      // 접속 기록 저장
      const requestBody = {
        userId: userId,
        pageUrl: pageUrl,
        pageTitle: pageTitle,
        referrer: referrer,
        sessionId: sessionId,
        durationSeconds: null, // 현재 페이지는 아직 체류 시간 없음
      };

      console.log('[page-visit-tracker] 📤 API 요청 전송:', {
        url: `${apiBaseUrl}/api/auth/page-visit`,
        method: 'POST',
        body: requestBody
      });

      const response = await fetch(`${apiBaseUrl}/api/auth/page-visit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[page-visit-tracker] 📥 API 응답 받음:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[page-visit-tracker] ❌ API 오류 응답:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        });
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[page-visit-tracker] ✅ 접속 기록 저장 완료:', {
        page: pageTitle,
        userId: userId || '익명',
        id: result.data?.id,
        createdAt: result.data?.createdAt,
        result: result
      });
    } catch (error) {
      // 접속 기록 저장 실패는 페이지 로딩에 영향을 주지 않음
      console.error('[page-visit-tracker] ❌ 접속 기록 저장 실패:', {
        message: error.message,
        stack: error.stack,
        page: document.title,
        url: window.location.href,
        error: error
      });
    }
  }

  // 이전 페이지의 체류 시간 업데이트 (선택적, 실패해도 무시)
  async function updatePreviousPageDuration(apiBaseUrl, sessionId, durationSeconds) {
    // 이 기능은 나중에 구현 가능 (현재는 기본 저장만)
    // 필요시 마지막 방문 기록을 찾아서 duration_seconds를 업데이트
  }

  // 페이지 언로드 시 체류 시간 저장 (beforeunload)
  window.addEventListener('beforeunload', () => {
    const lastVisitTime = localStorage.getItem('last_page_visit_time');
    if (lastVisitTime) {
      const durationSeconds = Math.floor((Date.now() - parseInt(lastVisitTime)) / 1000);
      // localStorage에 저장 (다음 페이지에서 사용)
      sessionStorage.setItem('last_page_duration', durationSeconds.toString());
    }
  });

  // 페이지 로드 시 접속 기록 저장
  console.log('[page-visit-tracker] 스크립트 로드 완료');
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('[page-visit-tracker] DOMContentLoaded - 접속 기록 저장 시작');
      savePageVisit();
    });
  } else {
    // 이미 로드된 경우 즉시 실행
    console.log('[page-visit-tracker] 이미 로드됨 - 접속 기록 저장 시작');
    savePageVisit();
  }

  // SPA 라우팅 지원 (pushState/replaceState 감지)
  if (typeof window.history.pushState === 'function') {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(...args) {
      originalPushState.apply(window.history, args);
      setTimeout(savePageVisit, 100); // 약간의 지연 후 저장
    };

    window.history.replaceState = function(...args) {
      originalReplaceState.apply(window.history, args);
      setTimeout(savePageVisit, 100);
    };

    // popstate 이벤트 (뒤로가기/앞으로가기)
    window.addEventListener('popstate', () => {
      setTimeout(savePageVisit, 100);
    });
  }

})();

