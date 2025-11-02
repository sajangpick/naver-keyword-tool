# 사장픽 — Copilot / AI Agent 안내

이 저장소에서 바로 생산적으로 작업하기 위한 핵심 정보만 정리합니다.

## ⚠️ 작업 시작 전 필수 확인

**반드시 이 순서로 진행하세요:**

1. 이 문서(`copilot-instructions.md`) 읽기 (2분)
2. `docs/AI_START_HERE.md` 읽기 (30초)
3. 사용자에게 확인 보고: "✅ AI_START_HERE.md를 확인했습니다. 작업을 시작하겠습니다."
4. 필요한 정보만 검색 → 작업 수행
5. 작업 완료 후 `docs/AI_LOG.md`에 5-10줄 요약 기록

**이 순서를 따르지 않으면 작업 금지!**

## 1. 아키텍처 — 변경 절대 금지! 🚨

```
사용자
  ↓
Vercel (정적 HTML/CSS/JS 호스팅)
  ├── index.html, Blog-Editor.html, review.html 등
  └── /api/* 요청 → vercel.json rewrites 사용
              ↓
Render (Express.js 서버 — 24시간 실행)
  ├── server.js (4312줄, 모든 라우팅/미들웨어)
  ├── api/ (30+ API 엔드포인트)
  │   ├── chatgpt-blog.js (AI 블로그 생성)
  │   ├── place-crawl.js (네이버 플레이스 크롤링)
  │   ├── middleware/token-tracker.js (TokenFlow 시스템)
  │   └── auth/, payment/, subscription/ 등
  └── 환경변수로 외부 서비스 연동
              ↓
Supabase (PostgreSQL + Auth)
  ├── users, stores, blog_posts
  ├── subscriptions, token_usage (TokenFlow)
  └── policies, news_board 등
```

**왜 이런 구조인가?**
- **2025-10-22 결정**: Vercel은 serverless 환경으로 Express 앱 전체 실행 불가
- ChatGPT/크롤링은 15-30초 소요 → Vercel Functions 10초 제한 초과
- Render는 무료 플랜으로 24시간 Express 서버 실행 지원

## 2. 절대 금기 사항 🔴

**이 파일들을 수정/삭제하면 사이트 전체가 중단됩니다:**

### 2-1. `vercel.json` (프록시 설정)
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://sajangpick-kwon-teamjang.onrender.com/api/:path*" }
  ]
}
```
- 모든 `/api/*` 요청을 Render로 프록시
- **수정 금지**: 이미 실패한 "Vercel Functions 통합" 제안 거부 (docs/배포_아키텍처.md 참조)

### 2-2. `api/` 폴더 전체
- 30+ API 파일 삭제 시 모든 기능 중단
- 각 API는 `server.js`에서 라우팅됨 (`server.js` 183-4200줄)

### 2-3. Render 배포 구조
- Render 서버 중단 = 사이트 작동 불가
- "Vercel로 통합" 제안 절대 금지

## 3. 개발 명령어

```bash
# 설치 (pnpm 필수 — package.json packageManager 지정)
pnpm install

# 개발 서버 (nodemon 자동 재시작)
pnpm dev

# 프로덕션 로컬 실행
pnpm start

# 크롤러
pnpm run crawl:all        # 전국 크롤링
pnpm run crawl:test       # 테스트 크롤링

# 데이터베이스
pnpm run db:init          # 테이블 초기화
pnpm run db:seed          # 샘플 데이터 삽입
pnpm run db:check         # 연결 확인
```

## 4. 핵심 파일 구조

**필독 문서 (작업 전 확인):**
- `docs/AI_START_HERE.md` — 30초 프로젝트 개요
- `docs/AI_WORKFLOW.md` — 작업 순서 (반드시 준수)
- `docs/중요_경고사항.md` — 금기 사항 전체 목록
- `docs/배포_아키텍처.md` — 왜 Vercel+Render 구조인지 설명

**코드 진입점:**
- `server.js` (4312줄) — Express 설정, 라우팅, 환경변수, CORS, helmet
- `api/` 폴더 — 각 기능별 API (chatgpt-blog.js, place-crawl.js 등)
- `*.html` (루트) — 프론트엔드 페이지 (Vanilla JS, fetch로 API 호출)

**데이터베이스:**
- `database/schemas/` — Supabase 테이블 스키마 (core, features 하위 폴더)
- `database/scripts/` — init/seed/check 스크립트

## 5. 프로젝트 규칙

### 5-1. 로깅 규칙
```javascript
// ✅ 올바른 방법
const devLog = (...args) => { if (isDevelopment) console.log(...args); };
const devError = (...args) => { if (isDevelopment) console.error(...args); };

// ❌ 금지 (프로덕션 로그 오염)
console.log("디버그 메시지");
```
- `server.js` L18-27에 정의됨
- 프로덕션에서는 로그 출력 안 함 (`NODE_ENV=production`)

### 5-2. 환경변수 관리
```javascript
// server.js L30-74에서 로드
const PORT = process.env.PORT || 3003;  // 3000 충돌 방지
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
```
- `.env` 파일 필수 (백업 권장)
- Render/Vercel 환경변수 별도 설정 (docs/배포_가이드.md 참조)

### 5-3. API 패턴
```javascript
// 모든 AI API는 TokenFlow 추적 필수
const { trackTokenUsage, checkTokenLimit } = require('./middleware/token-tracker');

async function callAI(userId, prompt) {
  await checkTokenLimit(userId, 3000);  // 사전 체크
  const response = await openai.chat.completions.create(...);
  await trackTokenUsage(userId, response.usage, 'chatgpt-blog');  // 사후 기록
  return response;
}
```
- `api/chatgpt-blog.js` L14-60 예시 참조
- `api/middleware/token-tracker.js` 참조

### 5-4. 프론트엔드 API 호출
```javascript
// HTML 파일에서 fetch 패턴
const response = await fetch('/api/chatgpt-blog', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, keyword, angle })
});
```
- `/api/*` 경로는 `vercel.json`이 Render로 자동 프록시
- 로컬 개발: `http://localhost:3003/api/*`
- 프로덕션: `https://your-site.vercel.app/api/*` → Render로 리다이렉트

## 6. 외부 연동

**Supabase (PostgreSQL + Auth):**
- SDK: `@supabase/supabase-js`
- 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- 초기화: `server.js` L56-68

**OpenAI / AI APIs:**
- `OPENAI_API_KEY`, `GEMINI_API_KEY`, `CLAUDE_API_KEY`
- 토큰 추적: `api/middleware/token-tracker.js` (자동)

**네이버 APIs:**
- 검색광고: `NAVER_CUSTOMER_ID`, `NAVER_API_KEY`, `NAVER_SECRET_KEY`
- 검색 API: `NAVER_SEARCH_CLIENT_ID`, `NAVER_SEARCH_CLIENT_SECRET`
- 서명 생성 로직: `server.js` L730-790 (HmacSHA256)

## 7. 주요 기능 위치

**AI 블로그 생성:**
- API: `api/chatgpt-blog.js` (1862줄, 8가지 랜덤 앵글)
- 프론트: `Blog-Editor.html`
- 특징: 이전 블로그 분석, 다양성 강화, 시간/계절 정보 활용

**네이버 플레이스 크롤링:**
- API: `api/place-crawl.js`, `api/place-batch-crawl.js`
- 크롤러: `crawler/nationwide-crawler.js`
- 특징: Puppeteer 사용, rate limiting

**리뷰 관리:**
- API: `api/generate-reply.js` (AI 답변 생성)
- 프론트: `review.html`

**TokenFlow 구독 시스템:**
- API: `api/subscription/` (토큰 추적, 플랜 관리)
- 미들웨어: `api/middleware/token-tracker.js`
- 관리자: `admin/pages/subscription-settings.html`
- 사용자: `user/subscription-management.html`

**뉴스 관리:**
- API: `api/news-board.js`, `api/news-search.js`, `api/ai-news-recommend.js`
- 관리자: `admin/news-management.html`

## 8. 작업 체크리스트

**변경 전:**
1. `docs/AI_START_HERE.md` 읽기
2. 사용자에게 확인 보고 전송
3. 관련 API와 HTML 파일 검색 (`grep` 활용)
4. 영향 범위 확인 (server.js 라우팅 체크)

**코드 수정 시:**
1. `devLog()`/`devError()` 사용 (console.log 금지)
2. 환경변수 하드코딩 금지 (process.env 사용)
3. TokenFlow API는 `trackTokenUsage()` 호출 필수

**배포 관련:**
1. `vercel.json` 절대 수정 금지
2. Render 배포 구조 변경 제안 금지
3. 환경변수 Render/Vercel 양쪽 동기화

**작업 완료:**
1. 변경 사항 요약
2. 테스트 방법 안내 (필요시)
3. `docs/AI_LOG.md` 하단에 5-10줄 기록 (전체 파일 읽지 말 것!)

## 9. 검색 패턴 예시

```bash
# 특정 기능 찾기
grep -r "크롤링" docs/
grep -r "KAKAO" api/

# API 엔드포인트 찾기
grep "app.post\|app.get" server.js

# 토큰 추적 사용처 찾기
grep -r "trackTokenUsage" api/

# 환경변수 사용처 확인
grep -r "process.env" api/ server.js
```

## 10. 자주 하는 실수

❌ **AI_LOG.md 전체 읽기** → 1200줄, 메모리 폭발  
✅ 작업 완료 후 하단에 요약만 추가

❌ **vercel.json 수정 제안** → 사이트 중단  
✅ 현재 구조 유지 (이미 실패한 방법)

❌ **console.log 남발** → 프로덕션 로그 오염  
✅ `devLog()` 사용

❌ **localhost 하드코딩** → 프로덕션 오류  
✅ 환경변수 또는 상대 경로 사용

❌ **TokenFlow 추적 누락** → 토큰 소비 미기록  
✅ `checkTokenLimit()` + `trackTokenUsage()` 세트 사용

---

**더 자세한 내용:** `docs/AI_START_HERE.md`, `docs/AI_WORKFLOW.md`, `docs/중요_경고사항.md` 참조
