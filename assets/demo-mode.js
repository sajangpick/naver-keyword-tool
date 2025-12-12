/**
 * 전역 데모 모드 시스템
 * 카카오페이 심사팀이 로그인 없이 사이트 전체를 확인할 수 있도록 지원
 * 
 * 사용법: URL에 ?demo=true 파라미터 추가
 * 예: https://sajangpick.co.kr/index.html?demo=true
 */

(function() {
  'use strict';

  // URL 파라미터에서 데모 모드 확인
  const urlParams = new URLSearchParams(window.location.search);
  const isDemoMode = urlParams.get('demo') === 'true';

  // 데모 모드 상태를 localStorage에 저장 (다른 페이지로 이동해도 유지)
  if (isDemoMode) {
    localStorage.setItem('demo_mode', 'true');
    // 데모 모드 배너 표시
    showDemoBanner();
  } else {
    // URL에 demo=true가 없으면 localStorage에서 확인
    const storedDemoMode = localStorage.getItem('demo_mode') === 'true';
    if (storedDemoMode) {
      // 다른 페이지로 이동했지만 데모 모드 유지
      showDemoBanner();
    }
  }

  // 데모 모드 배너 표시
  function showDemoBanner() {
    // 이미 배너가 있으면 중복 생성 방지
    if (document.getElementById('demo-mode-banner')) {
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'demo-mode-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #ff7b54, #e56548);
      color: white;
      padding: 12px 20px;
      text-align: center;
      font-weight: 600;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    `;
    banner.innerHTML = `
      <span>🔍 데모 모드: 테스트 페이지입니다. 실제 기능은 작동하지 않습니다.</span>
      <button onclick="exitDemoMode()" style="
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        padding: 4px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        transition: all 0.3s;
      " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
         onmouseout="this.style.background='rgba(255,255,255,0.2)'">
        데모 모드 종료
      </button>
    `;
    document.body.insertBefore(banner, document.body.firstChild);

    // body에 padding-top 추가 (배너가 콘텐츠를 가리지 않도록)
    document.body.style.paddingTop = '50px';
  }

  // 데모 모드 종료
  window.exitDemoMode = function() {
    localStorage.removeItem('demo_mode');
    const banner = document.getElementById('demo-mode-banner');
    if (banner) {
      banner.remove();
    }
    document.body.style.paddingTop = '';
    // 현재 URL에서 demo=true 제거하고 새로고침
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    window.location.href = url.toString();
  };

  // 전역 데모 모드 상태 확인 함수
  window.isDemoMode = function() {
    return localStorage.getItem('demo_mode') === 'true';
  };

  // auth-state.js와 통합: 데모 모드일 때 로그인 체크 우회
  if (window.isDemoMode()) {
    // 데모 모드일 때는 가짜 세션 생성
    if (!window.authState) {
      window.authState = {};
    }
    
    // 가짜 getSession 함수 (데모 모드용)
    const originalGetSession = window.authState.supabase?.auth?.getSession;
    if (window.authState.supabase && window.authState.supabase.auth) {
      const originalGetSession = window.authState.supabase.auth.getSession.bind(window.authState.supabase.auth);
      window.authState.supabase.auth.getSession = function() {
        // 데모 모드일 때는 가짜 세션 반환
        return Promise.resolve({
          data: {
            session: {
              user: {
                id: 'demo_user_12345',
                email: 'demo@sajangpick.co.kr',
                user_metadata: {
                  full_name: '데모 사용자',
                  name: '데모 사용자'
                }
              },
              access_token: 'demo_token'
            }
          }
        });
      };
    }
  }

  console.log('[demo-mode] 전역 데모 모드:', window.isDemoMode() ? '활성화됨' : '비활성화됨');
})();

