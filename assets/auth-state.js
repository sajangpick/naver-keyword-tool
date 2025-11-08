(async function () {
  if (window.authState?.supabase) {
    return; // already initialized
  }
  if (!window.supabase) {
    console.warn("[auth] Supabase SDK not loaded; auth-state init skipped.");
    return;
  }

  async function resolveSupabaseConfig() {
    let url = window.SUPABASE_URL;
    let anonKey = window.SUPABASE_ANON_KEY;

    if (url && anonKey) {
      return { url, anonKey };
    }

    const endpoints = ["/api/config"];

    // Render 백엔드 직접 호출 (Vercel 프록시 실패 시 대비)
    const renderOrigin = window.SUPABASE_CONFIG_FALLBACK_ORIGIN ||
      "https://naver-keyword-tool.onrender.com";
    if (renderOrigin && renderOrigin !== window.location.origin) {
      endpoints.push(`${renderOrigin}/api/config`);
    }

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { credentials: "omit" });
        if (!response.ok) {
          console.warn("[auth] Supabase config 요청 실패:", endpoint, response.status);
          continue;
        }

        let config;
        try {
          config = await response.clone().json();
        } catch (parseError) {
          const text = await response.text().catch(() => "");
          throw new Error(`JSON 파싱 실패: ${text?.slice(0, 120) || ""}`);
        }

        if (config?.supabaseUrl && config?.supabaseAnonKey) {
          return {
            url: config.supabaseUrl,
            anonKey: config.supabaseAnonKey,
            source: endpoint,
          };
        }
      } catch (error) {
        console.error("[auth] Supabase config 가져오기 오류:", endpoint, error);
      }
    }

    throw new Error("Supabase 환경변수를 가져오지 못했습니다");
  }

  let SUPABASE_URL = null;
  let SUPABASE_ANON_KEY = null;
  try {
    const config = await resolveSupabaseConfig();
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

  const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY || ""
  );

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
