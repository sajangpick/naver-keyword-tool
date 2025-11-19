/**
 * 사장픽 인증 가드 시스템
 * 
 * 사용법:
 * 1. HTML에서 이 스크립트를 로드: <script src="./assets/auth-guard.js" defer></script>
 * 2. 보호할 입력 필드에 클래스 추가: class="auth-required"
 * 3. 또는 protectInputFields() 함수로 자동 보호
 */

(function() {
  'use strict';

  // 로그인 체크 함수
  function isUserLoggedIn() {
    try {
      // localStorage에서 로그인 상태 확인
      const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
      const userData = localStorage.getItem('userData');
      
      // 두 가지 조건 모두 확인
      return isLoggedIn && userData !== null;
    } catch (error) {
      console.warn('[auth-guard] 로그인 상태 확인 실패:', error);
      return false;
    }
  }

  // 로그인 페이지로 리다이렉트 (현재 페이지 URL 저장)
  function redirectToLogin() {
    try {
      // 현재 페이지 URL 저장 (로그인 후 복귀용)
      const currentPage = window.location.pathname + window.location.search;
      sessionStorage.setItem('returnUrl', currentPage);
      
      // 로그인 페이지로 이동
      window.location.href = '/login.html';
    } catch (error) {
      console.error('[auth-guard] 리다이렉트 실패:', error);
      // sessionStorage 실패 시에도 로그인 페이지로 이동
      window.location.href = '/login.html';
    }
  }

  // 로그인 필요 알림 표시 및 로그인 페이지 이동 확인
  function showLoginRequiredAlert(event) {
    // 이벤트 기본 동작 막기
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // 로그인 상태 재확인
    if (isUserLoggedIn()) {
      return true; // 로그인되어 있으면 통과
    }

    // 팝업 메시지 표시
    const userConfirmed = confirm('회원 전용 기능입니다. 로그인 해주세요.\n\n로그인 페이지로 이동하시겠습니까?');
    
    if (userConfirmed) {
      redirectToLogin();
    } else {
      // 포커스 제거 (입력 필드에서 벗어나기)
      if (event && event.target) {
        event.target.blur();
      }
    }
    
    return false;
  }

  // 입력 필드 보호 (실제 입력 시도 시에만 팝업)
  function protectInputField(element) {
    if (!element) return;

    // 이미 보호된 필드는 스킵
    if (element.dataset.authProtected === 'true') {
      return;
    }

    // 보호 플래그 설정
    element.dataset.authProtected = 'true';

    // 알림이 이미 표시된 상태인지 추적 (중복 팝업 방지)
    let alertShown = false;

    // 키보드 입력 시도 시에만 팝업 표시
    element.addEventListener('keydown', function(event) {
      if (!isUserLoggedIn() && !alertShown) {
        event.preventDefault();
        event.stopPropagation();
        alertShown = true; // 팝업 표시 플래그 설정
        showLoginRequiredAlert(event);
        
        // 입력 필드 blur 처리
        if (element.blur) {
          element.blur();
        }
        
        // 3초 후 플래그 리셋 (사용자가 다시 시도할 수 있도록)
        setTimeout(() => { alertShown = false; }, 3000);
      }
    }, true);

    // input 이벤트 (붙여넣기, 드래그 등)
    element.addEventListener('input', function(event) {
      if (!isUserLoggedIn() && !alertShown) {
        event.preventDefault();
        event.stopPropagation();
        
        // 입력된 값 제거
        const originalValue = element.value;
        element.value = '';
        
        // 값이 실제로 변경된 경우에만 팝업 표시
        if (originalValue !== '') {
          alertShown = true;
          showLoginRequiredAlert(event);
          
          // 3초 후 플래그 리셋
          setTimeout(() => { alertShown = false; }, 3000);
        }
      }
    }, true);

    // paste 이벤트 (붙여넣기 시도)
    element.addEventListener('paste', function(event) {
      if (!isUserLoggedIn() && !alertShown) {
        event.preventDefault();
        event.stopPropagation();
        alertShown = true;
        showLoginRequiredAlert(event);
        
        // 3초 후 플래그 리셋
        setTimeout(() => { alertShown = false; }, 3000);
      }
    }, true);
  }

  // 버튼 클릭 보호
  function protectButton(button) {
    if (!button) return;

    // 이미 보호된 버튼은 스킵
    if (button.dataset.authProtected === 'true') {
      return;
    }

    button.dataset.authProtected = 'true';

    // 중복 팝업 방지
    let alertShown = false;

    button.addEventListener('click', function(event) {
      if (!isUserLoggedIn() && !alertShown) {
        event.preventDefault();
        event.stopPropagation();
        alertShown = true;
        showLoginRequiredAlert(event);
        
        // 3초 후 플래그 리셋
        setTimeout(() => { alertShown = false; }, 3000);
      }
    }, true);
  }

  // 페이지의 모든 입력 필드 자동 보호
  function protectAllInputFields() {
    // 로그인되어 있으면 보호 불필요
    if (isUserLoggedIn()) {
      console.log('[auth-guard] ✅ 로그인 상태 - 모든 기능 사용 가능');
      return;
    }

    console.log('[auth-guard] 🔒 비로그인 상태 - 입력 필드 보호 활성화');

    // 보호할 요소 선택자들
    const selectors = [
      'input[type="text"]',
      'input[type="search"]',
      'input[type="email"]',
      'input[type="tel"]',
      'input[type="url"]',
      'input[type="number"]',
      'textarea',
      'select',
      '.auth-required', // 명시적으로 보호가 필요한 요소
    ];

    // 모든 선택자에 해당하는 요소 보호
    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        // 로그인/회원가입 폼은 제외
        if (element.closest('form[action*="login"]') || 
            element.closest('form[action*="signup"]') ||
            element.closest('.auth-buttons') ||
            element.closest('.header-auth')) {
          return;
        }
        protectInputField(element);
      });
    });

    // 전송 버튼, 생성 버튼 등 보호
    const buttonSelectors = [
      'button[type="submit"]',
      'button.btn-primary',
      'button.submit-btn',
      'button.generate-btn',
      '.auth-required-button',
    ];

    buttonSelectors.forEach(selector => {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        // 로그인/로그아웃 버튼은 제외
        if (button.id === 'loginBtn' || 
            button.id === 'logoutBtn' ||
            button.id === 'signupBtn' ||
            button.closest('.auth-buttons') ||
            button.closest('.header-auth')) {
          return;
        }
        protectButton(button);
      });
    });
  }

  // DOM 변경 감지 (동적으로 추가된 요소 보호)
  function observeDOMChanges() {
    if (isUserLoggedIn()) {
      return; // 로그인되어 있으면 감시 불필요
    }

    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length > 0) {
          // 새로 추가된 노드들 확인
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1) { // Element 노드만
              // 입력 필드 확인
              if (node.matches && (node.matches('input') || node.matches('textarea') || node.matches('select'))) {
                protectInputField(node);
              }
              // 자식 요소 중 입력 필드 확인
              const inputs = node.querySelectorAll('input, textarea, select');
              inputs.forEach(protectInputField);
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 페이지 로드 완료 후 실행
  function initAuthGuard() {
    // 로그인 상태 확인
    const loggedIn = isUserLoggedIn();
    console.log('[auth-guard] 페이지 로드 - 로그인 상태:', loggedIn);

    if (!loggedIn) {
      // 비로그인 시 입력 필드 보호
      protectAllInputFields();
      observeDOMChanges();
    }

    // 로그인 상태 변경 이벤트 리스너
    window.addEventListener('auth:state-changed', function() {
      const newState = isUserLoggedIn();
      console.log('[auth-guard] 인증 상태 변경:', newState);
      
      if (newState) {
        // 로그인됨 - 페이지 새로고침으로 보호 해제
        console.log('[auth-guard] ✅ 로그인 완료 - 페이지 새로고침');
        window.location.reload();
      }
    });
  }

  // DOMContentLoaded 이벤트에서 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthGuard);
  } else {
    initAuthGuard();
  }

  // 전역 함수로 노출 (수동 보호용)
  window.authGuard = {
    isLoggedIn: isUserLoggedIn,
    protect: protectInputField,
    protectButton: protectButton,
    showLoginAlert: showLoginRequiredAlert,
    init: initAuthGuard
  };
})();

