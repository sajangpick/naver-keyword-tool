// ============================================
// 어드민 공통 유틸리티 함수
// ============================================
// 모든 어드민 페이지에서 사용하는 공통 함수들

(function() {
  'use strict';

  const SUPABASE_NOT_READY_MESSAGE = 'Supabase가 초기화되지 않았습니다.';

  async function waitForAdminBootstrap(timeout = 10000) {
    if (window.AdminBootstrap && typeof window.AdminBootstrap.getSupabaseClient === 'function') {
      return window.AdminBootstrap;
    }

    return new Promise(resolve => {
      const start = Date.now();
      const timer = setInterval(() => {
        if (window.AdminBootstrap && typeof window.AdminBootstrap.getSupabaseClient === 'function') {
          clearInterval(timer);
          resolve(window.AdminBootstrap);
          return;
        }

        if (Date.now() - start > timeout) {
          clearInterval(timer);
          resolve(null);
        }
      }, 30);
    });
  }

  async function waitForSession(supabase, timeout = 5000) {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('❌ 세션 조회 실패:', error);
      return null;
    }

    if (session) {
      return session;
    }

    return new Promise(resolve => {
      let subscription;
      const timer = setTimeout(() => {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
        resolve(null);
      }, timeout);

      const { data: { subscription: authSubscription } = {} } = supabase.auth.onAuthStateChange((event, newSession) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && newSession) {
          clearTimeout(timer);
          if (subscription && typeof subscription.unsubscribe === 'function') {
            subscription.unsubscribe();
          }
          resolve(newSession);
        }
      });

      subscription = authSubscription;
    });
  }

  async function getSupabaseClient() {
    await waitForAdminBootstrap();

    if (window.AdminBootstrap && typeof window.AdminBootstrap.getSupabaseClient === 'function') {
      try {
        const client = await window.AdminBootstrap.getSupabaseClient();
        if (client) {
          window.supabaseClient = client;
          return client;
        }
      } catch (error) {
        console.error('Supabase 초기화 실패:', error);
        throw error;
      }
    }

    if (window.supabaseClient) {
      return window.supabaseClient;
    }

    if (window.supabase && typeof window.supabase.auth === 'object') {
      return window.supabase;
    }

    throw new Error(SUPABASE_NOT_READY_MESSAGE);
  }

  // ==================== 날짜/시간 포맷 ====================
  
  /**
   * 날짜를 한국어 형식으로 포맷
   * @param {string|Date} date - 날짜
   * @returns {string} - "2025년 10월 30일"
   */
  function formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  }

  /**
   * 날짜와 시간을 한국어 형식으로 포맷
   * @param {string|Date} date - 날짜
   * @returns {string} - "2025년 10월 30일 14:30"
   */
  function formatDateTime(date) {
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${formatDate(d)} ${hours}:${minutes}`;
  }

  /**
   * 상대 시간 표시 (예: "3분 전", "2시간 전")
   * @param {string|Date} date - 날짜
   * @returns {string}
   */
  function timeAgo(date) {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    if (diffHour < 24) return `${diffHour}시간 전`;
    if (diffDay < 7) return `${diffDay}일 전`;
    return formatDate(date);
  }

  // ==================== 숫자 포맷 ====================

  /**
   * 숫자를 천 단위 콤마로 포맷
   * @param {number} num - 숫자
   * @returns {string} - "1,234,567"
   */
  function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return Number(num).toLocaleString('ko-KR');
  }

  /**
   * 퍼센트 포맷
   * @param {number} value - 값 (0-1 또는 0-100)
   * @param {boolean} isDecimal - true면 0-1 범위, false면 0-100 범위
   * @returns {string} - "45.6%"
   */
  function formatPercent(value, isDecimal = true) {
    if (value === null || value === undefined) return '0%';
    const percent = isDecimal ? value * 100 : value;
    return percent.toFixed(1) + '%';
  }

  /**
   * 파일 크기 포맷
   * @param {number} bytes - 바이트
   * @returns {string} - "1.5 MB"
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  // ==================== API 호출 ====================

  /**
   * 관리자 API 호출 (자동으로 인증 토큰 포함)
   * @param {string} endpoint - API 엔드포인트
   * @param {object} options - fetch 옵션
   * @returns {Promise<any>}
   */
  async function adminFetch(endpoint, options = {}) {
    try {
      let accessToken = null;
      
      // 방법 1: Supabase 클라이언트에서 세션 가져오기 (우선)
      try {
        const supabase = await getSupabaseClient();
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.access_token) {
            accessToken = session.access_token;
          }
        }
      } catch (supabaseError) {
        console.warn('⚠️ Supabase 클라이언트에서 세션을 가져올 수 없습니다:', supabaseError.message);
      }
      
      // 방법 2: localStorage/sessionStorage에서 토큰 가져오기 (대체)
      if (!accessToken) {
        console.log('🔍 localStorage/sessionStorage에서 토큰 검색 시작...');
        
        // 모든 storage 확인 (localStorage 우선, 그 다음 sessionStorage)
        const storages = [localStorage, sessionStorage];
        
        for (const storage of storages) {
          // Supabase는 보통 'sb-{project-ref}-auth-token' 형식으로 저장
          // 또는 'supabase.auth.token' 형식
          const keys = Object.keys(storage);
          console.log(`📋 ${storage === localStorage ? 'localStorage' : 'sessionStorage'} 키 개수:`, keys.length);
          
          for (const key of keys) {
            // Supabase 관련 키 찾기
            if (key.includes('sb-') || key.includes('supabase') || key.includes('auth')) {
              try {
                const value = storage.getItem(key);
                if (!value) continue;
                
                let parsed;
                try {
                  parsed = JSON.parse(value);
                } catch (e) {
                  // JSON이 아닐 수도 있음
                  continue;
                }
                
                // 다양한 형식 확인
                if (parsed.access_token) {
                  accessToken = parsed.access_token;
                  console.log('✅ 토큰 발견:', key, '형식: access_token');
                  break;
                } else if (parsed.currentSession?.access_token) {
                  accessToken = parsed.currentSession.access_token;
                  console.log('✅ 토큰 발견:', key, '형식: currentSession.access_token');
                  break;
                } else if (parsed.session?.access_token) {
                  accessToken = parsed.session.access_token;
                  console.log('✅ 토큰 발견:', key, '형식: session.access_token');
                  break;
                } else if (typeof parsed === 'object') {
                  // 중첩된 객체에서 재귀적으로 찾기
                  const findToken = (obj) => {
                    if (!obj || typeof obj !== 'object') return null;
                    if (obj.access_token) return obj.access_token;
                    for (const val of Object.values(obj)) {
                      const token = findToken(val);
                      if (token) return token;
                    }
                    return null;
                  };
                  const foundToken = findToken(parsed);
                  if (foundToken) {
                    accessToken = foundToken;
                    console.log('✅ 토큰 발견:', key, '형식: 중첩 객체');
                    break;
                  }
                }
              } catch (e) {
                // 파싱 실패는 무시
              }
            }
          }
          
          if (accessToken) break;
        }
        
        if (!accessToken) {
          console.warn('⚠️ localStorage/sessionStorage에서 토큰을 찾을 수 없습니다.');
          // 디버깅: 모든 키 출력
          console.log('📋 localStorage 키들:', Object.keys(localStorage));
          console.log('📋 sessionStorage 키들:', Object.keys(sessionStorage));
        }
      }
      
      if (!accessToken) {
        console.error('❌ 토큰을 찾을 수 없습니다. 로그인이 필요합니다.');
        // 토큰이 없어도 API 호출은 시도 (서버에서 401 반환)
        // 리다이렉트는 하지 않음
        const error = new Error('로그인이 필요합니다. 세션을 찾을 수 없습니다.');
        error.status = 401;
        error.noRedirect = true; // 리다이렉트 방지 플래그
        throw error;
      }
      
      console.log('✅ 토큰 발견, API 호출 진행');

      // 기본 헤더 설정
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      };

      // API 호출 (리다이렉트 루프 방지)
      const response = await fetch(endpoint, {
        ...options,
        headers,
        redirect: 'manual' // 리다이렉트를 수동으로 처리하여 루프 방지
      });
      
      // 리다이렉트 응답 처리
      if (response.type === 'opaqueredirect' || response.status === 0) {
        const error = new Error('리다이렉트 루프가 감지되었습니다. 서버 설정을 확인하세요.');
        error.status = 302;
        error.redirect = true;
        throw error;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.error || `API 오류: ${response.status}`);
        error.status = response.status;
        error.data = errorData;
        // 403 에러는 리다이렉트하지 않고 에러만 throw
        if (response.status === 403) {
          console.warn('⚠️ 관리자 권한이 없습니다:', errorData);
        }
        throw error;
      }

      return await response.json();
    } catch (error) {
      console.error('API 호출 실패:', error);
      // 리다이렉트하지 않고 에러만 throw
      throw error;
    }
  }

  // ==================== 권한 확인 ====================

  /**
   * 관리자 권한 확인
   * @returns {Promise<boolean>}
   */
  async function checkAdminAuth() {
    try {
      const supabase = await getSupabaseClient();
      const session = await waitForSession(supabase);

      if (!session || !session.user) {
        console.log('⌛ 세션 대기 중');
        return null;
      }

      const user = session.user;

      if (!user) {
        console.log('⚠️ 사용자 정보 없음');
        return false;
      }

      console.log('✅ 로그인된 사용자:', user.email);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('user_type, membership_level')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('❌ 프로필 조회 실패:', profileError);
        return false;
      }

      console.log('✅ 프로필:', profile);

      // user_type, membership_level 중 하나라도 'admin'이면 관리자
      const isAdmin = profile && (
        profile.user_type === 'admin' || 
        profile.membership_level === 'admin'
      );
      console.log(`🔐 관리자 권한: ${isAdmin ? 'O' : 'X'}`);
      
      return isAdmin;
    } catch (error) {
      if (error && error.message === SUPABASE_NOT_READY_MESSAGE) {
        return null;
      }

      console.error('❌ 권한 확인 실패:', error);
      return false;
    }
  }

  /**
   * 관리자 권한 체크 및 리다이렉트
   */
  async function requireAdmin({ redirect = true, maxRetries = 50, retryDelay = 100 } = {}) {
    let attempts = 0;

    while (attempts <= maxRetries) {
      const authStatus = await checkAdminAuth();

      if (authStatus === true) {
        return true;
      }

      if (authStatus === false) {
        if (redirect) {
          const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.replace(`/login.html?redirect=${currentUrl}`);
        }
        return false;
      }

      attempts += 1;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }

    if (redirect && window.location.pathname !== '/login.html') {
      const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login.html?redirect=${currentUrl}`);
    }

    return false;
  }

  // ==================== 알림 ====================

  /**
   * 성공 알림 표시
   * @param {string} message - 메시지
   */
  function showSuccess(message) {
    // 토스트 UI 구현 예정 (Toastify.js 추천)
    alert('✅ ' + message);
  }

  /**
   * 에러 알림 표시
   * @param {string} message - 메시지
   */
  function showError(message) {
    // 토스트 UI 구현 예정 (Toastify.js 추천)
    alert('❌ ' + message);
  }

  /**
   * 확인 다이얼로그
   * @param {string} message - 메시지
   * @returns {Promise<boolean>}
   */
  async function confirm(message) {
    return window.confirm(message);
  }

  // ==================== 로딩 상태 ====================

  /**
   * 로딩 스피너 표시
   * @param {HTMLElement} element - 대상 요소
   */
  function showLoading(element) {
    if (!element) return;
    element.innerHTML = `
      <div class="loading">
        <i class="fas fa-spinner fa-spin"></i>
        <div>로딩 중...</div>
      </div>
    `;
  }

  /**
   * 빈 상태 표시
   * @param {HTMLElement} element - 대상 요소
   * @param {string} message - 메시지
   * @param {string} icon - 아이콘
   */
  function showEmpty(element, message = '데이터가 없습니다', icon = 'fa-inbox') {
    if (!element) return;
    element.innerHTML = `
      <div class="empty-state">
        <i class="fas ${icon}"></i>
        <div>${message}</div>
      </div>
    `;
  }

  /**
   * 에러 상태 표시
   * @param {HTMLElement} element - 대상 요소
   * @param {string} message - 메시지
   */
  function showErrorState(element, message = '데이터 로드 실패') {
    if (!element) return;
    element.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle" style="color: var(--danger);"></i>
        <div>${message}</div>
      </div>
    `;
  }

  // ==================== 전역 객체에 추가 ====================

  window.AdminUtils = {
    // 날짜/시간
    formatDate,
    formatDateTime,
    timeAgo,
    
    // 숫자
    formatNumber,
    formatPercent,
    formatFileSize,
    
    // API
    adminFetch,
    
    // 권한
    checkAdminAuth,
    requireAdmin,
    
    // 알림
    showSuccess,
    showError,
    confirm,
    
    // UI 상태
    showLoading,
    showEmpty,
    showErrorState
  };

  console.log('✅ Admin Utils loaded');

})();

