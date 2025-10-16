# AI 작업 로그 (반드시 먼저 읽기)

> 💡 **새 AI는 먼저 `docs/QUICK_START.md`를 읽으세요!** (3분 안에 핵심 파악)  
> 이 문서는 상세한 변경 이력입니다.

이 문서는 이 저장소에서 작업하는 모든 사람/AI가 반드시 먼저 읽고 업데이트해야 하는 변경 이력입니다. 작은 수정이라도 여기 항목을 추가하세요. (커밋 직전 체크리스트는 아래에 있습니다.)

---

## 🔥 최신 중요 사항 TOP 3 (바쁘면 여기만!)

### 1. naver-keyword-tool 폴더 삭제됨 (2025-10-16)

- 서브모듈 정리 완료
- ⚠️ vercel.json에 Render 프록시 유지 중 (`https://naver-keyword-tool.onrender.com`)
- 현재 코드는 정상 작동 (Render 서버 계속 운영 중)

### 2. Kakao 로그인 Vercel 이전 완료 (2025-10-14)

- `/auth/*` 경로는 이제 Vercel Functions 사용
- 환경변수 필수: KAKAO_REST_API_KEY, KAKAO_REDIRECT_URI, JWT_SECRET

### 3. 로그인 상태 확인 로직 개선 (2025-10-14)

- 모든 HTML 페이지 수정 완료
- localStorage 에러 처리 강화

---

## 📋 전체 작업 이력 (상세)

---

## 2025-10-16 - 문서 체계 대폭 개선: 3단계 읽기 구조 완성 🎯

- 배경: 새 AI가 빠르게 컨텍스트를 파악할 수 있도록 문서 구조 개선 필요
- 변경 파일: `README.md`, `docs/AI_LOG.md`, `docs/QUICK_START.md` (신규)

### 핵심 개선사항

#### 1. **QUICK_START.md 신규 생성** (가장 중요!)

- 3분 안에 읽을 수 있는 핵심 요약본
- 현재 프로젝트 상태 (아키텍처, 최근 작업)
- 작업 시 주의사항 (Do/Don't)
- 진행 중인 계획 요약
- 주요 파일 구조 다이어그램
- FAQ 포함

#### 2. **AI_LOG.md 상단에 "최신 TOP 3" 섹션 추가**

- 바쁜 AI를 위한 최신 중요 사항만 요약
- QUICK_START.md 링크 안내 추가
- 전체 이력과 최신 요약 분리

#### 3. **README.md 읽기 흐름 개선**

- "🚀 처음이라면 여기서 시작!" 섹션 강조
- QUICK_START.md를 최우선 안내
- 읽는 순서를 트리 구조로 시각화
- 예상 소요 시간 명시 (3분, 1분 등)

### 새로운 읽기 흐름

```
새 AI 투입 → README.md 확인
              ↓
         QUICK_START.md (3분) ← 핵심!
              ↓
         AI_LOG.md 최신 TOP 3 (1분)
              ↓
         (필요시) AI_LOG.md 전체
              ↓
         (필요시) PROJECT_PLAN.md
```

### 효과

- ✅ **토큰 절약**: 272줄 전부 읽지 않고 핵심만 파악
- ✅ **시간 절약**: 3분 + 1분 = 4분 안에 작업 시작 가능
- ✅ **명확한 우선순위**: 무엇을 먼저 읽어야 하는지 명확
- ✅ **오작업 방지**: 주의사항과 Do/Don't 명시
- ✅ **유지보수 용이**: QUICK_START.md만 업데이트하면 됨

### 유지보수 방법

- **중요 변경 시**: QUICK_START.md + AI_LOG.md TOP 3 업데이트
- **일반 작업**: AI_LOG.md에만 추가
- **계획 변경**: PROJECT_PLAN.md 업데이트

- 후속 작업: 주요 변경마다 QUICK_START.md 동기화 필요

---

## 2025-10-16 - naver-keyword-tool 폴더 삭제 후 영향도 점검 완료

- 배경: `naver-keyword-tool` 폴더가 삭제되어 프로젝트 내 참조 문제 확인 필요
- 점검 결과:
  - ✅ 모든 HTML 파일: 참조 없음
  - ✅ server.js: 참조 없음
  - ✅ package.json: 참조 없음
  - ⚠️ vercel.json (23번째 줄): Render 프록시 URL 유지 중
    - `https://naver-keyword-tool.onrender.com/api/:path*`
    - 현재 Render 서버 작동 중이면 문제 없음
  - ⚠️ docs/AI_LOG.md (113번째 줄): 문서 내용에 URL 언급 (정보성, 문제 없음)
  - ⚠️ docs/PROJECT_PLAN.md: 향후 제거 계획 기록 (계획 문서, 문제 없음)
- 확인 방법: `grep -R "naver-keyword-tool" .` 명령으로 전체 검색
- 결론: **현재 코드는 정상 작동**. Render 서버가 계속 운영 중이면 API 프록시도 정상
- 주의사항: 향후 Render 서버 중단 시 vercel.json 프록시 수정 필요
- 후속 작업: Render → Vercel Functions 완전 이관 계획 진행 중 (PROJECT_PLAN.md 참고)

---

## 2025-10-14 - 로그인 상태 확인 로직 개선 (전체 페이지)

- 배경: 로그인 상태임에도 불구하고 로그인/회원가입 버튼이 계속 표시되는 문제 발생. AI 리뷰작성을 제외한 모든 페이지에서 발생
- 문제 원인:
  - 기존 로직이 불완전: 로그인 시 버튼을 숨기기만 하고, 비로그인 시 명시적으로 표시하지 않음
  - 일부 페이지에는 로그인 상태 확인 로직 자체가 없음
  - 에러 처리 부족으로 localStorage 파싱 오류 시 UI 상태가 이상해짐
- 변경 파일:
  - `ChatGPT.html`: 로그인 상태 확인 로직 개선 (else 케이스 추가, 에러 처리 강화)
  - `index.html`: 동일하게 개선
  - `Blog-Editor.html`: 로그인 상태 확인 로직 신규 추가
  - `naver_search.html`: 로그인 상태 확인 로직 신규 추가
  - `place-check.html`: 로그인 상태 확인 로직 신규 추가
- 주요 변경점:
  - 로그인 O: 로그인/회원가입 버튼 숨김 (`display: "none"`)
  - 로그인 X: 로그인/회원가입 버튼 명시적으로 표시 (`display: "inline-block"`)
  - try-catch로 localStorage.getItem("userData") 파싱 오류 처리
  - 파싱 오류 시 localStorage 초기화하여 깨끗한 상태 유지
  - 로그아웃 시 확인 다이얼로그 추가 (사용자 경험 개선)
- 확인 방법:
  1. 브라우저 새로고침 (Ctrl + Shift + R로 하드 리프레시)
  2. 비로그인 상태: 로그인/회원가입 버튼이 보여야 함
  3. 로그인 상태: 로그인/회원가입 버튼이 사라지고 로그아웃 버튼이 보여야 함
  4. 모든 페이지에서 동일하게 동작하는지 확인 (ChatGPT, 키워드검색, 블로그, 플레이스점검)
- 배포: Git 푸시 → Vercel 자동 배포
  ```bash
  git add .
  git commit -m "fix: 로그인 상태 확인 로직 개선 (전체 페이지)"
  git push
  ```
- 후속 작업: 없음 (완료)

---

## 2025-10-14 - 카카오 로그인 이관 진행(환경변수/리라이트/검증)

- 배경: KOE101 오류 해소 및 프록시 제거를 위해 `/auth/*`를 Vercel 함수로 처리하고, 콘솔/ENV 설정을 정합화
- 적용 사항(코드/설정)
  - Vercel 함수 추가: `api/auth/kakao/login.js`, `api/auth/kakao/callback.js`, `api/auth/me.js`, `api/auth/logout.js`
  - 라우팅: `vercel.json`에 내부 리라이트 추가 → `/auth/:path*` → `/api/auth/:path*`
  - 의존성: `package.json`에 `jsonwebtoken` 추가
  - 환경변수(Vercel Project → Settings → Environment Variables, Production):
    - `KAKAO_REST_API_KEY` = 카카오 콘솔 REST API 키
    - `KAKAO_REDIRECT_URI` = `https://sajangpick.co.kr/auth/kakao/callback`
    - `JWT_SECRET` = 긴 랜덤 문자열(예: 64 hex)
    - `CORS_ORIGIN` = `https://sajangpick.co.kr,https://www.sajangpick.co.kr`
    - `KAKAO_CLIENT_SECRET` (선택, 콘솔에서 사용 ON일 때만)
  - 배포: 환경변수 저장 후 Redeploy(Production)
- 카카오 콘솔(반드시 일치)
  - 제품 설정 → 카카오 로그인 → 일반:
    - 사용 ON
    - 리다이렉트 URI = `https://sajangpick.co.kr/auth/kakao/callback`
  - 앱 설정 → 일반 → 플랫폼(Web):
    - 사이트 도메인: `https://sajangpick.co.kr`, `https://www.sajangpick.co.kr` (https, 슬래시 없음)
- 확인 절차(스모크)
  1. `https://sajangpick.co.kr/auth/kakao/login?state=login` → 카카오 로그인 화면
  2. 로그인 후 `/login.html?login=ok` 리다이렉트
  3. `https://sajangpick.co.kr/api/auth/me` → `{ authenticated: true }`
- 트러블슈팅 메모
  - KOE101 발생 시 점검 순서: (1) redirect_uri 정확도, (2) REST API 키(client_id) 일치, (3) 플랫폼 Web 도메인, (4) Client Secret 사용 여부
- 상태
  - ENV/리라이트/함수 배포 완료, 콘솔 설정 안내 중
  - 다음: 각 페이지의 로그인/회원가입 버튼 링크를 `/auth/kakao/login?state=login|signup`으로 통일

## 2025-10-14 - 모바일 헤더 겹침 전면 수정 + 배포 플로우 정리

- 배경: 모바일에서 상단 로고/로그인/탭이 겹치는 이슈 발생(여러 페이지). 작은 화면에서 클릭 시 겹침.
- 변경 파일
  - `ChatGPT.html`: 모바일에서 `.top-nav` 세로 스택, `.user-actions` absolute 해제, 버튼 줄바꿈 허용
  - `Blog-Editor.html`: 동일 규칙 적용
  - `naver_search.html`: 동일 규칙 적용
  - `place-check.html`: 동일 규칙 적용
  - `index.html`: 기존에 적용된 모바일 가로 스크롤(상단 앱 1줄, 5개 노출) 유지
- 핵심 CSS 규칙(모바일, ≤768px)
  - `.top-nav { flex-direction: column; gap: 8~15px }`
  - `.user-actions { position: static; width: 100%; justify-content: center; flex-wrap: wrap }`
  - 필요 시 버튼 패딩/폰트 축소로 오버플로 방지
- 확인 방법
  1. 각 페이지를 휴대폰 또는 DevTools(≤768px)로 열기
  2. 상단 로고/로그인/마이페이지와 메뉴 탭이 겹치지 않고 위→아래 순서로 정렬되는지 확인
  3. 캐시 무시: URL 뒤에 `?v=YYYYMMDD` 쿼리 추가
- 배포(Vercel)
  - 깃 연동이면: `git add . && git commit -m "fix(mobile): 헤더 겹침 해결" && git push`
  - CLI 즉시 배포: `pnpm dlx vercel deploy --prod`
- 주의/참고
  - 상단 기능 아이콘(메인 `index.html`)은 모바일에서 1줄 고정 + 가로 스크롤, 5개 노출
  - API는 Render로 프록시: `vercel.json`의 rewrites 참고

---

## 2025-10-13 - 상단 기능 아이콘(모바일) 1줄 스크롤 적용

- 배경: 모바일에서 상단 기능 아이콘(채팅/리뷰작성/블로그/키워드/플점검)이 2줄로 보임 → 1줄에 5개 보이고 넘치면 가로 스크롤
- 변경 파일: `index.html`
- 주요 변경점
  - `.top-actions-row .top-apps`를 가로 스크롤 가능 플렉스로 전환
  - 아이템 폭 고정: `flex: 0 0 calc((100% - 48px) / 5)`
  - 스크롤 스냅 + 스크롤바 숨김
- 확인/배포: 위와 동일

---

## 운영/구조 메모

- 정적 웹: Vercel (Framework: Other, Build/Output 비움)
- API: Render로 운영, 프론트에서 `vercel.json`으로 `/api`/`/auth` 프록시
- 백엔드 베이스 URL(프론트): `https://naver-keyword-tool.onrender.com`
- 캐시 무효화: 정적 리소스 변경 시 쿼리 버전(`?v=날짜`) 권장

---

## Next.js 통합 계획(백엔드까지 Vercel, 단계적 전환)

- 배경: 현재는 정적 HTML + Express(Render). 유지보수/프록시 복잡도 감소를 위해 Next.js(App Router)로 통합 예정
- 단기(현행 유지): `vercel.json` 프록시로 로그인/API 사용, Render ENV 정리
- 중기(Phase 1~3): 인증 → 읽기 API → 쓰기/연산 API 순서로 Next Route Handlers로 이관, 기능 토글로 점진 전환
- 최종: 전부 Vercel에서 구동, Render 프록시 제거
- 필요한 ENV(Vercel Project Settings): `KAKAO_REST_API_KEY`, `KAKAO_REDIRECT_URI=https://sajangpick.co.kr/auth/kakao/callback`, `KAKAO_CLIENT_SECRET(옵션)`, `JWT_SECRET`, `CORS_ORIGIN`
- 라우팅 정책: 기존 경로 유지(`/api/*`, `/auth/*`), 점진 이관 시 토글로 트래픽 분배(10%→50%→100%)

### 단계 요약

- Phase 1(인증): `/auth/kakao/login`, `/auth/kakao/callback` Next로 이전, `/login`, `/join` UX 이식. 성공 시 기존 도메인으로 리다이렉트. 롤백: 경로 스위치로 즉시 복귀
- Phase 2(읽기 API): `/api/keywords`, `/api/search/local`, `/api/health` 이관, 캐시 전략(ISR/서버 캐시) 적용
- Phase 3(쓰기/연산): `/api/chat`, `/api/generate-blog`, `/api/analyze-review`, `/api/generate-reply` 이관. 타임아웃/스트리밍 고려, 에러/재시도 표준화
- Phase 4(페이지): 주요 HTML 페이지를 `app/` 페이지로 전환, 공통 레이아웃/성능 최적화
- Phase 5(DB): 필요 시 SQLite → Supabase(Postgres) 전환

### 검증/롤백

- SLO: 오류율 <1%, P95 <800ms, 로그인 성공률 ±1%p 이내. 실패 시 플래그 OFF로 1분 내 복귀

---

## 점진 전환 실행계획 요약(`docs/점진전환_실행계획.md`)

- 원칙: 작은 배포/빠른 관측/즉시 롤백, 기존 경로 유지, 관측 필수(오류율/P95/로그인 성공률)
- 세이프가드: 사용량 90% 경고, 95% 직전 중지, 오류율/P95 급증 시 롤백
- 환경/보안: Kakao OAuth state 쿠키, JWT 세션 쿠키, CORS Origin 고정, helmet + CSP Report-Only → Nonce 도입 후 Enforce 전환 계획
- SLO 게이트: 1시간 관측치 충족 시 승급, 초과 시 롤백
- Phase 0: 준비/관측/ENV 분리/기능 토글 설계, 롤백 스크립트 리허설
- Phase 1: 인증만 Next로 분리(NextAuth 또는 자체 OAuth), `/login`·`/join` 이관
- Phase 2: 읽기 API 이관(저위험), 캐시 전략 수립, 단계적 전환(5→20→50→100%)
- Phase 3: 쓰기/연산 API 이관(중위험), 서버리스 한계 고려(타임아웃/스트리밍), 재시도 표준화
- Phase 4: 페이지 전환(SEO/UX), 정적 자원 캐시/압축, 공통 레이아웃
- Phase 5: 데이터 계층 전환(있을 경우) — 듀얼라이트 후 컷오버
- 운영 체크리스트: 배포 전 테스트/알림/ 롤백 리허설/취약점 스캔, 스모크 테스트 항목 명시(`/auth/kakao/login` 302 등)

---

## 커밋 직전 체크리스트(의무)

- [ ] 이 파일에 이번 변경 항목을 추가했나요?
- [ ] 변경/테스트 방법을 한 줄이라도 남겼나요?
- [ ] 배포 방식(깃 푸시 또는 Vercel CLI)을 기록했나요?

---

## 2025-10-14 - Phase 1 착수: 카카오 OAuth를 Vercel 함수로 이관

- 배경: 프록시/콜드스타트/404 감소 및 운영 단순화를 위해 인증 라우트를 Vercel로 이전
- 변경 파일:
  - `api/auth/kakao/login.js`: 카카오 authorize로 리다이렉트 + CSRF state 쿠키 발급
  - `api/auth/kakao/callback.js`: 토큰 교환, JWT 세션 쿠키 발급, `/login.html?login=ok` 또는 `/join.html?signup=ok` 리다이렉트
  - `api/auth/me.js`, `api/auth/logout.js`: 세션 조회/해제
  - `vercel.json`: `/auth/*` 프록시 제거(내부 함수로 처리), `/api/*` 프록시 유지
  - `package.json`: `jsonwebtoken` 추가
- 필요한 환경변수(Vercel Project Settings):
  - `KAKAO_REST_API_KEY`, `KAKAO_REDIRECT_URI=https://sajangpick.co.kr/auth/kakao/callback`
  - `KAKAO_CLIENT_SECRET`(선택), `JWT_SECRET`, `CORS_ORIGIN=https://sajangpick.co.kr,https://www.sajangpick.co.kr`
- 확인 방법:
  1. 배포 후 `https://sajangpick.co.kr/auth/kakao/login?state=login` 접속 → 카카오 화면으로 이동
  2. 로그인 후 `/login.html?login=ok`로 리다이렉트되는지 확인
  3. `https://sajangpick.co.kr/api/auth/me` 응답에서 `authenticated:true` 확인
- 롤백: `vercel.json`에서 `/auth/:path*` 프록시 항목 복원 후 재배포

## 2025-10-16 - 문서 폴더 통합(루트 `docs` 기준)

- 배경: `docs` 폴더가 루트와 `naver-keyword-tool/docs`에 이중 존재하여 중복/혼선을 유발
- 변경 파일/경로:
  - `naver-keyword-tool/index.html`: 이미지 경로를 `../docs/chatgpt.png`로 수정
  - `naver-keyword-tool/docs/` 내 중복 문서 제거: `env.example.md`, `새로운방식.md`, `점진전환_실행계획.md`, `chatgpt.png`(삭제 시도)
- 주요 변경점:
  - 기준 폴더를 루트 `docs`로 확정, 모든 참조를 루트 기준으로 통일
  - 코드 전반에서 `naver-keyword-tool/docs` 참조 제거(검색 기준, 남은 참조 없음)
- 확인 방법:
  1. `grep -R "naver-keyword-tool/docs" -n .` 결과가 없어야 함
  2. `naver-keyword-tool/index.html`에서 OpenAI 아이콘 경로가 `../docs/chatgpt.png`인지 확인
  3. `naver-keyword-tool/docs` 폴더가 비어있는지 확인(서브모듈 특성상 잔여 파일이 있을 수 있음)
- 배포: Git 푸시 → Vercel 자동 배포 (정적 파일 변경)
- 주의/추가 조치(서브모듈일 경우):
  - 하위 레포(`naver-keyword-tool`)가 서브모듈이면 해당 레포 안에서 별도 커밋이 필요할 수 있음
  - 예: `git -C naver-keyword-tool rm -f docs/chatgpt.png && (cd naver-keyword-tool && git commit -m "chore(docs): remove duplicate docs")`

## 2025-10-16 - 중복 서브앱 정리: `naver-keyword-tool/` 제거

- 배경: 루트와 `naver-keyword-tool/`에 동일 이름의 페이지/서버 파일이 공존하여 혼선 발생. 목표는 루트(`sajangpick_osm`)만 유지
- 영향 분석(해시 비교): SAME=`mypage.html` 1건, DIFF=`index.html`, `AI-Review.html`, `Blog-Editor.html`, `ChatGPT.html`, `join.html`, `login.html`, `naver_search.html`, `place-check.html`, `server.js`
- 조치:
  - `naver-keyword-tool/index.html` 삭제(루트 `index.html` 유지)
  - 중복 페이지/서버 파일 삭제: 위 DIFF/SAME 항목 모두 `naver-keyword-tool/` 측 제거
  - 패키지/배포 파일 삭제: `naver-keyword-tool/package.json`, `package-lock.json`, `render.yaml`
  - 정적 리소스 하위 폴더 비움(`css/css`, `js/js`) — 폴더 삭제는 수동 필요할 수 있음
- 참조 점검:
  - 전역 검색 결과 `naver-keyword-tool/` 경로 링크/참조 없음(페이지 링크는 루트 기준 유지)
- 확인 방법:
  1. `grep -R "naver-keyword-tool/" -n .` 결과 없음
  2. 루트 `index.html` 정상 표시 및 상단 앱 링크 동작 확인
  3. 빌드/배포 후 404 경로 없음(`naver-keyword-tool/index.html` 직접 접근은 제거됨)
- 배포: Git 푸시 → Vercel 자동 배포

## 새 항목 추가 템플릿 (복사해서 사용)

### YYYY-MM-DD - 간단 제목

- 배경: 한 줄 설명
- 변경 파일: `path/to/file1`, `path/to/file2`
- 주요 변경점:
  - 변경 1
  - 변경 2
- 확인 방법:
  1. 단계1
  2. 기대 결과
- 배포: Git 푸시 또는 `pnpm dlx vercel deploy --prod`
- 주의/롤백: 위험 요소/롤백 방법(필요 시 Vercel Instant Rollback)
- 후속 작업: 다음 해야 할 일
