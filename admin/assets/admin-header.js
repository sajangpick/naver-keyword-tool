// ============================================
// 어드민 헤더 공통 컴포넌트
// ============================================
// 페이지 상단의 제목, 사용자 정보, 버튼 등을 표시합니다.

(function() {
  'use strict';

  // 페이지별 설정
  const PAGE_CONFIG = {
    '/admin/pages/dashboard.html': {
      title: '대시보드',
      subtitle: '전체 시스템 현황',
      icon: '📊'
    },
    '/admin/analytics.html': {
      title: '분석',
      subtitle: '사용자 & 기능 분석',
      icon: '📈'
    },
    '/admin/performance.html': {
      title: '성능 모니터링',
      subtitle: 'API & 페이지 성능',
      icon: '⚡'
    },
    '/admin/errors.html': {
      title: '에러 관리',
      subtitle: '에러 로그 & 패턴',
      icon: '🐛'
    },
    '/admin/member-management.html': {
      title: '회원 관리',
      subtitle: '회원 정보 & 등급',
      icon: '👥'
    },
    '/admin/review-monitoring.html': {
      title: '리뷰 모니터링',
      subtitle: '리뷰 알림 & 관리',
      icon: '🔔'
    },
    '/admin/rank-report.html': {
      title: '순위 리포트',
      subtitle: '검색 순위 분석',
      icon: '📊'
    },
    '/admin/db-view.html': {
      title: 'DB 뷰어',
      subtitle: '데이터베이스 관리',
      icon: '🗄️'
    },
    '/admin/news-management.html': {
      title: '뉴스 관리',
      subtitle: '뉴스 게시판 관리',
      icon: '📰'
    },
    '/admin/pages/login-logs.html': {
      title: '로그인 기록',
      subtitle: '회원 로그인 기록 조회',
      icon: '🔐'
    },
    '/admin/pages/page-visits.html': {
      title: '접속 기록',
      subtitle: '회원 페이지 접속 기록 조회',
      icon: '📊'
    },
    '/admin/pages/feature-usage.html': {
      title: '사용 기록',
      subtitle: '블로그, 리뷰, 키워드검색, 레시피, 영상 기능 사용 기록',
      icon: '📈'
    }
  };

  // 현재 페이지 설정 가져오기
  function getPageConfig() {
    const currentPath = window.location.pathname;
    
    // 정확히 일치하는 경로 찾기
    if (PAGE_CONFIG[currentPath]) {
      return PAGE_CONFIG[currentPath];
    }
    
    // /admin/ 또는 /admin/index.html → 대시보드
    if (currentPath === '/admin/' || currentPath === '/admin/index.html') {
      return PAGE_CONFIG['/admin/pages/dashboard.html'];
    }
    
    // 기본값
    return {
      title: '관리자',
      subtitle: '시스템 관리',
      icon: '⚙️'
    };
  }

  // 헤더 HTML 생성
  function createHeader() {
    const config = getPageConfig();
    
    const header = document.createElement('div');
    header.className = 'admin-header';
    header.id = 'adminHeader';

    header.innerHTML = `
      <div class="header-left">
        <div class="page-icon">${config.icon}</div>
        <div class="page-info">
          <h1 class="page-title">${config.title}</h1>
          <p class="page-subtitle">${config.subtitle}</p>
        </div>
        <button class="header-btn" id="mainPageBtn" title="메인 페이지로 이동">
          <i class="fas fa-home"></i>
        </button>
      </div>

      <div class="header-right">
        <button class="header-btn login-btn" id="loginBtn" title="로그인" style="display: none;">
          <i class="fas fa-sign-in-alt"></i>
          <span>로그인</span>
        </button>
        
        <button class="header-btn" id="refreshBtn" title="새로고침">
          <i class="fas fa-sync-alt"></i>
        </button>
        
        <div class="user-info" id="adminUserInfo">
          <div class="user-avatar" id="userAvatar">
            <i class="fas fa-user"></i>
          </div>
          <div class="user-details">
            <div class="user-name" id="userName">로딩 중...</div>
            <div class="user-role">
              <span class="role-badge">로딩 중...</span>
            </div>
          </div>
        </div>

        <button class="header-btn" id="logoutBtn" title="로그아웃">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    `;

    return header;
  }

  // ==================== 등급 시스템 (member-management.html과 동일) ====================
  
  // 등급 한글명 매핑 (member-management.html과 동일)
  const LEVEL_NAMES = {
    free: '라이트',      // FREE 등급도 라이트로 표시
    seed: '라이트',
    power: '스탠다드',
    big_power: '프로',
    bigpower: '프로',   // 정규화된 형태도 지원
    premium: '프리미엄',
    elite: '스타터',
    expert: '프로',
    master: '엔터프라이즈',
    platinum: '플래티넘',
    admin: '관리자'
  };

  // 등급 정규화 함수 (member-management.html과 동일)
  function normalizeMembershipLevel(level) {
    if (!level) {
      return 'seed';
    }
    const normalized = level.toLowerCase();
    // FREE 또는 free를 seed로 변환
    if (normalized === 'free') {
      return 'seed';
    }
    // big_power를 bigpower로 변환
    if (normalized === 'big_power') {
      return 'bigpower';
    }
    return normalized;
  }

  // 사용자 유형 한글명 매핑
  const USER_TYPE_NAMES = {
    owner: '식당 대표',
    agency: '대행사/블로거',
    manager: '매니저',
    admin: '관리자'
  };

  // 권한 라벨 생성 함수
  function getRoleLabel(profile) {
    if (!profile) {
      console.warn('[Header] getRoleLabel: 프로필이 없음, 기본값 반환');
      return '라이트'; // 프로필이 없어도 기본 등급 표시
    }

    console.log('[Header] getRoleLabel 입력:', {
      user_type: profile.user_type,
      membership_level: profile.membership_level,
      role: profile.role
    });

    // 관리자 권한 확인 (user_type, membership_level, role 중 하나라도 'admin')
    const isAdmin = profile.user_type === 'admin' || 
                   profile.membership_level === 'admin' || 
                   (profile.role && profile.role === 'admin');
    
    if (isAdmin) {
      console.log('[Header] 관리자로 판단');
      return '관리자';
    }

    // user_type에 따른 분류
    if (profile.user_type === 'owner') {
      // 식당 대표: 등급 한글명 표시
      const normalizedLevel = normalizeMembershipLevel(profile.membership_level);
      const label = LEVEL_NAMES[normalizedLevel] || normalizedLevel || '라이트';
      console.log('[Header] 식당 대표 등급:', normalizedLevel, '→', label);
      return label;
    } else if (profile.user_type === 'agency') {
      // 대행사/블로거: 등급 한글명 표시
      const normalizedLevel = normalizeMembershipLevel(profile.membership_level);
      const label = LEVEL_NAMES[normalizedLevel] || normalizedLevel || '스타터';
      console.log('[Header] 대행사 등급:', normalizedLevel, '→', label);
      return label;
    } else if (profile.user_type === 'manager') {
      // 매니저: 유형명 표시
      console.log('[Header] 매니저로 판단');
      return USER_TYPE_NAMES.manager || '매니저';
    } else {
      // 기타: 등급이 있으면 등급명, 없으면 user_type명
      if (profile.membership_level) {
        const normalizedLevel = normalizeMembershipLevel(profile.membership_level);
        const label = LEVEL_NAMES[normalizedLevel] || normalizedLevel;
        console.log('[Header] 기타 등급:', normalizedLevel, '→', label);
        return label;
      }
      const label = USER_TYPE_NAMES[profile.user_type] || '라이트'; // 기본값도 라이트로 변경
      console.log('[Header] user_type만 있음:', profile.user_type, '→', label);
      return label;
    }
  }

  // 사용자 정보 로드
  async function loadUserInfo() {
    try {
      // AdminBootstrap이 제공하는 Supabase 클라이언트를 우선 사용
      let supabaseClient = null;

      if (window.AdminBootstrap && typeof window.AdminBootstrap.getSupabaseClient === 'function') {
        try {
          supabaseClient = await window.AdminBootstrap.getSupabaseClient();
        } catch (_) {
          // fallthrough to other checks
        }
      }

      // fallback: 전역에 이미 준비된 클라이언트 사용
      if (!supabaseClient && window.supabase && window.supabase.auth && typeof window.supabase.auth.getUser === 'function') {
        supabaseClient = window.supabase;
      }

      if (!supabaseClient || !supabaseClient.auth || typeof supabaseClient.auth.getUser !== 'function') {
        console.warn('⚠️ Supabase client not ready (skip header user info)');
        // 로그인되지 않은 상태로 간주하고 로그인 버튼 표시
        showLoginButton();
        return;
      }

      const { data: { user } = { user: null } } = await supabaseClient.auth.getUser();

      if (user) {
        // 프로필 정보 가져오기 (권한 확인용)
        let roleLabel = '회원'; // 기본값
        
        try {
          console.log('[Header] 프로필 조회 시작, userId:', user.id);
          
          const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('user_type, membership_level, role')
            .eq('id', user.id)
            .single();

          console.log('[Header] 프로필 조회 결과:', { profile, profileError });

          if (profileError) {
            console.error('[Header] 프로필 조회 에러:', profileError);
            // 에러가 있어도 프로필이 있으면 사용
            if (profile) {
              roleLabel = getRoleLabel(profile);
              console.log('[Header] 프로필 있음, 라벨:', roleLabel);
            }
          } else if (profile) {
            // member-management.html의 등급 시스템 사용
            roleLabel = getRoleLabel(profile);
            console.log('[Header] 등급 라벨 생성:', roleLabel, '프로필:', {
              user_type: profile.user_type,
              membership_level: profile.membership_level,
              role: profile.role
            });
          } else {
            console.warn('[Header] 프로필 데이터가 없음');
          }
        } catch (profileError) {
          console.error('[Header] 프로필 조회 예외 발생:', profileError);
          // 프로필 조회 실패 시 기본값 '회원' 사용
        }

        // 사용자 이름 업데이트
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
          userNameEl.textContent = user.email || '사용자';
        }
        
        // 권한 라벨 업데이트
        const roleBadgeEl = document.querySelector('.role-badge');
        if (roleBadgeEl) {
          roleBadgeEl.textContent = roleLabel;
        }
        
        // 아바타에 이니셜 표시
        const avatarEl = document.getElementById('userAvatar');
        if (avatarEl && user.email) {
          const initial = user.email.charAt(0).toUpperCase();
          avatarEl.innerHTML = `<span class="avatar-initial">${initial}</span>`;
        }
        
        // 로그인된 상태: 로그인 버튼 숨기고 사용자 정보/로그아웃 버튼 표시
        hideLoginButton();
      } else {
        // 로그인되지 않은 상태: 로그인 버튼 표시하고 사용자 정보/로그아웃 버튼 숨기기
        showLoginButton();
      }
    } catch (error) {
      console.error('사용자 정보 로드 실패:', error);
      // 에러 발생 시 로그인 버튼 표시
      showLoginButton();
    }
  }

  // 로그인 버튼 표시
  function showLoginButton() {
    const loginBtn = document.getElementById('loginBtn');
    const userInfo = document.getElementById('adminUserInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (loginBtn) loginBtn.style.display = 'flex';
    if (userInfo) userInfo.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }

  // 로그인 버튼 숨기기
  function hideLoginButton() {
    const loginBtn = document.getElementById('loginBtn');
    const userInfo = document.getElementById('adminUserInfo');
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfo) userInfo.style.display = 'flex';
    if (logoutBtn) logoutBtn.style.display = 'flex';
  }

  // 메인 페이지 이동 버튼 이벤트
  function setupMainPageButton() {
    const mainPageBtn = document.getElementById('mainPageBtn');
    if (mainPageBtn) {
      mainPageBtn.addEventListener('click', () => {
        window.location.href = '/index.html';
      });
    }
  }

  // 새로고침 버튼 이벤트
  function setupRefreshButton() {
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        // 페이지에 refreshData 함수가 있으면 호출
        if (typeof window.refreshData === 'function') {
          window.refreshData();
        } else {
          // 없으면 페이지 새로고침
          window.location.reload();
        }
      });
    }
  }

  // 로그인 버튼 이벤트
  function setupLoginButton() {
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        const currentUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login.html?redirect=${currentUrl}`;
      });
    }
  }

  // 로그아웃 버튼 이벤트
  function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        if (!confirm('로그아웃 하시겠습니까?')) return;
        
        try {
          if (window.supabase) {
            await window.supabase.auth.signOut();
          }
          
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('userData');
          
          alert('로그아웃 되었습니다.');
          window.location.href = '/login.html';
        } catch (error) {
          console.error('로그아웃 오류:', error);
          alert('로그아웃 중 오류가 발생했습니다.');
        }
      });
    }
  }

  // DOM 로드 후 헤더 삽입
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // 기존 헤더 제거 (중복 방지)
    const existingHeader = document.getElementById('adminHeader');
    if (existingHeader) {
      existingHeader.remove();
    }

    // main.admin-main 요소 찾기
    let mainContent = document.querySelector('main.admin-main, .admin-main, main');
    
    if (!mainContent) {
      // main 요소가 없으면 생성
      mainContent = document.createElement('main');
      mainContent.className = 'admin-main';
      
      // body의 모든 자식을 main으로 이동 (sidebar 제외)
      const children = Array.from(document.body.children);
      children.forEach(child => {
        if (!child.id || child.id !== 'adminSidebar') {
          mainContent.appendChild(child);
        }
      });
      
      document.body.appendChild(mainContent);
    }

    // main의 첫 번째 자식으로 헤더 삽입
    const header = createHeader();
    mainContent.insertBefore(header, mainContent.firstChild);

    // 이벤트 설정
    setupMainPageButton();
    setupRefreshButton();
    setupLoginButton();
    setupLogoutButton();

    // 사용자 정보 로드 (비동기)
    setTimeout(loadUserInfo, 100);

    console.log('✅ Admin Header loaded');
  }

})();

