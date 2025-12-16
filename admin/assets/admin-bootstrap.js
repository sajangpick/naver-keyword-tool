(function() {
  'use strict';

  const FALLBACK_CONFIG = {
    supabaseUrl: 'https://ptuzlubgggbgsophfcna.supabase.co',
    supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0dXpsdWJnZ2diZ3NvcGhmY25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MjEzMzQsImV4cCI6MjA3NTk5NzMzNH0.NaMMH7vVpcrFAi9IOQ0o_HF6rQ7dOdiAXAkxu6r84CE'
  };

  let supabasePromise = null;
  let configCache = null;
  let supabaseLib = null;

  function waitForSupabaseLib(timeout = 10000) {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return Promise.resolve(window.supabase);
    }

    return new Promise((resolve, reject) => {
      const start = Date.now();

      const timer = setInterval(() => {
        if (window.supabase && typeof window.supabase.createClient === 'function') {
          clearInterval(timer);
          resolve(window.supabase);
          return;
        }

        if (Date.now() - start > timeout) {
          clearInterval(timer);
          reject(new Error('Supabase 라이브러리를 찾을 수 없습니다. CDN 로딩을 확인하세요.'));
        }
      }, 30);
    });
  }

  async function loadConfig() {
    if (configCache) return configCache;

    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        if (data && data.supabaseUrl && data.supabaseAnonKey) {
          configCache = {
            supabaseUrl: data.supabaseUrl,
            supabaseAnonKey: data.supabaseAnonKey
          };
          return configCache;
        }
      }
    } catch (error) {
      console.warn('Supabase 설정 API 호출 실패:', error);
    }

    configCache = FALLBACK_CONFIG;
    return configCache;
  }

  async function initSupabaseClient() {
    if (supabasePromise) return supabasePromise;

    supabasePromise = (async () => {
      const lib = await waitForSupabaseLib();
      supabaseLib = lib;

      const config = await loadConfig();
      const client = lib.createClient(config.supabaseUrl, config.supabaseAnonKey);

      window.supabaseLib = lib;
      window.supabaseClient = client;
      window.supabase = client;

      if (typeof client.createClient !== 'function') {
        client.createClient = lib.createClient.bind(lib);
      }

      return client;
    })().catch(error => {
      supabasePromise = null;
      throw error;
    });

    return supabasePromise;
  }

  function onReady(callback) {
    if (typeof callback !== 'function') return;

    initSupabaseClient()
      .then(client => {
        try {
          callback(client);
        } catch (error) {
          console.error('AdminBootstrap 콜백 실행 중 오류:', error);
        }
      })
      .catch(error => {
        console.error('AdminBootstrap 초기화 실패:', error);
      });
  }

  window.AdminBootstrap = {
    getSupabaseClient: initSupabaseClient,
    onReady,
    async getConfig() {
      await initSupabaseClient();
      return configCache;
    },
    async getSupabaseLib() {
      await initSupabaseClient();
      return supabaseLib;
    },
    ready: initSupabaseClient,

    // ==================== 권한 관리 함수 ====================
    
    async initializeHeader() {
      // 헤더 초기화 (기존 코드가 있다면 유지)
      const headerEl = document.getElementById('header');
      if (!headerEl || headerEl.children.length > 0) return;
      
      try {
        const response = await fetch('/admin/assets/common-header.js');
        // 헤더는 별도 스크립트에서 로드
      } catch (e) {
        console.log('헤더 로드 안함');
      }
    },

    async initializeSidebar() {
      // 사이드바 초기화 (기존 코드가 있다면 유지)
      const sidebarEl = document.getElementById('sidebar');
      if (!sidebarEl || sidebarEl.children.length > 0) return;
      
      try {
        const response = await fetch('/admin/assets/admin-sidebar.js');
        // 사이드바는 별도 스크립트에서 로드
      } catch (e) {
        console.log('사이드바 로드 안함');
      }
    },

    // 현재 사용자의 권한 정보 가져오기
    async getCurrentUserPermissions() {
      try {
        const supabase = await initSupabaseClient();
        
        // 로그인한 사용자 정보 조회
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        // profiles 테이블에서 사용자 정보 조회
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('kakao_id', user.user_metadata?.kakao_id || user.id)
          .single();

        if (!profile) return null;

        // 일반 관리자인 경우 권한 조회 (role 컬럼이 있을 때만)
        if (profile.user_type === 'admin' && profile.role === 'general') {
          const permResponse = await fetch(`/api/admin/permissions/${profile.id}`);
          const permData = await permResponse.json();
          
          return {
            userId: profile.id,
            userType: profile.user_type,
            role: profile.role || null,
            permissions: permData.permissions?.permissions || {}
          };
        }

        // 오너 관리자는 모든 권한 보유 (role 컬럼이 있을 때만)
        if (profile.user_type === 'admin' && profile.role === 'owner') {
          return {
            userId: profile.id,
            userType: profile.user_type,
            role: profile.role || null,
            permissions: {} // 모든 권한 허용
          };
        }

        // 매니저인 경우 역할 조회
        if (profile.user_type === 'manager') {
          const roleResponse = await fetch(`/api/admin/manager-roles/${profile.id}`);
          const roleData = await roleResponse.json();
          
          return {
            userId: profile.id,
            userType: profile.user_type,
            role: profile.role || null,
            managerRole: roleData.role?.manager_role || 'general',
            permissions: roleData.role?.permissions || {}
          };
        }

        return {
          userId: profile.id,
          userType: profile.user_type,
          role: profile.role || null
        };
      } catch (error) {
        console.error('권한 조회 실패:', error);
        return null;
      }
    },

    // 권한 확인 함수
    checkPermission(permissions, featureKey) {
      // 권한이 명시적으로 false면 불가
      if (permissions[featureKey] === false) {
        return false;
      }
      // 그 외는 허용
      return true;
    },

    // 버튼 활성화/비활성화
    applyPermissionToElement(element, featureKey, permissions) {
      if (!element) return;

      const allowed = this.checkPermission(permissions, featureKey);
      
      if (allowed) {
        element.classList.remove('disabled');
        element.disabled = false;
        element.title = '';
      } else {
        element.classList.add('disabled');
        element.disabled = true;
        element.title = '접근 권한이 없습니다';
        element.style.opacity = '0.5';
        element.style.cursor = 'not-allowed';
      }
    }
  };

  initSupabaseClient().catch(error => {
    console.error('AdminBootstrap 초기화 실패:', error);
  });

  console.log('✅ Admin Bootstrap loaded');
})();

