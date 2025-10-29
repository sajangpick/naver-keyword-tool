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
  :root{--naver-green:#03c75a;--naver-green-dark:#02b14f;--naver-green-50:#e6f9f0;--bg:#f7f9fb}
  .header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.8);backdrop-filter:blur(8px);border-bottom:1px solid #e5e7eb;transition:transform .3s ease}
  .header.header-hidden{transform:translateY(-100%)}
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
  .auth-buttons{position:absolute;right:0;top:0;bottom:0;margin:auto 0;display:flex;align-items:center;gap:12px}
  .auth-user{display:none;align-items:center;gap:12px;padding:6px 12px;border-radius:999px;border:1px solid rgba(17,24,39,.08);background:rgba(255,255,255,.95);box-shadow:0 16px 28px rgba(15,23,42,.08)}
  .auth-user__avatar{width:36px;height:36px;border-radius:50%;background:var(--naver-green-50);color:var(--naver-green);font-weight:800;display:flex;align-items:center;justify-content:center;letter-spacing:-.02em;text-transform:uppercase}
  .auth-user__meta{display:flex;flex-direction:column;line-height:1.1}
  .auth-user__label{font-size:11px;font-weight:600;color:#9ca3af;letter-spacing:.08em;text-transform:uppercase}
  .auth-user__email{font-size:14px;font-weight:600;color:#1f2937;cursor:pointer;transition:color .2s ease}.auth-user__email:hover{color:var(--naver-green)}
  .auth-user__logout{height:32px;padding:0 14px;border-radius:999px;border:1px solid rgba(17,24,39,.08);background:#fff;color:#374151;font-weight:600;cursor:pointer;transition:all .2s ease;display:inline-flex;align-items:center;justify-content:center;gap:6px}
  .auth-user__logout:hover{background:#f3f4f6;border-color:rgba(17,24,39,.15)}
  .auth-btn{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 18px;border-radius:999px;font-weight:700;font-size:14px;gap:8px;border:1px solid transparent;text-decoration:none;cursor:pointer;transition:all .2s ease}
  .auth-btn--primary{background:var(--naver-green);color:#fff;box-shadow:0 12px 24px rgba(3,199,90,.25)}
  .auth-btn--primary:hover{background:var(--naver-green-dark)}
  .auth-btn--ghost{background:rgba(3,199,90,.12);color:var(--naver-green)}
  .auth-btn--ghost:hover{background:rgba(3,199,90,.18)}
  @media (max-width:768px){.top-actions-row{flex-direction:column;align-items:stretch}.top-actions-row .top-apps{display:flex !important;flex-wrap:nowrap !important;gap:12px;overflow-x:auto !important;-webkit-overflow-scrolling:touch;padding:8px 12px 10px 12px;scroll-snap-type:x proximity;justify-content:flex-start !important}.top-actions-row .top-apps a.app{flex:0 0 calc((100% - 48px)/5) !important;scroll-snap-align:start}.top-actions-row .top-apps::-webkit-scrollbar{display:none}.auth-buttons{position:static;width:100%;flex-direction:column;align-items:stretch;gap:10px}.auth-user{width:100%;justify-content:space-between;padding:10px 16px}.auth-user__logout{height:36px}.auth-btn{width:100%}}
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
            <a class="app" href="/naver_search.html"><div class="app-icon"><i class="fa-solid fa-key" style="font-size:20px"></i></div><div class="app-label">키워드</div></a>
            <a class="app" href="/review.html"><div class="app-icon"><i class="fa-solid fa-pen-nib" style="font-size:20px"></i></div><div class="app-label">리뷰작성</div></a>
            <a class="app" href="/Blog-Editor.html"><div class="app-icon"><i class="fa-solid fa-blog" style="font-size:20px"></i></div><div class="app-label">블로그</div></a>
            <a class="app" href="/ChatGPT.html"><div class="app-icon"><i class="fa-solid fa-comments" style="font-size:20px"></i></div><div class="app-label">채팅</div></a>
          </div>
          <div class="auth-buttons" id="authButtons">
            <div class="auth-user" id="authUser" style="display:none;">
              <div class="auth-user__avatar" id="userAvatar">U</div>
              <div class="auth-user__meta">
                <span class="auth-user__label">내 정보</span>
                <span class="auth-user__email" id="userEmail"></span>
              </div>
            </div>
            <a href="/login.html" class="auth-btn auth-btn--primary" id="loginBtn">
              <i class="fa-solid fa-arrow-right-to-bracket"></i>
              <span>로그인</span>
            </a>
            <a href="/join.html" class="auth-btn auth-btn--ghost" id="signupBtn">
              <i class="fa-solid fa-user-plus"></i>
              <span>회원가입</span>
            </a>
          </div>
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

  const loginBtn = document.getElementById("loginBtn");
  const signupBtn = document.getElementById("signupBtn");
  const authUser = document.getElementById("authUser");
  const userEmailSpan = document.getElementById("userEmail");
  const userAvatar = document.getElementById("userAvatar");

  function updateAuthUI() {
    const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
    const rawUser = localStorage.getItem("userData");
    
    console.log('[Header Auth] 로그인 상태 체크:', { isLoggedIn, hasUserData: !!rawUser });

    if (isLoggedIn && rawUser) {
      try {
        const user = JSON.parse(rawUser);
        console.log('[Header Auth] 사용자 정보:', { email: user.email, id: user.id });
        
        if (loginBtn) loginBtn.style.display = "none";
        if (signupBtn) signupBtn.style.display = "none";
        if (authUser) authUser.style.display = "flex";

        if (userEmailSpan) {
          userEmailSpan.textContent = "마이페이지";
          userEmailSpan.title = "클릭하여 마이페이지로 이동";
          // 마이페이지 클릭 시 이동
          userEmailSpan.style.cursor = 'pointer';
          userEmailSpan.onclick = function() {
            location.href = '/mypage.html';
          };
        }
        if (userAvatar) {
          const base =
            user.displayName ||
            user.user_metadata?.full_name ||
            user.email ||
            "U";
          userAvatar.textContent = (base.trim()[0] || "U").toUpperCase();
        }
      } catch (error) {
        console.error("[auth] failed to parse userData", error);
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("userData");
        updateAuthUI();
        return;
      }
    } else {
      if (authUser) authUser.style.display = "none";
      if (loginBtn) loginBtn.style.display = "inline-flex";
      if (signupBtn) signupBtn.style.display = "inline-flex";
      if (userEmailSpan) {
        userEmailSpan.textContent = "";
        userEmailSpan.title = "";
      }
    }
  }

  updateAuthUI();
  window.addEventListener("auth:state-changed", updateAuthUI);

  // 모바일에서 스크롤 시 헤더 숨김/표시 (kmong 스타일)
  (function initHeaderAutoHide() {
    const header = document.querySelector('.header');
    if (!header) return;

    let lastScrollY = window.scrollY;
    let ticking = false;

    function updateHeader() {
      const currentScrollY = window.scrollY;
      
      // 모바일에서만 작동 (768px 이하)
      if (window.innerWidth > 768) {
        header.classList.remove('header-hidden');
        return;
      }

      // 최상단(100px 미만)이면 항상 헤더 표시
      if (currentScrollY < 100) {
        header.classList.remove('header-hidden');
      }
      // 아래로 스크롤 && 100px 이상
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        header.classList.add('header-hidden');
      }
      // 위로 스크롤
      else if (currentScrollY < lastScrollY) {
        header.classList.remove('header-hidden');
      }

      lastScrollY = currentScrollY;
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(updateHeader);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateHeader, { passive: true });
  })();
})();
