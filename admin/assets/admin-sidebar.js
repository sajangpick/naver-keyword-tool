// ============================================
// 어드민 사이드바 공통 컴포넌트
// ============================================
// 모든 어드민 페이지에서 자동으로 사이드바를 생성합니다.
// 현재 페이지에 따라 자동으로 활성화 상태를 표시합니다.

(function() {
  'use strict';

  // 메뉴 구성
  const MENU_ITEMS = [
    {
      icon: '📊',
      title: '대시보드',
      path: '/admin/pages/dashboard.html',
      badge: null
    },
    {
      section: '모니터링'
    },
    {
      icon: '📈',
      title: '분석',
      path: '/admin/analytics.html',
      badge: null
    },
    {
      icon: '⚡',
      title: '성능',
      path: '/admin/performance.html',
      badge: null
    },
    {
      icon: '🐛',
      title: '에러',
      path: '/admin/errors.html',
      badge: null
    },
    {
      section: '관리'
    },
    {
      icon: '👥',
      title: '회원 관리',
      path: '/admin/member-management.html',
      badge: null
    },
    {
      icon: '🔔',
      title: '리뷰 모니터링',
      path: '/admin/review-monitoring.html',
      badge: null
    },
    {
      icon: '📊',
      title: '순위 리포트',
      path: '/admin/rank-report.html',
      badge: null
    },
    {
      icon: '📰',
      title: '뉴스 관리',
      path: '/admin/news-management.html',
      badge: null
    },
    {
      section: '구독 및 청구'
    },
    {
      icon: '💰',
      title: '가격 설정',
      path: '/admin/pages/subscription-settings.html',
      badge: null
    },
    {
      icon: '🎁',
      title: '토큰 설정',
      path: '/admin/pages/subscription-settings.html',
      badge: null
    },
    {
      icon: '📊',
      title: '토큰 대시보드',
      path: '/admin/pages/token-dashboard.html',
      badge: 'NEW'
    },
    {
      icon: '⚙️',
      title: '회원 맞춤 설정',
      path: '/admin/pages/member-subscription-customization.html',
      badge: null
    },
    {
      section: '기타'
    },
    {
      icon: '🗄️',
      title: 'DB 뷰어',
      path: '/admin/db-view.html',
      badge: null
    }
  ];

  // 현재 페이지 경로
  const currentPath = window.location.pathname;

  // 사이드바 HTML 생성
  function createSidebar() {
    const sidebar = document.createElement('div');
    sidebar.className = 'admin-sidebar';
    sidebar.id = 'adminSidebar';

    let html = `
      <div class="sidebar-header">
        <a href="/" class="logo-link">
          <div class="logo">
            <span class="logo-icon">🎯</span>
            <span class="logo-text">사장픽</span>
          </div>
        </a>
        <div class="admin-badge">관리자</div>
      </div>

      <nav class="sidebar-nav">
    `;

    // 메뉴 아이템 생성
    MENU_ITEMS.forEach(item => {
      if (item.section) {
        // 섹션 제목
        html += `<div class="nav-section">${item.section}</div>`;
      } else {
        // 메뉴 아이템
        const isActive = currentPath === item.path || 
                        (item.path === '/admin/pages/dashboard.html' && currentPath === '/admin/' || currentPath === '/admin/index.html');
        
        html += `
          <a href="${item.path}" class="nav-item ${isActive ? 'active' : ''}">
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-title">${item.title}</span>
            ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
          </a>
        `;
      }
    });

    html += `
      </nav>

      <div class="sidebar-footer">
        <a href="/" class="footer-link">
          <span class="footer-icon">🏠</span>
          <span class="footer-text">메인으로</span>
        </a>
      </div>
    `;

    sidebar.innerHTML = html;
    return sidebar;
  }

  // DOM 로드 후 사이드바 삽입
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // 기존 사이드바 제거 (중복 방지)
    const existingSidebar = document.getElementById('adminSidebar');
    if (existingSidebar) {
      existingSidebar.remove();
    }

    // body의 첫 번째 자식으로 사이드바 삽입
    const sidebar = createSidebar();
    document.body.insertBefore(sidebar, document.body.firstChild);

    // body에 sidebar-active 클래스 추가 (CSS 레이아웃용)
    document.body.classList.add('has-sidebar');

    console.log('✅ Admin Sidebar loaded');
  }

})();

