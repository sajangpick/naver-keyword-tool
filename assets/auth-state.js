(async function () {
  if (window.authState?.supabase) {
    return; // already initialized
  }
  
  // Supabase SDK 로드 대기 (최대 5초)
  let waitCount = 0;
  const maxWait = 50; // 5초 (50 * 100ms)
  while (!window.supabase && waitCount < maxWait) {
    await new Promise(resolve => setTimeout(resolve, 100));
    waitCount++;
  }
  
  if (!window.supabase) {
    console.error("[auth] Supabase SDK가 로드되지 않았습니다. Supabase 스크립트가 먼저 로드되어야 합니다.");
    return;
  }
  
  // createClient 함수가 있는지 확인
  if (typeof window.supabase.createClient !== 'function') {
    console.error("[auth] Supabase SDK의 createClient 함수를 찾을 수 없습니다.");
    return;
  }

  async function resolveSupabaseConfig() {
    // 이미 설정된 값이 있으면 사용
    let url = window.SUPABASE_URL;
    let anonKey = window.SUPABASE_ANON_KEY;

    if (url && anonKey) {
      return { url, anonKey };
    }

    // 로컬 개발 환경 감지
    const isLocalDev = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname === '';

    const endpoints = [];
    
    // 로컬 개발 환경에서는 로컬 Express 서버 우선 시도 (포트 3003)
    if (isLocalDev) {
      // Live Server(5501)를 사용하는 경우 Express 서버(3003) 시도
      endpoints.push("http://127.0.0.1:3003/api/config");
      endpoints.push("http://localhost:3003/api/config");
    } else {
      // 프로덕션 환경에서는 같은 origin의 /api/config 시도
      endpoints.push("/api/config");
    }

    // Render 백엔드 fallback (모든 환경에서 마지막 시도)
    const renderOrigin = window.SUPABASE_CONFIG_FALLBACK_ORIGIN ||
      "https://naver-keyword-tool.onrender.com";
    if (renderOrigin && renderOrigin !== window.location.origin) {
      endpoints.push(`${renderOrigin}/api/config`);
    }

    for (const endpoint of endpoints) {
      let timeoutId = null;
      try {
        console.log("[auth] Supabase config 요청 시도:", endpoint);
        
        // 타임아웃 설정 (5초)
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(endpoint, { 
          credentials: "omit",
          mode: 'cors',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        timeoutId = null;
        
        if (!response.ok) {
          console.warn("[auth] Supabase config 요청 실패:", endpoint, response.status);
          continue;
        }

        let config;
        try {
          config = await response.clone().json();
        } catch (parseError) {
          const text = await response.text().catch(() => "");
          console.warn("[auth] JSON 파싱 실패:", text?.slice(0, 120));
          continue;
        }

        if (config?.supabaseUrl && config?.supabaseAnonKey) {
          console.log("[auth] ✅ Supabase config 로드 성공:", endpoint);
          return {
            url: config.supabaseUrl,
            anonKey: config.supabaseAnonKey,
            source: endpoint,
          };
        } else {
          console.warn("[auth] Supabase config에 필수 값이 없습니다:", config);
        }
      } catch (error) {
        // 타임아웃 정리
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // 네트워크 오류는 조용히 넘어가고 다음 엔드포인트 시도
        if (error.name === 'AbortError') {
          console.warn("[auth] 요청 타임아웃:", endpoint);
        } else if (error.message && (error.message.includes('CORS') || error.message.includes('Failed to fetch'))) {
          console.warn("[auth] 네트워크 오류 (다음 엔드포인트 시도):", endpoint);
        } else {
          console.error("[auth] Supabase config 가져오기 오류:", endpoint, error.message);
        }
      }
    }

    // 모든 엔드포인트 실패 시 명확한 에러 메시지
    let errorMsg = "";
    
    if (isLocalDev) {
      const currentPort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
      const isLiveServer = currentPort === '5501' || currentPort === '5500' || currentPort === '';
      
      if (isLiveServer) {
        errorMsg = "⚠️ Live Server를 사용 중입니다.\n\n" +
          "Express 서버를 실행해야 합니다:\n" +
          "1. 터미널을 열고 프로젝트 폴더로 이동\n" +
          "2. 'node server.js' 실행\n" +
          "3. 브라우저에서 http://localhost:3003/login.html 접속\n\n" +
          "또는 login.html 파일의 주석을 해제하고 환경변수를 직접 설정하세요.";
      } else {
        errorMsg = "Supabase 환경변수를 가져오지 못했습니다.\n\n" +
          "Express 서버가 실행 중인지 확인하세요:\n" +
          "- 터미널에서 'node server.js' 실행\n" +
          "- http://localhost:3003/login.html 접속";
      }
    } else {
      errorMsg = "Supabase 환경변수를 가져오지 못했습니다. 서버가 실행 중인지 확인하거나 환경변수가 설정되어 있는지 확인해주세요.";
    }
    
    console.error("[auth] ❌", errorMsg);
    // alert 제거 - 사용자 경험을 위해 조용히 실패 처리
    // 프로덕션 환경에서는 fallback을 사용하거나 조용히 실패
    return null; // 에러 발생 시 null 반환
  }

  let SUPABASE_URL = null;
  let SUPABASE_ANON_KEY = null;
  try {
    const config = await resolveSupabaseConfig();
    if (!config) {
      console.error("[auth] Supabase config를 가져오지 못했습니다.");
      return;
    }
    SUPABASE_URL = config.url;
    SUPABASE_ANON_KEY = config.anonKey;
    if (config.source) {
      console.info("[auth] Supabase config loaded from", config.source);
    }
  } catch (error) {
    console.error("[auth] 환경변수를 가져오는데 실패했습니다:", error);
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[auth] Supabase 환경변수가 설정되지 않았습니다.");
    return;
  }

  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  // Supabase SDK의 createClient 함수 사용
  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY || ""
  );
  
  // window.supabase가 SDK 객체가 아닌 경우를 대비한 처리
  if (!supabaseClient || typeof supabaseClient.auth !== 'object') {
    console.error("[auth] Supabase 클라이언트 생성 실패");
    return;
  }

  const STORAGE_KEYS = {
    status: "isLoggedIn",
    data: "userData",
  };

  function persistSession(session) {
    if (!session?.user) return;
    const user = session.user;
    const userData = {
      id: user.id || "",
      email: user.email || "",
      displayName:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email ||
        "",
      photoURL: user.user_metadata?.avatar_url || "",
      provider: user.app_metadata?.provider || "kakao",
      loginTime: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEYS.data, JSON.stringify(userData));
      localStorage.setItem(STORAGE_KEYS.status, "true");
      console.log("[auth] ✅ 세션 저장 완료:", { email: userData.email, id: userData.id });
    } catch (error) {
      console.warn("[auth] Failed to persist session", error);
    }
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.data);
    localStorage.removeItem(STORAGE_KEYS.status);
  }

  async function syncSession() {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      console.log("[auth] 세션 동기화:", { hasSession: !!session });
      if (session) {
        persistSession(session);
      } else {
        clearSession();
      }
      window.dispatchEvent(new CustomEvent("auth:state-changed"));
      return session;
    } catch (error) {
      console.error("[auth] Session sync failed", error);
      return null;
    }
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN") {
      persistSession(session);
    } else if (event === "SIGNED_OUT") {
      clearSession();
    }
    window.dispatchEvent(new CustomEvent("auth:state-changed"));
  });

  async function signOut() {
    try {
      await supabaseClient.auth.signOut();
    } catch (error) {
      console.error("[auth] Sign-out failed", error);
    } finally {
      clearSession();
      window.dispatchEvent(new CustomEvent("auth:state-changed"));
    }
  }

  window.authState = {
    supabase: supabaseClient,
    syncSession,
    signOut,
  };

  syncSession();
})();
