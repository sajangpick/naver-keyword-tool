# 보안 점검 보고서
**프로젝트**: 사장픽 (sajang pick)  
**점검 일시**: 2025년 10월 28일  
**점검자**: AI Security Auditor  
**점검 범위**: 전체 코드베이스

---

## 📋 목차
1. [점검 개요](#점검-개요)
2. [🔴 치명적 보안 이슈](#-치명적-보안-이슈)
3. [🟡 중요 보안 이슈](#-중요-보안-이슈)
4. [🟢 권장 개선 사항](#-권장-개선-사항)
5. [✅ 양호한 보안 설정](#-양호한-보안-설정)
6. [해결 방안 및 권장사항](#해결-방안-및-권장사항)

---

## 점검 개요

### 점검 항목
✅ 환경 변수 및 API 키 노출  
✅ 인증/인가 시스템 보안  
✅ 데이터베이스 보안 (SQL Injection 등)  
✅ XSS 및 CSRF 취약점  
✅ API 엔드포인트 보안  
✅ 클라이언트 사이드 보안  

---

## 🔴 치명적 보안 이슈

### 1. **Supabase Anon Key가 클라이언트 코드에 하드코딩됨** ⚠️⚠️⚠️
**파일**: `assets/auth-state.js` (Line 13-14)

```javascript
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0dXpsdWJnZ2diZ3NvcGhmY25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MjEzMzQsImV4cCI6MjA3NTk5NzMzNH0.NaMMH7vVpcrFAi9IOQ0o_HF6rQ7dOdiAXAkxu6r84CE";
```

**위험도**: 🔴 **치명적 (Critical)**

**영향**:
- Supabase API 키가 public하게 노출됨
- 누구나 해당 키를 사용하여 데이터베이스에 접근 가능
- 데이터 유출, 무단 수정, 삭제 위험

**해결 방법**:
1. 즉시 Supabase 콘솔에서 해당 anon key를 **재생성**하세요
2. 하드코딩된 키를 제거하고 환경 변수로 관리
3. Row Level Security (RLS) 정책을 반드시 활성화

**긴급 조치**:
```bash
# 1. Supabase 콘솔 접속
# 2. Settings > API > Anon key 재생성
# 3. 새 키를 .env에만 저장
# 4. assets/auth-state.js 수정
```

---

### 2. **JWT_SECRET이 프로덕션에서 랜덤 생성될 수 있음** ⚠️⚠️
**파일**: `server.js` (Line 58-64)

```javascript
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.JWT_SECRET) {
  console.warn("[SECURITY] JWT_SECRET is not set. Using a random secret for this process only.");
}
```

**위험도**: 🔴 **치명적 (Critical)**

**영향**:
- 서버 재시작 시 JWT_SECRET이 변경되어 모든 사용자 로그아웃
- 세션 관리 불안정
- 공격자가 타이밍을 이용한 공격 가능

**해결 방법**:
`server.js`의 2753-2756번 라인에 이미 프로덕션 환경 체크가 있지만, 더 강화 필요:

```javascript
// 개선된 코드
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[CRITICAL] JWT_SECRET must be set in production. Exiting.');
    process.exit(1);
  }
  console.warn('[DEV ONLY] Using random JWT_SECRET. DO NOT USE IN PRODUCTION!');
  JWT_SECRET = crypto.randomBytes(32).toString("hex");
}
```

---

## 🟡 중요 보안 이슈

### 3. **CORS 설정이 개발 환경에서 모든 Origin 허용** ⚠️⚠️
**파일**: `server.js` (Line 78-93)

```javascript
origin: (origin, callback) => {
  // 개발 환경에서는 모든 origin 허용
  if (process.env.NODE_ENV !== "production") {
    return callback(null, true);
  }
  // ...
}
```

**위험도**: 🟡 **중요 (High)**

**영향**:
- 개발 환경에서 CSRF 공격에 취약
- 로컬 개발 중에도 악의적인 사이트에서 API 호출 가능

**해결 방법**:
```javascript
// 개발 환경에서도 특정 도메인만 허용
const DEV_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:10000',
  'http://127.0.0.1:10000'
];

origin: (origin, callback) => {
  if (!origin) return callback(null, true);
  
  if (process.env.NODE_ENV !== "production") {
    if (DEV_ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Dev origin not allowed"));
  }
  // production 로직...
}
```

---

### 4. **CSRF 토큰 검증이 로그아웃에만 적용됨** ⚠️⚠️
**파일**: `server.js` (Line 542-584)

**위험도**: 🟡 **중요 (High)**

**영향**:
- 다른 중요한 API 엔드포인트에서 CSRF 공격에 취약
- 데이터 생성/수정/삭제 작업이 공격자에 의해 수행될 수 있음

**취약한 엔드포인트**:
- `POST /api/supabase-crud` (데이터 CRUD)
- `POST /api/generate-reply` (리뷰 답글 생성)
- `POST /api/generate-blog` (블로그 생성)

**해결 방법**:
CSRF 미들웨어를 생성하고 모든 상태 변경 엔드포인트에 적용:

```javascript
// CSRF 미들웨어
function csrfProtection(req, res, next) {
  const parsedCookies = getCookies(req);
  const csrfCookie = parsedCookies["csrf_token"];
  const csrfHeader = req.headers["x-csrf-token"];
  
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ 
      success: false, 
      error: "CSRF validation failed" 
    });
  }
  next();
}

// 적용
app.post("/api/supabase-crud", csrfProtection, supabaseCrudHandler);
app.post("/api/generate-reply", csrfProtection, async (req, res) => { ... });
```

---

### 5. **Rate Limiting이 IP 기반이지만 프록시 환경 고려 부족** ⚠️
**파일**: `server.js` (Line 234-267)

```javascript
function rateLimiter(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  // ...
}
```

**위험도**: 🟡 **중요 (High)**

**영향**:
- 프록시/로드밸런서 뒤에서는 모든 요청이 동일한 IP로 보임
- Rate limiting이 제대로 작동하지 않을 수 있음
- DDoS 공격 방어 약화

**해결 방법**:
```javascript
// X-Forwarded-For 헤더 고려
function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection.remoteAddress || 'unknown';
}

function rateLimiter(req, res, next) {
  const clientIP = getClientIP(req);
  // ...
}
```

---

### 6. **데이터베이스 CRUD API에 인증 없음** ⚠️⚠️
**파일**: `api/supabase-crud.js`

**위험도**: 🟡 **중요 (High)**

**영향**:
- 누구나 `/api/supabase-crud`를 호출하여 데이터 조작 가능
- 인증 없이 테이블의 데이터를 추가/수정/삭제 가능

**해결 방법**:
```javascript
// 인증 미들웨어 추가
async function requireAuth(req, res, next) {
  const parsedCookies = getCookies(req);
  const token = parsedCookies['session'];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const payload = verifyJwt(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  req.user = payload;
  next();
}

// 적용
app.post("/api/supabase-crud", requireAuth, csrfProtection, supabaseCrudHandler);
```

---

## 🟢 권장 개선 사항

### 7. **innerHTML 사용으로 인한 XSS 위험**
**파일들**: `review.html`, `ChatGPT.html`, `Blog-Editor.html` 등

**위험도**: 🟢 **보통 (Medium)**

**문제**:
일부 HTML 파일에서 `innerHTML`을 사용하여 동적 콘텐츠 삽입

**권장 사항**:
```javascript
// 나쁜 예
element.innerHTML = userInput;

// 좋은 예
element.textContent = userInput;

// HTML이 필요한 경우 sanitize
function sanitizeHTML(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}
```

---

### 8. **민감한 로그 출력**
**파일**: `server.js` 및 여러 API 파일들

**위험도**: 🟢 **보통 (Medium)**

**문제**:
```javascript
console.log("식당 정보 포함됨:", placeInfo.basic?.name || "정보 없음");
console.log("사장님 추천 정보 포함됨");
```

**권장 사항**:
```javascript
// 프로덕션에서는 민감한 정보 로그 금지
if (process.env.NODE_ENV !== 'production') {
  console.log("식당 정보 포함됨:", placeInfo.basic?.name);
}

// 또는 로그 레벨 사용
const logger = {
  debug: (msg) => process.env.NODE_ENV !== 'production' && console.log(msg),
  info: console.log,
  error: console.error
};
```

---

### 9. **CSP (Content Security Policy) 설정이 느슨함**
**파일**: `server.js` (Line 143-166)

```javascript
scriptSrc: ["'self'", "https:", "'unsafe-inline'", "'unsafe-eval'"],
```

**위험도**: 🟢 **보통 (Medium)**

**문제**:
- `'unsafe-inline'`과 `'unsafe-eval'`이 허용되어 XSS 방어 약화

**권장 사항**:
```javascript
// 더 엄격한 CSP
directives: {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com",
    "'nonce-{random}'" // 각 요청마다 랜덤 nonce 생성
  ],
  styleSrc: ["'self'", "'nonce-{random}'"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'", process.env.API_URL],
}
```

---

### 10. **에러 메시지에서 시스템 정보 노출**
**파일**: `server.js` (Line 2739-2748)

```javascript
app.use((error, req, res, next) => {
  console.error("전역 에러:", error);
  res.status(500).json({
    error: "서버 내부 오류가 발생했습니다.",
    details: process.env.NODE_ENV === "development" ? error.message : "서버 관리자에게 문의하세요.",
  });
});
```

**위험도**: 🟢 **낮음 (Low)**

**문제**:
개발 환경에서 스택 트레이스나 시스템 경로가 노출될 수 있음

**권장 사항**:
```javascript
app.use((error, req, res, next) => {
  // 에러 로그는 서버 로그에만 (파일 또는 로그 서비스)
  logger.error('Server error:', {
    message: error.message,
    stack: error.stack,
    requestId: req.requestId,
    path: req.path
  });
  
  // 클라이언트에는 최소한의 정보만
  res.status(500).json({
    error: "서버 오류가 발생했습니다.",
    requestId: req.requestId, // 고객 지원 시 사용
    timestamp: new Date().toISOString()
  });
});
```

---

### 11. **Supabase Service Role Key 사용 시 권한 제한 없음**
**파일**: `server.js` (Line 38-52)

**위험도**: 🟢 **보통 (Medium)**

**문제**:
Service Role Key는 모든 RLS를 우회하므로 매우 강력한 권한

**권장 사항**:
1. Service Role Key는 절대 클라이언트에 노출 금지 (✅ 이미 잘 되어 있음)
2. 필요한 경우에만 제한적으로 사용
3. 가능하면 Anon Key + RLS 정책 사용

```javascript
// 서비스별로 다른 키 사용
const publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 일반 작업은 public, 관리자 작업만 admin 사용
```

---

## ✅ 양호한 보안 설정

### 잘 구현된 보안 기능들

1. **✅ 환경 변수 관리**
   - `.env` 파일이 `.gitignore`에 포함됨
   - 환경 변수 예시 파일 (`docs/env.example.md`) 제공

2. **✅ Helmet 보안 헤더**
   - Helmet 미들웨어 사용 (Line 96-141)
   - HSTS, Referrer-Policy, Permissions-Policy 설정

3. **✅ Rate Limiting**
   - 기본적인 Rate Limiting 구현 (Line 234-277)
   - 15분당 100 요청 제한

4. **✅ Input Sanitization**
   - `sanitizeString()` 함수로 입력값 정제 (Line 305-311)
   - 제어 문자 제거

5. **✅ 데이터베이스 보안**
   - Prepared Statements 사용 (SQL Injection 방어)
   - `better-sqlite3` 사용

6. **✅ JWT 구현**
   - 자체 JWT 구현으로 의존성 감소 (Line 313-361)
   - 만료 시간 검증

7. **✅ HTTPS 강제 (프로덕션)**
   - HSTS 헤더 설정 (Line 133-141)

8. **✅ 로그 요청 ID**
   - 각 요청마다 고유 ID 생성으로 추적 가능 (Line 168-185)

---

## 해결 방안 및 권장사항

### 즉시 조치 (24시간 내)

1. **🔴 Supabase Anon Key 재생성 및 제거**
   ```bash
   # 1. Supabase 콘솔에서 새 키 생성
   # 2. .env 파일에만 저장
   # 3. assets/auth-state.js에서 하드코딩된 키 제거
   # 4. 환경 변수로 전달하도록 수정
   ```

2. **🔴 프로덕션 환경 JWT_SECRET 필수 체크 강화**
   ```javascript
   if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
     console.error('[CRITICAL] JWT_SECRET is required in production');
     process.exit(1);
   }
   ```

3. **🟡 CSRF 보호 확대**
   - 모든 상태 변경 API에 CSRF 토큰 검증 추가

### 단기 조치 (1주일 내)

4. **🟡 인증 미들웨어 추가**
   - CRUD API에 인증 요구
   - 관리자 전용 엔드포인트 보호

5. **🟡 Rate Limiting 개선**
   - X-Forwarded-For 헤더 고려
   - 더 세밀한 제한 (엔드포인트별)

6. **🟢 CSP 정책 강화**
   - `unsafe-inline`, `unsafe-eval` 제거
   - Nonce 기반 스크립트 로딩

### 중기 조치 (1개월 내)

7. **🟢 로깅 시스템 개선**
   - 민감한 정보 로그 제거
   - 로그 레벨 도입 (debug, info, warn, error)
   - 프로덕션 로그는 외부 서비스로 전송

8. **🟢 XSS 방어 강화**
   - innerHTML 사용 최소화
   - DOMPurify 같은 라이브러리 도입

9. **보안 테스트 자동화**
   - npm audit 정기 실행
   - 의존성 취약점 모니터링

### 장기 조치

10. **보안 모니터링**
    - 침입 탐지 시스템 (IDS)
    - 이상 행위 감지

11. **정기 보안 감사**
    - 분기별 보안 점검
    - 침투 테스트

12. **보안 교육**
    - 개발팀 보안 교육
    - 보안 코딩 가이드라인 수립

---

## 요약

### 발견된 이슈 통계
- 🔴 **치명적**: 2개
- 🟡 **중요**: 5개
- 🟢 **보통/낮음**: 5개
- ✅ **양호**: 8개

### 우선순위 조치 사항
1. **최우선**: Supabase Anon Key 하드코딩 제거 및 재생성
2. **최우선**: JWT_SECRET 프로덕션 검증 강화
3. **높음**: CSRF 보호 확대
4. **높음**: CRUD API 인증 추가
5. **높음**: CORS 설정 개선

### 전반적인 평가
프로젝트는 기본적인 보안 설정(Helmet, Rate Limiting, Input Sanitization)이 잘 되어 있으나, **API 키 노출**과 **인증/인가 부족**이 가장 큰 문제입니다. 

즉시 조치 항목을 해결하면 대부분의 심각한 보안 위험을 제거할 수 있습니다.

---

## 참고 자료
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/security)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)

---

**점검 완료일**: 2025년 10월 28일  
**다음 점검 권장**: 2025년 11월 28일


