# 🚀 Vercel 배포 가이드

## 📋 준비사항

✅ GitHub 계정
✅ 프로젝트가 GitHub에 올라가 있음 (완료!)
✅ 환경변수 정보 (네이버 API 키, OpenAI 키 등)

---

## 1️⃣ Vercel 회원가입 및 프로젝트 연결

### 1. Vercel 사이트 접속
```
https://vercel.com
```

### 2. GitHub로 로그인
- 우측 상단 "Sign Up" 또는 "Log In" 클릭
- "Continue with GitHub" 선택
- GitHub 계정 연동 승인

### 3. 새 프로젝트 생성
1. 대시보드에서 **"Add New..."** → **"Project"** 클릭
2. GitHub 레포지토리 목록에서 **`sajangpick/naver-keyword-tool`** 찾기
3. **"Import"** 버튼 클릭

---

## 2️⃣ 프로젝트 설정

### Build & Development Settings

Vercel이 자동으로 설정을 감지하지만, 다음과 같이 설정되어 있는지 확인하세요:

```
Framework Preset: Other
Root Directory: ./
Build Command: (비워두기 - 정적 사이트)
Output Directory: (비워두기)
Install Command: pnpm install --no-frozen-lockfile
```

**중요:** `vercel.json` 파일이 이미 있어서 자동 설정됩니다!

---

## 3️⃣ 환경변수 설정 (필수!)

배포 전에 **Environment Variables** 탭에서 다음 환경변수들을 추가해야 합니다:

### 필수 환경변수

#### 서버 설정
```bash
NODE_ENV=production
PORT=10000
CORS_ORIGIN=https://your-domain.vercel.app
```

#### 네이버 API (키워드 도구)
```bash
NAVER_CUSTOMER_ID=your_customer_id
NAVER_API_KEY=your_api_key
NAVER_SECRET_KEY=your_secret_key
```

#### 네이버 검색 API (플레이스 검색)
```bash
NAVER_SEARCH_CLIENT_ID=your_client_id
NAVER_SEARCH_CLIENT_SECRET=your_client_secret
```

#### AI API 키
```bash
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
CLAUDE_API_KEY=sk-ant-...
```

#### 카카오 로그인
```bash
KAKAO_REST_API_KEY=your_kakao_key
KAKAO_REDIRECT_URI=https://your-domain.vercel.app/auth/kakao/callback
KAKAO_CLIENT_SECRET=(선택사항)
```

#### JWT 시크릿
```bash
JWT_SECRET=아주긴랜덤문자열32자이상
```

### 환경변수 추가 방법 (스크린샷 대신 설명)

1. **Settings** 탭 클릭
2. 왼쪽 메뉴에서 **Environment Variables** 클릭
3. 각 환경변수 추가:
   - **Key**: 변수 이름 (예: `NAVER_API_KEY`)
   - **Value**: 실제 값 (예: `your_api_key_here`)
   - **Environments**: `Production`, `Preview`, `Development` 모두 체크
4. **"Add"** 버튼 클릭
5. 모든 환경변수에 대해 반복

---

## 4️⃣ 배포 시작!

1. **"Deploy"** 버튼 클릭
2. 배포 진행 상황 확인 (보통 2-3분 소요)
3. 배포 완료 후 **"Visit"** 버튼 클릭하여 사이트 확인

---

## 5️⃣ 도메인 확인 및 설정

### 자동 생성된 도메인
배포가 완료되면 다음과 같은 도메인이 자동으로 생성됩니다:
```
https://naver-keyword-tool-xxx.vercel.app
```

### 커스텀 도메인 연결 (선택사항)

1. **Settings** → **Domains** 클릭
2. 원하는 도메인 입력 (예: `sajangpick.com`)
3. DNS 설정 안내에 따라 도메인 제공업체에서 설정
4. 검증 완료 후 자동으로 SSL 인증서 발급

---

## 6️⃣ 실시간 목록 수집 기능 테스트

배포 완료 후:

1. 배포된 도메인으로 이동
2. 상단 메뉴에서 **"플 순위"** 클릭
3. 키워드 입력 (예: "부산고기맛집")
4. **"실시간 목록 수집"** 버튼 클릭
5. 데이터가 수집되는지 확인

---

## 🔧 문제 해결

### 배포 실패 시

1. **Deployments** 탭에서 로그 확인
2. 빌드 에러 메시지 확인
3. 환경변수가 모두 올바르게 설정되었는지 확인

### API 작동 안 할 때

1. **Environment Variables**에 모든 키가 설정되었는지 확인
2. 특히 `NAVER_CUSTOMER_ID`, `NAVER_API_KEY`, `NAVER_SECRET_KEY` 확인
3. 환경변수 수정 후 **"Redeploy"** 필요

### CORS 에러 발생 시

`CORS_ORIGIN` 환경변수를 배포된 도메인으로 설정:
```bash
CORS_ORIGIN=https://your-actual-domain.vercel.app
```

---

## 📱 자동 배포 설정

Vercel은 GitHub에 코드를 푸시할 때마다 **자동으로 배포**됩니다!

```bash
# 로컬에서 코드 수정 후
git add .
git commit -m "업데이트 내용"
git push origin main

# Vercel이 자동으로 감지하고 배포 시작!
```

---

## 🎉 완료!

배포가 완료되면:
- ✅ 실시간 목록 수집 기능 작동
- ✅ 모든 API 기능 사용 가능
- ✅ HTTPS 자동 적용
- ✅ 전 세계 CDN을 통한 빠른 속도

**배포된 사이트 URL**: https://your-domain.vercel.app

---

## 📞 추가 지원

문제가 발생하면:
1. Vercel 대시보드의 로그 확인
2. GitHub Issues에 문의
3. Vercel 문서: https://vercel.com/docs


