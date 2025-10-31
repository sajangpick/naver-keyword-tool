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
      const supabase = await getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('로그인이 필요합니다.');
      }

      // 기본 헤더 설정
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        ...options.headers
      };

      // API 호출
      const response = await fetch(endpoint, {
        ...options,
        headers
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `API 오류: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API 호출 실패:', error);
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

      // user_type이 'admin' 또는 membership_level이 'admin'인 경우
      const isAdmin = profile && (profile.user_type === 'admin' || profile.membership_level === 'admin');
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
    // TODO: 나중에 토스트 UI로 개선
    alert('✅ ' + message);
  }

  /**
   * 에러 알림 표시
   * @param {string} message - 메시지
   */
  function showError(message) {
    // TODO: 나중에 토스트 UI로 개선
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

