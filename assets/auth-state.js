(function () {
  if (window.authState?.supabase) {
    return; // already initialized
  }
  if (!window.supabase) {
    console.warn("[auth] Supabase SDK not loaded; auth-state init skipped.");
    return;
  }

  const SUPABASE_URL =
    window.SUPABASE_URL || "https://ptuzlubgggbgsophfcna.supabase.co";
  const SUPABASE_ANON_KEY =
    window.SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0dXpsdWJnZ2diZ3NvcGhmY25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MjEzMzQsImV4cCI6MjA3NTk5NzMzNH0.NaMMH7vVpcrFAi9IOQ0o_HF6rQ7dOdiAXAkxu6r84CE";

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
