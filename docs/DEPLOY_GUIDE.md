# 🚀 Vercel 배포 가이드

> **AI 작업자**: 이 문서는 AI가 빠르게 정보를 찾을 수 있도록 구조화되어 있습니다.  
> 상단 체크리스트 → 환경변수 → 배포 단계 → 트러블슈팅 → 상세 가이드 순서로 확인하세요.

---

## 🎯 AI용 빠른 체크리스트

### 배포 전 확인사항
- [ ] GitHub에 코드 푸시 완료
- [ ] `vercel.json` 파일 존재 (자동 설정용)
- [ ] 환경변수 준비됨 (아래 "필수 환경변수" 참조)
- [ ] Supabase 프로젝트 생성 완료 (카카오 로그인 사용 시)

### 배포 단계 요약
1. https://vercel.com → GitHub 로그인
2. Add New → Project → Import 레포지토리
3. Environment Variables 설정 (아래 전체 리스트 참조)
4. Deploy 클릭 → 2-3분 대기
5. 배포 완료 후 도메인 확인

### 자주 발생하는 문제
- **⚠️ pnpm install 실패** (가장 흔한 문제!): `package.json`에 pnpm 버전 명시 필요 → [해결방법](#pnpm-install-실패)
- **배포 실패**: 환경변수 누락 확인
- **API 작동 안 함**: `NAVER_*` 환경변수 값 재확인
- **CORS 에러**: `CORS_ORIGIN`을 배포된 도메인으로 설정
- **카카오 로그인 안 됨**: `SUPABASE_URL`, `SUPABASE_ANON_KEY` 확인

---

## 🔑 환경변수 전체 리스트 (복사용)

### ✅ 필수 환경변수

```bash
# 서버 설정
NODE_ENV=production
PORT=10000
CORS_ORIGIN=https://your-domain.vercel.app

# Supabase (카카오 로그인)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here

# 네이버 검색광고 API (키워드 도구)
NAVER_CUSTOMER_ID=your_customer_id
NAVER_API_KEY=your_api_key
NAVER_SECRET_KEY=your_secret_key

# 네이버 OpenAPI (로컬 검색)
NAVER_SEARCH_CLIENT_ID=your_client_id
NAVER_SEARCH_CLIENT_SECRET=your_client_secret

# JWT 시크릿 (32자 이상)
JWT_SECRET=your_very_long_random_secret_key_here
```

### 🔧 선택적 환경변수

```bash
# 네이버 데이터랩 (트렌드)
NAVER_DATALAB_CLIENT_ID=your_datalab_client_id
NAVER_DATALAB_CLIENT_SECRET=your_datalab_secret

# AI API 키
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
CLAUDE_API_KEY=sk-ant-...

# 보안 설정
CSP_ENFORCE=false

# 기능 플래그
FEATURE_API_READ_NEXT=false
FEATURE_API_CHAT_NEXT=false
FEATURE_AUTH_NEXT=false
```

---

## 📋 간결한 배포 단계

### 1. Vercel 접속 및 프로젝트 생성

```
1. https://vercel.com 접속
2. GitHub로 로그인
3. Add New... → Project
4. 레포지토리 선택 → Import
```

### 2. 빌드 설정 (자동 감지됨)

```
Framework Preset: Other
Root Directory: ./
Build Command: (비워두기)
Output Directory: (비워두기)
Install Command: pnpm install --no-frozen-lockfile
```

### 3. 환경변수 설정

**Environment Variables 탭에서**:
- 위 "환경변수 전체 리스트"의 필수 항목들을 하나씩 추가
- Key: 변수 이름
- Value: 실제 값
- Environments: Production, Preview, Development 모두 체크

### 4. 배포 및 확인

```
1. Deploy 버튼 클릭
2. 2-3분 대기 (로그 확인)
3. Visit 버튼 클릭하여 사이트 확인
4. 실시간 목록 수집 기능 테스트
```

---

## 🔧 트러블슈팅 가이드

### ⚠️ pnpm install 실패 (가장 흔한 문제!)

**증상**: 
- 빌드 로그에 `Command "pnpm install" exited with 1` 에러
- Vercel이 pnpm 버전을 인식하지 못함
- `Detected pnpm-lock.yaml 9` 경고 메시지

**원인 분석**:
```json
// ❌ 문제: package.json에 npm만 명시됨
"engines": {
  "node": ">=18.0.0",
  "npm": ">=8.0.0"  // npm은 사용하지 않는데 있음!
}
```

Vercel은 `pnpm-lock.yaml`은 인식하지만, **어떤 pnpm 버전을 사용해야 할지 모름** → 설치 실패!

**해결 방법**:

1. `pnpm-lock.yaml` 파일 첫 줄에서 버전 확인:
   ```yaml
   lockfileVersion: '9.0'  # pnpm 9.x 사용 중
   ```

2. `package.json` 수정:
   ```json
   "engines": {
     "node": ">=18.0.0",
     "pnpm": ">=9.0.0"  // ✅ pnpm 버전 추가
   },
   "packageManager": "pnpm@9.0.0",  // ✅ 명확한 버전 지정
   ```

3. 커밋 & 푸시:
   ```bash
   git add package.json
   git commit -m "fix: Vercel 배포 위해 pnpm 버전 명시"
   git push origin main
   ```

4. Vercel이 자동으로 재배포 → 성공! ✅

**핵심 포인트**:
- `pnpm-lock.yaml`의 버전과 `package.json`의 버전이 일치해야 함
- `packageManager` 필드는 Node.js 16.9+ 에서 표준으로 권장됨
- 이 설정이 없으면 Vercel은 기본 pnpm 버전을 사용하는데, 프로젝트와 호환되지 않을 수 있음

---

### 배포 실패 시

**증상**: 빌드 중 에러 발생, 빨간색 X 표시

**해결 방법**:
1. Deployments 탭 → 실패한 배포 클릭
2. 로그에서 에러 메시지 확인
3. 주로 환경변수 누락이 원인
4. 환경변수 추가 후 Redeploy

### API 작동 안 함

**증상**: "실시간 목록 수집" 버튼 클릭 시 에러

**해결 방법**:
1. Settings → Environment Variables
2. 다음 변수 값 재확인:
   - `NAVER_CUSTOMER_ID`
   - `NAVER_API_KEY`
   - `NAVER_SECRET_KEY`
3. 띄어쓰기, 오타 확인
4. 수정 후 Redeploy

### CORS 에러

**증상**: 브라우저 콘솔에 CORS 관련 에러

**해결 방법**:
```bash
# CORS_ORIGIN을 배포된 실제 도메인으로 설정
CORS_ORIGIN=https://your-actual-domain.vercel.app

# 또는 여러 도메인
CORS_ORIGIN=https://domain1.vercel.app,https://domain2.vercel.app
```

### 카카오 로그인 안 됨

**증상**: 카카오 로그인 버튼 클릭 시 에러

**체크리스트**:
1. Supabase 환경변수 확인:
   - `SUPABASE_URL` (https://프로젝트ID.supabase.co)
   - `SUPABASE_ANON_KEY`
2. Supabase Dashboard → Authentication → Providers → Kakao ON 확인
3. 카카오 개발자 콘솔에서 Redirect URI 확인:
   ```
   https://프로젝트ID.supabase.co/auth/v1/callback
   ```

### 환경변수 수정 후 반영 안 됨

**원인**: 환경변수 변경은 재배포가 필요함

**해결 방법**:
1. Settings → Environment Variables에서 수정
2. Deployments 탭으로 이동
3. 최신 배포 옆 "..." 메뉴 클릭
4. "Redeploy" 선택

---

## 📱 자동 배포 설정

Vercel은 GitHub push 시 **자동 배포**됩니다:

```bash
# 로컬에서 코드 수정 후
git add .
git commit -m "업데이트 내용"
git push origin main

# → Vercel이 자동으로 감지하고 배포 시작
```

---

## 🌐 커스텀 도메인 연결

### 도메인 추가 방법

1. Settings → Domains
2. 도메인 입력 (예: `sajangpick.com`)
3. DNS 설정 안내 확인
4. 도메인 제공업체(가비아, 후이즈 등)에서 DNS 레코드 추가:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21
   
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```
5. 검증 완료 후 자동 SSL 인증서 발급

### 환경변수 업데이트

도메인 연결 후 다음 환경변수 업데이트:
```bash
CORS_ORIGIN=https://sajangpick.com,https://www.sajangpick.com
```

---

## 📖 비개발자를 위한 상세 가이드

> 아래 내용은 코딩을 모르는 분들을 위한 스텝바이스텝 가이드입니다.

### 📍 1단계: Vercel 사이트 접속

1. **브라우저를 열고** 다음 주소로 이동하세요:
   ```
   https://vercel.com
   ```

2. **우측 상단**에 "Sign Up" 또는 "Log In" 버튼이 보일 거예요
   - 클릭하세요!

3. **"Continue with GitHub"** 버튼 클릭
   - GitHub 계정으로 로그인하면 연동됩니다
   - 처음이면 권한 승인 화면이 나오는데, "Authorize" 클릭하세요

✅ **완료!** Vercel 대시보드가 보이면 성공입니다!

---

### 📍 2단계: 프로젝트 가져오기

1. **대시보드**에서 찾아보세요:
   - 우측 상단에 **"Add New..."** 버튼 (큰 + 모양)
   - 클릭!

2. 나타나는 메뉴에서:
   - **"Project"** 선택

3. **"Import Git Repository"** 화면이 나타납니다
   - GitHub 레포지토리 목록이 보일 거예요
   - **"naver-keyword-tool"** 또는 **"sajangpick"** 찾기
   - 옆에 **"Import"** 버튼 클릭!

💡 **Tip:** 레포지토리가 안 보인다면?
- "Adjust GitHub App Permissions →" 링크 클릭
- 레포지토리 접근 권한 추가

✅ **완료!** 다음 화면으로 넘어갑니다!

---

### 📍 3단계: 프로젝트 설정

**"Configure Project"** 화면이 나타납니다.

#### 기본 설정 (건드리지 마세요!)

다음 항목들은 **그냥 두면 됩니다**:
- ✅ Project Name: (자동으로 설정됨)
- ✅ Framework Preset: Other (자동 감지)
- ✅ Root Directory: ./
- ✅ Build Command: (비워두기)
- ✅ Output Directory: (비워두기)
- ✅ Install Command: pnpm install --no-frozen-lockfile

#### 환경변수 설정 (중요! ⚠️)

**아래로 스크롤**하면 **"Environment Variables"** 섹션이 있습니다.

**"Add"** 버튼을 눌러서 다음 항목들을 **하나씩** 추가하세요:

#### 📝 환경변수 입력 가이드

각 환경변수를 추가할 때:
1. **Name (이름)**: 아래 표의 "이름" 열 복사
2. **Value (값)**: 본인의 실제 API 키 입력
3. **Environments**: Production, Preview, Development **모두 체크** ✅
4. **"Add"** 버튼 클릭
5. 다음 환경변수로 반복!

#### 🔑 필수 환경변수 (반드시 입력!)

| 이름                      | 설명                          | 예시 값                                      |
| ------------------------- | ----------------------------- | -------------------------------------------- |
| `NODE_ENV`                | 서버 환경                     | `production`                                 |
| `PORT`                    | 서버 포트                     | `10000`                                      |
| `SUPABASE_URL`            | Supabase 프로젝트 URL         | `https://프로젝트ID.supabase.co`             |
| `SUPABASE_ANON_KEY`       | Supabase 공개 키              | `eyJhb...` (긴 문자열)                       |
| `NAVER_CUSTOMER_ID`       | 네이버 고객 ID                | `cust123456`                                 |
| `NAVER_API_KEY`           | 네이버 API 키                 | `01234567890abcdef`                          |
| `NAVER_SECRET_KEY`        | 네이버 시크릿 키              | `abcdefg1234567`                             |
| `NAVER_SEARCH_CLIENT_ID`  | 네이버 검색 클라이언트 ID     | `abc123`                                     |
| `NAVER_SEARCH_CLIENT_SECRET` | 네이버 검색 시크릿         | `xyz789`                                     |
| `JWT_SECRET`              | 인증 시크릿 (32자 이상)       | `my-super-secret-key-12345678901234567890`   |

💡 **JWT_SECRET 만드는 법:**
- 아무 긴 문자열이나 입력하세요 (32자 이상)
- 예: `sajangpick-secret-key-2025-very-long-string`

#### 🤖 선택적 환경변수 (있으면 입력)

AI 기능을 사용하려면:

| 이름               | 설명          | 어디서 발급?                           |
| ------------------ | ------------- | -------------------------------------- |
| `OPENAI_API_KEY`   | ChatGPT 사용  | https://platform.openai.com/api-keys   |
| `GEMINI_API_KEY`   | Google Gemini | https://aistudio.google.com/app/apikey |
| `CLAUDE_API_KEY`   | Claude AI     | https://console.anthropic.com/         |

#### ⚠️ 주의사항

- **띄어쓰기 없이** 정확히 입력하세요
- **API 키는 절대 다른 곳에 공유하지 마세요!**
- **Value 값을 잘못 입력하면** 배포 후 기능이 작동 안 합니다
  - 괜찮아요! 나중에 수정할 수 있어요

✅ **모든 환경변수 입력 완료?** 다음 단계로!

---

### 📍 4단계: 배포 시작!

1. **맨 아래로 스크롤**하세요

2. **큰 파란색 "Deploy"** 버튼이 보일 거예요
   - 클릭!

3. **배포가 시작됩니다!**
   - 화면에 로딩 애니메이션과 로그가 표시됩니다
   - **2-3분 정도 기다리세요** ☕
   - 절대 창을 닫지 마세요!

4. **"Congratulations!"** 메시지가 나타나면 완료!
   - 축하합니다! 🎉

✅ **배포 성공!**

---

### 📍 5단계: 사이트 확인하기

배포가 완료되면:

1. **"Visit"** 버튼이 보일 거예요
   - 클릭하면 배포된 사이트로 이동!

2. **도메인 주소 확인**
   - 자동으로 생성된 주소: `https://naver-keyword-tool-xxx.vercel.app`
   - 이 주소를 복사해서 저장해두세요!

3. **"플 순위" 메뉴 클릭**하여 테스트:
   - 키워드 입력: `부산고기맛집`
   - **"실시간 목록 수집"** 버튼 클릭
   - 데이터가 잘 수집되는지 확인!

✅ **모든 과정 완료!** 🎊

---

## 🎉 완료!

축하합니다! 이제 여러분의 사이트가 전 세계에 배포되었습니다! 🌍

**배포된 사이트**: https://your-domain.vercel.app

**앞으로 할 일:**
1. ✅ 실시간 목록 수집 기능 테스트
2. ✅ 다른 기능들도 확인해보기
3. ✅ 코드 수정하면 자동 재배포 확인
4. ✅ 친구들에게 사이트 공유! 🎊

---

## 📞 도움이 필요하면?

- 막히는 부분이 있으면 언제든 물어보세요!
- 에러 메시지를 복사해서 보내주시면 도와드릴게요!

