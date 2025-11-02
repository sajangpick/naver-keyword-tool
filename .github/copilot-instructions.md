## 사장픽 — Copilot / AI Agent 안내

짧고 실용적으로 이 저장소에서 바로 생산적으로 작업하기 위한 핵심 정보만 정리합니다.

### 1) 한눈에 보는 아키텍처
- 프론트엔드: 정적 HTML + Vanilla JS, Vercel으로 정적 배포 (루트 HTML 파일들)
- 백엔드: `server.js` 기반 Express 서버 (Render에 배포), API는 `api/` 폴더에 관련 코드 존재
- DB: Supabase 사용 (서비스 키는 런타임 환경변수로 제공)
- 크롤러: `crawler/` 와 Python 스크립트(또는 Node 크롤러) — 크롤링은 별도 스케줄/스크립트로 실행

### 2) 절대/중요 금기 사항 (프로덕션 안전)
- 절대 `vercel.json` 수정 금지 — 프록시/라우팅 설정으로 사이트 중단 위험
- `api/` 폴더 및 Render 배포 구조를 임의로 통합/삭제하지 마세요 (구조 변경 제안 금지)

### 3) 빠른 개발/실행 명령 (예시)
- 설치: `pnpm install` (package.json의 `packageManager`가 pnpm)
- 개발 서버: `pnpm dev` → 내부적으로 `nodemon server.js`
- 프로덕션(로컬 실행): `pnpm start` → `node server.js`
- 크롤러 예: `pnpm run crawl:all` 또는 `pnpm run crawl:test`
- DB 스크립트: `pnpm run db:init`, `pnpm run db:seed`, `pnpm run db:check`

### 4) 어디서 핵심 정보를 찾을지 (필독 파일들)
- `docs/AI_START_HERE.md` — AI가 작업 시작할 때 반드시 읽을 문서(30초 요약)
- `docs/AI_WORKFLOW.md` — 작업 전/중/후 반드시 따를 워크플로우
- `docs/AI_LOG.md` — 작업 완료 후 요약을 남길 위치 (전체 읽지 말고 요약만 작성)
- `server.js` — Express 설정, 환경변수, CORS, rate-limiter, 정적 서빙 등 주요 런타임 로직
- `package.json` — 사용 가능한 npm/pnpm 스크립트 (위에 주요 스크립트 예시)

### 5) 프로젝트 특이 관례 / 규칙 (AI 전용)
- 작업 시작 전 사용자에게 확인 문구를 반드시 보낼 것: 예) "AI_START_HERE.md를 확인했습니다. 작업을 시작하겠습니다."
- `docs/AI_START_HERE.md`와 `docs/AI_WORKFLOW.md`의 순서를 따르지 않으면 작업 금지
- `docs/AI_LOG.md`는 결과 기록용: 절대 전체 파일을 메모리에 불러오지 말 것(큰 파일)
- 로깅: 개발 전용 로깅은 `devLog()` / `devError()` 패턴 사용 — `console.log` 남발 금지

### 6) 통합·외부 연동 포인트
- Supabase: `@supabase/supabase-js` 사용, 서비스 키는 `SUPABASE_SERVICE_ROLE_KEY` 등 환경변수에 있음
- OpenAI / Gemini / Claude 키는 환경변수(예: `OPENAI_API_KEY`, `CLAUDE_API_KEY`)에 설정
- 네이버 API: `NAVER_*` 환경변수로 관리 (서명 생성 로직는 `server.js` 참조)

### 7) 안전한 변경/검토 팁 (간단한 체크리스트)
1. 변경 전: `docs/AI_START_HERE.md` 읽고 사용자에게 확인 메시지 전송
2. 코드 변경 시: 관련 엔드포인트(`server.js`)와 정적 파일(`*.html`)의 영향 범위 확인
3. 배포 관련 파일(`vercel.json`)은 수정하지 않음
4. 작업 완료: `docs/AI_LOG.md`에 5–10줄로 요약 기록

### 8) 예시 검색·수정 패턴
- 특정 기능(크롤링/카카오 로그인/배포)을 찾고 싶을 때:
  - `grep -R "크롤링" docs/` 또는 코드에서 `grep -R "KAKAO" api/`
  - 핵심 파일: `crawler/`, `api/place-crawl.js`, `docs/KAKAO_LOGIN_GUIDE.md`

---
빠른 피드백 주세요: 추가로 포함할 정확한 운영 규칙이나, 민감 파일(예: 다른 금기 목록)을 알려주시면 즉시 반영하겠습니다.
