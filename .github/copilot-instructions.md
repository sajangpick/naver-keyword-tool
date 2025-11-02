# 사장픽 AI Coding Agent Instructions

> **프로젝트**: 식당 사장님을 위한 네이버 플레이스 순위 분석 & AI 블로그 생성 SaaS  
> **핵심**: Express.js 서버 (Render) + 정적 프론트엔드 (Vercel) + Supabase

## 🚨 Critical: 작업 시작 전 필수 확인

**반드시 이 순서로:**
1. 이 문서 읽기 (2분)
2. `docs/AI_START_HERE.md` 읽기 (30초)
3. **사용자에게 확인 보고**: "✅ AI_START_HERE.md를 확인했습니다. 작업을 시작하겠습니다."
4. 필요 정보만 검색 → 작업 수행
5. 완료 후 `docs/AI_LOG.md` 하단에 5-10줄 요약 추가

## 1. 아키텍처 (절대 변경 금지)

```
Vercel (정적 호스팅)
  ├── *.html (Vanilla JS, fetch API 사용)
  └── /api/* 요청 → vercel.json rewrites
              ↓
Render (Express.js 24시간 서버)
  ├── server.js (4312줄 - 모든 라우팅/미들웨어)
  ├── api/ (30+ 엔드포인트)
  │   ├── chatgpt-blog.js (AI 블로그 생성, 1862줄)
  │   ├── place-crawl.js (Puppeteer 크롤링)
  │   └── middleware/token-tracker.js (TokenFlow 시스템)
  └── .env (환경변수 - 백업 필수!)
              ↓
Supabase (PostgreSQL + Auth)
  └── users, blog_posts, subscriptions, token_usage, reviews 등
```

**왜 Vercel + Render 분리?**
- Vercel Serverless Functions는 10초 제한 → ChatGPT/크롤링 15-30초 소요로 불가
- Express 앱 전체(`app.listen()`, 복잡한 미들웨어 체인)는 Vercel에서 실행 불가
- 2025-10-22 "Vercel 통합" 시도 실패 → 현 구조 결정 (docs/배포_아키텍처.md)

## 2. 절대 금기 사항

### ❌ 수정/삭제 금지 파일
1. **`vercel.json`** - 모든 `/api/*` 요청을 Render로 프록시. 수정 시 API 전체 중단.
2. **`api/` 폴더** - 30+ API 파일. 하나라도 삭제 시 해당 기능 중단.
3. **`.env`** - Supabase/OpenAI/Kakao 키 저장. 분실 시 복구 불가.

### ❌ 제안 금지 사항
- "Vercel Functions로 통합" → 이미 실패함
- "Render 제거" → 사이트 작동 불가
- "`vercel.json` 간소화" → API 호출 실패

## 3. 개발 워크플로우

### 명령어 (pnpm 필수)
```powershell
pnpm install              # 의존성 설치
pnpm dev                  # 개발 서버 (nodemon, PORT 3003)
pnpm start                # 프로덕션 로컬 실행

pnpm run crawl:all        # 전국 크롤링
pnpm run crawl:test       # 테스트 크롤링
pnpm run db:init          # Supabase 테이블 초기화
pnpm run db:seed          # 샘플 데이터 삽입
```

### 로깅 규칙 (server.js L18-27)
```javascript
// ✅ 올바른 방법 (프로덕션 로그 오염 방지)
const devLog = (...args) => { if (isDevelopment) console.log(...args); };
const devError = (...args) => { if (isDevelopment) console.error(...args); };

// ❌ 금지 - console.log 직접 사용 금지
console.log("디버그 메시지");
```

### 환경변수 패턴
```javascript
// server.js L30-74 패턴 준수
const PORT = process.env.PORT || 3003;  // 3000 충돌 방지
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ❌ 하드코딩 금지
const apiUrl = "http://localhost:3000";  // 프로덕션 오류 발생
```

## 4. 핵심 코딩 패턴

### TokenFlow 시스템 (모든 AI API 필수)
```javascript
// api/chatgpt-blog.js L14-60 패턴
const { trackTokenUsage, checkTokenLimit } = require('./middleware/token-tracker');

async function callOpenAI(userId, prompt) {
  // 1. 사전 체크 (예상 토큰)
  await checkTokenLimit(userId, 3000);
  
  // 2. API 호출
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }]
  });
  
  // 3. 사후 기록 (실제 사용량)
  await trackTokenUsage(userId, response.usage, 'chatgpt-blog');
  
  return response;
}
```

### API 라우팅 (server.js)
```javascript
// server.js L183-4200에서 모든 API 라우팅
app.post('/api/chatgpt-blog', async (req, res) => {
  const chatgptBlog = require('./api/chatgpt-blog');
  await chatgptBlog(req, res);
});
```

### 프론트엔드 API 호출 (*.html)
```javascript
// Vanilla JS, fetch 사용
const response = await fetch('/api/chatgpt-blog', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, keyword, angle })
});

// vercel.json이 /api/* 요청을 Render로 자동 프록시
// 로컬: http://localhost:3003/api/chatgpt-blog
// 프로덕션: https://your-site.vercel.app/api/chatgpt-blog → Render
```

## 5. 주요 기능 위치

| 기능 | API | 프론트엔드 | 특징 |
|------|-----|-----------|------|
| AI 블로그 생성 | `api/chatgpt-blog.js` (1862줄) | `Blog-Editor.html` | 8가지 랜덤 앵글, 이전 블로그 분석 |
| 네이버 크롤링 | `api/place-crawl.js` | `naver_search.html` | Puppeteer, rate limiting |
| 리뷰 관리 | `api/generate-reply.js` | `review.html` | AI 답변 생성 |
| TokenFlow | `api/subscription/`, `api/middleware/token-tracker.js` | `user/subscription-management.html` | 토큰 추적/한도 관리 |
| 뉴스 관리 | `api/news-board.js` | `admin/news-management.html` | AI 추천 |

## 6. 외부 서비스 연동

**Supabase** (PostgreSQL + Auth)
- SDK: `@supabase/supabase-js`
- 초기화: `server.js` L56-68
- 스키마: `database/schemas/` (core, features 하위 폴더)

**OpenAI / AI APIs**
- 키: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `CLAUDE_API_KEY`
- 토큰 추적: `api/middleware/token-tracker.js` (자동)

**네이버 APIs**
- 검색광고: `NAVER_CUSTOMER_ID`, `NAVER_API_KEY`, `NAVER_SECRET_KEY`
- 서명 생성: `server.js` L730-790 (HmacSHA256)

## 7. 작업 체크리스트

### 변경 전
1. `docs/AI_START_HERE.md` 읽기
2. 사용자 확인 보고 전송
3. grep으로 관련 파일 검색 (`grep -r "keyword" api/`)
4. `server.js`에서 라우팅 확인

### 코드 수정 시
1. `devLog()`/`devError()` 사용 (console.log 금지)
2. 환경변수 하드코딩 금지
3. AI API는 TokenFlow 추적 필수

### 배포 관련
1. `vercel.json` 수정 금지
2. Render 구조 변경 제안 금지
3. 환경변수 Render/Vercel 양쪽 동기화

### 완료 후
1. 변경사항 요약
2. 테스트 방법 안내
3. `docs/AI_LOG.md` 하단에 5-10줄 기록 (전체 읽지 말 것!)

## 8. 자주 하는 실수

| ❌ 실수 | ✅ 올바른 방법 |
|---------|---------------|
| `AI_LOG.md` 전체 읽기 (1200줄) | 하단에 요약만 추가 |
| `vercel.json` 수정 제안 | 현 구조 유지 (이미 실패) |
| `console.log` 남발 | `devLog()` 사용 |
| `localhost` 하드코딩 | 환경변수/상대 경로 |
| TokenFlow 추적 누락 | `checkTokenLimit()` + `trackTokenUsage()` 세트 |

## 9. 참고 문서

**필독** (작업 전):
- `docs/AI_START_HERE.md` - 30초 프로젝트 개요
- `docs/AI_WORKFLOW.md` - 작업 순서
- `docs/중요_경고사항.md` - 금기 사항
- `docs/배포_아키텍처.md` - Vercel+Render 구조 이유

**검색 패턴**:
```powershell
# API 엔드포인트 찾기
grep "app.post\|app.get" server.js

# 토큰 추적 사용처
grep -r "trackTokenUsage" api/

# 환경변수 사용처
grep -r "process.env" api/ server.js
```

---

**더 자세한 내용**: `docs/AI_START_HERE.md`, `docs/AI_WORKFLOW.md` 참조
