require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");
const helmet = require("helmet");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.set("trust proxy", true);

// 환경변수에서 설정 읽기 (Render/Vercel/로컬 모두 호환)
// PORT가 지정되어 있으면 해당 포트 사용, 없으면 3000 사용
const PORT = Number(process.env.PORT) || 3000;

// 네이버 API 설정
const NAVER_API = {
  baseUrl: "https://api.searchad.naver.com",
  customerId: process.env.NAVER_CUSTOMER_ID,
  apiKey: process.env.NAVER_API_KEY,
  secretKey: process.env.NAVER_SECRET_KEY,
};

// 네이버 검색 API 설정 (Local 검색용)
const NAVER_SEARCH = {
  clientId: process.env.NAVER_SEARCH_CLIENT_ID,
  clientSecret: process.env.NAVER_SEARCH_CLIENT_SECRET,
};

// AI API 키 설정
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

// Supabase 설정
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

// Supabase 클라이언트 초기화
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    console.log("✅ Supabase 클라이언트 초기화 성공");
  } catch (error) {
    console.error("❌ Supabase 클라이언트 초기화 실패:", error.message);
  }
} else {
  console.warn("⚠️ Supabase 환경변수가 설정되지 않았습니다. DB 저장 기능이 비활성화됩니다.");
}
// Kakao OAuth 설정
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI;
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET || "";
// JWT 설정
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.JWT_SECRET) {
  console.warn(
    "[SECURITY] JWT_SECRET is not set. Using a random secret for this process only."
  );
}
// Feature flags
const FEATURE_API_READ_NEXT =
  (process.env.FEATURE_API_READ_NEXT || "false") === "true";
const FEATURE_API_CHAT_NEXT =
  (process.env.FEATURE_API_CHAT_NEXT || "false") === "true";
const FEATURE_AUTH_NEXT = (process.env.FEATURE_AUTH_NEXT || "false") === "true";

// CORS 설정 (다중 도메인/CSV 지원)
const RAW_CORS = process.env.CORS_ORIGIN || "*";
const ALLOWED_ORIGINS = RAW_CORS.split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOW_ALL = ALLOWED_ORIGINS.includes("*");
const corsOptions = {
  origin: (origin, callback) => {
    // 개발 환경에서는 모든 origin 허용
    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }
    // Production 환경
    if (!origin) return callback(null, true); // Non-browser / same-origin fallback
    if (ALLOW_ALL) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: !ALLOW_ALL,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// 미들웨어 설정
app.use(cors(corsOptions));
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "*")
) {
  console.warn(
    "[SECURITY] In production, CORS_ORIGIN is not set or is '*'. Set it to your exact domain to prevent unwanted origins."
  );
}
// 개발 환경에서는 helmet CSP 비활성화
if (process.env.NODE_ENV === "production") {
  app.use(helmet({ crossOriginEmbedderPolicy: false }));
} else {
  app.use(helmet({ 
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false // 개발 환경에서 CSP 완전 비활성화
  }));
}
// Referrer-Policy 강화
app.use(helmet.referrerPolicy({ policy: "strict-origin-when-cross-origin" }));
// Permissions-Policy 최소 허용 (필요 기능만 허용)
app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "accelerometer=()",
      "autoplay=()",
      "usb=()",
    ].join(", ")
  );
  next();
});
// HSTS in production (assumes TLS termination in front proxy)
if (process.env.NODE_ENV === "production") {
  app.use(
    helmet.hsts({
      maxAge: 15552000, // 180 days
      includeSubDomains: true,
      preload: false,
    })
  );
}
// CSP in Report-Only mode to observe violations without breaking existing pages
const CSP_ENFORCE = (process.env.CSP_ENFORCE || "false") === "true";
// CSP 개발 환경에서는 비활성화 (production에서만 활성화)
if (process.env.NODE_ENV === "production") {
  app.use(
    helmet.contentSecurityPolicy({
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https:", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        reportUri: ["/csp-report"],
      },
      reportOnly: !CSP_ENFORCE,
    })
  );
} else {
  // 개발 환경에서는 CSP 비활성화
  console.log("[DEV] Content Security Policy disabled for development");
}
// Request ID & timing
app.use((req, res, next) => {
  const reqId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString("hex");
  const start = Date.now();
  res.setHeader("x-request-id", reqId);
  req.requestId = reqId;
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    console.log(
      `${new Date().toISOString()} - ${req.method} ${req.path} - ${
        res.statusCode
      } - ${durationMs}ms - reqId:${reqId}`
    );
  });
  next();
});
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CSP report collection endpoint
app.post(
  "/csp-report",
  express.json({ type: ["application/csp-report", "application/json"] }),
  (req, res) => {
    try {
      console.warn("CSP Report:", JSON.stringify(req.body));
    } catch (e) {
      console.warn("CSP Report (raw):", req.body);
    }
    res.status(204).end();
  }
);
// Limit CSP report spam
app.use("/csp-report", rateLimiter);

// 정적 파일 제공 (안전한 디렉터리만 공개)
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// 주요 HTML 라우트 화이트리스트 서빙
function sendHtml(res, file) {
  res.sendFile(path.join(__dirname, file));
}

app.get(["/index.html"], (req, res) => sendHtml(res, "index.html"));
app.get("/login.html", (req, res) => sendHtml(res, "login.html"));
app.get("/join.html", (req, res) => sendHtml(res, "join.html"));
app.get("/naver_search.html", (req, res) => sendHtml(res, "naver_search.html"));
// 플점검은 일반 화면에서 노출/접근 불가 (홈으로 리다이렉트)
app.get("/place-check.html", (req, res) => res.redirect("/"));
app.get("/ChatGPT.html", (req, res) => sendHtml(res, "ChatGPT.html"));
app.get("/AI-Review.html", (req, res) => sendHtml(res, "AI-Review.html"));
app.get("/Blog-Editor.html", (req, res) => sendHtml(res, "Blog-Editor.html"));
app.get("/mypage.html", (req, res) => sendHtml(res, "mypage.html"));
// 플순위는 어드민 전용으로만 접근 허용 (일반 경로는 홈으로 리다이렉트)
app.get("/rank-report.html", (req, res) => res.redirect("/"));
app.get("/admin/rank-report.html", (req, res) => sendHtml(res, "admin/rank-report.html"));
// Supabase 테스트 페이지
app.get("/supabase-test.html", (req, res) => sendHtml(res, "supabase-test.html"));
// 리뷰 페이지
app.get("/review.html", (req, res) => sendHtml(res, "review.html"));

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15분
const RATE_LIMIT_MAX = 100; // 최대 100 요청

function rateLimiter(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  const now = Date.now();

  if (!requestCounts.has(clientIP)) {
    requestCounts.set(clientIP, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    });
    return next();
  }

  const clientData = requestCounts.get(clientIP);

  if (now > clientData.resetTime) {
    clientData.count = 1;
    clientData.resetTime = now + RATE_LIMIT_WINDOW;
    return next();
  }

  if (clientData.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({
      error: "요청 한도를 초과했습니다. 15분 후 다시 시도해주세요.",
    });
  }

  clientData.count++;
  next();
}

app.use("/api/", rateLimiter);
app.use("/auth/", rateLimiter);
// Periodic cleanup for rate limiter map (memory hygiene)
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of requestCounts.entries()) {
    if (now > data.resetTime) requestCounts.delete(ip);
  }
}, 5 * 60 * 1000);

// 로깅 미들웨어(요약, IP만 기록)
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  console.log(`IP: ${ip} - reqId:${req.requestId}`);
  next();
});

// ==================== 유틸리티 함수들 ====================

// 네이버 API 서명 생성 함수
function generateSignature(timestamp, method, uri, secretKey) {
  const message = `${timestamp}.${method}.${uri}`;
  const hmac = crypto.createHmac("sha256", secretKey);
  hmac.update(message);
  return hmac.digest("base64");
}

// Basic input validation helpers
function isNonEmptyString(value, maxLen = 2000) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLen
  );
}

function sanitizeString(value) {
  if (typeof value !== "string") return "";
  // Remove control characters except common whitespace
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
}

// ===== JWT helpers (HS256) =====
function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload, expiresInSeconds) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + expiresInSeconds, ...payload };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${data}.${signature}`;
}

function verifyJwt(token) {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !signature) return null;
    const data = `${encodedHeader}.${encodedPayload}`;
    const expected = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(data)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    if (expected !== signature) return null;
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64").toString("utf8")
    );
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && now > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function getCookies(req) {
  const raw = req.headers.cookie || "";
  if (!raw) return {};
  return Object.fromEntries(
    raw
      .split(/;\s*/)
      .filter(Boolean)
      .map((kv) => {
        const idx = kv.indexOf("=");
        return [
          kv.substring(0, idx),
          decodeURIComponent(kv.substring(idx + 1)),
        ];
      })
  );
}

function setSessionCookie(res, token, maxAgeSec) {
  const isProd = process.env.NODE_ENV === "production";
  const cookieFlags = `HttpOnly; Path=/; SameSite=Lax${
    isProd ? "; Secure" : ""
  }; Max-Age=${maxAgeSec}`;
  const existing = res.getHeader("Set-Cookie");
  const cookies = Array.isArray(existing)
    ? existing
    : existing
    ? [existing]
    : [];
  cookies.push(`session=${token}; ${cookieFlags}`);
  res.setHeader("Set-Cookie", cookies);
}

// 월별 트렌드 데이터 생성 함수 (실제 API 데이터 기반 시뮬레이션)
function generateTrendDataBasedOnCurrent(
  currentPcCount,
  currentMobileCount,
  keyword
) {
  const monthlyData = [];
  const currentDate = new Date();

  // 키워드 특성에 따른 계절성 패턴 적용
  const seasonalPatterns = getSeasonalPattern(keyword);

  for (let i = 11; i >= 0; i--) {
    const targetDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - i,
      1
    );
    const monthIndex = targetDate.getMonth(); // 0-11

    // 계절성 패턴 적용
    const seasonalMultiplier = seasonalPatterns[monthIndex];

    // 기본 변동 (±30%)
    const baseVariation = (Math.random() - 0.5) * 0.6;

    // 전체 변동 = 계절성 + 랜덤 변동
    const pcMultiplier = seasonalMultiplier * (1 + baseVariation);
    const mobileMultiplier = seasonalMultiplier * (1 + baseVariation * 0.8); // 모바일은 조금 더 안정적

    const pcCount = Math.max(0, Math.floor(currentPcCount * pcMultiplier));
    const mobileCount = Math.max(
      0,
      Math.floor(currentMobileCount * mobileMultiplier)
    );

    monthlyData.push({
      month: `${monthIndex + 1}월`,
      monthlyPcQcCnt: pcCount,
      monthlyMobileQcCnt: mobileCount,
      date: `${targetDate.getFullYear()}-${String(monthIndex + 1).padStart(
        2,
        "0"
      )}`,
      seasonalFactor: seasonalMultiplier,
    });
  }

  return monthlyData;
}

// 키워드별 계절성 패턴 계산
function getSeasonalPattern(keyword) {
  const keywordLower = keyword.toLowerCase();

  // 여름 관련 키워드
  if (
    keywordLower.includes("여행") ||
    keywordLower.includes("휴가") ||
    keywordLower.includes("수영") ||
    keywordLower.includes("아이스크림")
  ) {
    return [0.7, 0.7, 0.8, 0.9, 1.0, 1.3, 1.5, 1.4, 1.1, 0.9, 0.8, 0.7]; // 여름 피크
  }

  // 겨울 관련 키워드
  if (
    keywordLower.includes("겨울") ||
    keywordLower.includes("스키") ||
    keywordLower.includes("크리스마스") ||
    keywordLower.includes("연말")
  ) {
    return [1.4, 1.2, 0.9, 0.8, 0.7, 0.7, 0.7, 0.8, 0.9, 1.0, 1.2, 1.5]; // 겨울 피크
  }

  // 봄 관련 키워드
  if (
    keywordLower.includes("벚꽃") ||
    keywordLower.includes("봄") ||
    keywordLower.includes("소풍") ||
    keywordLower.includes("개학")
  ) {
    return [0.8, 0.9, 1.3, 1.4, 1.2, 0.9, 0.8, 0.8, 0.9, 1.0, 0.9, 0.8]; // 봄 피크
  }

  // 가을 관련 키워드
  if (
    keywordLower.includes("가을") ||
    keywordLower.includes("단풍") ||
    keywordLower.includes("추석") ||
    keywordLower.includes("등산")
  ) {
    return [0.8, 0.8, 0.9, 0.9, 0.9, 0.8, 0.8, 0.9, 1.2, 1.4, 1.3, 0.9]; // 가을 피크
  }

  // 음식 관련은 상대적으로 안정적이지만 연말에 약간 증가
  if (
    keywordLower.includes("음식") ||
    keywordLower.includes("맛집") ||
    keywordLower.includes("레스토랑") ||
    keywordLower.includes("카페")
  ) {
    return [1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.1, 1.2]; // 연말 약간 증가
  }

  // 기본 패턴 (약간의 계절성)
  return [1.0, 0.95, 1.0, 1.05, 1.1, 1.05, 1.0, 1.0, 1.05, 1.1, 1.05, 1.1];
}

// ==================== 헬스체크 및 루트 ====================

// 서버 상태 확인
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    message: "통합 API 서버가 정상 작동 중입니다.",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    version: "2.2.0",
    featureFlags: {
      apiReadNext: FEATURE_API_READ_NEXT,
      apiChatNext: FEATURE_API_CHAT_NEXT,
      authNext: FEATURE_AUTH_NEXT,
    },
    services: {
      naverKeywordTool: NAVER_API.customerId ? "ACTIVE" : "INACTIVE",
      keywordTrend: "ACTIVE",
      blogGenerator: OPENAI_API_KEY ? "ACTIVE" : "INACTIVE",
      reviewAnalyzer: OPENAI_API_KEY ? "ACTIVE" : "INACTIVE",
      placeSearch: NAVER_SEARCH.clientId ? "ACTIVE" : "INACTIVE",
    },
  });
});

// 루트 경로: 홈페이지 제공
app.get("/", (req, res) => sendHtml(res, "index.html"));

// ==================== 인증 (Kakao OAuth) ====================

// 카카오 로그인 시작
app.get("/auth/kakao/login", (req, res) => {
  try {
    if (!KAKAO_REST_API_KEY || !KAKAO_REDIRECT_URI) {
      return res.status(500).json({
        success: false,
        error: "Kakao OAuth 환경변수가 설정되지 않았습니다. (.env 확인)",
      });
    }

    // intent: login|signup (optional)
    const intent = (req.query.state || "").toString().substring(0, 16);

    // generate CSRF state and store in HttpOnly cookie (10 minutes)
    const stateToken = crypto.randomBytes(16).toString("hex");
    const expires = new Date(Date.now() + 10 * 60 * 1000).toUTCString();
    const isProd = process.env.NODE_ENV === "production";
    const cookieFlags = `HttpOnly; Path=/; SameSite=Lax${
      isProd ? "; Secure" : ""
    }`;
    res.setHeader("Set-Cookie", [
      `kstate=${stateToken}; Expires=${expires}; ${cookieFlags}`,
      `kintent=${encodeURIComponent(
        intent
      )}; Expires=${expires}; ${cookieFlags}`,
      // CSRF 토큰 발급(로그아웃 보호용)
      `csrf_token=${stateToken}; Expires=${expires}; Path=/; SameSite=Lax${
        isProd ? "; Secure" : ""
      }`,
    ]);

    const authorizeUrl =
      `https://kauth.kakao.com/oauth/authorize?response_type=code` +
      `&client_id=${encodeURIComponent(KAKAO_REST_API_KEY)}` +
      `&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}` +
      `&state=${encodeURIComponent(stateToken)}`;

    return res.redirect(authorizeUrl);
  } catch (error) {
    console.error("Kakao 로그인 시작 오류:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 카카오 콜백
app.get("/auth/kakao/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code)
      return res
        .status(400)
        .json({ success: false, error: "code가 없습니다." });
    if (!KAKAO_REST_API_KEY || !KAKAO_REDIRECT_URI) {
      return res.status(500).json({
        success: false,
        error: "Kakao OAuth 환경변수가 설정되지 않았습니다. (.env 확인)",
      });
    }

    // parse cookies
    const rawCookie = req.headers.cookie || "";
    const cookies = Object.fromEntries(
      rawCookie
        .split(/;\s*/)
        .filter(Boolean)
        .map((kv) => {
          const idx = kv.indexOf("=");
          return [
            kv.substring(0, idx),
            decodeURIComponent(kv.substring(idx + 1)),
          ];
        })
    );
    const cookieState = cookies["kstate"] || "";
    const intent = cookies["kintent"] || "";
    if (!cookieState || !state || cookieState !== state) {
      return res.status(400).send("Invalid state");
    }

    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("client_id", KAKAO_REST_API_KEY);
    params.append("redirect_uri", KAKAO_REDIRECT_URI);
    params.append("code", code);
    if (KAKAO_CLIENT_SECRET)
      params.append("client_secret", KAKAO_CLIENT_SECRET);

    const tokenResp = await axios.post(
      "https://kauth.kakao.com/oauth/token",
      params,
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 15000,
      }
    );

    const accessToken = tokenResp.data.access_token;

    // fetch profile (optional now)
    const profileResp = await axios.get("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });
    const kakaoUser = profileResp.data || {};

    // Minimal session payload (do not store access token)
    const sessionPayload = {
      sub: `kakao:${kakaoUser.id || "unknown"}`,
      provider: "kakao",
      name: kakaoUser.kakao_account?.profile?.nickname || "",
    };
    const sessionToken = signJwt(sessionPayload, 60 * 60 * 24 * 7); // 7 days

    // clear cookies (respect Secure in prod)
    const isProd = process.env.NODE_ENV === "production";
    const cookieFlags = `HttpOnly; Path=/; SameSite=Lax${
      isProd ? "; Secure" : ""
    }`;
    res.setHeader("Set-Cookie", [
      `kstate=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${cookieFlags}`,
      `kintent=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${cookieFlags}`,
    ]);
    setSessionCookie(res, sessionToken, 60 * 60 * 24 * 7);

    const redirectTarget =
      intent === "signup" ? "/join.html?signup=ok" : "/login.html?login=ok";
    return res.redirect(redirectTarget);
  } catch (error) {
    console.error("Kakao 콜백 오류:", error.response?.data || error.message);
    return res.redirect("/login.html?error=kakao");
  }
});

// Current session info
app.get("/auth/me", (req, res) => {
  const cookies = getCookies(req);
  const token = cookies["session"];
  if (!token) return res.status(401).json({ authenticated: false });
  const payload = verifyJwt(token);
  if (!payload) return res.status(401).json({ authenticated: false });
  res.json({
    authenticated: true,
    user: { sub: payload.sub, name: payload.name, provider: payload.provider },
  });
});

// Logout: clear session cookie
app.post("/auth/logout", (req, res) => {
  // Origin check (basic CSRF mitigation)
  const origin = req.headers.origin || "";
  const allowedOrigin = process.env.CORS_ORIGIN || "";
  if (
    allowedOrigin &&
    allowedOrigin !== "*" &&
    origin &&
    origin !== allowedOrigin
  ) {
    return res.status(403).json({ success: false, error: "Invalid origin" });
  }

  // CSRF token header check
  const parsedCookies = getCookies(req);
  const csrfCookie = parsedCookies["csrf_token"];
  const csrfHeader = req.headers["x-csrf-token"];
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res
      .status(403)
      .json({ success: false, error: "CSRF validation failed" });
  }

  const isProd = process.env.NODE_ENV === "production";
  const cookieFlags = `HttpOnly; Path=/; SameSite=Lax${
    isProd ? "; Secure" : ""
  }`;
  const existing = res.getHeader("Set-Cookie");
  const setCookies = Array.isArray(existing)
    ? existing
    : existing
    ? [existing]
    : [];
  setCookies.push(
    `session=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ${cookieFlags}`
  );
  setCookies.push(
    `csrf_token=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; SameSite=Lax${
      isProd ? "; Secure" : ""
    }`
  );
  res.setHeader("Set-Cookie", setCookies);
  res.json({ success: true });
});

// ==================== Supabase 테스트 API ====================

// Supabase 연결 테스트 (로컬에서 데이터 확인)
const testSupabaseHandler = require("./api/test-supabase");
app.get("/api/test-supabase", testSupabaseHandler);

// Supabase CRUD (데이터 추가/수정/삭제)
const supabaseCrudHandler = require("./api/supabase-crud");
app.post("/api/supabase-crud", supabaseCrudHandler);

// ==================== 크롤링 API (Vercel Functions를 로컬에서 연결) ====================

// 배치 크롤링 (목록 + 상세 정보)
const placeBatchCrawlHandler = require("./api/place-batch-crawl");
app.post("/api/place-batch-crawl", placeBatchCrawlHandler);
app.get("/api/place-batch-crawl", placeBatchCrawlHandler);

// 목록 크롤링
const rankListCrawlHandler = require("./api/rank-list-crawl");
app.post("/api/rank-list-crawl", rankListCrawlHandler);
app.get("/api/rank-list-crawl", rankListCrawlHandler);

// 상세 정보 크롤링
const placeDetailCrawlHandler = require("./api/place-detail-crawl");
app.post("/api/place-detail-crawl", placeDetailCrawlHandler);
app.get("/api/place-detail-crawl", placeDetailCrawlHandler);

// ==================== 네이버 키워드 API ====================

// 키워드 도구 API
app.post("/api/keywords", async (req, res) => {
  const { DataQ: rawDataQ } = req.body;
  const DataQ = sanitizeString(rawDataQ || "");

  if (!isNonEmptyString(DataQ, 200)) {
    return res.status(400).json({
      error: "키워드(DataQ)는 필수 매개변수입니다.",
    });
  }

  // API 키 검증
  if (!NAVER_API.customerId || !NAVER_API.apiKey || !NAVER_API.secretKey) {
    return res.status(500).json({
      error: "네이버 API 설정이 올바르지 않습니다. 환경변수를 확인해주세요.",
    });
  }

  try {
    console.log("키워드 검색 요청 수신");

    const timestamp = Date.now().toString();
    const method = "GET";
    const uri = "/keywordstool";
    const signature = generateSignature(
      timestamp,
      method,
      uri,
      NAVER_API.secretKey
    );

    // 네이버 검색광고 키워드 도구 API 호출
    const response = await axios.get(`${NAVER_API.baseUrl}${uri}`, {
      params: {
        hintKeywords: DataQ,
        showDetail: 1,
      },
      headers: {
        "X-Timestamp": timestamp,
        "X-API-KEY": NAVER_API.apiKey,
        "X-Customer": NAVER_API.customerId,
        "X-Signature": signature,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    console.log(
      `키워드 검색 성공: ${response.data.keywordList?.length || 0}개 결과`
    );

    res.json({
      ...response.data,
      searchInfo: {
        keyword: DataQ,
        timestamp: new Date().toISOString(),
        server: "Integrated Server",
      },
    });
  } catch (error) {
    console.error("네이버 검색광고 API 호출 오류:", error.message);

    if (error.response) {
      const { status, data } = error.response;
      console.error(`네이버 API 오류 (${status}):`, data);

      let errorMessage;
      switch (status) {
        case 400:
          errorMessage = "잘못된 요청입니다. 키워드나 파라미터를 확인해주세요.";
          break;
        case 401:
          errorMessage =
            "API 인증에 실패했습니다. API 키와 시그니처를 확인해주세요.";
          break;
        case 403:
          errorMessage = "API 사용 권한이 없습니다.";
          break;
        case 404:
          errorMessage = "API 엔드포인트를 찾을 수 없습니다.";
          break;
        case 429:
          errorMessage = "API 호출 한도를 초과했습니다.";
          break;
        case 500:
          errorMessage = "네이버 서버 내부 오류입니다.";
          break;
        default:
          errorMessage = `네이버 API 오류 (${status})`;
      }

      res.status(status).json({
        error: errorMessage,
        details: data,
        timestamp: new Date().toISOString(),
      });
    } else if (error.code === "ECONNABORTED") {
      res.status(408).json({
        error: "요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.",
        details: error.message,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        error: "서버 내부 오류가 발생했습니다.",
        details: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
});

// 키워드 월별 트렌드 API (네이버 데이터랩 사용)
app.post("/api/keyword-trend", async (req, res) => {
  const rawKeyword = req.body?.keyword;
  const keyword = sanitizeString(rawKeyword || "");

  if (!isNonEmptyString(keyword, 200)) {
    return res.status(400).json({
      error: "키워드는 필수 매개변수입니다.",
    });
  }

  try {
    console.log("키워드 트렌드 검색 요청 수신");

    // 네이버 데이터랩 API로 실제 트렌드 데이터 요청
    const trendData = await getNaverTrendData(keyword);

    if (trendData && trendData.length > 0) {
      console.log(
        `실제 트렌드 데이터 수집 완료: ${trendData.length}개월 데이터`
      );

      res.json({
        success: true,
        data: {
          keyword: keyword,
          monthlyTrend: trendData,
          totalMonths: trendData.length,
          dataSource: "naver_datalab",
        },
        searchInfo: {
          keyword: keyword,
          timestamp: new Date().toISOString(),
          server: "Integrated Server (Real Data)",
        },
      });
    } else {
      // 데이터랩 API 실패시 기존 키워드 API 기반 추정
      const fallbackData = await generateFallbackTrendData(keyword);

      res.json({
        success: true,
        data: {
          keyword: keyword,
          monthlyTrend: fallbackData,
          totalMonths: fallbackData.length,
          dataSource: "keyword_api_estimation",
          note: "네이버 데이터랩 API를 사용할 수 없어 키워드 API 기반 추정 데이터를 제공합니다.",
        },
        searchInfo: {
          keyword: keyword,
          timestamp: new Date().toISOString(),
          server: "Integrated Server (Fallback)",
        },
      });
    }
  } catch (error) {
    console.error("키워드 트렌드 생성 오류:", error.message);

    res.status(500).json({
      success: false,
      error: "키워드 트렌드 데이터 생성 중 오류가 발생했습니다.",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// 네이버 데이터랩 API로 실제 트렌드 데이터 수집
async function getNaverTrendData(keyword) {
  try {
    const clientId = process.env.NAVER_DATALAB_CLIENT_ID;
    const clientSecret = process.env.NAVER_DATALAB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn("네이버 데이터랩 API 키가 설정되지 않음");
      return null;
    }

    // 12개월 전부터 현재까지 기간 설정
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 11);

    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    const requestBody = {
      startDate: startDateStr,
      endDate: endDateStr,
      timeUnit: "month",
      keywordGroups: [
        {
          groupName: keyword,
          keywords: [keyword],
        },
      ],
    };

    console.log("네이버 데이터랩 API 요청:", requestBody);

    const response = await axios.post(
      "https://openapi.naver.com/v1/datalab/search",
      requestBody,
      {
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    if (response.data && response.data.results && response.data.results[0]) {
      const trendResults = response.data.results[0].data;

      return trendResults.map((item) => {
        const date = new Date(item.period);
        const month = date.getMonth() + 1;

        // 네이버 데이터랩은 상대적 수치(0-100)를 제공하므로
        // 실제 검색수처럼 변환 (기본값에 비례하여 스케일링)
        const baseValue = Math.floor(Math.random() * 3000) + 1000;
        const scaleFactor = item.ratio / 50; // 50을 기준으로 스케일링

        return {
          month: `${month}월`,
          monthlyPcQcCnt: Math.floor(baseValue * scaleFactor * 0.3), // PC는 30%
          monthlyMobileQcCnt: Math.floor(baseValue * scaleFactor * 0.7), // 모바일은 70%
          date: item.period,
          ratio: item.ratio,
          dataSource: "naver_datalab",
        };
      });
    }

    return null;
  } catch (error) {
    console.error(
      "네이버 데이터랩 API 오류:",
      error.response?.data || error.message
    );
    return null;
  }
}

// 기존 키워드 API 기반 대체 데이터 생성
async function generateFallbackTrendData(keyword) {
  try {
    // 현재 키워드 데이터 조회
    const timestamp = Date.now().toString();
    const method = "GET";
    const uri = "/keywordstool";
    const signature = generateSignature(
      timestamp,
      method,
      uri,
      NAVER_API.secretKey
    );

    let currentData = null;

    try {
      const response = await axios.get(`${NAVER_API.baseUrl}${uri}`, {
        params: {
          hintKeywords: keyword,
          showDetail: 1,
        },
        headers: {
          "X-Timestamp": timestamp,
          "X-API-KEY": NAVER_API.apiKey,
          "X-Customer": NAVER_API.customerId,
          "X-Signature": signature,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });

      if (response.data.keywordList && response.data.keywordList.length > 0) {
        currentData =
          response.data.keywordList.find(
            (item) =>
              (item.relKeyword || item.keyword || "").toLowerCase() ===
              keyword.toLowerCase()
          ) || response.data.keywordList[0];
      }
    } catch (apiError) {
      console.warn("키워드 API 조회 실패:", apiError.message);
    }

    // 현재 데이터 기반 트렌드 생성
    const basePcCount =
      currentData?.monthlyPcQcCnt || Math.floor(Math.random() * 1500) + 500;
    const baseMobileCount =
      currentData?.monthlyMobileQcCnt ||
      Math.floor(Math.random() * 3000) + 1000;

    return generateTrendDataBasedOnCurrent(
      basePcCount,
      baseMobileCount,
      keyword
    );
  } catch (error) {
    console.error("대체 트렌드 데이터 생성 실패:", error.message);

    // 최후 수단: 완전 랜덤 데이터
    const basePcCount = Math.floor(Math.random() * 1500) + 500;
    const baseMobileCount = Math.floor(Math.random() * 3000) + 1000;

    return generateTrendDataBasedOnCurrent(
      basePcCount,
      baseMobileCount,
      keyword
    );
  }
}

// 연관 키워드 검색 API
app.get("/api/related-keywords", async (req, res) => {
  const seed = sanitizeString((req.query?.seed || "").toString());

  if (!isNonEmptyString(seed, 200)) {
    return res.status(400).json({
      error: "시드 키워드(seed)는 필수 매개변수입니다.",
    });
  }

  // API 키 검증
  if (!NAVER_API.customerId || !NAVER_API.apiKey || !NAVER_API.secretKey) {
    return res.status(500).json({
      error: "네이버 API 설정이 올바르지 않습니다. 환경변수를 확인해주세요.",
    });
  }

  try {
    console.log("연관 키워드 검색 요청 수신");

    const timestamp = Date.now().toString();
    const method = "GET";
    const uri = "/relkwdstat";
    const signature = generateSignature(
      timestamp,
      method,
      uri,
      NAVER_API.secretKey
    );

    const response = await axios.get(`${NAVER_API.baseUrl}${uri}`, {
      params: {
        hintKeywords: seed,
        showDetail: 1,
      },
      headers: {
        "X-Timestamp": timestamp,
        "X-API-KEY": NAVER_API.apiKey,
        "X-Customer": NAVER_API.customerId,
        "X-Signature": signature,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });

    console.log(`연관 키워드 검색 성공`);
    res.json({
      ...response.data,
      searchInfo: {
        seed: seed,
        timestamp: new Date().toISOString(),
        server: "Integrated Server",
      },
    });
  } catch (error) {
    console.error("연관 키워드 API 호출 오류:", error.message);

    if (error.response) {
      res.status(error.response.status).json({
        error: `네이버 API 오류 (${error.response.status})`,
        details: error.response.data,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(500).json({
        error: "서버 내부 오류가 발생했습니다.",
        details: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
});

// ==================== 네이버 검색 API (Local) ====================
// 이 부분은 플레이스 스크래핑을 대체하기 위해 새로 추가되었습니다.
app.get("/api/search/local", async (req, res) => {
  const query = sanitizeString((req.query?.query || "").toString());

  if (!isNonEmptyString(query, 200)) {
    return res.status(400).json({
      success: false,
      error: "검색어를 입력해주세요.",
    });
  }

  const clientId = NAVER_SEARCH.clientId;
  const clientSecret = NAVER_SEARCH.clientSecret;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      success: false,
      error:
        "네이버 검색 API 키가 설정되지 않았습니다. .env 파일을 확인해주세요.",
    });
  }

  try {
    console.log("네이버 로컬 검색 요청 수신");

    const response = await axios.get(
      "https://openapi.naver.com/v1/search/local.json",
      {
        params: {
          query: query,
          display: 10,
          start: 1,
          sort: "random",
        },
        headers: {
          "X-Naver-Client-Id": clientId,
          "X-Naver-Client-Secret": clientSecret,
        },
      }
    );

    console.log(`네이버 로컬 검색 성공: ${response.data.items.length}개 결과`);
    res.json({
      success: true,
      items: response.data.items,
      metadata: {
        query: query,
        api: "Naver Search API (Local)",
      },
    });
  } catch (error) {
    console.error(
      "네이버 로컬 검색 API 오류:",
      error.response?.data || error.message
    );
    res.status(error.response?.status || 500).json({
      success: false,
      error: "네이버 로컬 검색 중 오류가 발생했습니다.",
      details: error.response?.data || error.message,
    });
  }
});

// ==================== AI API 호출 함수들 ====================

// ChatGPT API 호출 (블로그 생성용)
async function callChatGPTForBlog(prompt) {
  try {
    console.log("ChatGPT API 호출 중 (블로그 생성)...");
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "당신은 가게 리뷰 블로그를 작성하는 전문 작가입니다. 주어진 정보를 바탕으로 자연스럽고 매력적인 블로그 초안을 작성해주세요.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("ChatGPT API 오류:", error.response?.data || error.message);
    throw new Error(
      "ChatGPT API 호출 실패: " +
        (error.response?.data?.error?.message || error.message)
    );
  }
}

// ChatGPT API 호출 (리뷰 분석용)
async function callChatGPTForReview(prompt) {
  try {
    console.log("ChatGPT API 호출 중 (리뷰 분석)...");
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "당신은 고객 리뷰를 분석하는 전문가입니다. 리뷰의 감정, 만족도, 주요 키워드, 문제점을 정확하게 분석하고 적절한 답글을 제안해주세요.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("ChatGPT API 오류:", error.response?.data || error.message);
    throw new Error(
      "ChatGPT API 호출 실패: " +
        (error.response?.data?.error?.message || error.message)
    );
  }
}

// Gemini API 호출
async function callGemini(prompt) {
  try {
    console.log("Gemini API 호출 중...");
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 1500,
          temperature: 0.7,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    if (
      response.data.candidates &&
      response.data.candidates[0] &&
      response.data.candidates[0].content
    ) {
      return response.data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Gemini API 응답 형식 오류");
    }
  } catch (error) {
    console.error("Gemini API 오류:", error.response?.data || error.message);
    if (error.response?.status === 404) {
      try {
        console.log("gemini-1.5-flash로 재시도...");
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              maxOutputTokens: 1500,
              temperature: 0.7,
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
            timeout: 30000,
          }
        );

        if (
          response.data.candidates &&
          response.data.candidates[0] &&
          response.data.candidates[0].content
        ) {
          return response.data.candidates[0].content.parts[0].text;
        }
      } catch (retryError) {
        console.error(
          "Gemini 재시도 실패:",
          retryError.response?.data || retryError.message
        );
      }
    }
    throw new Error(
      "Gemini API 호출 실패: " +
        (error.response?.data?.error?.message || error.message)
    );
  }
}

// Claude API 호출
async function callClaude(prompt) {
  try {
    console.log("Claude API 호출 중...");
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-haiku-20240307",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      },
      {
        headers: {
          "x-api-key": CLAUDE_API_KEY,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        timeout: 30000,
      }
    );

    if (response.data.content && response.data.content[0]) {
      return response.data.content[0].text;
    } else {
      throw new Error("Claude API 응답 형식 오류");
    }
  } catch (error) {
    console.error("Claude API 오류:", error.response?.data || error.message);
    throw new Error(
      "Claude API 호출 실패: " +
        (error.response?.data?.error?.message || error.message)
    );
  }
}

// ==================== ChatGPT 채팅 API ====================

// ChatGPT 채팅 API
app.post("/api/chat", async (req, res) => {
  try {
    const rawMsg = req.body?.message || "";
    const message = sanitizeString(rawMsg);

    console.log("ChatGPT 채팅 요청 수신");

    // 입력 데이터 검증
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "메시지가 필요합니다.",
      });
    }

    if (message.length > 4000) {
      return res.status(400).json({
        success: false,
        error: "메시지가 너무 깁니다. 4000자 이하로 입력해주세요.",
      });
    }

    if (!OPENAI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "OpenAI API 키가 설정되지 않았습니다. 환경변수를 확인해주세요.",
      });
    }

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "당신은 도움이 되는 AI 어시스턴트입니다. 한국어로 친근하고 정확하게 답변해주세요. 사용자의 질문에 성실하게 대답하고, 필요한 경우 추가 설명이나 예시를 제공해주세요.",
          },
          {
            role: "user",
            content: message,
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    console.log("ChatGPT 응답 성공");

    res.json({
      success: true,
      reply: response.data.choices[0].message.content,
      usage: response.data.usage,
      metadata: {
        model: "gpt-3.5-turbo",
        timestamp: new Date().toISOString(),
        server: "Integrated Server",
      },
    });
  } catch (error) {
    console.error("ChatGPT API 오류:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      error: "ChatGPT API 호출 중 오류가 발생했습니다.",
      details: error.response?.data?.error?.message || error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ==================== 블로그 생성 API ====================

// 프롬프트 생성 함수 (블로그용)
function generateBlogPrompt(storeData, step) {
  const baseInfo = `
가게명: ${storeData.storeName}
업종: ${storeData.category}
주소: ${storeData.address || "정보 없음"}
영업시간: ${storeData.businessHours || "정보 없음"}
지역: ${storeData.region?.city || ""} ${storeData.region?.district || ""}
블로그 스타일: ${storeData.blogStyle}
목표 글자수: ${storeData.wordCount}자
`;

  switch (step) {
    case "chatgpt":
      return `${baseInfo}

위 정보를 바탕으로 ${storeData.blogStyle} 스타일의 가게 리뷰 블로그 초안을 작성해주세요. 
${storeData.wordCount}자 내외로 작성하되, 자연스럽고 흥미로운 내용으로 구성해주세요.
실제 방문 경험이 있는 것처럼 생생하게 작성해주세요.

다음 요소들을 포함해주세요:
- 가게의 첫인상과 외관
- 음식이나 서비스의 특징과 맛
- 분위기나 인테리어
- 추천 메뉴나 특별한 포인트
- 재방문 의사와 추천 이유`;

    case "gemini":
      return `다음은 ChatGPT가 작성한 가게 리뷰 블로그 초안입니다:

${storeData.previousContent}

이 내용을 바탕으로 다음 요구사항에 맞게 개선해주세요:
- 블로그 스타일: ${storeData.blogStyle}
- 목표 글자수: ${storeData.wordCount}자
- 더 생동감 있고 구체적인 표현으로 개선
- 독자의 관심을 끌 수 있는 요소 추가
- 가게의 특색과 매력이 더 잘 드러나도록 수정
- 감정적인 표현과 개인적인 경험을 더 풍부하게
- 한국어 표현을 더 자연스럽게
- 읽기 쉽도록 문단 구성 개선`;

    case "claude":
      return `다음은 Gemini가 개선한 가게 리뷰 블로그입니다:

${storeData.previousContent}

이 블로그를 최종 완성본으로 다듬어주세요:
- 문장의 자연스러움과 가독성 향상
- ${storeData.blogStyle} 스타일에 완벽히 부합하도록 조정
- ${storeData.wordCount}자에 맞게 조정
- 맞춤법과 어투 점검
- 전체적인 흐름과 구조 최적화
- 한국어 표현을 더 자연스럽게 다듬기
- 문단 구성과 가독성 개선
- 블로그 독자들이 좋아할 만한 요소 강화`;

    default:
      return baseInfo;
  }
}

// 메인 블로그 생성 API
app.post("/api/generate-blog", async (req, res) => {
  try {
    const storeData = {
      storeName: sanitizeString(req.body?.storeName || ""),
      category: sanitizeString(req.body?.category || ""),
      address: sanitizeString(req.body?.address || ""),
      businessHours: sanitizeString(req.body?.businessHours || ""),
      region: req.body?.region || {},
      blogStyle: sanitizeString(req.body?.blogStyle || ""),
      wordCount: Math.max(
        300,
        Math.min(3000, Number(req.body?.wordCount) || 1200)
      ),
      previousContent: sanitizeString(req.body?.previousContent || ""),
    };
    console.log("블로그 생성 요청 수신");

    // 입력 데이터 검증
    if (!storeData.storeName || !storeData.category || !storeData.blogStyle) {
      return res.status(400).json({
        success: false,
        error: "필수 정보가 누락되었습니다.",
        required: ["storeName", "category", "blogStyle"],
      });
    }

    const results = {
      step1_chatgpt: "",
      step2_gemini: "",
      step3_claude: "",
      finalBlog: "",
    };

    // Step 1: ChatGPT로 초안 작성
    try {
      console.log("Step 1: ChatGPT 초안 작성 시작");
      const chatgptPrompt = generateBlogPrompt(storeData, "chatgpt");
      results.step1_chatgpt = await callChatGPTForBlog(chatgptPrompt);
      console.log("Step 1 완료");
    } catch (error) {
      console.error("Step 1 실패:", error.message);
      return res.status(500).json({
        success: false,
        error: `ChatGPT 단계에서 오류: ${error.message}`,
        step: "chatgpt",
      });
    }

    // Step 2: Gemini로 개선
    try {
      console.log("Step 2: Gemini 개선 시작");
      storeData.previousContent = results.step1_chatgpt;
      const geminiPrompt = generateBlogPrompt(storeData, "gemini");
      results.step2_gemini = await callGemini(geminiPrompt);
      console.log("Step 2 완료");
    } catch (error) {
      console.error("Step 2 실패:", error.message);
      results.step2_gemini = results.step1_chatgpt;
      console.log("Gemini 단계 실패, ChatGPT 결과 사용");
    }

    // Step 3: Claude로 최종 다듬기
    try {
      console.log("Step 3: Claude 최종 다듬기 시작");
      storeData.previousContent = results.step2_gemini;
      const claudePrompt = generateBlogPrompt(storeData, "claude");
      results.step3_claude = await callClaude(claudePrompt);
      console.log("Step 3 완료");
    } catch (error) {
      console.error("Step 3 실패:", error.message);
      results.step3_claude = results.step2_gemini;
      console.log("Claude 단계 실패, 이전 결과 사용");
    }

    results.finalBlog =
      results.step3_claude || results.step2_gemini || results.step1_chatgpt;

    console.log("블로그 생성 완료");

    res.json({
      success: true,
      data: results,
      metadata: {
        storeName: storeData.storeName,
        blogStyle: storeData.blogStyle,
        wordCount: storeData.wordCount,
        generatedAt: new Date().toISOString(),
        server: "Integrated Server",
        stepsCompleted: {
          chatgpt: !!results.step1_chatgpt,
          gemini:
            !!results.step2_gemini &&
            results.step2_gemini !== results.step1_chatgpt,
          claude:
            !!results.step3_claude &&
            results.step3_claude !== results.step2_gemini,
        },
      },
    });
  } catch (error) {
    console.error("블로그 생성 전체 오류:", error);
    res.status(500).json({
      success: false,
      error: error.message || "블로그 생성 중 오류가 발생했습니다.",
    });
  }
});

// ==================== 리뷰 분석 API ====================

// 리뷰 분석 프롬프트 생성
function generateReviewAnalysisPrompt(reviewText, analysisType, options) {
  let prompt = `다음 고객 리뷰를 분석해주세요:\n\n"${reviewText}"\n\n`;

  switch (analysisType) {
    case "sentiment":
      prompt += `감정 분석에 집중하여 다음 형식으로 답변해주세요:
감정: [긍정적/중립적/부정적]
점수: [0-1 사이의 숫자]
요약: [감정 분석 요약 한 문장]`;
      break;

    case "keywords":
      prompt += `키워드 분석에 집중하여 주요 키워드 5-10개를 추출해주세요.
음식명, 서비스, 분위기, 가격 등 중요한 키워드를 콤마로 구분하여 나열해주세요.`;
      break;

    case "improvement":
      prompt += `개선점 분석에 집중하여 다음을 찾아주세요:
1. 문제점: 리뷰에서 언급된 불만사항이나 개선이 필요한 부분
2. 개선 제안: 구체적인 개선 방안`;
      break;

    default: // comprehensive
      prompt += `종합적으로 분석하여 다음 내용을 포함해주세요:
1. 감정 분석 (긍정/중립/부정, 점수)
2. 추정 평점 (1-5점)
3. 주요 키워드 (5-10개)
4. 언급된 장점
5. 언급된 단점 또는 문제점
6. 개선 제안사항`;
  }

  if (options.includes("generateReply")) {
    prompt += `\n\n또한 이 리뷰에 대한 적절한 사업주 답글을 생성해주세요. 
답글은 감사 인사, 구체적인 언급 사항에 대한 응답, 앞으로의 개선 의지를 포함해야 합니다.`;
  }

  return prompt;
}

// 응답 파싱 함수
function parseAnalysisResponse(responseText, analysisType, options) {
  const result = {};

  try {
    // 감정 분석 추출
    const sentimentMatch = responseText.match(/감정\s*[:：]\s*([가-힣]+)/);
    const scoreMatch = responseText.match(/점수\s*[:：]\s*([\d.]+)/);
    const summaryMatch = responseText.match(/요약\s*[:：]\s*([^\n]+)/);

    if (sentimentMatch || scoreMatch) {
      result.sentiment = {
        overall: sentimentMatch
          ? sentimentMatch[1].includes("긍정")
            ? "positive"
            : sentimentMatch[1].includes("부정")
            ? "negative"
            : "neutral"
          : "neutral",
        score: scoreMatch ? parseFloat(scoreMatch[1]) : 0.5,
        summary: summaryMatch ? summaryMatch[1].trim() : "감정 분석 결과",
      };
    }

    // 평점 추출
    const ratingMatch = responseText.match(/평점\s*[:：]\s*([\d.]+)/);
    if (
      ratingMatch ||
      responseText.includes("점") ||
      responseText.includes("별")
    ) {
      const rating = ratingMatch
        ? parseFloat(ratingMatch[1])
        : responseText.includes("5점") || responseText.includes("별점 5")
        ? 5
        : responseText.includes("4점") || responseText.includes("별점 4")
        ? 4
        : responseText.includes("3점") || responseText.includes("별점 3")
        ? 3
        : responseText.includes("2점") || responseText.includes("별점 2")
        ? 2
        : responseText.includes("1점") || responseText.includes("별점 1")
        ? 1
        : 3.5;

      result.rating = {
        score: rating,
        explanation: `리뷰 내용을 종합하여 ${rating}점으로 추정됩니다.`,
      };
    }

    // 키워드 추출
    const keywordMatches = responseText.match(/키워드\s*[:：]\s*([^\n]+)/);
    if (keywordMatches) {
      result.keywords = keywordMatches[1]
        .split(/[,，\s]+/)
        .filter((k) => k.trim().length > 0);
    }

    // 문제점 추출
    const issueMatches = responseText.match(
      /문제점\s*[:：]\s*([^\n]+(?:\n(?![\d.]+\.|[가-힣]+\s*[:：])[^\n]*)*)/
    );
    if (issueMatches) {
      result.issues = issueMatches[1]
        .split(/[\n\r]+/)
        .filter((i) => i.trim().length > 0);
    }

    // 개선 제안 추출
    const suggestionMatches = responseText.match(
      /개선\s*(?:제안|방안)\s*[:：]\s*([^\n]+(?:\n(?![\d.]+\.|[가-힣]+\s*[:：])[^\n]*)*)/
    );
    if (suggestionMatches) {
      result.suggestions = suggestionMatches[1]
        .split(/[\n\r]+/)
        .filter((s) => s.trim().length > 0);
    }

    // 답글 추출
    if (options.includes("generateReply")) {
      const replyMatches = responseText.match(/답글\s*[:：]\s*"?([^"]+)"?/);
      if (replyMatches) {
        result.reply = replyMatches[1].trim();
      }
    }

    // 종합 요약
    result.summary =
      responseText.substring(0, 300) + (responseText.length > 300 ? "..." : "");
  } catch (error) {
    console.error("응답 파싱 오류:", error);
  }

  return result;
}

// 기본 키워드 추출 함수
function extractBasicKeywords(text) {
  const keywords = [];

  // 음식 관련 키워드
  const foodKeywords = [
    "맛",
    "음식",
    "메뉴",
    "요리",
    "맛있",
    "맛없",
    "달콤",
    "매콤",
    "짜",
    "싱거",
    "부드러",
    "바삭",
  ];
  const serviceKeywords = [
    "서비스",
    "직원",
    "사장",
    "친절",
    "불친절",
    "빠른",
    "느린",
  ];
  const atmosphereKeywords = [
    "분위기",
    "인테리어",
    "깔끔",
    "더러",
    "넓은",
    "좁은",
    "시끄러",
    "조용",
  ];
  const priceKeywords = ["가격", "비싸", "저렴", "합리적", "비용", "돈"];

  const allKeywords = [
    ...foodKeywords,
    ...serviceKeywords,
    ...atmosphereKeywords,
    ...priceKeywords,
  ];

  allKeywords.forEach((keyword) => {
    if (text.includes(keyword)) {
      keywords.push(keyword);
    }
  });

  return keywords.slice(0, 8); // 최대 8개까지
}

// 평점 추정 함수
function estimateRating(text, sentiment) {
  let score = 3; // 기본 3점

  if (sentiment) {
    if (sentiment.overall === "positive") {
      score = 4 + sentiment.score; // 4-5점
    } else if (sentiment.overall === "negative") {
      score = 1 + sentiment.score * 2; // 1-3점
    } else {
      score = 2.5 + sentiment.score; // 2.5-3.5점
    }
  }

  // 텍스트에서 명시적 평점 찾기
  const explicitRating = text.match(/([1-5])점|별점\s*([1-5])|★{1,5}/);
  if (explicitRating) {
    const rating =
      explicitRating[1] || explicitRating[2] || explicitRating[0].length;
    score = parseInt(rating) || score;
  }

  return {
    score: Math.min(5, Math.max(1, Math.round(score * 2) / 2)), // 0.5 단위로 반올림
    explanation: `리뷰 내용을 종합하여 ${rating}점으로 추정됩니다.`,
  };
}

// 리뷰 분석 API
app.post("/api/analyze-review", async (req, res) => {
  try {
    const reviewText = sanitizeString(req.body?.reviewText || "");
    const analysisType = sanitizeString(
      req.body?.analysisType || "comprehensive"
    );
    const options = Array.isArray(req.body?.options) ? req.body.options : [];
    const placeInfo = req.body?.placeInfo || null;
    const ownerTips = sanitizeString(req.body?.ownerTips || "");

    console.log("리뷰 분석 요청 수신");
    if (placeInfo) {
      console.log("식당 정보 포함됨:", placeInfo.basic?.name || "정보 없음");
    }
    if (ownerTips) {
      console.log("사장님 추천 정보 포함됨");
    }

    // 입력 데이터 검증
    if (!reviewText || reviewText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "분석할 리뷰 텍스트가 필요합니다.",
      });
    }

    if (reviewText.length > 5000) {
      return res.status(400).json({
        success: false,
        error: "리뷰 텍스트가 너무 깁니다. 5000자 이하로 입력해주세요.",
      });
    }

    const results = {};

    // 기본 분석 (ChatGPT)
    try {
      console.log("Step 1: ChatGPT로 기본 분석 시작");
      const prompt = generateReviewAnalysisPrompt(
        reviewText,
        analysisType,
        options || []
      );
      const chatgptResponse = await callChatGPTForReview(prompt);

      // 응답 파싱
      const parsedResults = parseAnalysisResponse(
        chatgptResponse,
        analysisType,
        options || []
      );
      Object.assign(results, parsedResults);

      console.log("Step 1 완료");
    } catch (error) {
      console.error("ChatGPT 분석 실패:", error.message);
      // ChatGPT 실패시 기본값 설정
      results.sentiment = {
        overall: "neutral",
        score: 0.5,
        summary: "분석 중 오류가 발생했습니다.",
      };
    }

    // 감정 분석 보강 (Gemini)
    if (analysisType === "comprehensive" || analysisType === "sentiment") {
      try {
        console.log("Step 2: Gemini로 감정 분석 보강");
        const sentimentPrompt = `다음 리뷰의 감정을 0-1 사이 점수로 정확히 분석해주세요:
"${reviewText}"

결과 형식:
감정: [긍정적/중립적/부정적]
점수: [0-1 사이 소수점]
분석: [상세 분석 2-3문장]`;

        const geminiResponse = await callGemini(sentimentPrompt);
        const sentimentResult = parseAnalysisResponse(
          geminiResponse,
          "sentiment",
          []
        );

        if (sentimentResult.sentiment) {
          results.sentiment = sentimentResult.sentiment;
        }

        console.log("Step 2 완료");
      } catch (error) {
        console.error("Gemini 감정 분석 실패:", error.message);
      }
    }

    // 답글 생성 (Claude)
    if (options && options.includes("generateReply")) {
      try {
        console.log("Step 3: Claude로 답글 생성");
        
        // 식당 정보를 프롬프트에 추가
        let placeInfoText = "";
        if (placeInfo || ownerTips) {
          placeInfoText = "\n\n=== 우리 식당 정보 ===\n";
          if (placeInfo) {
            if (placeInfo.basic?.name) placeInfoText += `상호명: ${placeInfo.basic.name}\n`;
            if (placeInfo.basic?.category) placeInfoText += `업종: ${placeInfo.basic.category}\n`;
            if (placeInfo.menu && placeInfo.menu.length > 0) {
              placeInfoText += `주요 메뉴: ${placeInfo.menu.slice(0, 10).map(m => `${m.name}${m.price ? `(${m.price})` : ''}`).join(', ')}\n`;
            }
            if (placeInfo.introduction?.text) {
              placeInfoText += `특징: ${placeInfo.introduction.text}\n`;
            }
          }
          if (ownerTips) {
            placeInfoText += `\n🌟 사장님이 앞으로 추천하고 싶은 포인트 (고객이 경험한 내용 아님!):\n${ownerTips}\n`;
          }
          placeInfoText += "========================\n";
        }
        
        let ownerTipsInstruction = "";
        if (ownerTips) {
          ownerTipsInstruction = `

🚨🚨🚨 필수 작업 🚨🚨🚨
다음 메뉴들을 답글에 반드시 포함하고 자세하게 설명하세요:
"${ownerTips}"

각 메뉴의 특징, 맛, 인기 이유 등을 구체적으로 설명하세요!`;
        }

        const replyPrompt = `당신은 식당 사장입니다. 고객 리뷰에 답글을 작성하세요.

고객 리뷰: "${reviewText}"
${placeInfoText}${ownerTipsInstruction}

답글 작성 규칙:
1. 리뷰 내용에 먼저 간단히 답변 (1-2문장)
2. ${ownerTips ? `사장님 추천 메뉴("${ownerTips}")를 반드시 모두 언급하고 각 메뉴의 특징을 자세히 설명 (2-3문장)` : '추가 메뉴 추천'}
3. 재방문 유도
4. 200-350자, 친근하고 자세한 톤

예시:
리뷰: "맛있어요"
사장님 추천: "삼겹살, 돼지갈비"
답글: "방문 감사합니다. 맛있게 드셨다니 정말 기쁩니다. 다음에는 저희 삼겹살을 꼭 드셔보세요. 육즙이 풍부하고 고소한 맛이 일품입니다. 돼지갈비도 부드럽고 양념이 잘 배어 많은 고객님들께서 좋아하시는 인기 메뉴입니다. 다음 방문 시 꼭 맛보시길 추천드립니다!"

⚠️ 중요:
- 사장님 추천 메뉴는 단순 언급이 아니라 매력적으로 상세 설명
- 맛과 특징을 일반적이고 긍정적으로 표현 (맛있다, 인기 있다, 부드럽다, 풍부하다 등)
- 🚨 절대 금지: 구체적인 재료(국내산, 1등급), 조리법(숯불, 24시간 숙성) 등 확인되지 않은 정보 만들어내지 마세요!
- 고객이 먹고 싶어지게 만들되 사실에 근거한 일반적 표현만 사용

답글:`;

        const claudeResponse = await callClaude(replyPrompt);
        results.reply = claudeResponse.trim().replace(/^"|"$/g, "");

        console.log("답글 생성 완료");

        res.json({
          success: true,
          data: {
            reply: results.reply,
            originalReview: reviewText,
          },
          metadata: {
            textLength: reviewText.length,
            replyLength: results.reply.length,
            generatedAt: new Date().toISOString(),
            server: "Integrated Server",
          },
        });
      } catch (error) {
        console.error("Claude 답글 생성 실패:", error.message);

        // Claude 실패시 ChatGPT로 대체 시도
        try {
          console.log("ChatGPT로 대체 답글 생성 시도");

          // 식당 정보를 프롬프트에 추가
          let fallbackPlaceInfo = "";
          if (placeInfo || ownerTips) {
            fallbackPlaceInfo = "\n\n우리 식당 정보:\n";
            if (placeInfo) {
              if (placeInfo.basic?.name) fallbackPlaceInfo += `상호: ${placeInfo.basic.name}\n`;
              if (placeInfo.basic?.category) fallbackPlaceInfo += `업종: ${placeInfo.basic.category}\n`;
              if (placeInfo.menu && placeInfo.menu.length > 0) {
                fallbackPlaceInfo += `메뉴: ${placeInfo.menu.slice(0, 8).map(m => m.name).join(', ')}\n`;
              }
            }
            if (ownerTips) {
              fallbackPlaceInfo += `🌟 사장님 강조 포인트: ${ownerTips}\n`;
            }
          }

          const fallbackPrompt = `다음 고객 리뷰에 대한 사업주 답글을 작성해주세요:
"${reviewText}"
${fallbackPlaceInfo}

요구사항:
- 감사 인사 포함
- 리뷰에서 언급한 메뉴에 대해 반드시 답변
- 궁금해하는 메뉴가 있다면 우리 식당 메뉴를 바탕으로 추천
- 🌟 사장님이 강조한 포인트를 자연스럽게 반영
- 새로운 고객들도 볼 것을 고려하여 메뉴와 분위기 소개
- 친근하고 정중한 톤
- 150-250자 내외
- 답글만 작성`;

          const fallbackReply = await callChatGPTForReview(fallbackPrompt);
          const cleanFallbackReply = fallbackReply.trim().replace(/^"|"$/g, "");

          // ==================== DB 저장 로직 (Fallback) ====================
          let fallbackReviewId = null;
          let fallbackDbSaveStatus = "not_attempted";
          let fallbackDbError = null;

          if (supabase) {
            try {
              console.log("📦 DB 저장 시작 (Fallback)...");

              // 1. places 테이블에 식당 정보 저장 (UPSERT)
              let savedPlaceId = null;
              if (placeInfo && placeInfo.basic) {
                const placeData = {
                  place_id: placeInfo.basic.place_id || placeInfo.basic.id || null,
                  place_name: placeInfo.basic.name || "정보 없음",
                  category: placeInfo.basic.category || null,
                  road_address: placeInfo.contact?.road_address || null,
                  lot_address: placeInfo.contact?.lot_address || null,
                  phone: placeInfo.contact?.phone_display || placeInfo.contact?.phone || null,
                  homepage: placeInfo.contact?.homepage || null,
                  rating: placeInfo.stats?.rating ? parseFloat(placeInfo.stats.rating) : null,
                  visitor_reviews: placeInfo.stats?.visitor_reviews || 0,
                  blog_reviews: placeInfo.stats?.blog_reviews || 0,
                  business_hours: placeInfo.business?.hours || null,
                  last_crawled_at: new Date().toISOString(),
                };

                if (placeData.place_id) {
                  const { data: placeResult, error: placeError } = await supabase
                    .from("places")
                    .upsert(placeData, {
                      onConflict: "place_id",
                      ignoreDuplicates: false,
                    })
                    .select();

                  if (placeError) {
                    console.error("❌ places 저장 실패:", placeError);
                  } else {
                    savedPlaceId = placeData.place_id;
                    console.log("✅ places 저장 성공:", savedPlaceId);
                  }
                } else {
                  console.warn("⚠️ place_id가 없어 places 테이블에 저장하지 않습니다.");
                }
              }

              // 2. review_responses 테이블에 리뷰 & 답글 저장
              const { data: testUser, error: userError } = await supabase
                .from("profiles")
                .select("id")
                .eq("name", "김사장")
                .single();

              let userId = testUser?.id;
              
              if (userError || !testUser) {
                console.warn("⚠️ 테스트 회원(김사장)을 찾을 수 없습니다. 첫 번째 회원 사용.");
                const { data: firstUser, error: firstUserError } = await supabase
                  .from("profiles")
                  .select("id")
                  .limit(1)
                  .single();
                
                if (firstUserError || !firstUser) {
                  throw new Error("profiles 테이블에 회원이 없습니다.");
                }
                
                userId = firstUser.id;
              }

              const reviewData = {
                user_id: userId,
                place_id: savedPlaceId || null,
                naver_place_url: req.body?.placeUrl || null,
                customer_review: reviewText,
                owner_tips: ownerTips || null,
                place_info_json: placeInfo || null,
                ai_response: cleanFallbackReply,
                ai_model: "chatgpt",
                generation_time_ms: null,
                is_used: false,
                status: "draft",
              };

              const { data: reviewResult, error: reviewError } = await supabase
                .from("review_responses")
                .insert(reviewData)
                .select();

              if (reviewError) {
                console.error("❌ review_responses 저장 실패:", reviewError);
                fallbackDbSaveStatus = "failed";
                fallbackDbError = reviewError.message;
              } else {
                fallbackReviewId = reviewResult[0]?.id;
                console.log("✅ review_responses 저장 성공:", fallbackReviewId);
                fallbackDbSaveStatus = "success";
              }
            } catch (dbErr) {
              console.error("❌ DB 저장 중 오류:", dbErr);
              fallbackDbSaveStatus = "failed";
              fallbackDbError = dbErr.message;
            }
          } else {
            console.log("⚠️ Supabase 클라이언트가 초기화되지 않아 DB 저장을 건너뜁니다.");
          }
          // ==================== DB 저장 로직 끝 (Fallback) ====================

          res.json({
            success: true,
            data: {
              reply: cleanFallbackReply,
              originalReview: reviewText,
              reviewId: fallbackReviewId,
            },
            metadata: {
              textLength: reviewText.length,
              replyLength: cleanFallbackReply.length,
              generatedAt: new Date().toISOString(),
              server: "Integrated Server (Fallback)",
              dbSaveStatus: fallbackDbSaveStatus,
              dbError: fallbackDbError,
            },
          });
        } catch (fallbackError) {
          console.error("대체 답글 생성도 실패:", fallbackError.message);
          throw new Error(
            "답글 생성에 실패했습니다. 잠시 후 다시 시도해주세요."
          );
        }
      }
    }

    // 키워드가 없으면 기본 키워드 추출
    if (!results.keywords || results.keywords.length === 0) {
      const basicKeywords = extractBasicKeywords(reviewText);
      if (basicKeywords.length > 0) {
        results.keywords = basicKeywords;
      }
    }

    // 평점이 없으면 기본 평점 추정
    if (!results.rating) {
      const estimatedRating = estimateRating(reviewText, results.sentiment);
      results.rating = estimatedRating;
    }

    console.log("리뷰 분석 완료!");

    res.json({
      success: true,
      data: results,
      metadata: {
        textLength: reviewText.length,
        analysisType: analysisType,
        optionsUsed: options || [],
        analyzedAt: new Date().toISOString(),
        server: "Integrated Server",
      },
    });
  } catch (error) {
    console.error("리뷰 분석 전체 오류:", error);
    res.status(500).json({
      success: false,
      error: error.message || "리뷰 분석 중 오류가 발생했습니다.",
    });
  }
});

// ==================== 간단한 리뷰 답글 생성 API ====================

// 간단한 리뷰 답글 생성 API
app.post("/api/generate-reply", async (req, res) => {
  try {
    const reviewText = sanitizeString(req.body?.reviewText || "");
    const placeInfo = req.body?.placeInfo || null;
    const ownerTips = sanitizeString(req.body?.ownerTips || "");

    console.log("리뷰 답글 생성 요청 수신");
    if (placeInfo) {
      console.log("식당 정보 포함됨:", placeInfo.basic?.name || "정보 없음");
    }
    if (ownerTips) {
      console.log("사장님 추천 정보 포함됨");
    }

    // 입력 데이터 검증
    if (!reviewText || reviewText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "답글을 생성할 리뷰 텍스트가 필요합니다.",
      });
    }

    if (reviewText.length > 3000) {
      return res.status(400).json({
        success: false,
        error: "리뷰 텍스트가 너무 깁니다. 3000자 이하로 입력해주세요.",
      });
    }

    // Claude로 답글 생성
    try {
      console.log("Claude로 답글 생성 시작");

      // 식당 정보를 프롬프트에 추가
      let placeInfoText = "";
      if (placeInfo || ownerTips) {
        placeInfoText = "\n\n=== 우리 식당 정보 ===\n";
        
        if (placeInfo) {
          if (placeInfo.basic?.name) {
            placeInfoText += `상호명: ${placeInfo.basic.name}\n`;
          }
          if (placeInfo.basic?.category) {
            placeInfoText += `업종: ${placeInfo.basic.category}\n`;
          }
          if (placeInfo.contact?.road_address) {
            placeInfoText += `위치: ${placeInfo.contact.road_address}\n`;
          }
          if (placeInfo.business?.hours) {
            placeInfoText += `영업시간: ${placeInfo.business.hours}\n`;
          }
          
          // 메뉴 정보 (중요!)
          if (placeInfo.menu && placeInfo.menu.length > 0) {
            placeInfoText += `\n주요 메뉴:\n`;
            placeInfo.menu.slice(0, 10).forEach(item => {
              placeInfoText += `- ${item.name}${item.price ? ` (${item.price})` : ''}\n`;
            });
          }
          
          // 소개글
          if (placeInfo.introduction?.text) {
            placeInfoText += `\n우리 식당 특징: ${placeInfo.introduction.text}\n`;
          }
          
          // 편의시설
          if (placeInfo.facilities?.list && placeInfo.facilities.list.length > 0) {
            placeInfoText += `\n편의시설: ${placeInfo.facilities.list.join(', ')}\n`;
          }
        }
        
        // 🌟 사장님이 강조하고 싶은 포인트 (최우선 반영!)
        if (ownerTips) {
          placeInfoText += `\n🌟 사장님이 앞으로 추천하고 싶은 포인트 (고객이 경험한 내용 아님!):\n${ownerTips}\n`;
        }
        
        placeInfoText += "========================\n";
      }

      let ownerTipsInstruction = "";
      if (ownerTips) {
        ownerTipsInstruction = `

🚨🚨🚨 필수 작업 🚨🚨🚨
다음 메뉴들을 답글에 반드시 포함하고 자세하게 설명하세요:
"${ownerTips}"

각 메뉴의 특징, 맛, 인기 이유 등을 구체적으로 설명하세요!`;
      }

      const replyPrompt = `당신은 식당 사장입니다. 고객 리뷰에 답글을 작성하세요.

고객 리뷰: "${reviewText}"
${placeInfoText}${ownerTipsInstruction}

답글 작성 규칙:
1. 리뷰 내용에 먼저 간단히 답변 (1-2문장)
2. ${ownerTips ? `사장님 추천 메뉴("${ownerTips}")를 반드시 모두 언급하고 각 메뉴의 특징을 자세히 설명 (2-3문장)` : '추가 메뉴 추천'}
3. 재방문 유도
4. 200-350자, 친근하고 자세한 톤

예시:
리뷰: "맛있어요"
사장님 추천: "삼겹살, 돼지갈비"
답글: "방문 감사합니다. 맛있게 드셨다니 정말 기쁩니다. 다음에는 저희 삼겹살을 꼭 드셔보세요. 육즙이 풍부하고 고소한 맛이 일품입니다. 돼지갈비도 부드럽고 양념이 잘 배어 많은 고객님들께서 좋아하시는 인기 메뉴입니다. 다음 방문 시 꼭 맛보시길 추천드립니다!"

⚠️ 중요:
- 사장님 추천 메뉴는 단순 언급이 아니라 매력적으로 상세 설명
- 맛과 특징을 일반적이고 긍정적으로 표현 (맛있다, 인기 있다, 부드럽다, 풍부하다 등)
- 🚨 절대 금지: 구체적인 재료(국내산, 1등급), 조리법(숯불, 24시간 숙성) 등 확인되지 않은 정보 만들어내지 마세요!
- 고객이 먹고 싶어지게 만들되 사실에 근거한 일반적 표현만 사용

답글:`;

      const reply = await callClaude(replyPrompt);
      const cleanReply = reply.trim().replace(/^"|"$/g, "");

      console.log("답글 생성 완료");

      // ==================== DB 저장 로직 ====================
      let savedReviewId = null;
      let dbSaveStatus = "not_attempted"; // "not_attempted", "success", "failed"
      let dbError = null;

      if (supabase) {
        try {
          console.log("📦 DB 저장 시작...");

          // 1. places 테이블에 식당 정보 저장 (UPSERT)
          let savedPlaceId = null;
          if (placeInfo && placeInfo.basic) {
            const placeData = {
              place_id: placeInfo.basic.place_id || placeInfo.basic.id || null,
              place_name: placeInfo.basic.name || "정보 없음",
              category: placeInfo.basic.category || null,
              road_address: placeInfo.contact?.road_address || null,
              lot_address: placeInfo.contact?.lot_address || null,
              phone: placeInfo.contact?.phone_display || placeInfo.contact?.phone || null,
              homepage: placeInfo.contact?.homepage || null,
              rating: placeInfo.stats?.rating ? parseFloat(placeInfo.stats.rating) : null,
              visitor_reviews: placeInfo.stats?.visitor_reviews || 0,
              blog_reviews: placeInfo.stats?.blog_reviews || 0,
              business_hours: placeInfo.business?.hours || null,
              last_crawled_at: new Date().toISOString(),
            };

            if (placeData.place_id) {
              // place_id가 있으면 UPSERT
              const { data: placeResult, error: placeError } = await supabase
                .from("places")
                .upsert(placeData, {
                  onConflict: "place_id",
                  ignoreDuplicates: false,
                })
                .select();

              if (placeError) {
                console.error("❌ places 저장 실패:", placeError);
              } else {
                savedPlaceId = placeData.place_id;
                console.log("✅ places 저장 성공:", savedPlaceId);
              }
            } else {
              console.warn("⚠️ place_id가 없어 places 테이블에 저장하지 않습니다.");
            }
          }

          // 2. review_responses 테이블에 리뷰 & 답글 저장
          // 테스트 회원 ID 조회 (김사장)
          const { data: testUser, error: userError } = await supabase
            .from("profiles")
            .select("id")
            .eq("name", "김사장")
            .single();

          let userId = testUser?.id;
          
          if (userError || !testUser) {
            console.warn("⚠️ 테스트 회원(김사장)을 찾을 수 없습니다. 첫 번째 회원 사용.");
            // 첫 번째 회원 가져오기
            const { data: firstUser, error: firstUserError } = await supabase
              .from("profiles")
              .select("id")
              .limit(1)
              .single();
            
            if (firstUserError || !firstUser) {
              throw new Error("profiles 테이블에 회원이 없습니다.");
            }
            
            userId = firstUser.id;
          }

          const reviewData = {
            user_id: userId,
            place_id: savedPlaceId || null, // place_id가 없으면 NULL
            naver_place_url: req.body?.placeUrl || null,
            customer_review: reviewText,
            owner_tips: ownerTips || null,
            place_info_json: placeInfo || null,
            ai_response: cleanReply,
            ai_model: "claude",
            generation_time_ms: null, // 필요시 계산
            is_used: false,
            status: "draft",
          };

          const { data: reviewResult, error: reviewError } = await supabase
            .from("review_responses")
            .insert(reviewData)
            .select();

          if (reviewError) {
            console.error("❌ review_responses 저장 실패:", reviewError);
            dbSaveStatus = "failed";
            dbError = reviewError.message;
          } else {
            savedReviewId = reviewResult[0]?.id;
            console.log("✅ review_responses 저장 성공:", savedReviewId);
            dbSaveStatus = "success";
          }
        } catch (dbErr) {
          console.error("❌ DB 저장 중 오류:", dbErr);
          dbSaveStatus = "failed";
          dbError = dbErr.message;
        }
      } else {
        console.log("⚠️ Supabase 클라이언트가 초기화되지 않아 DB 저장을 건너뜁니다.");
      }
      // ==================== DB 저장 로직 끝 ====================

      res.json({
        success: true,
        data: {
          reply: cleanReply,
          originalReview: reviewText,
          reviewId: savedReviewId, // 저장된 리뷰 ID 반환
        },
        metadata: {
          textLength: reviewText.length,
          replyLength: cleanReply.length,
          generatedAt: new Date().toISOString(),
          server: "Integrated Server",
          dbSaveStatus: dbSaveStatus, // "not_attempted", "success", "failed"
          dbError: dbError, // 에러 메시지 (있을 경우)
        },
      });
    } catch (error) {
      console.error("Claude 답글 생성 실패:", error.message);

      // Claude 실패시 ChatGPT로 대체 시도
      try {
        console.log("ChatGPT로 대체 답글 생성 시도");

        // 식당 정보를 프롬프트에 추가
        let placeInfoText = "";
        if (placeInfo || ownerTips) {
          placeInfoText = "\n\n우리 식당 정보:\n";
          if (placeInfo) {
            if (placeInfo.basic?.name) placeInfoText += `상호: ${placeInfo.basic.name}\n`;
            if (placeInfo.basic?.category) placeInfoText += `업종: ${placeInfo.basic.category}\n`;
            if (placeInfo.menu && placeInfo.menu.length > 0) {
              placeInfoText += `메뉴: ${placeInfo.menu.slice(0, 8).map(m => m.name).join(', ')}\n`;
            }
          }
          if (ownerTips) {
            placeInfoText += `🌟 사장님 강조 포인트: ${ownerTips}\n`;
          }
        }

        const fallbackPrompt = `다음 고객 리뷰에 대한 사업주 답글을 작성해주세요:
"${reviewText}"
${placeInfoText}

요구사항:
- 감사 인사 포함
- 리뷰에서 언급한 메뉴나 음식에 대해 반드시 답변
- 궁금해하는 메뉴가 있다면 우리 식당 메뉴를 바탕으로 추천
- 🌟 사장님이 강조한 포인트를 자연스럽게 반영
- 새로운 고객들도 볼 것을 고려하여 메뉴와 분위기 소개
- 친근하고 정중한 톤
- 150-250자 내외
- 답글만 작성`;

        const fallbackReply = await callChatGPTForReview(fallbackPrompt);
        const cleanFallbackReply = fallbackReply.trim().replace(/^"|"$/g, "");

        res.json({
          success: true,
          data: {
            reply: cleanFallbackReply,
            originalReview: reviewText,
          },
          metadata: {
            textLength: reviewText.length,
            replyLength: cleanFallbackReply.length,
            generatedAt: new Date().toISOString(),
            server: "Integrated Server (Fallback)",
          },
        });
      } catch (fallbackError) {
        console.error("대체 답글 생성도 실패:", fallbackError.message);
        throw new Error("답글 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    }
  } catch (error) {
    console.error("답글 생성 전체 오류:", error);
    res.status(500).json({
      success: false,
      error: error.message || "답글 생성 중 오류가 발생했습니다.",
    });
  }
});

// ==================== 네이버 플레이스 스크래핑 API는 보안상의 이유로 비활성화합니다. ====================
app.get("/api/scrape/places", (req, res) => {
  return res.status(503).json({
    success: false,
    error:
      "네이버 플레이스 스크래핑 기능이 보안상의 이유로 비활성화되었습니다.",
  });
});

// ==================== AI API 키 테스트 ====================

// AI API 키 테스트 엔드포인트
app.get("/api/test-keys", async (req, res) => {
  const testResults = {
    openai: "NOT_TESTED",
    gemini: "NOT_TESTED",
    claude: "NOT_TESTED",
  };

  // OpenAI 테스트
  try {
    await axios.get("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      timeout: 10000,
    });
    testResults.openai = "SUCCESS";
  } catch (error) {
    testResults.openai =
      "FAILED: " + (error.response?.data?.error?.message || error.message);
  }

  // Gemini 테스트
  try {
    await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [{ text: "Test" }],
          },
        ],
      },
      { timeout: 10000 }
    );
    testResults.gemini = "SUCCESS";
  } catch (error) {
    testResults.gemini =
      "FAILED: " + (error.response?.data?.error?.message || error.message);
  }

  // Claude 테스트
  try {
    await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-haiku-20240307",
        max_tokens: 10,
        messages: [{ role: "user", content: "Test" }],
      },
      {
        headers: {
          "x-api-key": CLAUDE_API_KEY,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        timeout: 10000,
      }
    );
    testResults.claude = "SUCCESS";
  } catch (error) {
    testResults.claude =
      "FAILED: " + (error.response?.data?.error?.message || error.message);
  }

  res.json(testResults);
});

// ==================== 추가 API 엔드포인트들 ====================

// 블로그 스타일 옵션 조회
app.get("/api/blog-styles", (req, res) => {
  res.json({
    styles: [
      {
        value: "일상후기",
        label: "일상후기",
        description: "편안하고 친근한 톤으로 일상 경험을 공유",
      },
      {
        value: "상세리뷰",
        label: "상세리뷰",
        description: "음식, 서비스, 분위기 등을 자세히 분석",
      },
      {
        value: "사진중심",
        label: "사진중심",
        description: "시각적 요소를 강조한 생생한 묘사",
      },
      {
        value: "분위기중심",
        label: "분위기중심",
        description: "가게의 무드와 감성에 집중",
      },
    ],
  });
});

// 리뷰 분석 옵션 조회
app.get("/api/analysis-options", (req, res) => {
  res.json({
    analysisTypes: [
      {
        value: "comprehensive",
        label: "종합 분석",
        description: "감정, 평점, 키워드, 개선점을 모두 분석",
      },
      {
        value: "sentiment",
        label: "감정 분석",
        description: "고객의 감정과 만족도에 집중 분석",
      },
      {
        value: "keywords",
        label: "키워드 분석",
        description: "리뷰에서 중요한 키워드 추출",
      },
      {
        value: "improvement",
        label: "개선점 분석",
        description: "문제점과 개선 방안에 집중",
      },
    ],
    options: [
      {
        value: "generateReply",
        label: "답글 생성",
        description: "리뷰에 대한 적절한 답글 제안",
      },
      {
        value: "extractRating",
        label: "평점 추출",
        description: "리뷰 내용에서 평점 추정",
      },
      {
        value: "findIssues",
        label: "문제점 파악",
        description: "언급된 불만사항과 문제점 추출",
      },
      {
        value: "suggestActions",
        label: "개선 제안",
        description: "구체적인 개선 방안 제시",
      },
    ],
  });
});

// 지역 데이터 조회
app.get("/api/regions", (req, res) => {
  res.json({
    regions: {
      서울: [
        "강남구",
        "강동구",
        "강북구",
        "강서구",
        "관악구",
        "광진구",
        "구로구",
        "금천구",
        "노원구",
        "도봉구",
        "동대문구",
        "동작구",
        "마포구",
        "서대문구",
        "서초구",
        "성동구",
        "성북구",
        "송파구",
        "양천구",
        "영등포구",
        "용산구",
        "은평구",
        "종로구",
        "중구",
        "중랑구",
      ],
      부산: [
        "강서구",
        "금정구",
        "남구",
        "동구",
        "동래구",
        "부산진구",
        "북구",
        "사상구",
        "사하구",
        "서구",
        "수영구",
        "연제구",
        "영도구",
        "중구",
        "해운대구",
        "기장군",
      ],
      대구: [
        "남구",
        "달서구",
        "동구",
        "북구",
        "서구",
        "수성구",
        "중구",
        "달성군",
      ],
      인천: [
        "계양구",
        "남동구",
        "동구",
        "미추홀구",
        "부평구",
        "서구",
        "연수구",
        "중구",
        "강화군",
        "옹진군",
      ],
    },
  });
});

// ==================== 에러 핸들러 ====================

// 404 에러 핸들러
app.use("*", (req, res) => {
  const prod = process.env.NODE_ENV === "production";
  const payload = {
    error: "요청한 경로를 찾을 수 없습니다.",
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  };
  if (!prod) {
    payload.availableEndpoints = [
      "GET /",
      "GET /health",
      "GET /auth/me",
      "POST /auth/logout",
      "POST /api/keywords",
      "POST /api/keyword-trend",
      "GET /api/related-keywords",
      "POST /api/generate-blog",
      "POST /api/analyze-review",
      "POST /api/generate-reply",
      "GET /api/search/local",
      "GET /api/test-keys",
      "GET /auth/kakao/login",
      "GET /auth/kakao/callback",
    ];
  }
  res.status(404).json(payload);
});

// 전역 에러 핸들러
app.use((error, req, res, next) => {
  console.error("전역 에러:", error);
  res.status(500).json({
    error: "서버 내부 오류가 발생했습니다.",
    details:
      process.env.NODE_ENV === "development"
        ? error.message
        : "서버 관리자에게 문의하세요.",
    timestamp: new Date().toISOString(),
  });
});

// ==================== 서버 시작 ====================

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error("[SECURITY] In production, JWT_SECRET must be set. Exiting.");
  process.exit(1);
}

// Vercel 환경에서는 export만, 로컬 환경에서는 listen
if (process.env.VERCEL) {
  // Vercel serverless 환경
  module.exports = app;
} else {
  // 로컬 개발 환경
  app.listen(PORT, "0.0.0.0", () => {
    console.log("==========================================");
    console.log("🚀 통합 API 서버가 시작되었습니다!");
    console.log(`🌐 서버 주소: http://0.0.0.0:${PORT}`);
    console.log(`🏥 서버 상태: http://0.0.0.0:${PORT}/health`);
    console.log(`📊 환경: ${process.env.NODE_ENV || "development"}`);
    console.log("==========================================");
    console.log("");
    console.log("🔧 사용 가능한 서비스:");
    console.log("");
    console.log("📊 네이버 키워드 도구:");
    console.log('- 키워드 검색: POST /api/keywords (Body: {DataQ: "치킨"})');
    console.log(
      '- 키워드 트렌드: POST /api/keyword-trend (Body: {keyword: "치킨"})'
    );
    console.log("- 연관 키워드: GET /api/related-keywords?seed=맛집");
    console.log("");
    console.log("🤖 AI 블로그 생성:");
    console.log("- 블로그 생성: POST /api/generate-blog");
    console.log("- API 키 테스트: GET /api/test-keys");
    console.log("");
    console.log("🔍 리뷰 분석:");
    console.log("- 리뷰 분석: POST /api/analyze-review");
    console.log("- 답글 생성: POST /api/generate-reply");
    console.log("- 분석 옵션: GET /api/analysis-options");
    console.log("");
    console.log("📍 네이버 플레이스 검색:");
    console.log("- 로컬 검색: GET /api/search/local?query=마포맛집");
    console.log("");
    console.log("⚙️ API 설정 확인:");
    console.log(
      `- 네이버 Customer ID: ${NAVER_API.customerId ? "✅ 설정됨" : "❌ 미설정"}`
    );
    console.log(
      `- 네이버 API Key: ${NAVER_API.apiKey ? "✅ 설정됨" : "❌ 미설정"}`
    );
    console.log(
      `- 네이버 Secret Key: ${NAVER_API.secretKey ? "✅ 설정됨" : "❌ 미설정"}`
    );
    console.log(
      `- 네이버 검색 Client ID: ${
        NAVER_SEARCH.clientId ? "✅ 설정됨" : "❌ 미설정"
      }`
    );
    console.log(
      `- 네이버 검색 Client Secret: ${
        NAVER_SEARCH.clientSecret ? "✅ 설정됨" : "❌ 미설정"
      }`
    );
    console.log(
      `- OpenAI API Key: ${OPENAI_API_KEY ? "✅ 설정됨" : "❌ 미설정"}`
    );
    console.log(
      `- Gemini API Key: ${GEMINI_API_KEY ? "✅ 설정됨" : "❌ 미설정"}`
    );
    console.log(
      `- Claude API Key: ${CLAUDE_API_KEY ? "✅ 설정됨" : "❌ 미설정"}`
    );
    console.log("------------------------------------------");
    console.log("Feature Flags:");
    console.log(
      `- FEATURE_API_READ_NEXT: ${FEATURE_API_READ_NEXT ? "ON" : "OFF"}`
    );
    console.log(
      `- FEATURE_API_CHAT_NEXT: ${FEATURE_API_CHAT_NEXT ? "ON" : "OFF"}`
    );
    console.log(`- FEATURE_AUTH_NEXT: ${FEATURE_AUTH_NEXT ? "ON" : "OFF"}`);
    console.log("==========================================");
    console.log("🔐 Kakao OAuth:");
    console.log(
      `- Kakao REST API Key: ${KAKAO_REST_API_KEY ? "✅ 설정됨" : "❌ 미설정"}`
    );
    console.log(`- Kakao Redirect URI: ${KAKAO_REDIRECT_URI || "❌ 미설정"}`);
    console.log(
      `- Kakao Client Secret: ${KAKAO_CLIENT_SECRET ? "✅ 설정됨" : "❌ 미설정"}`
    );
    console.log("------------------------------------------");
    console.log("Feature Flags:");
    console.log(
      `- FEATURE_API_READ_NEXT: ${FEATURE_API_READ_NEXT ? "ON" : "OFF"}`
    );
    console.log(
      `- FEATURE_API_CHAT_NEXT: ${FEATURE_API_CHAT_NEXT ? "ON" : "OFF"}`
    );
    console.log(`- FEATURE_AUTH_NEXT: ${FEATURE_AUTH_NEXT ? "ON" : "OFF"}`);
    console.log("==========================================");
  });

  // 종료 처리 (로컬 환경에서만)
  process.on("SIGINT", () => {
    console.log("\n🛑 서버를 종료합니다...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\n🛑 서버를 종료합니다...");
    process.exit(0);
  });
}
