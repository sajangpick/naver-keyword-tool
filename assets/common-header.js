// Common Header Injector - makes header consistent across all pages
(function () {
  // global guard to prevent double injection even if script is loaded twice
  if (window.__COMMON_HEADER_INJECTED__) return;
  if (document.querySelector(".header")) return; // already present
  window.__COMMON_HEADER_INJECTED__ = true;

  // ensure Font Awesome is loaded (icons fallback)
  (function ensureFA() {
    const href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css";
    const hasFA = Array.from(document.styleSheets || []).some((s) => {
      try {
        return s.href && s.href.includes("font-awesome");
      } catch (_) {
        return false;
      }
    });
    if (!hasFA && !document.getElementById("fa-cdn")) {
      const link = document.createElement("link");
      link.id = "fa-cdn";
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
  })();

  const css = `
  :root{--naver-green:#03c75a;--naver-green-dark:#02b14f;--bg:#f7f9fb}
  .header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.8);backdrop-filter:blur(8px);border-bottom:1px solid #e5e7eb}
  .header-inner{display:flex;align-items:center;justify-content:center;gap:16px;padding:14px 24px;max-width:1200px;margin:0 auto}
  .logo{font-weight:800;font-size:24px;color:#111827;cursor:pointer}
  .top-search{background:#fff;border-bottom:1px solid #e5e7eb}
  .top-search .container{max-width:1200px;margin:0 auto;padding:6px 24px 12px 24px}
  .ns-box{display:flex;align-items:center;gap:10px;padding:8px 14px;border:2px solid var(--naver-green);border-radius:999px;background:#fff;box-shadow:0 8px 20px rgba(3,199,90,.08)}
  .ns-logo{height:32px;display:inline-flex;align-items:center;gap:6px;font-weight:900}
  .ns-logo-text{font-size:18px;color:#111827}
  .ns-input{flex:1;border:none;outline:none;font-size:18px;padding:6px 4px;background:transparent}
  .ns-btn{width:40px;height:40px;border:none;border-radius:999px;background:var(--naver-green);color:#fff;cursor:pointer}
  .ns-btn:hover{background:var(--naver-green-dark)}
  .top-actions-row{position:relative;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}
  .top-apps{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;padding:12px 4px 6px 4px}
  .top-apps a.app{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:64px;text-decoration:none;color:#374151}
  .app-icon{width:44px;height:44px;border-radius:12px;background:#fff;border:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(0,0,0,.06);color:var(--naver-green);font-size:18px}
  .app-label{font-size:14px;color:#374151}
  .top-apps a.app:hover .app-icon{border-color:var(--naver-green);transform:translateY(-2px);transition:all .2s ease}
  .auth-buttons{position:absolute;right:0;top:0;bottom:0;margin:auto 0;display:flex;flex-direction:column;gap:8px;align-items:stretch;justify-content:center}
  .login-link{display:inline-flex;align-items:center;justify-content:center;width:200px;height:48px;padding:0 16px;border-radius:6px;background:var(--naver-green);color:#fff;font-weight:800;font-size:15px;border:none;text-decoration:none}
  .kakao-signup{display:inline-flex;align-items:center;justify-content:center;width:200px;height:48px;background:transparent;color:#6b7280;font-weight:800;font-size:15px;border-radius:6px;text-decoration:underline;text-underline-offset:3px}
  @media (max-width:768px){.auth-buttons{position:static;width:100%;align-items:center}.top-actions-row{flex-direction:column}.top-actions-row .top-apps{display:flex !important;flex-wrap:nowrap !important;gap:12px;overflow-x:auto !important;-webkit-overflow-scrolling:touch;padding:8px 12px 10px 12px;scroll-snap-type:x proximity;justify-content:flex-start !important}.top-actions-row .top-apps a.app{flex:0 0 calc((100% - 48px)/5) !important;scroll-snap-align:start}.top-actions-row .top-apps::-webkit-scrollbar{display:none}}
  `;

  // inject style only once
  let style = document.getElementById("common-header-style");
  if (!style) {
    style = document.createElement("style");
    style.id = "common-header-style";
    style.textContent = css;
    document.head.appendChild(style);
  }

  const headerHtml = `
  <header class="header">
    <div class="header-inner"><div class="logo" onclick="location.href='/'">사장픽</div></div>
    <section class="top-search">
      <div class="container top-row">
        <form id="topNaverChatForm" class="ns-box">
          <div class="ns-logo" aria-label="GPT-5"><span class="ns-logo-text">GPT-5</span></div>
          <input id="topNaverChatInput" class="ns-input" type="text" placeholder="무엇이든 물어보세요. 예) 손님 불만 리뷰에 공손한 답변 작성" autocomplete="off" />
          <button type="submit" id="topNaverChatSubmit" class="ns-btn" aria-label="검색"><i class="fa-solid fa-magnifying-glass"></i></button>
        </form>
        <div class="top-actions-row top-actions">
          <div class="top-apps" style="padding:0">
            <a class="app" href="/ChatGPT.html"><div class="app-icon"><i class="fa-solid fa-comments" style="font-size:20px"></i></div><div class="app-label">채팅</div></a>
            <a class="app" href="/review.html"><div class="app-icon"><i class="fa-solid fa-pen-nib" style="font-size:20px"></i></div><div class="app-label">리뷰작성</div></a>
            <a class="app" href="/Blog-Editor.html"><div class="app-icon"><i class="fa-solid fa-blog" style="font-size:20px"></i></div><div class="app-label">블로그</div></a>
            <a class="app" href="/naver_search.html"><div class="app-icon"><i class="fa-solid fa-key" style="font-size:20px"></i></div><div class="app-label">키워드</div></a>
            
          </div>
          <div class="auth-buttons" id="authButtons" style="display:none"></div>
        </div>
        <div id="topChatSearchOutput" class="output" style="display:none"></div>
      </div>
    </section>
  </header>`;

  document.body.insertAdjacentHTML("afterbegin", headerHtml);
  // if any duplicate headers exist for any reason, keep only the first
  const injectedHeaders = document.querySelectorAll("header.header");
  if (injectedHeaders.length > 1) {
    for (let i = 1; i < injectedHeaders.length; i++) {
      injectedHeaders[i].remove();
    }
  }

  // Utilities
  function setLoading(el, isLoading, textWhenLoading = "검색 중...") {
    if (!el) return;
    el.dataset._originalText = el.dataset._originalText || el.textContent;
    el.disabled = !!isLoading;
    if (isLoading) el.textContent = textWhenLoading;
    else el.textContent = el.dataset._originalText;
  }
  async function readJsonSafely(res) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        return await res.json();
      } catch (_) {
        return { error: "JSON 파싱 실패", status: res.status };
      }
    }
    try {
      const t = await res.text();
      return t ? { error: t, status: res.status } : { status: res.status };
    } catch (_) {
      return { error: "응답 본문 읽기 실패", status: res.status };
    }
  }
  function showOutput(el, data) {
    if (!el) return;
    el.classList.remove("error");
    el.style.display = "block";
    el.textContent =
      typeof data === "string" ? data : JSON.stringify(data, null, 2);
  }
  function showError(el, err) {
    if (!el) return;
    el.classList.add("error");
    el.style.display = "block";
    el.textContent = (
      err?.error ||
      err?.message ||
      "오류가 발생했습니다."
    ).toString();
  }

  // Chat search submit
  const form = document.getElementById("topNaverChatForm");
  const input = document.getElementById("topNaverChatInput");
  const submit = document.getElementById("topNaverChatSubmit");
  const out = document.getElementById("topChatSearchOutput");
  const BACKEND_URL = window.BACKEND_URL || ""; // 현재 도메인 기준 상대경로 사용
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = (input?.value || "").trim();
    if (!message) {
      showError(out, { message: "검색어를 입력하세요." });
      return;
    }
    setLoading(submit, true);
    showOutput(out, "");
    try {
      const res = await fetch(`/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await readJsonSafely(res);
      if (!res.ok || data.success === false) throw data;
      showOutput(out, data.reply || data);
    } catch (err) {
      showError(out, err);
    } finally {
      setLoading(submit, false);
    }
  });

  // Login status (same localStorage logic)
  (function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    const userData = localStorage.getItem("userData");
    const container = document.getElementById("authButtons");
    if (!container) return;
    container.style.display = "flex";
    if (isLoggedIn === "true" && userData) {
      try {
        const user = JSON.parse(userData);
        const span = document.createElement("span");
        span.id = "userEmail";
        span.style.marginRight = "10px";
        span.style.fontSize = "14px";
        span.textContent = user.email || user.name || "사용자";
        const logout = document.createElement("button");
        logout.id = "logoutBtn";
        logout.className = "kakao-signup";
        logout.style.border = "none";
        logout.style.cursor = "pointer";
        logout.textContent = "로그아웃";
        logout.addEventListener("click", function () {
          if (confirm("로그아웃 하시겠습니까?")) {
            localStorage.removeItem("isLoggedIn");
            localStorage.removeItem("userData");
            location.href = "index.html";
          }
        });
        container.replaceChildren(span, logout);
      } catch (e) {
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userData");
      }
    } else {
      const login = document.createElement("a");
      login.href = "/login.html";
      login.className = "login-link";
      login.id = "loginBtn";
      login.innerHTML =
        '<span class="emph">사장님픽</span><span class="sub"> 로그인</span>';
      const signup = document.createElement("a");
      signup.href = "/join.html";
      signup.className = "kakao-signup";
      signup.id = "signupBtn";
      signup.textContent = "카카오톡 아이디로 회원가입";
      container.replaceChildren(login, signup);
    }
  })();
})();
