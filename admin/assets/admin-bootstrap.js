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
    ready: initSupabaseClient
  };

  initSupabaseClient().catch(error => {
    console.error('AdminBootstrap 초기화 실패:', error);
  });

  console.log('✅ Admin Bootstrap loaded');
})();

