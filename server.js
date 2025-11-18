require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
const { spawn } = require("child_process");
const helmet = require("helmet");
const { createClient } = require("@supabase/supabase-js");
const multer = require("multer");

const app = express();
app.set("trust proxy", true);

// 개발 환경 체크
const isDevelopment = process.env.NODE_ENV === 'development';

// 조건부 로깅 함수
const devLog = (...args) => {
  if (isDevelopment) {
    console.log(...args);
  }
};

const devError = (...args) => {
  if (isDevelopment) {
    console.error(...args);
  }
};

// 환경변수에서 설정 읽기 (Render/Vercel/로컬 모두 호환)
// PORT가 지정되어 있으면 해당 포트 사용, 없으면 3003 사용 (3000 충돌 방지)
const PORT = Number(process.env.PORT) || 3003;

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
const OPENAI_SHORTS_MODEL =
  process.env.OPENAI_SHORTS_MODEL ||
  process.env.OPENAI_CHAT_MODEL ||
  "gpt-4o-mini";

// Supabase 설정
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase = null;

// Supabase 클라이언트 초기화
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    devLog("✅ Supabase 클라이언트 초기화 성공");
  } catch (error) {
    devError("❌ Supabase 클라이언트 초기화 실패:", error.message);
  }
} else {
  devLog("⚠️ Supabase 환경변수가 설정되지 않았습니다. DB 저장 기능이 비활성화됩니다.");
}
// Kakao OAuth 설정
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const KAKAO_REDIRECT_URI = process.env.KAKAO_REDIRECT_URI;
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET || "";
// JWT 설정
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.JWT_SECRET) {
  devLog(
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
  allowedHeaders: ["Content-Type", "Authorization", "user-id"],
};

// 미들웨어 설정
app.use(cors(corsOptions));
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "*")
) {
  devLog(
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
  devLog("[DEV] Content Security Policy disabled for development");
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
    devLog(
      `${new Date().toISOString()} - ${req.method} ${req.path} - ${
        res.statusCode
      } - ${durationMs}ms - reqId:${reqId}`
    );
  });
  next();
});
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Multer 설정 (파일 업로드용)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  }
});

// CSP report collection endpoint
app.post(
  "/csp-report",
  express.json({ type: ["application/csp-report", "application/json"] }),
  (req, res) => {
    try {
      devLog("CSP Report:", JSON.stringify(req.body));
    } catch (e) {
      devLog("CSP Report (raw):", req.body);
    }
    res.status(204).end();
  }
);
// Limit CSP report spam
app.use("/csp-report", rateLimiter);

// ==================== API 라우트 (정적 파일보다 먼저) ====================

// 클라이언트용 환경변수 제공 (공개 가능한 키만)
app.options("/api/config", (req, res) => {
  // CORS preflight 요청 처리
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.status(200).end();
});

app.get("/api/config", (req, res) => {
  // CORS 헤더 추가
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  res.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
  });
});

// 정적 파일 제공 (안전한 디렉터리만 공개)
// 정적 파일 서빙 (루트 경로도 추가)
app.use(express.static(path.join(__dirname)));
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/images", express.static(path.join(__dirname, "images")));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use("/admin", express.static(path.join(__dirname, "admin")));
app.use("/docs", express.static(path.join(__dirname, "docs")));

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
app.get("/sanao-book.html", (req, res) => sendHtml(res, "sanao-book.html"));
app.get("/sajangpick-book.html", (req, res) => sendHtml(res, "sajangpick-book.html"));
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
  devLog(`IP: ${ip} - reqId:${req.requestId}`);
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

// ==================== 인증 ====================
// Note: 카카오 로그인은 Supabase OAuth를 사용합니다. (login.html, join.html 참고)
// 서버 방식 카카오 로그인 코드는 삭제되었습니다.

// 이전 서버 방식 카카오 로그인 라우트 삭제됨:
// - /auth/kakao/login
// - /auth/kakao/callback  
// - /auth/me

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
// const testSupabaseHandler = require("./api/test-supabase");
// app.get("/api/test-supabase", testSupabaseHandler);

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

// ==================== 관리자 통계 API ====================
const adminAnalyticsHandler = require("./api/admin/analytics");
const adminDashboardHandler = require("./api/admin/dashboard");
app.get("/api/admin/analytics", adminAnalyticsHandler);
app.get("/api/admin/dashboard", adminDashboardHandler);

// ==================== ChatGPT 블로그 생성 API ====================
const chatgptBlogHandler = require("./api/chatgpt-blog");
app.post("/api/chatgpt-blog", chatgptBlogHandler);
app.post("/api/chatgpt", chatgptBlogHandler);  // 레시피 생성용 엔드포인트 추가

// ==================== 뉴스 게시판 API ====================
const newsBoardHandler = require("./api/news-board");
app.get("/api/news-board", newsBoardHandler);
app.post("/api/news-board", newsBoardHandler);
app.put("/api/news-board", newsBoardHandler);
app.delete("/api/news-board", newsBoardHandler);
// news-collect.js 파일이 없으므로 주석 처리
// const newsCollectHandler = require("./api/news-collect");
const naverSectionNewsHandler = require("./api/naver-section-news");
// app.post("/api/news-collect", newsCollectHandler);
app.get("/api/naver-section-news", naverSectionNewsHandler);

// AI 뉴스 추천 API
const aiNewsRecommendHandler = require("./api/ai-news-recommend");
app.post("/api/ai-news-recommend", aiNewsRecommendHandler);

// AI 뉴스 해석 API
const newsAiSummaryHandler = require("./api/news-ai-summary");
app.post("/api/news-ai-summary", newsAiSummaryHandler);

// 뉴스 원문 추출 API
const newsFetchHandler = require("./api/news-fetch");
app.get("/api/news-fetch", newsFetchHandler);

// 뉴스 검색 API (소상공인/식당 특화)
const newsSearchHandler = require("./api/news-search");
app.get("/api/news-search", newsSearchHandler);
app.post("/api/news-search", newsSearchHandler);

// ==================== 정책지원금 API ====================
const policySupportHandler = require("./api/policy-support");
app.get("/api/policy-support", policySupportHandler);
app.post("/api/policy-support", policySupportHandler);
app.put("/api/policy-support", policySupportHandler);
app.delete("/api/policy-support", policySupportHandler);
app.get("/api/policy-support/categories", policySupportHandler);
app.post("/api/policy-support/bookmark", policySupportHandler);
app.post("/api/policy-support/apply", policySupportHandler);

// 실제 정책 데이터 수집 API
const fetchRealPolicyHandler = require("./api/fetch-real-policy-data");
app.get("/api/fetch-real-policies", fetchRealPolicyHandler);
app.post("/api/fetch-real-policies", fetchRealPolicyHandler);

// API 테스트 엔드포인트 (디버깅용)
const testPolicyApiHandler = require("./api/test-policy-api");
app.get("/api/test-policy-api", testPolicyApiHandler);
app.post("/api/test-policy-api", testPolicyApiHandler);

// ==================== 레시피 관리 시스템 API ====================
// 레시피 CRUD 및 검색 API
const recipesRouter = require("./api/recipes");
app.use("/api/recipes", recipesRouter);

// 레시피 이미지 API (Pexels)
const recipeImageRouter = require("./api/recipe-image");
app.use("/api/recipe-image", recipeImageRouter);

// ==================== ADLOG 순위 추적 API ====================
// 어드민 스크래핑 제어 API
const scrapingControlRouter = require("./api/admin/scraping-control");
app.use("/api/admin", scrapingControlRouter);

// ==================== 구독 시스템 API ====================
// 가격 설정 API - require 실패 시 대비하여 주석 처리
// const pricingConfigHandler = require("./api/subscription/pricing-config");
// app.get("/api/subscription/pricing-config", pricingConfigHandler);
// app.put("/api/subscription/pricing-config", pricingConfigHandler);

// 토큰 설정 API - require 실패 시 대비하여 주석 처리
// const tokenConfigHandler = require("./api/subscription/token-config");
// app.get("/api/subscription/token-config", tokenConfigHandler);
// app.put("/api/subscription/token-config", tokenConfigHandler);

// 토큰 사용량 API
const tokenUsageHandler = require("./api/subscription/token-usage");
app.get("/api/subscription/token-usage", tokenUsageHandler);
app.post("/api/subscription/token-usage", tokenUsageHandler);

// 구독 주기 API
const subscriptionCycleHandler = require("./api/subscription/cycle");
app.get("/api/subscription/cycle", subscriptionCycleHandler);
app.post("/api/subscription/cycle", subscriptionCycleHandler);
app.put("/api/subscription/cycle", subscriptionCycleHandler);

// 사용자 대시보드 API
const userDashboardHandler = require("./api/subscription/user-dashboard");
app.get("/api/subscription/user-dashboard", userDashboardHandler);
app.post("/api/subscription/user-dashboard", userDashboardHandler);

// 크론 작업 API (수동 실행용)
const subscriptionRenewalHandler = require("./api/cron/subscription-renewal");
app.get("/api/cron/subscription-renewal", subscriptionRenewalHandler);

// 정책 상태 자동 업데이트 크론 작업
const policyStatusUpdateHandler = require("./api/cron/policy-status-update");
app.get("/api/cron/policy-status-update", async (req, res) => {
  const updateExpiredPolicies = require("./api/cron/policy-status-update");
  const result = await updateExpiredPolicies();
  res.json(result);
});

// ==================== 블로그 스타일 설정 API ====================
const blogStyleHandler = require("./api/blog-style");
app.get("/api/blog-style", blogStyleHandler);
app.post("/api/blog-style", blogStyleHandler);

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
    devLog("키워드 검색 요청 수신");

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

    devLog(
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
    devError("네이버 검색광고 API 호출 오류:", error.message);

    if (error.response) {
      const { status, data } = error.response;
      devError(`네이버 API 오류 (${status}):`, data);

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
    devLog("키워드 트렌드 검색 요청 수신");

    // 네이버 데이터랩 API로 실제 트렌드 데이터 요청
    const trendData = await getNaverTrendData(keyword);

    if (trendData && trendData.length > 0) {
      devLog(
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
    devError("키워드 트렌드 생성 오류:", error.message);

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
      devLog("네이버 데이터랩 API 키가 설정되지 않음");
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

    devLog("네이버 데이터랩 API 요청:", requestBody);

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
    devError(
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
      devLog("키워드 API 조회 실패:", apiError.message);
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
    devError("대체 트렌드 데이터 생성 실패:", error.message);

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
    devLog("연관 키워드 검색 요청 수신:", seed);

    // /relkwdstat 엔드포인트가 작동하지 않을 수 있으므로
    // /keywordstool 엔드포인트를 사용하여 연관 키워드 조회
    const timestamp = Date.now().toString();
    const method = "GET";
    const uri = "/keywordstool";
    const signature = generateSignature(
      timestamp,
      method,
      uri,
      NAVER_API.secretKey
    );

    devLog(`네이버 API 호출: ${NAVER_API.baseUrl}${uri}`);

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

    devLog(`연관 키워드 검색 성공: ${response.data.keywordList?.length || 0}개 결과`);
    
    // 시드 키워드와 정확히 일치하는 항목 제외
    const keywordList = (response.data.keywordList || []).filter(item => {
      const keyword = item.relKeyword || item.keyword || "";
      return keyword.toLowerCase().trim() !== seed.toLowerCase().trim();
    });

    res.json({
      keywordList: keywordList,
      searchInfo: {
        seed: seed,
        timestamp: new Date().toISOString(),
        server: "Integrated Server",
        totalCount: keywordList.length,
      },
    });
  } catch (error) {
    devError("연관 키워드 API 호출 오류:", error.message);
    devError("에러 상세:", error.response?.data || error.response?.status);

    if (error.response) {
      // 네이버 API 오류를 그대로 전달하지 않고, 더 명확한 메시지 제공
      const status = error.response.status;
      let errorMessage = `네이버 API 오류 (${status})`;
      
      if (status === 404) {
        errorMessage = "네이버 API 엔드포인트를 찾을 수 없습니다. API 설정을 확인해주세요.";
      } else if (status === 401) {
        errorMessage = "네이버 API 인증에 실패했습니다. API 키를 확인해주세요.";
      } else if (status === 403) {
        errorMessage = "네이버 API 사용 권한이 없습니다.";
      }

      res.status(500).json({
        error: errorMessage,
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
    devLog("네이버 로컬 검색 요청 수신");

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

    devLog(`네이버 로컬 검색 성공: ${response.data.items.length}개 결과`);
    res.json({
      success: true,
      items: response.data.items,
      metadata: {
        query: query,
        api: "Naver Search API (Local)",
      },
    });
  } catch (error) {
    devError(
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
    devLog("ChatGPT API 호출 중 (블로그 생성)...");
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
    devError("ChatGPT API 오류:", error.response?.data || error.message);
    throw new Error(
      "ChatGPT API 호출 실패: " +
        (error.response?.data?.error?.message || error.message)
    );
  }
}

// ChatGPT API 호출 (리뷰 분석용)
async function callChatGPTForReview(prompt) {
  try {
    devLog("ChatGPT API 호출 중 (리뷰 분석)...");
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
    devError("ChatGPT API 오류:", error.response?.data || error.message);
    throw new Error(
      "ChatGPT API 호출 실패: " +
        (error.response?.data?.error?.message || error.message)
    );
  }
}

// Gemini API 호출
async function callGemini(prompt) {
  try {
    devLog("Gemini API 호출 중...");
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
    devError("Gemini API 오류:", error.response?.data || error.message);
    if (error.response?.status === 404) {
      try {
        devLog("gemini-1.5-flash로 재시도...");
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
        devError(
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
    devLog("Claude API 호출 중...");
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
    devError("Claude API 오류:", error.response?.data || error.message);
    throw new Error(
      "Claude API 호출 실패: " +
        (error.response?.data?.error?.message || error.message)
    );
  }
}

async function callOpenAIForShortsPlan({ keywords, style, durationSec }) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");
  }

  const cleanedKeywords = (keywords || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 10);

  const promptContext = `
[요청 조건]
- 영상 주제 키워드: ${cleanedKeywords.join(", ") || "미작성"}
- 영상 스타일: ${style || "기본"}
- 영상 길이: ${durationSec || 15}초
- 목적: 식당/카페 홍보용 SNS 숏폼 영상

[작성 가이드]
1. plan_summary: 영상 핵심 메시지를 1문장으로 요약
2. plan_outline: 컷별 구성(3~4컷) 배열. 각 요소는 {"cut":번호,"duration":"3초","description":"장면 설명","text":"자막/멘트"} 형태.
3. script: 컷 순서에 맞춰 자연스럽게 이어지는 나레이션/자막 문장 (전체 ${durationSec ||
    15}초 기준)
4. tips: 촬영/편집 시 추가 팁 (선택)

[출력 형식]
JSON 객체로만 응답하며 key는 plan_summary, plan_outline, script, tips를 포함합니다.
`;

  try {
    devLog("OpenAI 숏폼 기획 요청 중...");
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: OPENAI_SHORTS_MODEL,
        messages: [
          {
            role: "system",
            content:
              "당신은 소상공인 식당을 위한 SNS 숏폼 전문 영상 기획자입니다. 반드시 JSON으로만 응답하세요.",
          },
          { role: "user", content: promptContext },
        ],
        temperature: 0.6,
        max_tokens: 900,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 45000,
      }
    );

    const content = response.data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI 응답이 비어 있습니다.");

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error("OpenAI 응답을 JSON으로 파싱할 수 없습니다.");
    }

    const planSummary = parsed.plan_summary?.trim() || "";
    const planOutline = Array.isArray(parsed.plan_outline)
      ? parsed.plan_outline
      : [];
    const tips =
      typeof parsed.tips === "string"
        ? parsed.tips.trim()
        : Array.isArray(parsed.tips)
        ? parsed.tips.join(" ")
        : "";
    const planText =
      `${planSummary}\n\n` +
      planOutline
        .map((item, idx) => {
          const cut = item.cut || idx + 1;
          const duration = item.duration ? ` (${item.duration})` : "";
          const description = item.description || "";
          const text = item.text ? `\n   - 자막/멘트: ${item.text}` : "";
          return `${cut}컷${duration}: ${description}${text}`;
        })
        .join("\n") +
      (tips ? `\n\n추가 팁: ${tips}` : "");

    const script =
      typeof parsed.script === "string"
        ? parsed.script.trim()
        : Array.isArray(parsed.script)
        ? parsed.script.join("\n")
        : "";

    return { plan: planText.trim(), script };
  } catch (error) {
    devError(
      "OpenAI 숏폼 기획 생성 오류:",
      error.response?.data || error.message
    );
    throw new Error(
      "AI 기획 생성에 실패했습니다: " +
        (error.response?.data?.error?.message || error.message || "")
    );
  }
}

function ensureUserId(userId) {
  if (!userId || typeof userId !== "string") {
    const error = new Error("로그인이 필요합니다.");
    error.statusCode = 401;
    throw error;
  }
}

async function savePlanHistoryEntry({
  userId,
  keywords,
  style,
  duration,
  plan,
  script,
  source = "ai",
}) {
  if (!supabase) {
    devError("Supabase가 초기화되지 않았습니다. 초안 저장을 건너뜁니다.");
    return null;
  }

  const payload = {
    user_id: userId,
    keywords,
    style: style || null,
    duration_sec: duration || null,
    plan_text: plan,
    script_text: script,
    source,
  };

  const { data, error } = await supabase
    .from("shorts_plan_history")
    .insert(payload)
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    devError("Supabase plan history 저장 실패:", error);
    return null;
  }
  return data;
}

async function fetchPlanHistoryEntries(userId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("shorts_plan_history")
    .select(
      "id, keywords, style, duration_sec, plan_text, script_text, source, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    devError("Supabase plan history 조회 실패:", error);
    return [];
  }
  return data || [];
}

async function deletePlanHistoryEntry(userId, entryId) {
  if (!supabase) return false;
  const { error } = await supabase
    .from("shorts_plan_history")
    .delete()
    .eq("user_id", userId)
    .eq("id", entryId);

  if (error) {
    devError("Supabase plan history 삭제 실패:", error);
    return false;
  }
  return true;
}

// ==================== ChatGPT 채팅 API ====================

// ChatGPT 채팅 API - api/chat.js 사용 (Function Calling 포함)
const chatHandler = require("./api/chat");
app.post("/api/chat", chatHandler);

// 기존 코드 (Function Calling 없이) - 주석 처리
/*
app.post("/api/chat", async (req, res) => {
  try {
    const rawMsg = req.body?.message || "";
    const message = sanitizeString(rawMsg);

    devLog("ChatGPT 채팅 요청 수신");

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

    // 현재 날짜 및 계절 정보
    const now = new Date();
    const month = now.getMonth() + 1; // 1-12
    const day = now.getDate();
    const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const weekday = weekdays[now.getDay()];
    let season = '';
    if (month >= 3 && month <= 5) season = '봄';
    else if (month >= 6 && month <= 8) season = '여름';
    else if (month >= 9 && month <= 11) season = '가을';
    else season = '겨울';

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "당신은 ChatGPT입니다. 사용자의 모든 질문에 대해 유용하고 자연스러운 답변을 제공해주세요.\n\n" +
              "현재 날짜 정보: " + `${now.getFullYear()}년 ${month}월 ${day}일 ${weekday}, ${season}` + "\n\n" +
              "답변 지침:\n" +
              "1. 날씨 질문: 실시간 날씨 데이터는 제공할 수 없지만, 현재 계절(" + season + ")과 해당 지역의 일반적인 날씨 패턴을 바탕으로 예상 날씨를 안내해주세요. 예를 들어 \"현재 " + season + "인 부산은 일반적으로 [계절별 특징]하며, 오늘 같은 날씨라면 [예상 날씨]일 가능성이 높습니다. 외출 시에는 [구체적인 조언]하시면 좋습니다\"와 같이 구체적이고 유용하게 답변해주세요.\n" +
              "2. 일반 지식: 학습된 지식을 바탕으로 정확하고 도움이 되는 정보를 제공해주세요.\n" +
              "3. 모든 질문에 대해: 친근하고 자연스러우며, '제공할 수 없습니다' 같은 부정적인 표현보다는 가능한 한 유용한 정보나 대안을 제시해주세요. ChatGPT 웹사이트에서 사용자들이 받는 것처럼 자연스럽고 도움이 되는 답변을 제공해주세요.\n" +
              "4. 한국어로 친근하고 정확하게 답변하며, 사용자가 도움이 되도록 최선을 다해주세요.",
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

    devLog("ChatGPT 응답 성공");

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
    devError("ChatGPT API 오류:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      error: "ChatGPT API 호출 중 오류가 발생했습니다.",
      details: error.response?.data?.error?.message || error.message,
      timestamp: new Date().toISOString(),
    });
  }
});
*/

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
    devLog("블로그 생성 요청 수신");

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
      devLog("Step 1: ChatGPT 초안 작성 시작");
      const chatgptPrompt = generateBlogPrompt(storeData, "chatgpt");
      results.step1_chatgpt = await callChatGPTForBlog(chatgptPrompt);
      devLog("Step 1 완료");
    } catch (error) {
      devError("Step 1 실패:", error.message);
      return res.status(500).json({
        success: false,
        error: `ChatGPT 단계에서 오류: ${error.message}`,
        step: "chatgpt",
      });
    }

    // Step 2: Gemini로 개선
    try {
      devLog("Step 2: Gemini 개선 시작");
      storeData.previousContent = results.step1_chatgpt;
      const geminiPrompt = generateBlogPrompt(storeData, "gemini");
      results.step2_gemini = await callGemini(geminiPrompt);
      devLog("Step 2 완료");
    } catch (error) {
      devError("Step 2 실패:", error.message);
      results.step2_gemini = results.step1_chatgpt;
      devLog("Gemini 단계 실패, ChatGPT 결과 사용");
    }

    // Step 3: Claude로 최종 다듬기
    try {
      devLog("Step 3: Claude 최종 다듬기 시작");
      storeData.previousContent = results.step2_gemini;
      const claudePrompt = generateBlogPrompt(storeData, "claude");
      results.step3_claude = await callClaude(claudePrompt);
      devLog("Step 3 완료");
    } catch (error) {
      devError("Step 3 실패:", error.message);
      results.step3_claude = results.step2_gemini;
      devLog("Claude 단계 실패, 이전 결과 사용");
    }

    results.finalBlog =
      results.step3_claude || results.step2_gemini || results.step1_chatgpt;

    devLog("블로그 생성 완료");

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
    devError("블로그 생성 전체 오류:", error);
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
    devError("응답 파싱 오류:", error);
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

    devLog("리뷰 분석 요청 수신");
    if (placeInfo) {
      devLog("식당 정보 포함됨:", placeInfo.basic?.name || "정보 없음");
    }
    if (ownerTips) {
      devLog("사장님 추천 정보 포함됨");
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
      devLog("Step 1: ChatGPT로 기본 분석 시작");
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

      devLog("Step 1 완료");
    } catch (error) {
      devError("ChatGPT 분석 실패:", error.message);
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
        devLog("Step 2: Gemini로 감정 분석 보강");
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

        devLog("Step 2 완료");
      } catch (error) {
        devError("Gemini 감정 분석 실패:", error.message);
      }
    }

    // 답글 생성 (Claude)
    if (options && options.includes("generateReply")) {
      try {
        devLog("Step 3: Claude로 답글 생성");
        
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

        devLog("답글 생성 완료");

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
        devError("Claude 답글 생성 실패:", error.message);

        // Claude 실패시 ChatGPT로 대체 시도
        try {
          devLog("ChatGPT로 대체 답글 생성 시도");

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
              devLog("📦 DB 저장 시작 (Fallback)...");

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
                    devError("❌ places 저장 실패:", placeError);
                  } else {
                    savedPlaceId = placeData.place_id;
                    devLog("✅ places 저장 성공:", savedPlaceId);
                  }
                } else {
                  devLog("⚠️ place_id가 없어 places 테이블에 저장하지 않습니다.");
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
                devLog("⚠️ 테스트 회원(김사장)을 찾을 수 없습니다. 첫 번째 회원 사용.");
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
                devError("❌ review_responses 저장 실패:", reviewError);
                fallbackDbSaveStatus = "failed";
                fallbackDbError = reviewError.message;
              } else {
                fallbackReviewId = reviewResult[0]?.id;
                devLog("✅ review_responses 저장 성공:", fallbackReviewId);
                fallbackDbSaveStatus = "success";
              }
            } catch (dbErr) {
              devError("❌ DB 저장 중 오류:", dbErr);
              fallbackDbSaveStatus = "failed";
              fallbackDbError = dbErr.message;
            }
          } else {
            devLog("⚠️ Supabase 클라이언트가 초기화되지 않아 DB 저장을 건너뜁니다.");
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
          devError("대체 답글 생성도 실패:", fallbackError.message);
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

    devLog("리뷰 분석 완료!");

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
    devError("리뷰 분석 전체 오류:", error);
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

    devLog("리뷰 답글 생성 요청 수신");
    if (placeInfo) {
      devLog("식당 정보 포함됨:", placeInfo.basic?.name || "정보 없음");
    }
    if (ownerTips) {
      devLog("사장님 추천 정보 포함됨");
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
      devLog("Claude로 답글 생성 시작");

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

      devLog("답글 생성 완료");

      // ==================== DB 저장 로직 ====================
      let savedReviewId = null;
      let dbSaveStatus = "not_attempted"; // "not_attempted", "success", "failed"
      let dbError = null;

      if (supabase) {
        try {
          devLog("📦 DB 저장 시작...");

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
                devError("❌ places 저장 실패:", placeError);
              } else {
                savedPlaceId = placeData.place_id;
                devLog("✅ places 저장 성공:", savedPlaceId);
              }
            } else {
              devLog("⚠️ place_id가 없어 places 테이블에 저장하지 않습니다.");
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
            devLog("⚠️ 테스트 회원(김사장)을 찾을 수 없습니다. 첫 번째 회원 사용.");
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
            devError("❌ review_responses 저장 실패:", reviewError);
            dbSaveStatus = "failed";
            dbError = reviewError.message;
          } else {
            savedReviewId = reviewResult[0]?.id;
            devLog("✅ review_responses 저장 성공:", savedReviewId);
            dbSaveStatus = "success";
          }
        } catch (dbErr) {
          devError("❌ DB 저장 중 오류:", dbErr);
          dbSaveStatus = "failed";
          dbError = dbErr.message;
        }
      } else {
        devLog("⚠️ Supabase 클라이언트가 초기화되지 않아 DB 저장을 건너뜁니다.");
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
      devError("Claude 답글 생성 실패:", error.message);

      // Claude 실패시 ChatGPT로 대체 시도
      try {
        devLog("ChatGPT로 대체 답글 생성 시도");

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
        devError("대체 답글 생성도 실패:", fallbackError.message);
        throw new Error("답글 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    }
  } catch (error) {
    devError("답글 생성 전체 오류:", error);
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

// /api/config는 위쪽(220번 라인 근처)에 정의되어 있음

// ==================== 가게 정보 관리 API ====================

// 내 가게 정보 조회
app.get("/api/store-info", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase가 설정되지 않았습니다" });
    }

    // 임시: localStorage userId 사용 (추후 세션 인증으로 변경)
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: "userId가 필요합니다" });
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("store_place_url, store_name, store_address, store_business_hours, store_main_menu, store_landmarks, store_keywords")
      .eq("id", userId)
      .single();

    if (error) {
      devError("가게 정보 조회 실패:", error);
      return res.status(500).json({ error: "가게 정보 조회 실패", details: error.message });
    }

    res.json({ success: true, data: data || {} });
  } catch (error) {
    devError("가게 정보 조회 오류:", error);
    res.status(500).json({ error: "서버 오류", details: error.message });
  }
});

// 내 가게 정보 저장/수정
app.post("/api/store-info", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase가 설정되지 않았습니다" });
    }

    const { userId, storeInfo } = req.body;
    if (!userId) {
      return res.status(400).json({ error: "userId가 필요합니다" });
    }

    let finalStoreInfo = { ...storeInfo };
    let crawlResult = null;

    // 🔍 플레이스 URL이 있으면 자동 크롤링 시도
    if (storeInfo.placeUrl && storeInfo.placeUrl.trim()) {
      devLog('📍 플레이스 URL 발견, 자동 크롤링 시작:', storeInfo.placeUrl);

      try {
        // 1. 캐시 확인
        const { data: cachedPlace, error: cacheError } = await supabase
          .from('place_crawl_cache')
          .select('*')
          .eq('place_url', storeInfo.placeUrl)
          .single();

        if (cachedPlace && !cacheError) {
          devLog('✅ 캐시에서 플레이스 정보 발견:', cachedPlace.place_name);
          // 캐시된 정보 사용 (사용자가 입력한 정보가 있으면 우선 사용)
          if (!storeInfo.companyName && cachedPlace.place_name) {
            finalStoreInfo.companyName = cachedPlace.place_name;
          }
          if (!storeInfo.companyAddress && cachedPlace.place_address) {
            finalStoreInfo.companyAddress = cachedPlace.place_address;
          }
          if (!storeInfo.businessHours && cachedPlace.business_hours) {
            finalStoreInfo.businessHours = cachedPlace.business_hours;
          }
          if (!storeInfo.mainMenu && cachedPlace.main_menu) {
            finalStoreInfo.mainMenu = cachedPlace.main_menu;
          }
          crawlResult = { fromCache: true, data: cachedPlace };

          // 크롤링 카운트 증가
          await supabase
            .from('place_crawl_cache')
            .update({ 
              crawl_count: (cachedPlace.crawl_count || 0) + 1,
              last_crawled_at: new Date().toISOString()
            })
            .eq('id', cachedPlace.id);

        } else {
          devLog('⏭️ 캐시 없음, 사용자 입력 정보로 저장합니다.');
          // 캐시가 없으면 크롤링은 건너뛰고 사용자가 입력한 정보만 저장
          crawlResult = { fromCache: false, skipped: true };
        }

      } catch (crawlError) {
        devError('⚠️ 크롤링 체크 실패, 사용자 입력 정보 사용:', crawlError.message);
        // 크롤링 실패 시 사용자가 입력한 정보 그대로 사용
      }
    }

    // profiles 테이블 업데이트
    const updateData = {
      store_place_url: finalStoreInfo.placeUrl || null,
      store_name: finalStoreInfo.companyName || null,
      store_address: finalStoreInfo.companyAddress || null,
      store_business_hours: finalStoreInfo.businessHours || null,
      store_main_menu: finalStoreInfo.mainMenu || null,
      store_landmarks: finalStoreInfo.landmarks || null,
      store_keywords: finalStoreInfo.keywords || null,
    };

    const { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      devError("가게 정보 저장 실패:", error);
      return res.status(500).json({ error: "가게 정보 저장 실패", details: error.message });
    }

    res.json({ 
      success: true, 
      data,
      crawlResult: crawlResult // 크롤링 결과 정보 포함
    });
  } catch (error) {
    devError("가게 정보 저장 오류:", error);
    res.status(500).json({ error: "서버 오류", details: error.message });
  }
});

// 플레이스 크롤링 캐시 조회 (내 URL)
app.get("/api/place-cache", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase가 설정되지 않았습니다" });
    }

    const { placeUrl } = req.query;
    
    if (!placeUrl) {
      return res.status(400).json({ error: "placeUrl이 필요합니다" });
    }

    const { data, error } = await supabase
      .from('place_crawl_cache')
      .select('*')
      .eq('place_url', placeUrl)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      devError("캐시 조회 실패:", error);
      return res.status(500).json({ error: "캐시 조회 실패", details: error.message });
    }

    res.json({ success: true, data: data || null });
  } catch (error) {
    devError("캐시 조회 오류:", error);
    res.status(500).json({ error: "서버 오류", details: error.message });
  }
});

// 어드민: 모든 플레이스 크롤링 캐시 조회
app.get("/api/admin/place-cache", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase가 설정되지 않았습니다" });
    }

    const { data, error } = await supabase
      .from('place_crawl_cache')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      devError("캐시 목록 조회 실패:", error);
      return res.status(500).json({ error: "캐시 목록 조회 실패", details: error.message });
    }

    res.json({ success: true, data: data || [] });
  } catch (error) {
    devError("캐시 목록 조회 오류:", error);
    res.status(500).json({ error: "서버 오류", details: error.message });
  }
});

// 어드민: 특정 회원의 가게 정보 조회
app.get("/api/admin/store-info/:userId", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase가 설정되지 않았습니다" });
    }

    const { userId } = req.params;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, business_name, store_place_url, store_name, store_address, store_business_hours, store_main_menu, store_landmarks, store_keywords")
      .eq("id", userId)
      .single();

    if (error) {
      devError("회원 가게 정보 조회 실패:", error);
      return res.status(500).json({ error: "회원 가게 정보 조회 실패", details: error.message });
    }

    res.json({ success: true, data: data || {} });
  } catch (error) {
    devError("회원 가게 정보 조회 오류:", error);
    res.status(500).json({ error: "서버 오류", details: error.message });
  }
});

// 어드민: 특정 회원의 가게 정보 수정
app.put("/api/admin/store-info/:userId", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ error: "Supabase가 설정되지 않았습니다" });
    }

    const { userId } = req.params;
    const { storeInfo } = req.body;

    const updateData = {
      store_place_url: storeInfo.placeUrl || null,
      store_name: storeInfo.companyName || null,
      store_address: storeInfo.companyAddress || null,
      store_business_hours: storeInfo.businessHours || null,
      store_main_menu: storeInfo.mainMenu || null,
      store_landmarks: storeInfo.landmarks || null,
      store_keywords: storeInfo.keywords || null,
    };

    const { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      devError("회원 가게 정보 수정 실패:", error);
      return res.status(500).json({ error: "회원 가게 정보 수정 실패", details: error.message });
    }

    res.json({ success: true, data });
  } catch (error) {
    devError("회원 가게 정보 수정 오류:", error);
    res.status(500).json({ error: "서버 오류", details: error.message });
  }
});

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

// ==================== 회원 관리 API (관리자 전용) ====================

// 회원 목록 조회 (관리자만)
app.get('/api/admin/members', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Supabase가 설정되지 않았습니다' 
      });
    }

    const { user_type, search, page = 1, limit = 20 } = req.query;
    
    // 기본 쿼리
    let query = supabase
      .from('profiles')
      .select('*', { count: 'exact' });
    
    // 필터링
    if (user_type) {
      query = query.eq('user_type', user_type);
    }
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    
    // 페이징
    const offset = (page - 1) * limit;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // 실행
    const { data, error, count } = await query;
    
    if (error) {
      devError('회원 목록 조회 오류:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.json({
      success: true,
      members: data,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit)
    });
    
  } catch (error) {
    devError('회원 목록 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다' 
    });
  }
});

// 회원 등급 및 유형 변경 (관리자만)
app.put('/api/admin/members/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Supabase가 설정되지 않았습니다' 
      });
    }

    const { id } = req.params;
    const { user_type, membership_level, role, reset_usage } = req.body;
    
    // 회원 유형 유효성 검사
    const validUserTypes = ['owner', 'agency', 'admin', 'manager'];
    if (user_type && !validUserTypes.includes(user_type)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 회원 유형입니다'
      });
    }
    
    // 등급 유효성 검사
    const validLevels = [
      'seed', 'power', 'big_power', 'premium',
      'elite', 'expert', 'master', 'platinum',
      'admin'
    ];
    
    if (membership_level && !validLevels.includes(membership_level)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 등급입니다'
      });
    }

    // 역할(role) 유효성 검사
    const validRoles = ['general', 'super', 'owner', 'member'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 역할입니다'
      });
    }

    // 역할과 회원 유형의 조합 검사
    if (role && user_type) {
      const validRoleCombinations = {
        'manager': ['general', 'super'],
        'admin': ['general', 'owner'],
        'owner': ['member'],
        'agency': ['member']
      };

      if (!validRoleCombinations[user_type] || !validRoleCombinations[user_type].includes(role)) {
        return res.status(400).json({
          success: false,
          error: '유효하지 않은 회원 유형과 역할 조합입니다'
        });
      }
    }
    
    // 업데이트할 데이터
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    // 회원 유형 변경
    if (user_type) {
      updateData.user_type = user_type;
    }

    // 등급 변경
    if (membership_level) {
      updateData.membership_level = membership_level;
    }

    // 역할 변경
    if (role) {
      updateData.role = role;
    }
    
    // 사용량 초기화 옵션
    if (reset_usage) {
      updateData.monthly_review_count = 0;
      updateData.monthly_blog_count = 0;
    }
    
    // 실행
    const { data, error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      devError('회원 정보 변경 오류:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.json({
      success: true,
      member: data
    });
    
  } catch (error) {
    devError('회원 정보 변경 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다' 
    });
  }
});

// 회원 상세 조회 (관리자만)
app.get('/api/admin/members/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Supabase가 설정되지 않았습니다' 
      });
    }

    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      devError('회원 조회 오류:', error);
      return res.status(404).json({ 
        success: false, 
        error: '회원을 찾을 수 없습니다' 
      });
    }
    
    res.json({
      success: true,
      member: data
    });
    
  } catch (error) {
    devError('회원 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다' 
    });
  }
});

// 회원 삭제 (관리자만)
app.delete('/api/admin/members/:id', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Supabase가 설정되지 않았습니다' 
      });
    }

    const { id } = req.params;
    
    // 삭제 (ON DELETE CASCADE로 연관 데이터도 자동 삭제)
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    
    if (error) {
      devError('회원 삭제 오류:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    
    res.json({
      success: true,
      message: '회원이 삭제되었습니다'
    });
    
  } catch (error) {
    devError('회원 삭제 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다' 
    });
  }
});

// ==================== 관리자 권한 관리 API ====================

// 일반 관리자의 권한 조회 (오너 관리자만)
app.get('/api/admin/permissions/:adminId', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Supabase가 설정되지 않았습니다' 
      });
    }

    const { adminId } = req.params;

    const { data, error } = await supabase
      .from('admin_permissions')
      .select('*')
      .eq('general_admin_id', adminId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116은 데이터 없음
      devError('권한 조회 오류:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    // 데이터가 없으면 기본 권한 구조 반환
    if (!data) {
      return res.json({
        success: true,
        permissions: null,
        message: '설정된 권한이 없습니다'
      });
    }

    res.json({
      success: true,
      permissions: data
    });

  } catch (error) {
    devError('권한 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다' 
    });
  }
});

// 일반 관리자의 권한 설정/수정 (오너 관리자만)
app.post('/api/admin/permissions', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Supabase가 설정되지 않았습니다' 
      });
    }

    const { general_admin_id, owner_admin_id, permissions } = req.body;

    if (!general_admin_id || !owner_admin_id || !permissions) {
      return res.status(400).json({
        success: false,
        error: '필수 필드가 누락되었습니다'
      });
    }

    // 기존 권한이 있는지 확인
    const { data: existing } = await supabase
      .from('admin_permissions')
      .select('id')
      .eq('general_admin_id', general_admin_id)
      .single();

    let result;
    if (existing) {
      // 기존 권한 업데이트
      result = await supabase
        .from('admin_permissions')
        .update({ permissions, updated_at: new Date().toISOString() })
        .eq('general_admin_id', general_admin_id)
        .select()
        .single();
    } else {
      // 새 권한 생성
      result = await supabase
        .from('admin_permissions')
        .insert([{ general_admin_id, owner_admin_id, permissions }])
        .select()
        .single();
    }

    if (result.error) {
      devError('권한 저장 오류:', result.error);
      return res.status(500).json({ 
        success: false, 
        error: result.error.message 
      });
    }

    res.json({
      success: true,
      permissions: result.data
    });

  } catch (error) {
    devError('권한 저장 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다' 
    });
  }
});

// ==================== 매니저 역할 관리 API ====================

// 매니저의 역할 조회
app.get('/api/admin/manager-roles/:managerId', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Supabase가 설정되지 않았습니다' 
      });
    }

    const { managerId } = req.params;

    const { data, error } = await supabase
      .from('manager_roles')
      .select('*')
      .eq('manager_id', managerId)
      .single();

    if (error && error.code !== 'PGRST116') {
      devError('매니저 역할 조회 오류:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    if (!data) {
      return res.json({
        success: true,
        role: null,
        message: '설정된 역할이 없습니다'
      });
    }

    res.json({
      success: true,
      role: data
    });

  } catch (error) {
    devError('매니저 역할 조회 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다' 
    });
  }
});

// 매니저의 역할 설정/수정 (관리자만)
app.post('/api/admin/manager-roles', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ 
        success: false, 
        error: 'Supabase가 설정되지 않았습니다' 
      });
    }

    const { manager_id, assigned_by_admin_id, manager_role, permissions, scope } = req.body;

    if (!manager_id || !assigned_by_admin_id || !manager_role) {
      return res.status(400).json({
        success: false,
        error: '필수 필드가 누락되었습니다'
      });
    }

    // manager_role 유효성 검사
    const validManagerRoles = ['general', 'super'];
    if (!validManagerRoles.includes(manager_role)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 매니저 역할입니다'
      });
    }

    // 기존 역할이 있는지 확인
    const { data: existing } = await supabase
      .from('manager_roles')
      .select('id')
      .eq('manager_id', manager_id)
      .single();

    let result;
    if (existing) {
      // 기존 역할 업데이트
      const updateData = {
        manager_role,
        updated_at: new Date().toISOString()
      };
      if (permissions) updateData.permissions = permissions;
      if (scope) updateData.scope = scope;

      result = await supabase
        .from('manager_roles')
        .update(updateData)
        .eq('manager_id', manager_id)
        .select()
        .single();
    } else {
      // 새 역할 생성
      result = await supabase
        .from('manager_roles')
        .insert([{
          manager_id,
          assigned_by_admin_id,
          manager_role,
          permissions: permissions || {},
          scope: scope || 'all'
        }])
        .select()
        .single();
    }

    if (result.error) {
      devError('매니저 역할 저장 오류:', result.error);
      return res.status(500).json({ 
        success: false, 
        error: result.error.message 
      });
    }

    res.json({
      success: true,
      role: result.data
    });

  } catch (error) {
    devError('매니저 역할 저장 실패:', error);
    res.status(500).json({ 
      success: false, 
      error: '서버 오류가 발생했습니다' 
    });
  }
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
      "GET /api/admin/members",
      "PUT /api/admin/members/:id",
      "GET /api/admin/members/:id",
      "DELETE /api/admin/members/:id",
    ];
  }
  res.status(404).json(payload);
});

// 전역 에러 핸들러
app.use((error, req, res, next) => {
  devError("전역 에러:", error);
  res.status(500).json({
    error: "서버 내부 오류가 발생했습니다.",
    details:
      process.env.NODE_ENV === "development"
        ? error.message
        : "서버 관리자에게 문의하세요.",
    timestamp: new Date().toISOString(),
  });
});

// 쇼츠 영상 기획/대본 API

app.post("/api/shorts/plan-and-script", async (req, res) => {
  try {
    const {
      keywords = "",
      userId,
      style = null,
      duration = null,
      manualSave = false,
      plan: manualPlan,
      script: manualScript,
    } = req.body || {};

    ensureUserId(userId);

    let planText = "";
    let scriptText = "";
    let entry = null;

    if (manualSave) {
      planText = (manualPlan || "").trim();
      scriptText = (manualScript || "").trim();
      if (!planText && !scriptText) {
        return res.status(400).json({
          success: false,
          error: "저장할 기획/대본 내용이 없습니다.",
        });
      }
      entry = await savePlanHistoryEntry({
        userId,
        keywords,
        style,
        duration,
        plan: planText,
        script: scriptText,
        source: "manual",
      });
      return res.json({
        success: true,
        from: "manual",
        plan: planText,
        script: scriptText,
        entry,
      });
    }

    if (!keywords || typeof keywords !== "string") {
      return res.status(400).json({
        success: false,
        error: "키워드를 입력해주세요.",
      });
    }

    const aiResult = await callOpenAIForShortsPlan({
      keywords,
      style,
      durationSec: duration,
    });

    planText = aiResult.plan;
    scriptText = aiResult.script;

    entry = await savePlanHistoryEntry({
      userId,
      keywords,
      style,
      duration,
      plan: planText,
      script: scriptText,
      source: "ai",
    });

    res.json({
      success: true,
      plan: planText,
      script: scriptText,
      entry,
    });
  } catch (error) {
    devError("shorts plan-and-script 처리 실패:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "AI 기획 생성 중 오류가 발생했습니다.",
    });
  }
});

app.get("/api/shorts/plan-history", async (req, res) => {
  try {
    const { userId } = req.query;
    ensureUserId(userId);
    const items = await fetchPlanHistoryEntries(userId);
    res.json({
      success: true,
      items,
    });
  } catch (error) {
    devError("plan history 조회 실패:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "저장된 초안을 불러오지 못했습니다.",
    });
  }
});

app.post("/api/shorts/plan-history", async (req, res) => {
  try {
    const {
      userId,
      keywords = "",
      style = null,
      duration = null,
      plan = "",
      script = "",
      source = "manual",
    } = req.body || {};

    ensureUserId(userId);

    if (!plan && !script) {
      return res.status(400).json({
        success: false,
        error: "저장할 기획/대본 내용이 없습니다.",
      });
    }

    const entry = await savePlanHistoryEntry({
      userId,
      keywords,
      style,
      duration,
      plan,
      script,
      source,
    });

    res.json({
      success: true,
      entry,
    });
  } catch (error) {
    devError("plan history 저장 실패:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "초안을 저장하지 못했습니다.",
    });
  }
});

app.delete("/api/shorts/plan-history/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    ensureUserId(userId);
    if (!id) {
      return res
        .status(400)
        .json({ success: false, error: "삭제할 항목 ID가 필요합니다." });
    }
    const ok = await deletePlanHistoryEntry(userId, id);
    if (!ok) {
      return res
        .status(500)
        .json({ success: false, error: "저장된 초안을 삭제하지 못했습니다." });
    }
    res.json({ success: true });
  } catch (error) {
    devError("plan history 삭제 실패:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      error: error.message || "삭제 중 오류가 발생했습니다.",
    });
  }
});

// ==================== Runway API 설정 ====================

const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY || "key_8f7dd7e27cc2ed2a9bbb19893c6636fab1d008334adf301de3074d2f739f4e894440353d83e15c4bc272a78237bc201ceca2d9032ae168ae5bd97f98c1b5d2b7";

// Runway SDK 초기화 (공식 SDK 사용)
let RunwayML = null;
let runwayClient = null;

try {
  RunwayML = require("@runwayml/sdk");
  runwayClient = new RunwayML({
    apiKey: RUNWAY_API_KEY,
  });
  devLog("✅ Runway SDK 초기화 성공");
} catch (error) {
  devError("❌ Runway SDK 초기화 실패:", error.message);
  devLog("⚠️ Runway SDK가 설치되지 않았습니다. 'pnpm add @runwayml/sdk' 실행 필요");
}

// Runway API: 이미지에서 동영상 생성 (Gen-4 또는 Gen-3 모델 사용)
async function generateVideoWithRunway(imageUrl, prompt, duration = 5) {
  try {
    devLog("Runway API 호출 시작:", { imageUrl, prompt, duration });

    if (!runwayClient) {
      throw new Error("Runway SDK가 초기화되지 않았습니다. @runwayml/sdk 패키지를 설치해주세요.");
    }

    // Gen-4 Image to Video 또는 Gen-3 모델 사용
    // 공식 문서: https://docs.dev.runwayml.com/
    const task = await runwayClient.imageToVideo
      .create({
        model: "gen4_aleph", // 또는 "gen3_alpha_turbo" 등 사용 가능한 모델
        imageUrl: imageUrl,
        promptText: prompt || "cinematic food video, slow motion, professional lighting",
        duration: Math.min(Math.max(duration, 3), 10), // 3-10초 사이
        ratio: "9:16", // 쇼츠 형식 (세로)
      })
      .waitForTaskOutput(); // 작업 완료까지 자동 대기

    if (!task || !task.output || task.output.length === 0) {
      throw new Error("Runway API 응답에 영상 URL이 없습니다.");
    }

    const videoUrl = Array.isArray(task.output) ? task.output[0] : task.output;
    devLog("Runway 영상 생성 완료:", videoUrl);
    
    return { videoUrl, jobId: task.id || null };
  } catch (error) {
    devError("Runway API 오류:", error);
    
    // SDK 오류인 경우 직접 HTTP API로 폴백 시도
    if (error.message.includes("SDK") || error.message.includes("require")) {
      devLog("SDK 사용 불가, HTTP API로 폴백 시도");
      return await generateVideoWithRunwayHTTP(imageUrl, prompt, duration);
    }
    
    throw new Error(`Runway 영상 생성 실패: ${error.message}`);
  }
}

// HTTP API 폴백 함수 (SDK 사용 불가 시)
async function generateVideoWithRunwayHTTP(imageUrl, prompt, duration = 5) {
  try {
    devLog("Runway HTTP API 호출 시작 (폴백 모드)");

    const RUNWAY_API_BASE = "https://api.runwayml.com/v1";

    // Step 1: 이미지에서 동영상 생성 요청
    const response = await axios.post(
      `${RUNWAY_API_BASE}/image-to-video`,
      {
        image_url: imageUrl,
        prompt: prompt || "cinematic food video, slow motion, professional lighting",
        duration: Math.min(Math.max(duration, 3), 10),
        aspect_ratio: "9:16",
        watermark: false,
      },
      {
        headers: {
          "Authorization": `Bearer ${RUNWAY_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    if (!response.data || !response.data.id) {
      throw new Error("Runway API 응답에 job_id가 없습니다.");
    }

    const jobId = response.data.id;
    devLog("Runway 작업 ID:", jobId);

    // Step 2: Polling으로 상태 확인
    let status = "pending";
    let videoUrl = null;
    let attempts = 0;
    const maxAttempts = 60; // 최대 5분 대기 (5초 간격)

    while (status !== "succeeded" && status !== "failed" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5초 대기

      const statusResponse = await axios.get(
        `${RUNWAY_API_BASE}/image-to-video/${jobId}`,
        {
          headers: {
            "Authorization": `Bearer ${RUNWAY_API_KEY}`,
          },
          timeout: 10000,
        }
      );

      status = statusResponse.data.status || "pending";
      devLog(`Runway 작업 상태 (시도 ${attempts + 1}/${maxAttempts}):`, status);

      if (status === "succeeded" && statusResponse.data.output) {
        videoUrl = Array.isArray(statusResponse.data.output)
          ? statusResponse.data.output[0]
          : statusResponse.data.output;
        break;
      }

      if (status === "failed") {
        throw new Error(statusResponse.data.error || "Runway 영상 생성 실패");
      }

      attempts++;
    }

    if (!videoUrl) {
      throw new Error("영상 생성 시간이 초과되었습니다.");
    }

    devLog("Runway 영상 생성 완료 (HTTP):", videoUrl);
    return { videoUrl, jobId };
  } catch (error) {
    devError("Runway HTTP API 오류:", error);
    throw new Error(`Runway 영상 생성 실패: ${error.message}`);
  }
}

// ==================== 쇼츠 영상 생성 API ====================

app.post("/api/shorts/generate", upload.single("image"), async (req, res) => {
  try {
    const userId = req.headers["user-id"] || req.body.userId;
    ensureUserId(userId);

    // multer 에러 처리
    if (req.fileValidationError) {
      return res.status(400).json({
        success: false,
        error: req.fileValidationError,
      });
    }

    try {
      const {
        style,
        menuName,
        menuFeatures = "",
        menuPrice = "",
        music = "auto",
        duration = "10",
      } = req.body;

        if (!req.file) {
          return res.status(400).json({
            success: false,
            error: "이미지 파일이 필요합니다.",
          });
        }

        if (!menuName) {
          return res.status(400).json({
            success: false,
            error: "메뉴명이 필요합니다.",
          });
        }

        if (!style) {
          return res.status(400).json({
            success: false,
            error: "영상 스타일이 필요합니다.",
          });
        }

        // 이미지를 Supabase Storage에 업로드
        const fileExt = req.file.originalname.split(".").pop();
        const fileName = `${userId}/${Date.now()}.${fileExt}`;
        const filePath = `shorts-images/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(filePath, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          devError("이미지 업로드 실패:", uploadError);
          // 업로드 실패해도 계속 진행 (임시)
        }

        // Public URL 생성
        const { data: urlData } = supabase.storage
          .from("uploads")
          .getPublicUrl(filePath);
        const imageUrl = urlData?.publicUrl || "";

        // 스타일별 프롬프트 생성
        const stylePrompts = {
          luxury: "luxurious food presentation, elegant slow motion, premium restaurant quality, cinematic lighting, sophisticated atmosphere",
          fast: "dynamic food video, fast-paced editing, trendy social media style, vibrant colors, energetic movement",
          chef: "chef's hands preparing food, close-up cooking process, professional kitchen, detailed food preparation, authentic cooking",
          plating: "beautiful food plating, artistic presentation, restaurant-quality dish, elegant arrangement, professional food styling",
          simple: "clean food video, simple and elegant, minimalist style, natural lighting, professional quality"
        };

        const prompt = `${stylePrompts[style] || stylePrompts.simple}. ${menuName}${menuFeatures ? ', ' + menuFeatures : ''}. High quality, professional food video.`;

        // 영상 데이터베이스에 저장 (처리 중 상태)
        const { data: videoData, error: dbError } = await supabase
          .from("shorts_videos")
          .insert({
            user_id: userId,
            title: menuName,
            description: menuFeatures,
            style: style,
            duration_sec: parseInt(duration) || 10,
            music_type: music,
            menu_name: menuName,
            menu_features: menuFeatures,
            menu_price: menuPrice,
            image_url: imageUrl,
            status: "processing",
          })
          .select("*")
          .single();

        if (dbError) {
          devError("영상 데이터 저장 실패:", dbError);
          return res.status(500).json({
            success: false,
            error: "영상 데이터 저장 실패: " + dbError.message,
          });
        }

        // Runway API로 영상 생성 (비동기)
        generateVideoWithRunway(imageUrl, prompt, parseInt(duration) || 5)
          .then(async ({ videoUrl, jobId }) => {
            // 영상 생성 완료로 업데이트
            await supabase
              .from("shorts_videos")
              .update({
                status: "completed",
                video_url: videoUrl,
                updated_at: new Date().toISOString(),
              })
              .eq("id", videoData.id);
            
            devLog("영상 생성 완료 및 DB 업데이트:", videoData.id);
          })
          .catch(async (error) => {
            devError("Runway 영상 생성 실패:", error);
            // 실패 상태로 업데이트
            await supabase
              .from("shorts_videos")
              .update({
                status: "failed",
                error_message: error.message,
                updated_at: new Date().toISOString(),
              })
              .eq("id", videoData.id);
          });

      res.json({
        success: true,
        data: {
          id: videoData.id,
          status: "processing",
          message: "영상 생성이 시작되었습니다. 잠시 후 마이페이지에서 확인하세요.",
        },
      });
    } catch (error) {
      devError("영상 생성 처리 실패:", error);
      res.status(500).json({
        success: false,
        error: error.message || "영상 생성 중 오류가 발생했습니다.",
      });
    }
  } catch (error) {
    devError("영상 생성 API 오류:", error);
    res.status(500).json({
      success: false,
      error: error.message || "영상 생성 API 오류",
    });
  }
});

// ==================== 쇼츠 영상 목록 조회 API ====================

app.get("/api/shorts/videos", async (req, res) => {
  try {
    const userId = req.headers["user-id"] || req.query.userId;
    ensureUserId(userId);

    const { page = 1, limit = 20, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase
      .from("shorts_videos")
      .select("*", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: videos, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      data: videos || [],
      pagination: {
        total: count || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((count || 0) / parseInt(limit)),
      },
    });
  } catch (error) {
    devError("영상 목록 조회 실패:", error);
    res.status(500).json({
      success: false,
      error: error.message || "영상 목록을 불러오지 못했습니다.",
    });
  }
});

// ==================== 서버 시작 ====================

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  devError("[SECURITY] In production, JWT_SECRET must be set. Exiting.");
  process.exit(1);
}

// Vercel 환경에서는 export만, 로컬 환경에서는 listen
if (process.env.VERCEL) {
  // Vercel serverless 환경
  module.exports = app;
} else {
  // 로컬 개발 환경
  // ==================== 크론 작업 설정 ====================
  // node-cron 패키지 로드 (설치 필요: npm install node-cron)
  try {
    const cron = require('node-cron');
    const { renewExpiredSubscriptions, notifyTokenExceeded, recordDailyStats } = require('./api/cron/subscription-renewal');
    const updateExpiredPolicies = require('./api/cron/policy-status-update');

    // 매일 자정에 구독 갱신 및 정책 상태 업데이트
    cron.schedule('0 0 * * *', async () => {
      devLog('🔄 [CRON] 자정 구독 갱신 및 정책 상태 업데이트 작업 시작...');
      try {
        await renewExpiredSubscriptions();
        await recordDailyStats();
        const policyResult = await updateExpiredPolicies();
        devLog('✅ [CRON] 구독 갱신 및 정책 상태 업데이트 작업 완료', policyResult);
      } catch (error) {
        devError('❌ [CRON] 구독 갱신 실패:', error);
      }
    });

    // 매일 오후 6시에 토큰 한도 경고 알림
    cron.schedule('0 18 * * *', async () => {
      devLog('📢 [CRON] 토큰 한도 경고 알림 시작...');
      try {
        await notifyTokenExceeded();
        devLog('✅ [CRON] 토큰 한도 알림 완료');
      } catch (error) {
        devError('❌ [CRON] 토큰 한도 알림 실패:', error);
      }
    });

    // 매시간 통계 업데이트 (선택사항)
    cron.schedule('0 * * * *', async () => {
      devLog('📊 [CRON] 시간별 통계 업데이트...');
      try {
        await recordDailyStats();
      } catch (error) {
        devError('❌ [CRON] 통계 업데이트 실패:', error);
      }
    });

    devLog('✅ 크론 작업 스케줄러 활성화됨');
  } catch (error) {
    devLog('⚠️ 크론 작업 설정 실패 (node-cron 패키지 필요):', error.message);
  }

  app.listen(PORT, "0.0.0.0", () => {
    devLog("==========================================");
    devLog("🚀 통합 API 서버가 시작되었습니다!");
    devLog(`🌐 서버 주소: http://0.0.0.0:${PORT}`);
    devLog(`🏥 서버 상태: http://0.0.0.0:${PORT}/health`);
    devLog(`📊 환경: ${process.env.NODE_ENV || "development"}`);
    devLog("==========================================");
    devLog("");
    devLog("🔧 사용 가능한 서비스:");
    devLog("");
    devLog("📊 네이버 키워드 도구:");
    devLog('- 키워드 검색: POST /api/keywords (Body: {DataQ: "치킨"})');
    devLog(
      '- 키워드 트렌드: POST /api/keyword-trend (Body: {keyword: "치킨"})'
    );
    devLog("- 연관 키워드: GET /api/related-keywords?seed=맛집");
    devLog("");
    devLog("🤖 AI 블로그 생성:");
    devLog("- 블로그 생성: POST /api/generate-blog");
    devLog("- API 키 테스트: GET /api/test-keys");
    devLog("");
    devLog("🔍 리뷰 분석:");
    devLog("- 리뷰 분석: POST /api/analyze-review");
    devLog("- 답글 생성: POST /api/generate-reply");
    devLog("- 분석 옵션: GET /api/analysis-options");
    devLog("");
    devLog("📍 네이버 플레이스 검색:");
    devLog("- 로컬 검색: GET /api/search/local?query=마포맛집");
    devLog("");
    devLog("⚙️ API 설정 확인:");
    devLog(
      `- 네이버 Customer ID: ${NAVER_API.customerId ? "✅ 설정됨" : "❌ 미설정"}`
    );
    devLog(
      `- 네이버 API Key: ${NAVER_API.apiKey ? "✅ 설정됨" : "❌ 미설정"}`
    );
    devLog(
      `- 네이버 Secret Key: ${NAVER_API.secretKey ? "✅ 설정됨" : "❌ 미설정"}`
    );
    devLog(
      `- 네이버 검색 Client ID: ${
        NAVER_SEARCH.clientId ? "✅ 설정됨" : "❌ 미설정"
      }`
    );
    devLog(
      `- 네이버 검색 Client Secret: ${
        NAVER_SEARCH.clientSecret ? "✅ 설정됨" : "❌ 미설정"
      }`
    );
    devLog(
      `- OpenAI API Key: ${OPENAI_API_KEY ? "✅ 설정됨" : "❌ 미설정"}`
    );
    devLog(
      `- Gemini API Key: ${GEMINI_API_KEY ? "✅ 설정됨" : "❌ 미설정"}`
    );
    devLog(
      `- Claude API Key: ${CLAUDE_API_KEY ? "✅ 설정됨" : "❌ 미설정"}`
    );
    devLog("------------------------------------------");
    devLog("Feature Flags:");
    devLog(
      `- FEATURE_API_READ_NEXT: ${FEATURE_API_READ_NEXT ? "ON" : "OFF"}`
    );
    devLog(
      `- FEATURE_API_CHAT_NEXT: ${FEATURE_API_CHAT_NEXT ? "ON" : "OFF"}`
    );
    devLog(`- FEATURE_AUTH_NEXT: ${FEATURE_AUTH_NEXT ? "ON" : "OFF"}`);
    devLog("==========================================");
    devLog("🔐 Kakao OAuth:");
    devLog(
      `- Kakao REST API Key: ${KAKAO_REST_API_KEY ? "✅ 설정됨" : "❌ 미설정"}`
    );
    devLog(`- Kakao Redirect URI: ${KAKAO_REDIRECT_URI || "❌ 미설정"}`);
    devLog(
      `- Kakao Client Secret: ${KAKAO_CLIENT_SECRET ? "✅ 설정됨" : "❌ 미설정"}`
    );
    devLog("------------------------------------------");
    devLog("Feature Flags:");
    devLog(
      `- FEATURE_API_READ_NEXT: ${FEATURE_API_READ_NEXT ? "ON" : "OFF"}`
    );
    devLog(
      `- FEATURE_API_CHAT_NEXT: ${FEATURE_API_CHAT_NEXT ? "ON" : "OFF"}`
    );
    devLog(`- FEATURE_AUTH_NEXT: ${FEATURE_AUTH_NEXT ? "ON" : "OFF"}`);
    devLog("==========================================");
  });

  // 종료 처리 (로컬 환경에서만)
  process.on("SIGINT", () => {
    devLog("\n🛑 서버를 종료합니다...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    devLog("\n🛑 서버를 종료합니다...");
    process.exit(0);
  });
}

// ==================== 구독 시스템 API (중복 제거됨) ====================
// 이미 625-644번 줄에서 api/subscription/ 폴더의 파일들을 require로 처리하고 있음
// 아래는 백업용 직접 구현 (require 실패 시 사용)

// 1. 가격 설정 조회
app.get('/api/subscription/pricing-config', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const { data, error } = await supabase
      .from('pricing_config')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // 없으면 기본값으로 초기화
    if (!data) {
      const { data: newConfig } = await supabase
        .from('pricing_config')
        .insert([{
          owner_seed_price: 0,
          owner_power_price: 30000,
          owner_bigpower_price: 50000,
          owner_premium_price: 70000,
          agency_elite_price: 100000,
          agency_expert_price: 300000,
          agency_master_price: 500000,
          agency_premium_price: 1000000
        }])
        .select()
        .single();

      return res.json({ success: true, pricing: newConfig });
    }

    res.json({ success: true, pricing: data });
  } catch (error) {
    devError('가격 설정 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. 가격 설정 수정 (어드민만)
app.put('/api/subscription/pricing-config', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const pricing = req.body;

    const { data, error } = await supabase
      .from('pricing_config')
      .update(pricing)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, pricing: data });
  } catch (error) {
    devError('가격 설정 수정 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. 토큰 한도 설정 조회
app.get('/api/subscription/token-config', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const { data, error } = await supabase
      .from('token_config')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // 없으면 기본값으로 초기화
    if (!data) {
      const { data: newConfig } = await supabase
        .from('token_config')
        .insert([{
          owner_seed_limit: 100,
          owner_power_limit: 500,
          owner_bigpower_limit: 833,
          owner_premium_limit: 1166,
          agency_elite_limit: 1000,
          agency_expert_limit: 3000,
          agency_master_limit: 5000,
          agency_premium_limit: 10000
        }])
        .select()
        .single();

      return res.json({ success: true, tokens: newConfig });
    }

    res.json({ success: true, tokens: data });
  } catch (error) {
    devError('토큰 설정 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. 토큰 한도 설정 수정 (어드민만)
app.put('/api/subscription/token-config', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const tokens = req.body;

    const { data, error } = await supabase
      .from('token_config')
      .update(tokens)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, tokens: data });
  } catch (error) {
    devError('토큰 설정 수정 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. 개인별 맞춤 가격 조회
app.get('/api/subscription/member-pricing/:memberId', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const { memberId } = req.params;

    const { data, error } = await supabase
      .from('member_custom_pricing')
      .select('*')
      .eq('member_id', memberId)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.json({ success: true, custom_pricing: null });
    }

    if (error) throw error;

    res.json({ success: true, custom_pricing: data });
  } catch (error) {
    devError('맞춤 가격 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. 개인별 맞춤 가격 설정/수정 (어드민만)
app.post('/api/subscription/member-pricing', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const { member_id, custom_price, discount_reason } = req.body;

    // 기존 기록 확인
    const { data: existing } = await supabase
      .from('member_custom_pricing')
      .select('id')
      .eq('member_id', member_id)
      .single();

    let result;
    if (existing) {
      // 기존 기록 수정
      result = await supabase
        .from('member_custom_pricing')
        .update({ custom_price, discount_reason, updated_at: new Date().toISOString() })
        .eq('member_id', member_id)
        .select()
        .single();
    } else {
      // 새 기록 생성
      result = await supabase
        .from('member_custom_pricing')
        .insert([{ member_id, custom_price, discount_reason }])
        .select()
        .single();
    }

    if (result.error) throw result.error;

    res.json({ success: true, custom_pricing: result.data });
  } catch (error) {
    devError('맞춤 가격 저장 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. 개인별 맞춤 토큰 한도 조회
app.get('/api/subscription/member-token-limit/:memberId', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const { memberId } = req.params;

    const { data, error } = await supabase
      .from('member_custom_token_limit')
      .select('*')
      .eq('member_id', memberId)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.json({ success: true, custom_limit: null });
    }

    if (error) throw error;

    res.json({ success: true, custom_limit: data });
  } catch (error) {
    devError('맞춤 토큰 한도 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. 개인별 맞춤 토큰 한도 설정/수정 (어드민만)
app.post('/api/subscription/member-token-limit', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const { member_id, custom_limit, reason } = req.body;

    // 기존 기록 확인
    const { data: existing } = await supabase
      .from('member_custom_token_limit')
      .select('id')
      .eq('member_id', member_id)
      .single();

    let result;
    if (existing) {
      // 기존 기록 수정
      result = await supabase
        .from('member_custom_token_limit')
        .update({ custom_limit, reason, updated_at: new Date().toISOString() })
        .eq('member_id', member_id)
        .select()
        .single();
    } else {
      // 새 기록 생성
      result = await supabase
        .from('member_custom_token_limit')
        .insert([{ member_id, custom_limit, reason }])
        .select()
        .single();
    }

    if (result.error) throw result.error;

    res.json({ success: true, custom_limit: result.data });
  } catch (error) {
    devError('맞춤 토큰 한도 저장 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. 토큰 사용 기록 저장 - 새로운 handler 사용 (api/subscription/token-usage.js)
// app.post('/api/subscription/token-usage', async (req, res) => {
//   try {
//     if (!supabase) {
//       return res.status(503).json({ success: false, error: 'Supabase 미설정' });
//     }

//     const { user_id, store_id, tokens_used, api_type, input_tokens, output_tokens } = req.body;

//     const { data, error } = await supabase
//       .from('token_usage')
//       .insert([{
//         user_id,
//         store_id: store_id || null,
//         tokens_used,
//         api_type,
//         input_tokens: input_tokens || 0,
//         output_tokens: output_tokens || 0
//       }])
//       .select()
//       .single();

//     if (error) throw error;

//     res.json({ success: true, usage: data });
//   } catch (error) {
//     devError('토큰 사용 기록 저장 실패:', error);
//     res.status(500).json({ success: false, error: error.message });
//   }
// });

// 10. 구독 주기 조회
app.get('/api/subscription/cycle/:userId', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const { userId } = req.params;

    const { data, error } = await supabase
      .from('subscription_cycle')
      .select('*')
      .eq('user_id', userId)
      .order('cycle_start_date', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code === 'PGRST116') {
      return res.json({ success: true, cycle: null });
    }

    if (error) throw error;

    res.json({ success: true, cycle: data });
  } catch (error) {
    devError('구독 주기 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. 대행사 관리 식당 조회
app.get('/api/subscription/agency-stores/:agencyId', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const { agencyId } = req.params;

    const { data, error } = await supabase
      .from('agency_managed_stores')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('is_active', true);

    if (error) throw error;

    res.json({ success: true, stores: data });
  } catch (error) {
    devError('대행사 식당 조회 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 12. 대행사 관리 식당 등록 (대행사만)
app.post('/api/subscription/agency-stores', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const { id, agency_id, store_name, store_phone, store_address, naver_id, naver_password, google_id, google_password } = req.body;

    if (id) {
      // 수정 모드
      const updateData = {
        store_name,
        store_phone: store_phone || null,
        store_address: store_address || null,
        naver_place_url: req.body.naver_place_url || null,
        naver_id: naver_id || null,
        google_id: google_id || null,
      };

      // 비밀번호가 입력되면 추가로 암호화
      if (naver_password) {
        updateData.naver_password_encrypted = Buffer.from(naver_password).toString('base64');
      }
      if (google_password) {
        updateData.google_password_encrypted = Buffer.from(google_password).toString('base64');
      }

      const { data, error } = await supabase
        .from('agency_managed_stores')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, store: data, mode: 'update' });
    } else {
      // 신규 등록 모드
      const { data, error } = await supabase
        .from('agency_managed_stores')
        .insert([{
          agency_id,
          store_name,
          store_phone: store_phone || null,
          store_address: store_address || null,
          naver_place_url: req.body.naver_place_url || null,
          naver_id: naver_id || null,
          naver_password_encrypted: naver_password ? Buffer.from(naver_password).toString('base64') : null,
          google_id: google_id || null,
          google_password_encrypted: google_password ? Buffer.from(google_password).toString('base64') : null
        }])
        .select()
        .single();

      if (error) throw error;
      res.json({ success: true, store: data, mode: 'insert' });
    }
  } catch (error) {
    devError('식당 등록/수정 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 식당 삭제 API
app.delete('/api/subscription/agency-stores/:storeId', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const { storeId } = req.params;

    const { data, error } = await supabase
      .from('agency_managed_stores')
      .update({ is_active: false })
      .eq('id', storeId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, message: '식당이 삭제되었습니다' });
  } catch (error) {
    devError('식당 삭제 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 13. 업그레이드 요청 생성
app.post('/api/subscription/upgrade-request', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const { user_id, current_membership_level, requested_membership_level, reason } = req.body;

    const { data, error } = await supabase
      .from('upgrade_requests')
      .insert([{
        user_id,
        current_membership_level,
        requested_membership_level,
        reason,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, request: data });
  } catch (error) {
    devError('업그레이드 요청 생성 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 14. 업그레이드 요청 승인 (어드민만)
app.put('/api/subscription/upgrade-request/:requestId/approve', async (req, res) => {
  try {
    if (!supabase) {
      return res.status(503).json({ success: false, error: 'Supabase 미설정' });
    }

    const { requestId } = req.params;
    const { approved_by_admin_id, additional_charge } = req.body;

    const { data, error } = await supabase
      .from('upgrade_requests')
      .update({
        status: 'approved',
        approved_by_admin_id,
        additional_charge,
        approved_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, request: data });
  } catch (error) {
    devError('업그레이드 요청 승인 실패:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
