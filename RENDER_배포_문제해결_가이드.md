# 🚨 Render 배포 오류 해결 가이드

> **Render에서 "배포 과정에서 오류가 발생했습니다" 메시지가 나타날 때 해결 방법**

---

## 📋 1단계: Render 대시보드에서 로그 확인

### 1.1 로그 확인 방법
1. https://dashboard.render.com 접속
2. `naver-keyword-tool` 서비스 클릭
3. 왼쪽 메뉴에서 **"Logs"** 클릭
4. **"Deploy"** 탭에서 빌드/배포 로그 확인

### 1.2 확인할 내용
- ❌ **빨간색 에러 메시지** 찾기
- ❌ **"pnpm: command not found"** → pnpm 설치 문제
- ❌ **"Cannot find module"** → 의존성 설치 실패
- ❌ **"Port already in use"** → 포트 충돌
- ❌ **"Environment variable missing"** → 환경변수 누락

---

## 🔧 2단계: 일반적인 문제 해결

### 문제 1: pnpm 설치 실패

**증상:**
```
pnpm: command not found
또는
Error: Cannot find module 'pnpm'
```

**해결 방법:**

#### 방법 A: render.yaml 수정 (권장)
`render.yaml`의 `buildCommand`를 수정:

```yaml
buildCommand: npm install -g pnpm && pnpm install
```

또는 npm 사용:
```yaml
buildCommand: npm install
```

그리고 `package-lock.json`이 있는지 확인 (npm 사용 시)

#### 방법 B: Render 대시보드에서 직접 수정
1. Render 대시보드 → `naver-keyword-tool` 서비스
2. **"Settings"** → **"Build & Deploy"**
3. **"Build Command"** 수정:
   ```
   npm install -g pnpm && pnpm install
   ```
4. **"Save Changes"** 클릭
5. **"Manual Deploy"** → **"Deploy latest commit"** 클릭

---

### 문제 2: 의존성 설치 실패

**증상:**
```
Error: Cannot find module 'express'
또는
npm ERR! code ELIFECYCLE
```

**해결 방법:**

1. **로컬에서 테스트:**
   ```bash
   # 로컬에서 의존성 설치 테스트
   pnpm install
   # 또는
   npm install
   ```

2. **package.json 확인:**
   - `engines` 필드에 Node.js 버전 명시되어 있는지 확인
   - `packageManager` 필드 확인

3. **Render에서 Node.js 버전 확인:**
   - Render 대시보드 → Settings → Build & Deploy
   - **"Node Version"** 확인 (18.x 이상 권장)

---

### 문제 3: 환경변수 누락

**증상:**
```
Error: SUPABASE_URL is not defined
또는
JWT_SECRET must be set
```

**해결 방법:**

1. **필수 환경변수 확인:**
   - Render 대시보드 → `naver-keyword-tool` 서비스
   - **"Environment"** 탭 클릭
   - 다음 변수들이 모두 설정되어 있는지 확인:

   ```
   ✅ PORT=10000
   ✅ NODE_ENV=production
   ✅ NEXT_PUBLIC_SUPABASE_URL=...
   ✅ SUPABASE_SERVICE_ROLE_KEY=...
   ✅ OPENAI_API_KEY=...
   ✅ JWT_SECRET=... (자동 생성 가능)
   ✅ CORS_ORIGIN=...
   ```

2. **누락된 변수 추가:**
   - **"Add Environment Variable"** 클릭
   - Key와 Value 입력
   - **"Save Changes"** 클릭
   - **"Manual Deploy"** 실행

---

### 문제 4: 포트 충돌

**증상:**
```
Error: listen EADDRINUSE: address already in use :::10000
```

**해결 방법:**

1. **render.yaml 확인:**
   ```yaml
   envVars:
     - key: PORT
       value: 10000  # Render 기본 포트 (변경하지 마세요!)
   ```

2. **server.js 확인:**
   ```javascript
   const PORT = Number(process.env.PORT) || 3003;
   ```
   → Render에서는 `process.env.PORT`가 자동으로 10000으로 설정되므로 문제없음

3. **만약 문제가 계속되면:**
   - Render 대시보드에서 서비스 재시작
   - 또는 Render가 자동으로 포트를 할당하도록 PORT 환경변수 제거

---

### 문제 5: 서버 시작 실패

**증상:**
```
서버가 시작되지 않음
또는
Health check failed
```

**해결 방법:**

1. **/health 엔드포인트 확인:**
   - server.js에 `/health` 엔드포인트가 있는지 확인
   - render.yaml에 `healthCheckPath: /health` 설정 확인

2. **서버 시작 명령어 확인:**
   - Render 대시보드 → Settings → Build & Deploy
   - **"Start Command"** 확인: `node server.js`

3. **로컬에서 테스트:**
   ```bash
   # 로컬에서 서버 시작 테스트
   node server.js
   # 브라우저에서 http://localhost:3003/health 접속
   ```

---

## 🛠️ 3단계: render.yaml 최적화

현재 `render.yaml`을 확인하고 필요시 수정:

```yaml
services:
  - type: web
    name: naver-keyword-tool
    runtime: node
    region: singapore
    # pnpm이 설치되어 있지 않으면 npm 사용
    buildCommand: npm install -g pnpm@9.0.0 && pnpm install
    # 또는 npm 사용 (더 안정적)
    # buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      # ... 나머지 환경변수
    healthCheckPath: /health
```

---

## 📝 4단계: 배포 재시도 체크리스트

배포를 다시 시도하기 전에 다음을 확인하세요:

- [ ] **GitHub에 최신 코드 푸시 완료**
  ```bash
  git add .
  git commit -m "fix: Render 배포 설정 수정"
  git push origin main
  ```

- [ ] **로컬에서 서버 정상 작동 확인**
  ```bash
  node server.js
  # http://localhost:3003/health 접속하여 확인
  ```

- [ ] **package.json의 engines 확인**
  ```json
  {
    "engines": {
      "node": ">=18.0.0",
      "pnpm": ">=9.0.0"
    },
    "packageManager": "pnpm@9.0.0"
  }
  ```

- [ ] **Render 대시보드에서 환경변수 모두 설정 확인**

- [ ] **Render 대시보드에서 수동 배포 실행**
  1. Render 대시보드 → `naver-keyword-tool` 서비스
  2. **"Manual Deploy"** 클릭
  3. **"Deploy latest commit"** 선택
  4. 배포 로그 실시간 확인

---

## 🎯 5단계: 배포 성공 확인

배포가 성공했는지 확인:

1. **헬스체크:**
   ```
   https://naver-keyword-tool.onrender.com/health
   ```
   또는
   ```
   https://naver-keyword-tool.onrender.com/api/health
   ```

2. **응답 확인:**
   ```json
   {
     "status": "ok",
     "timestamp": "2025-01-XX..."
   }
   ```

3. **Vercel에서 API 호출 테스트:**
   - Vercel 배포된 사이트에서 API 기능 테스트
   - 예: Blog-Editor.html에서 블로그 생성 테스트

---

## 🆘 여전히 문제가 발생하면

### 추가 디버깅 방법:

1. **Render 로그에서 정확한 에러 메시지 복사**
2. **로컬에서 동일한 환경 재현:**
   ```bash
   # .env 파일에 Render와 동일한 환경변수 설정
   NODE_ENV=production
   PORT=10000
   # ... 나머지 변수
   
   # 서버 시작
   node server.js
   ```

3. **최소한의 설정으로 테스트:**
   - render.yaml에서 불필요한 환경변수 제거
   - 필수 변수만 남기고 배포 테스트

4. **Render 지원팀에 문의:**
   - Render 대시보드 → Support
   - 에러 로그와 함께 문의

---

## 📌 참고: 현재 프로젝트 설정

### 현재 render.yaml 설정:
- **서비스명**: `naver-keyword-tool`
- **빌드 명령어**: `pnpm install`
- **시작 명령어**: `node server.js`
- **포트**: `10000` (Render 기본 포트)
- **헬스체크**: `/health`

### 현재 vercel.json 설정:
- **API 프록시**: `/api/:path*` → `https://naver-keyword-tool.onrender.com/api/:path*`
- **인증 프록시**: `/auth/:path*` → `https://naver-keyword-tool.onrender.com/auth/:path*`

**⚠️ 중요**: `vercel.json`의 Render URL은 절대 변경하지 마세요!

---

## ✅ 성공 사례

배포가 성공하면:
1. Render 대시보드에서 "Live" 상태 확인
2. 헬스체크 엔드포인트 정상 응답
3. Vercel에서 API 호출 정상 작동
4. 이메일 알림: "배포가 성공적으로 완료되었습니다" ✅

---

**마지막 업데이트**: 2025-01-XX
**작성자**: AI Assistant

