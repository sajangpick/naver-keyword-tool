(async function () {
  if (window.authState?.supabase) {
    return; // already initialized
  }
  if (!window.supabase) {
    console.warn("[auth] Supabase SDK not loaded; auth-state init skipped.");
    return;
  }

  // ✅ 보안: 서버 API에서 환경변수를 안전하게 가져옵니다
  let SUPABASE_URL = window.SUPABASE_URL;
  let SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

  // window에 설정되지 않았으면 서버에서 가져오기
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    try {
      const response = await fetch('/api/config');
      const config = await response.json();
      SUPABASE_URL = config.supabaseUrl;
      SUPABASE_ANON_KEY = config.supabaseAnonKey;
    } catch (error) {
      console.error("[auth] 환경변수를 가져오는데 실패했습니다:", error);
      return;
    }
  }

  // 환경변수가 여전히 없으면 에러
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[auth] Supabase 환경변수가 설정되지 않았습니다.");
    return;
  }

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
