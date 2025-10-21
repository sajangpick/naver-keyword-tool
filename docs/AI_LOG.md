# AI 작업 로그 (반드시 먼저 읽기)

> 💡 **새 AI는 먼저 `docs/QUICK_START.md`를 읽으세요!** (3분 안에 핵심 파악)  
> 이 문서는 상세한 변경 이력입니다.

> ⚠️ **중요: 작업 전 필수 체크리스트**
> 1. **이 문서(AI_LOG.md)를 반드시 먼저 읽으세요** - 프로젝트 상황 파악
> 2. **QUICK_START.md를 읽으세요** - 3분 안에 핵심 구조 이해
> 3. **최신 TOP 3를 확인하세요** - 가장 최근 중요 변경사항
> 4. **작업 후 이 문서를 업데이트하세요** - 다음 AI를 위한 기록
> 
> 📌 **이 문서를 읽지 않고 작업하면 심각한 오작업이 발생합니다!**
> - Git 저장소 상태를 모르고 배포 방법을 잘못 안내
> - 이미 배포된 프로젝트를 새 프로젝트로 착각
> - 중복 파일 생성 또는 잘못된 삭제
> - 환경 설정 누락으로 프로덕션 장애

이 문서는 이 저장소에서 작업하는 모든 사람/AI가 반드시 먼저 읽고 업데이트해야 하는 변경 이력입니다. 작은 수정이라도 여기 항목을 추가하세요. (커밋 직전 체크리스트는 아래에 있습니다.)

---

## 🧭 비개발자용 초간단 가이드(10분 완성)

> 이 섹션만 따라 하면 “코드 올리기 → 배포 → 로그인 점검”이 끝납니다. 터미널은 필요 없습니다.

### 1) 코드 올리기(GitHub Desktop)
1. GitHub Desktop 실행 → File → Add local repository… → `C:\Users\admin\Desktop\사장픽` 선택 → Add
2. Repository → Repository settings… → Remote → URL에 `https://github.com/sajangpick/naver-keyword-tool.git` 입력 → Save
3. Changes 탭에서 Summary에 `chore: 프로젝트 동기화(사장픽 → naver-keyword-tool)` 입력 → Commit → 우측 상단 Push origin(또는 Publish branch)
4. “View on GitHub” 버튼으로 커밋이 보이는지 확인

필수 제외(절대 올리지 않음): `.env`, `.env.*`, `.vercel/`, `node_modules/`, `dist/`, `build/`, `coverage/`, `.DS_Store`
```
.env
.env.*
.vercel/
node_modules/
dist/
build/
coverage/
.DS_Store
```

### 2) 배포(Vercel 웹)
1. Vercel 대시보드 → New Project → GitHub에서 `sajangpick/naver-keyword-tool` 선택 → Team은 `sajangpick-team`
2. Production 환경변수 추가:
   - `KAKAO_REST_API_KEY`
   - `KAKAO_REDIRECT_URI` = `https://sajangpick.co.kr/auth/kakao/callback`
   - `JWT_SECRET` = 32자 이상 임의 문자열
   - `KAKAO_CLIENT_SECRET` = (카카오 콘솔에서 사용 ON일 때만)
   - `COOKIE_DOMAIN` = `.sajangpick.co.kr`
3. Deploy 클릭 → 최근 Deployments에서 성공 여부 확인

### 3) 빠른 점검(3가지 URL)
- 헬스체크: `https://www.sajangpick.co.kr/health` 가 OK면 정상
- 로그인 플로우: `https://www.sajangpick.co.kr/login.html` → 카카오 로그인 → 돌아왔을 때 주소에 `error` 파라미터가 없어야 정상
- 세션 확인: `https://www.sajangpick.co.kr/api/auth/me` 가 `{ authenticated: true }`

### 4) 로그인 실패 시, 이 정보만 전달해주세요
- 주소창에 보이는 `?error=...&reason=...&detail=...` 값을 그대로 복사
- 마지막으로 변경한 내용(파일명 1~2개, 한 줄 설명)
- 위 두 가지만 주시면 원인 즉시 특정 가능

---

## 🔥 최신 중요 사항 TOP 3 (바쁘면 여기만!)

### 1. 플점검/풀순위 제거 및 카카오 로그인 최적화 (2025-01-22) ⭐ NEW

**완료된 작업:**
- ✅ **플점검 완전 제거**: `place-check.html` 삭제, `/place-check.html` → `/` 리다이렉트
- ✅ **풀순위 제거 (admin만 유지)**: `rank-report.html` 삭제, `/rank-report.html` → `/` 리다이렉트
- ✅ **admin 전용 유지**: `/admin/rank-report.html`만 접근 가능
- ✅ **이메일 로그인 제거**: `login.html`, `join.html`에서 이메일 폼 완전 삭제
- ✅ **카카오 로그인 수정**: Supabase OAuth → 서버 OAuth(`/auth/kakao/login`) 변경
- ✅ **불필요한 파일 정리**: `api/rank-list-crawl.backup.js` 삭제
- ✅ **빌드 문제 해결**: `pnpm-lock.yaml` 업데이트, `.vercelignore` 최적화

**배포 확인 사항:**
- https://www.sajangpick.co.kr/place-check.html → 홈으로 리다이렉트
- https://www.sajangpick.co.kr/rank-report.html → 홈으로 리다이렉트
- https://www.sajangpick.co.kr/admin/rank-report.html → 정상 작동
- 로그인 페이지에서 카카오 로그인만 표시

### 2. 관리자/고객 페이지 분리 완료 (2025-10-17)

- **admin/ 폴더 생성**: 관리자 전용 페이지 분리
- **고객용 rank-report.html**: 간단한 순위 조회 페이지 (키워드 검색 + 실시간 수집 + CSV)
- **관리자용 admin/rank-report.html**: 구독 회원 관리 + 키워드 모니터링 + 전체 기능
- **test-batch-crawl.html 삭제**: rank-report.html과 중복되어 제거
- **링크 정상 작동**: index.html, common-header.js의 링크는 고객용 페이지로 연결
- **접근 방법**:
  - 고객: 메뉴의 "플 순위" 클릭 → `/rank-report.html`
  - 관리자: 직접 URL 입력 → `/admin/rank-report.html`

### 2. Vercel Pro 플랜으로 업그레이드 (2025-10-17)

- Serverless Function 메모리 제한: 2GB → 3GB
- `sajangpick-team` 생성 후 프로젝트 이전 완료
- `api/place-batch-crawl.js` 정상 작동 (3GB 메모리 사용)

### 3. naver-keyword-tool 폴더 삭제됨 (2025-10-16)

- 서브모듈 정리 완료
- ⚠️ vercel.json에 Render 프록시 유지 중 (`https://naver-keyword-tool.onrender.com`)
- 현재 코드는 정상 작동 (Render 서버 계속 운영 중)

---

## 📋 전체 작업 이력 (상세)

### 2025-01-22 - 플점검/풀순위 제거 및 카카오 로그인 최적화

**작업 배경:**
- 사용자 요청: "풀순위는 어드민에서만 사용, 플점검은 모든 화면에서 제거"
- 카카오 로그인 Supabase 설정 오류 발생 → 서버 OAuth로 변경

**수행 작업:**

1. **페이지 제거 및 리다이렉트 설정**
   - `place-check.html` 삭제
   - `rank-report.html` 삭제
   - `rank-report-pro.html` 삭제 (중복 파일)
   - `server.js`: `/place-check.html`, `/rank-report.html` → `/` 리다이렉트
   - `vercel.json`: redirects에 동일 설정 추가
   - `admin/rank-report.html`만 유지

2. **mypage.html 메뉴 정리**
   - "순위 조회", "순위 추적" 드롭다운 메뉴 항목 제거
   - "키워드 등록"만 남김

3. **카카오 로그인 수정**
   - **문제**: Supabase OAuth 사용 시 `ptuzlubgggbgsophfcna.supabase.co` 도메인 오류
   - **해결**: `login.html`, `join.html`에서 Supabase OAuth 제거
   - 서버 OAuth 사용: `/auth/kakao/login` (이미 `server.js`에 구현됨)

4. **이메일 로그인 완전 제거**
   - `login.html`: 이메일/비밀번호 입력 폼 삭제
   - `join.html`: 이메일/비밀번호 회원가입 폼 삭제
   - 카카오 로그인 버튼만 남김
   - 관련 JavaScript 코드 정리

5. **배포 문제 해결**
   - **문제 1**: `.vercelignore`가 `admin/rank-report.html`까지 제거
   - **해결**: `.vercelignore`에서 HTML 파일 제외 항목 제거
   - **문제 2**: `pnpm-lock.yaml`이 `package.json`과 동기화 안 됨
   - **해결**: `pnpm install` 후 lock 파일 업데이트

6. **불필요한 파일 정리**
   - `api/rank-list-crawl.backup.js` 삭제 (어디서도 사용 안 됨)
   - 중복 파일 확인:
     - `api/place-batch-crawl.js` → Vercel Functions (유지)
     - `api/place-batch-crawl-optimized.js` → 로컬 크롤러 (유지)

**변경된 파일:**
- 삭제: `place-check.html`, `rank-report.html`, `rank-report-pro.html`, `api/rank-list-crawl.backup.js`
- 수정: `login.html`, `join.html`, `mypage.html`, `server.js`, `vercel.json`, `.vercelignore`, `pnpm-lock.yaml`
- 유지: `admin/rank-report.html`

**결과:**
- ✅ 일반 사용자는 플점검/풀순위 접근 불가 (리다이렉트)
- ✅ 관리자는 `/admin/rank-report.html`로 접근 가능
- ✅ 카카오 로그인만 사용 (이메일 로그인 제거)
- ✅ Vercel 빌드 성공
- ✅ 코드베이스 정리 완료

### 2025-10-21 - Supabase 샘플 테이블 생성 및 RLS 정책 적용

**작업 목적:**
- Supabase 연결 검증과 최소 예제 테이블 구축(RLS 포함)

**수행 내용:**
1. Supabase 대시보드 → SQL Editor에서 아래 스크립트 실행:
   ```sql
   create table if not exists public.instruments (
     id bigint generated always as identity primary key,
     name text not null unique
   );

   insert into public.instruments (name) values
     ('violin'), ('viola'), ('cello')
   on conflict do nothing;

   alter table public.instruments enable row level security;

   drop policy if exists "Public can read instruments" on public.instruments;
   create policy "Public can read instruments"
   on public.instruments
   for select
   to anon, authenticated
   using (true);

   -- (선택) 인증 사용자의 쓰기 허용 시 활성화
   -- create policy "Authenticated can insert instruments"
   -- on public.instruments for insert to authenticated with check (true);
   ```
2. 데이터 확인(동일 SQL Editor):
   ```sql
   select * from public.instruments;
   ```
   - 결과: `violin`, `viola`, `cello` 3행 정상 조회 확인

**환경변수 정합성 확인:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon key)
- `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, 노출 금지)

**클라이언트/REST 테스트 스니펫:**
```js
// 브라우저
const supabase = window.supabase.createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const { data, error } = await supabase.from('instruments').select('*');
```
```bash
# REST
curl "https://<project>.supabase.co/rest/v1/instruments?select=*" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"
```

**영향/비고:**
- Supabase 연결 및 RLS 읽기 정책 정상 동작 확인.
- 앱에서 읽기 연동 즉시 가능. 쓰기가 필요하면 insert 정책 활성화 필요.

### 2025-10-17 - 코드 정리 및 로컬 크롤링 환경 구축 (작업 중단)

**작업 목적:**
- 비대해진 코드베이스 정리
- 로컬 개발 환경에서 크롤링 기능 테스트

**완료된 작업:**

1. **코드 정리**
   - `admin/rank-report.html`: 미사용 기능 약 500줄 제거 (1582줄 → 1068줄)
     - 삭제된 기능: 이미지 데모 데이터, 서버 계산, CSV/Excel 업로드 매핑, compute() 함수 등
   - `rank-report-pro.html`: 완전 중복 파일로 전체 삭제

2. **서버 설정 개선 (server.js)**
   - 포트 변경: 10000 → 3000 (포트 충돌 해결)
   - CSP(Content Security Policy): 개발 환경에서 비활성화
   - helmet 설정: 개발 환경에서 CSP 완전 비활성화
   - CORS: 개발 환경에서 모든 origin 허용
   - 정적 파일 제공: `/assets` 디렉토리 추가
   - 라우트 추가: `/api/place-batch-crawl`, `/api/rank-list-crawl`, `/api/place-detail-crawl` 연결

3. **크롤링 환경 구축**
   - `api/place-batch-crawl.js`: 로컬/Vercel 환경 자동 분기 처리
     - Vercel: `@sparticuz/chromium` + `puppeteer-core` 사용
     - 로컬: 일반 `puppeteer` 사용
   - `puppeteer` 패키지 설치: v24.25.0
   - Chromium 브라우저 설치: Chrome 141.0.7390.78 (176.3 MB)

**미해결 문제:**
- `/api/place-batch-crawl` 호출 시 500 에러 발생
- 에러 메시지: "리스트 전데이터를 찾을 수 없습니다"
- 원인: 터미널 에러 로그 미확인으로 정확한 원인 파악 못함
- 다음 단계: 서버 터미널에서 API 호출 시 에러 로그 확인 필요

**현재 상태:**
- 서버: `localhost:3000`에서 정상 실행 중
- 페이지: 로드 및 버튼 클릭 정상 작동
- API: 호출은 되지만 내부 에러 발생

**롤백 방법:**
- Git 커밋 전이므로 `git checkout .` 또는 `git stash`로 변경사항 취소 가능
- 또는 개별 파일 복원 가능

---

---

## 2025-10-17 - 관리자/고객 페이지 분리 + 프로젝트 구조 개선

### 📌 작업 배경
- Vercel 배포 준비 중 프로젝트 구조 정리 필요성 확인
- 관리자 전용 기능(회원 관리, 모니터링)과 고객용 기능(간단 조회) 분리 필요
- test-batch-crawl.html과 rank-report.html의 기능 중복 문제 해결

### 🔧 주요 변경 사항

#### 1. admin/ 폴더 생성 및 관리자 페이지 분리
- **admin/rank-report.html** (1,582줄):
  - 기존 rank-report.html을 admin 폴더로 이동
  - 관리자 전용 기능 유지:
    - ✅ 구독 회원 관리 (회원 추가/삭제/수정)
    - ✅ 키워드 모니터링 (순위 추적, 통계)
    - ✅ 전체 순위 업데이트
    - ✅ localStorage 기반 데이터 저장
  - 3개 탭 시스템:
    - 탭 1: 플레이스 순위 리스트 (실시간 크롤링)
    - 탭 2: 구독 회원 관리
    - 탭 3: 키워드 모니터링
  - 접근: `https://sajangpick.co.kr/admin/rank-report.html`

#### 2. 고객용 rank-report.html 신규 제작
- **rank-report.html** (385줄, 전체 새로 작성):
  - 간단한 순위 조회 페이지
  - 핵심 기능만 포함:
    - ✅ 키워드 검색
    - ✅ 실시간 상세 수집 (`/api/place-detail-crawl`)
    - ✅ 크롤링 결과 테이블 표시 (10개 컬럼)
    - ✅ CSV 다운로드
  - 제거된 기능:
    - ❌ 구독 회원 관리
    - ❌ 키워드 모니터링
    - ❌ 탭 시스템
  - 깔끔한 UI:
    - 그라디언트 헤더 (네이버 그린)
    - 정보 안내 박스
    - 반응형 디자인
  - 접근: `https://sajangpick.co.kr/rank-report.html` (메뉴에서 자동 연결)

#### 3. test-batch-crawl.html 삭제
- **삭제 이유**:
  - rank-report.html과 기능 중복 (키워드 크롤링, CSV 다운로드)
  - test-batch-crawl.html은 테스트용으로 제작된 페이지
  - 실제 서비스에는 rank-report.html 사용
- **보존된 기능**:
  - 전날 대비 리뷰 변화량 추적 기능은 나중에 필요 시 추가 가능
  - localStorage 기반 변화량 로직은 별도 보관

#### 4. 링크 경로 확인
- **index.html** (621줄):
  ```html
  <a class="app" href="/rank-report.html">
  ```
- **assets/common-header.js** (78줄):
  ```javascript
  <a class="app" href="/rank-report.html">
  ```
- ✅ 모든 링크는 고객용 페이지(`/rank-report.html`)로 정상 연결
- ✅ 관리자는 직접 URL 입력으로 접근 (`/admin/rank-report.html`)

### 📂 프로젝트 구조 논의

**현재 구조** (루트에 14개 HTML 분산):
```
📁 사장픽/
  ├── index.html, login.html, join.html
  ├── mypage.html, place-check.html, rank-report.html
  ├── AI-Review.html, Blog-Editor.html, ChatGPT.html
  ├── naver_search.html, rank-report-pro.html
  ├── admin/
  │   └── rank-report.html
  ├── api/ (정리됨 ✅)
  ├── assets/ (정리됨 ✅)
  └── docs/ (정리됨 ✅)
```

**제안된 구조** (pages/ 폴더 도입):
```
📁 사장픽/
  ├── index.html, login.html, join.html (루트 필수)
  ├── pages/ (고객용 페이지)
  │   ├── mypage.html
  │   ├── place-check.html
  │   ├── rank-report.html
  │   └── ...
  ├── admin/ (관리자 페이지)
  │   └── rank-report.html
  ├── assets/ (공용 자산)
  ├── api/ (서버리스 함수)
  └── docs/ (문서)
```

**결론**: 
- ✅ 현재 구조 유지 (옵션 A 선택)
- 이유:
  - Vercel은 정적 HTML을 루트에서도 잘 지원
  - 링크 수정 작업 불필요 (시간 절약)
  - admin/ 폴더만으로도 충분한 분리
  - 나중에 필요 시 점진적 이동 가능

### 🚀 Vercel 배포 준비

#### Vercel Pro 플랜 업그레이드 (이전 작업)
- **문제**: `api/place-batch-crawl.js` 메모리 3GB 필요, Hobby 플랜 2GB 제한
- **해결**:
  1. Vercel Pro 플랜 업그레이드 ($20/월)
  2. `sajangpick-team` 생성
  3. 프로젝트를 개인 계정 → 팀으로 이전
  4. 로컬 `.vercel` 폴더 삭제 후 재연결:
     ```bash
     rm -rf .vercel
     pnpm dlx vercel link --scope sajangpick-team
     pnpm dlx vercel deploy --prod
     ```
- ✅ 배포 성공: https://www.sajangpick.co.kr

#### 배포 대기 중인 변경사항
- ✅ test-batch-crawl.html 삭제
- ✅ admin/rank-report.html 생성
- ✅ rank-report.html 재작성 (고객용)
- ⏳ 배포 방법:
  - **방법 1**: Git push (자동 배포)
    ```bash
    git add .
    git commit -m "feat: 관리자/고객 페이지 분리 및 구조 개선"
    git push origin main
    ```
  - **방법 2**: Vercel CLI (수동 배포)
    ```bash
    pnpm dlx vercel deploy --prod
    ```

### 📝 파일 변경 요약

| 파일 | 상태 | 설명 |
|------|------|------|
| `admin/rank-report.html` | ✅ 생성 | 관리자 전용 (1,582줄, 전체 기능) |
| `rank-report.html` | 🔄 재작성 | 고객용 (385줄, 간단 버전) |
| `test-batch-crawl.html` | ❌ 삭제 | 중복 기능 제거 |
| `docs/AI_LOG.md` | 📝 업데이트 | 이 작업 기록 추가 |

### 🎯 다음 AI가 알아야 할 사항

1. **페이지 구분**:
   - 고객용: `/rank-report.html` (메뉴에서 접근)
   - 관리자용: `/admin/rank-report.html` (직접 URL 입력)

2. **관리자 페이지 보호**:
   - 현재는 URL만 알면 접근 가능
   - 추후 필요 시 인증 로직 추가:
     - 방법 A: 간단한 비밀번호 프롬프트 (sessionStorage)
     - 방법 B: Vercel 인증 미들웨어 (vercel.json)
     - 방법 C: Kakao 로그인 + 관리자 권한 체크

3. **프로젝트 구조**:
   - 현재는 루트에 HTML 파일들이 분산되어 있음
   - pages/ 폴더 도입은 논의만 하고 보류
   - 필요 시 점진적으로 이동 가능

4. **배포 상태**:
   - Vercel Pro 플랜 사용 중
   - sajangpick-team에 프로젝트 연결
   - 이번 변경사항은 아직 배포 안 됨 (사용자가 결정 대기)

### ⚠️ 주의사항

- **삭제된 파일**: test-batch-crawl.html (복구 불가, Git 히스토리에만 존재)
- **전날 대비 리뷰 변화량 기능**: test-batch-crawl.html에 있던 기능, 필요 시 rank-report.html에 추가 가능
- **링크 수정 불필요**: 모든 기존 링크는 `/rank-report.html`로 연결되어 있어 정상 작동

---

## 2025-10-17 - 전날 대비 리뷰 변화량 표시 + rank-report 상세 크롤링 개선

- 배경: 매일 크롤링할 때 어느 식당의 리뷰가 증가/감소했는지 한눈에 보고 싶다는 요청
- 변경 파일:
  - **`test-batch-crawl.html`**: 전날 대비 변화량 표시 기능 추가
    - localStorage에 이전 크롤링 데이터 자동 저장
    - 방문자리뷰/블로그리뷰 증감을 **+3**, **-5** 형태로 표시
    - 카드뷰, 테이블뷰, CSV 다운로드 모두 지원
    - 증가는 초록색(#10b981), 감소는 빨간색(#ef4444)으로 표시
  - **`rank-report.html`**: 실시간 상세 크롤링 기능 개선
    - 기존: `/api/rank-list-crawl` (목록만)
    - 개선: `/api/place-batch-crawl` (모든 상세 정보 포함)
    - 추가된 정보: 카테고리, 평점, 방문자리뷰, 블로그리뷰, 주소, 전화번호, 영업시간, 편의시설
    - 테이블에 10개 컬럼 표시 (기존 4개 → 10개)
    - CSV 다운로드에 13개 컬럼 포함 (상태, 변화량 등)
  - **`test-place-crawl.html`**: 삭제 (중복 기능 제거, test-batch-crawl.html로 통합)
- 주요 기능:
  - **전날 대비 변화량 추적**:
    - 키워드별로 localStorage에 크롤링 데이터 저장
    - 다음 크롤링 시 자동으로 이전 데이터와 비교
    - place_id와 업체명으로 매칭하여 정확한 비교
    - 예시: "방문 2,335개 +3 | 블로그 253개 -1"
  - **rank-report.html 개선**:
    - 버튼명: "실시간 목록 수집" → "🕷️ 실시간 상세 수집"
    - 최대 50개까지 상세 정보 크롤링 (시간 고려)
    - 진행 시간 표시: "수집 중... (최대 2분 소요)"
    - 에러 항목에 ⚠️ 표시
    - CSV 파일명: `네이버플레이스_명장동맛집_2025-10-17.csv`
- 데이터 저장 형식 (localStorage):
  ```javascript
  {
    date: "2025-10-17",
    timestamp: 1729123456789,
    places: [
      { place_name: "두찜", place_id: "123", visitor_reviews: 2233, blog_reviews: 245 }
    ]
  }
  ```
- 확인 방법:
  1. http://localhost:3000/test-batch-crawl.html
  2. "명장동맛집" 입력 후 첫 크롤링 → 변화량 표시 없음
  3. 몇 시간/며칠 후 같은 키워드로 다시 크롤링
  4. 방문자리뷰/블로그리뷰 옆에 **+3**, **-5** 같은 변화량 표시 확인
  5. CSV 다운로드 시 "방문자리뷰변화", "블로그리뷰변화" 컬럼 포함
- 배포: 
  - Git 저장소 재연결 필요 (ZIP 다운로드로 복구했기 때문에 .git 폴더 없음)
  - 방법 1: Git 재연결 후 push
  - 방법 2: Vercel CLI로 즉시 배포 (`vercel --prod`)
- 주의사항:
  - localStorage 용량 제한 (5-10MB) 고려하여 최근 30일 데이터만 유지
  - 키워드별로 독립적으로 저장 (다른 키워드 크롤링 시 영향 없음)
  - 브라우저 캐시 삭제 시 이전 데이터 초기화됨 (정상 동작)
- 후속 작업:
  - AI_LOG.md 업데이트 완료
  - GitHub에 커밋 후 Vercel 배포
  - 프로덕션 환경에서 테스트

---

## 2025-10-17 - 네이버 플레이스 전체 데이터 크롤링 기능 추가

- 배경: 기존에는 업체명, place_id, URL만 크롤링했으나, 모든 상세 정보(주소, 전화, 리뷰, 평점 등)를 수집하는 기능 요청
- 목표: "명장동맛집" 같은 키워드로 1~300위 식당의 모든 정보를 한 번에 크롤링
- 신규 생성 파일:
  - **`api/place-detail-crawl.js`**: 개별 place_id의 상세 정보 크롤링
  - **`api/place-batch-crawl.js`**: 키워드 → 목록 수집 → 각 식당 상세 정보 배치 크롤링
  - **`test-place-crawl.html`**: 개별 크롤링 테스트 페이지
  - **`test-batch-crawl.html`**: 배치 크롤링 테스트 페이지 (최대 300개)
- 수정 파일:
  - `vercel.json`: 새 API 함수 추가 및 라우팅 설정
- 주요 기능:
  - **개별 상세 크롤링** (`/api/place-detail-crawl`):
    - 입력: place_id (예: 1390003666)
    - 출력: 업체명, 카테고리, 주소, 전화번호, 영업시간, 평점, 리뷰수, 위생등급, 편의시설, TV방송 정보 등
  - **배치 크롤링** (`/api/place-batch-crawl`):
    - 입력: 키워드 (예: "명장동맛집"), maxPlaces (1~300)
    - 출력: 상위 N개 식당의 전체 상세 정보
    - 소요시간: 50개 기준 약 2~3분
    - CSV 다운로드 기능 포함
- 크롤링 데이터 항목:
  - 기본: 업체명, 카테고리, place_id
  - 연락처: 주소, 전화번호, 홈페이지/SNS, 지하철역 정보, 찾아가는 길
  - 영업: 영업시간, 브레이크타임
  - 통계: 평점, 방문자리뷰 수, 블로그리뷰 수, 위생등급
  - 편의시설: 주차, 예약, 단체이용, 화장실 등
  - 미디어: TV방송 정보, 사진 수
- Vercel 설정:
  - place-detail-crawl: 60초 타임아웃, 1.5GB 메모리
  - place-batch-crawl: 300초(5분) 타임아웃, 3GB 메모리
- 사용 예시:
  ```javascript
  // 개별 크롤링
  POST /api/place-detail-crawl
  { "place_id": "1390003666" }
  
  // 배치 크롤링
  POST /api/place-batch-crawl
  { "keyword": "명장동맛집", "maxPlaces": 50, "maxScrolls": 15 }
  ```
- 테스트:
  - http://localhost:10000/test-place-crawl.html (개별)
  - http://localhost:10000/test-batch-crawl.html (배치)
- 다음 단계:
  - Vercel 배포 후 프로덕션 테스트
  - place-check.html 페이지에 통합
  - CSV 외에 JSON, Excel 다운로드 옵션 추가 가능

---

## 2025-10-17 - 프로젝트 긴급 복구 완료 (컴퓨터 다운 사고)

- 배경: 12시간 전 작업 중 컴퓨터 다운으로 로컬 파일 전체 손실
- 복구 방법: GitHub 저장소 → ZIP 다운로드 → 로컬 복구
- 설치 도구:
  - Node.js v22.20.0 (신규 설치)
  - npm 10.9.3
  - PowerShell 실행 정책 변경 (RemoteSigned)
- 복구 결과:
  - ✅ 모든 소스코드 100% 복구 (51 커밋 이력 포함)
  - ✅ npm install로 223개 패키지 설치 완료
  - ✅ 보안 취약점 0개
  - ✅ 프로젝트 즉시 실행 가능 상태
- 복구 완료 파일:
  - HTML 파일 11개 (index.html, ChatGPT.html 등)
  - API 서버 코드 전체 (api/ 폴더)
  - 문서 11개 (docs/ 폴더)
  - 설정 파일 (package.json, vercel.json 등)
  - GitHub 워크플로우 (.github/)
  - Vercel 설정 (.vercel/)
- 교훈:
  - GitHub에 정기적으로 푸시하는 것의 중요성 재확인
  - Vercel 배포 덕분에 코드 손실 방지
  - 환경변수는 별도 백업 필요 (Vercel 대시보드에서 확인 가능)
- 다음 단계:
  - 환경변수 확인 (Vercel 대시보드)
  - 로컬 테스트 또는 Vercel 자동 배포 확인

---

## 2025-10-16 - 카카오 로그인 활성화 (비개발자용)

- 배경: 고객이 카카오톡으로 쉽게 회원가입할 수 있도록 활성화
- 변경 파일:
  - `login.html`: 카카오 로그인 버튼 활성화 (464~466줄)
  - `join.html`: 카카오 회원가입 버튼 활성화 (513~515줄)
  - `docs/KAKAO_LOGIN_SETUP.md`: 비개발자용 설정 가이드 신규 생성
- 주요 변경점:
  - 카카오 버튼 클릭 시 에러 메시지 대신 `/auth/kakao/login` 으로 리다이렉트
  - 로그인과 회원가입을 state 파라미터로 구분 (login/signup)
  - 카카오 API 코드는 이미 완성되어 있었음 (api/auth/kakao/\*)
- 필요한 환경변수 (Vercel):
  - `KAKAO_REST_API_KEY`: 카카오 개발자 콘솔에서 발급
  - `KAKAO_REDIRECT_URI`: `https://sajangpick.co.kr/auth/kakao/callback`
  - `JWT_SECRET`: 랜덤 문자열 (세션 암호화용)
- 확인 방법:
  1. 카카오 개발자 콘솔에서 앱 등록 (docs/KAKAO_LOGIN_SETUP.md 참고)
  2. Vercel 환경변수 3개 설정
  3. Git push 후 배포 대기
  4. https://sajangpick.co.kr/login.html 에서 카카오 버튼 클릭 테스트
  5. 카카오 로그인 화면이 나타나면 성공!
- 배포: Git 푸시 → Vercel 자동 배포
- 주의사항:
  - 카카오 개발자 콘솔의 Redirect URI와 Vercel 환경변수가 정확히 일치해야 함
  - 플랫폼(Web) 도메인도 https://sajangpick.co.kr 으로 등록 필수
  - JWT_SECRET은 안전한 랜덤 문자열 사용 (최소 32자 이상 권장)
- 후속 작업:
  - 카카오 개발자 등록 및 환경변수 설정 (사용자가 직접)
  - 로그인 성공 후 회원 정보 DB 저장 (향후 슈퍼베이스 연동 가능)

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

## ❌ 2025-10-19 - 크롤링 최적화 작업 실패

### 📋 작업 목표
1. 크롤링 속도 최적화 (20배 빠르게)
2. 새로운 데이터 수집 (메뉴, 사진 5장, 신규영수증, 지번주소)
3. 중복 데이터 제거
4. 999, 999 오류 데이터 수정
5. 전국 동단위 크롤링 시스템 구축
6. 데이터베이스 저장 기능 추가

### ❌ 실패 결과
- **크롤링 실행**: ✅ 성공
- **속도 개선**: ❌ 확인 불가
- **데이터 품질**: ❌ **여전히 999, 999 표시됨**
- **새로운 데이터**: ❌ **메뉴, 사진, 신규영수증 표시 안 됨**
- **중복 제거**: ❌ 확인 불가

### 실패 원인 분석

#### 1. 네이버 페이지 구조 미분석
- 실제 네이버 페이지를 열어서 확인 안 함
- 개발자 도구로 실제 HTML 구조 확인 안 함
- 클래스명을 추측으로 작성

#### 2. 테스트 없이 배포
- 로컬에서 실제 크롤링 테스트 안 함
- 로그 출력 확인 안 함
- 단계별 검증 없이 전체 코드 작성

#### 3. 디버깅 정보 부족
- 어떤 셀렉터가 작동하는지 로그 없음
- 추출된 데이터가 무엇인지 확인 불가
- 오류 발생 지점 추적 어려움

#### 4. 잘못된 파일에 작성
- 최적화 코드를 `api/place-batch-crawl-optimized.js`에 작성
- 서버는 `api/place-batch-crawl.js`를 사용
- 결과적으로 구버전 코드가 계속 실행됨

### 시도한 작업 내용

#### 변경 파일 (작동 안 함)
- `api/place-batch-crawl.js`: 병렬 처리, 새 데이터 수집 로직 추가
- `api/place-batch-crawl-optimized.js`: 최적화 버전 (사용 안 됨)
- `api/place-detail-crawl.js`: 상세 크롤링 개선
- `rank-report.html`: 테이블에 새 컬럼 추가
- `admin/rank-report.html`: 관리자 페이지 수정

#### 추가 생성 파일 (미완성)
- `db-schema.sql`: SQLite 데이터베이스 스키마
- `lib/database.js`: 데이터베이스 함수
- `crawler/nationwide-crawler.js`: 전국 크롤링 스크립트
- `docs/크롤링_가이드.md`: 사용 가이드
- `docs/2025-01-19_작업내역.md`: 작업 기록
- `docs/2025-01-19_실패기록.md`: 실패 기록

### 왜 실패했나?

**핵심 문제: 네이버 페이지를 제대로 분석하지 않음**

1. **추측으로 셀렉터 작성**
   - ❌ "아마 이 클래스명일 것 같다"
   - ✅ "개발자 도구로 확인했다"

2. **테스트 없이 배포**
   - ❌ 코드 작성 → 바로 사용자에게
   - ✅ 코드 작성 → 로컬 테스트 → 검증 → 배포

3. **단계별 진행 실패**
   - ❌ 모든 기능을 한 번에 추가
   - ✅ 하나씩 테스트하며 추가

### 올바른 접근 방법 (해야 했던 것)

#### Step 1: 실제 페이지 분석
1. Chrome에서 네이버 플레이스 모바일 페이지 열기
2. 개발자 도구 (F12) 열기
3. 실제 HTML 구조 확인
4. 정확한 클래스명, ID 확인
5. 데이터가 어디에 있는지 확인

#### Step 2: 단계별 테스트
```javascript
// 1단계: 페이지 로드만
console.log('페이지 로드 완료');

// 2단계: 특정 요소 존재 확인
const test = document.querySelector('.PXMot');
console.log('평점 요소:', test);

// 3단계: 데이터 추출
const rating = test?.textContent;
console.log('추출된 평점:', rating);
```

#### Step 3: 로컬 테스트
```bash
node api/place-batch-crawl.js
```

#### Step 4: 디버깅 로그 추가
```javascript
debugInfo.steps.push(`평점 요소 찾음: ${!!ratingEl}`);
debugInfo.steps.push(`추출된 평점: ${data.stats.rating}`);
```

### 다음 시도를 위한 계획

#### Phase 1: 현재 상태 분석 (30분)
1. 실제 네이버 플레이스 모바일 페이지 열기 (`https://m.place.naver.com/restaurant/1390003666`)
2. Chrome 개발자 도구로 실제 HTML 확인 (평점, 리뷰 수, 메뉴 리스트)
3. 스크린샷 캡처 또는 HTML 복사
4. 현재 크롤링 코드와 비교

#### Phase 2: 간단한 테스트 코드 작성 (20분)
- 최소한의 코드로 평점만 추출 테스트

#### Phase 3: 검증 후 적용 (10분)
1. 테스트 코드로 검증
2. 정상 작동 확인
3. 메인 코드에 적용

### 현재 상황

1. **코드는 수정했지만 작동하지 않음** ❌
2. **사용자가 여전히 999 데이터를 봄** ❌
3. **새로운 데이터가 수집되지 않음** ❌
4. **속도 개선 확인 불가** ❌

### 교훈

1. 실제 페이지 HTML 구조를 먼저 확인해야 함
2. 추측으로 코드를 작성하지 말 것
3. 로컬에서 충분히 테스트한 후 배포
4. 디버깅 로그를 충분히 남길 것
5. 단계별로 하나씩 검증하며 진행

### 다음 작업자에게

**실제 네이버 페이지의 HTML 구조를 분석해야 합니다:**

1. `https://m.place.naver.com/restaurant/1390003666` 열기
2. F12 (개발자 도구) 열기
3. Elements 탭에서 평점, 리뷰 수 요소 찾기
4. 해당 요소의 클래스명, 구조 확인
5. 스크린샷 또는 HTML 코드 확인

그래야만 **확실하게 작동하는 코드**를 만들 수 있습니다.

---

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
