# 🔐 카카오 로그인 설정 가이드 (Supabase 방식)

> **AI 작업자**: 이 프로젝트는 Supabase OAuth를 사용하여 카카오 로그인을 구현합니다.  
> 기존 서버 방식(Express 백엔드)에서 Supabase 방식으로 전환되었습니다.

---

## 🎯 AI용 빠른 체크리스트

### 설정 완료 확인
- [ ] 카카오 개발자 앱 생성 및 REST API 키 확보
- [ ] 카카오 로그인 활성화 (OFF → ON)
- [ ] Supabase Redirect URI 등록: `https://프로젝트ID.supabase.co/auth/v1/callback`
- [ ] Supabase Dashboard → Authentication → Providers → Kakao ON
- [ ] Supabase에 REST API 키 입력 + "Skip nonce check" 체크
- [ ] `.env`에 `SUPABASE_URL`, `SUPABASE_ANON_KEY` 설정
- [ ] `login.html`에서 `supabase.auth.signInWithOAuth()` 구현 확인

### 핵심 파일
- **`login.html`**: Supabase OAuth 클라이언트 구현
- **`lib/database.js`**: Supabase 클라이언트 초기화
- **`docs/AI_LOG.md`**: 카카오 로그인 전환 히스토리

### Redirect URI 형식
```
Supabase: https://프로젝트ID.supabase.co/auth/v1/callback
```

### 자주 발생하는 문제
- **KOE101 에러**: Redirect URI 불일치 → 카카오 콘솔에서 Supabase URI 확인
- **로그인 버튼 클릭 시 무반응**: Supabase 환경변수 확인
- **"Skip nonce check" 미체크**: Supabase Provider 설정에서 체크 필수

---

## 📊 Supabase vs 기존 방식 비교

| 구분           | 기존 Express 방식              | Supabase OAuth 방식      |
| -------------- | ------------------------------ | ------------------------ |
| **서버 코드**  | `/api/auth/kakao/*` 직접 구현  | 불필요 ✅                |
| **토큰 관리**  | 수동 (JWT 발급, 쿠키 설정)     | 자동 처리 ✅             |
| **보안**       | CSRF, HttpOnly 직접 구현       | 자동 처리 ✅             |
| **설정 시간**  | 며칠 (작동 실패 多)            | **10분** ✨              |
| **Redirect**   | `your-domain/auth/kakao/callback` | `supabase.co/auth/v1/callback` |
| **환경변수**   | `KAKAO_REST_API_KEY` 등        | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |

---

## 🔑 필수 환경변수

### Supabase (필수)
```bash
SUPABASE_URL=https://프로젝트ID.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**발급 위치**: Supabase Dashboard → Project Settings → API

### 카카오 개발자 (필수)
- **REST API 키**: 카카오 개발자 콘솔에서 발급
- **Redirect URI**: `https://프로젝트ID.supabase.co/auth/v1/callback`

---

## ⚡ 빠른 설정 가이드 (10분)

### 1️⃣ 카카오 개발자 설정 (5분)

1. https://developers.kakao.com 접속 → 로그인
2. "내 애플리케이션" → "애플리케이션 추가하기"
   - 앱 이름: `사장픽`
   - 카테고리: `기타`
3. "앱 설정" → "요약 정보" → **REST API 키 복사**
4. "제품 설정" → "카카오 로그인" → **OFF → ON**
5. "Redirect URI 등록" 버튼 클릭 → 다음 URL 입력:
   ```
   https://ptuzlubggggbgsophfcna.supabase.co/auth/v1/callback
   ```
   > ⚠️ `ptuzlubggggbgsophfcna`를 본인의 Supabase 프로젝트 ID로 변경!

### 2️⃣ Supabase 설정 (3분)

1. https://supabase.com → 본인 프로젝트 선택
2. **Authentication** → **Providers** → **Kakao** 찾기
3. 토글을 **ON**으로 변경
4. **Kakao Client ID**: 위에서 복사한 REST API 키 붙여넣기
5. **Kakao Client Secret**: 비워두기
6. **✅ Skip nonce check** 반드시 체크!
7. **Save** 버튼 클릭

### 3️⃣ 환경변수 확인 (1분)

**`.env` 파일**:
```bash
SUPABASE_URL=https://ptuzlubggggbgsophfcna.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1...
```

**Vercel 배포 시**:
- Settings → Environment Variables에 동일하게 추가

### 4️⃣ 테스트 (1분)

1. https://sajangpick.co.kr/login.html 접속
2. "카카오톡 아이디로 로그인" 버튼 클릭
3. 카카오 로그인 화면 확인
4. 로그인 후 자동 리다이렉트 확인

✅ **완료!** 🎉

---

## 🔧 트러블슈팅

### KOE101: Redirect URI 불일치

**증상**: 카카오 로그인 시 "redirect_uri 파라미터가 등록된 redirect_uri 값과 일치하지 않습니다."

**해결 방법**:
1. 카카오 개발자 콘솔 → "카카오 로그인" → Redirect URI 확인
2. 다음 형식이 **정확히** 일치해야 함:
   ```
   https://프로젝트ID.supabase.co/auth/v1/callback
   ```
3. `http`가 아닌 `https` 확인
4. 마지막 슬래시 없어야 함
5. 등록 후 5-10분 대기 (카카오 서버 반영 시간)

### 로그인 버튼 클릭 시 무반응

**원인**: Supabase 클라이언트 초기화 실패

**해결 방법**:
1. 브라우저 콘솔(F12) 확인
2. `.env` 파일에서 환경변수 확인:
   ```bash
   SUPABASE_URL=https://...
   SUPABASE_ANON_KEY=eyJ...
   ```
3. `login.html`에서 Supabase 초기화 코드 확인:
   ```javascript
   const supabase = window.supabase.createClient(
     'SUPABASE_URL',
     'SUPABASE_ANON_KEY'
   );
   ```
4. 서버 재시작: `pnpm run dev`

### "Skip nonce check" 에러

**증상**: 로그인 후 "nonce mismatch" 에러

**해결 방법**:
1. Supabase Dashboard → Authentication → Providers → Kakao
2. **"Skip nonce check"** 체크박스 확인
3. 체크되어 있지 않으면 체크 후 Save

### 세션이 유지되지 않음

**원인**: Supabase 세션 관리 설정 문제

**해결 방법**:
1. `login.html`에서 로그인 성공 후 세션 확인:
   ```javascript
   const { data: { session } } = await supabase.auth.getSession();
   console.log('세션:', session);
   ```
2. Supabase Dashboard → Authentication → Settings → "Refresh Token Rotation" 확인
3. 로컬 개발 시 HTTPS 사용 (HTTP는 쿠키 문제 발생 가능)

---

## 📖 비개발자를 위한 상세 가이드

> 아래 내용은 코딩을 모르는 분들을 위한 스텝바이스텝 가이드입니다.

### 📍 1단계: 카카오 개발자 앱 설정

#### 1-1. 카카오 개발자 콘솔 접속

1. **브라우저를 열고** 다음 주소로 이동하세요:
   ```
   https://developers.kakao.com
   ```

2. **우측 상단**에 "로그인" 버튼 클릭
   - 카카오톡 계정으로 로그인하세요

#### 1-2. 애플리케이션 만들기

1. **"내 애플리케이션"** 메뉴 클릭
   - 화면 상단에 있습니다

2. **"애플리케이션 추가하기"** 버튼 클릭
   - 노란색 버튼입니다

3. **정보 입력**:
   - **앱 이름**: `사장픽` (원하는 이름)
   - **사업자명**: 본인 이름
   - **카테고리**: `기타` 선택

4. **"저장"** 버튼 클릭

✅ **완료!** 앱이 생성되었습니다!

#### 1-3. REST API 키 복사하기 📝

1. 생성된 앱을 **클릭**하세요

2. 좌측 메뉴에서 **"앱 설정" → "요약 정보"** 클릭

3. **"REST API 키"** 찾기
   - 긴 영문자와 숫자 조합입니다 (예: `a1b2c3d4e5f6...`)

4. **복사 버튼** 클릭

5. **메모장에 붙여넣기** ⭐
   - 나중에 사용합니다!

#### 1-4. 카카오 로그인 활성화

1. 좌측 메뉴에서 **"제품 설정" → "카카오 로그인"** 클릭

2. **상태를 "OFF → ON"**으로 변경
   - 토글 버튼을 클릭하세요

3. **아래로 스크롤**해서 "Redirect URI" 섹션 찾기

4. **"Redirect URI 등록"** 버튼 클릭

5. **다음 URL을 정확히 입력**하세요:
   ```
   https://ptuzlubggggbgsophfcna.supabase.co/auth/v1/callback
   ```
   
   > ⚠️ **중요**: `ptuzlubggggbgsophfcna` 부분을 본인의 Supabase 프로젝트 ID로 변경하세요!
   > 
   > **Supabase 프로젝트 ID 찾는 방법**:
   > 1. https://supabase.com 접속 → 로그인
   > 2. 프로젝트 선택
   > 3. Settings → General → Project URL 확인
   > 4. `https://프로젝트ID.supabase.co`에서 `프로젝트ID` 부분 복사

6. **"저장"** 버튼 클릭

✅ **1단계 완료!** 카카오 설정 끝!

---

### 📍 2단계: Supabase 설정

#### 2-1. Supabase 대시보드 접속

1. **브라우저를 열고** 다음 주소로 이동하세요:
   ```
   https://supabase.com
   ```

2. **로그인**하세요

3. **본인의 프로젝트** 클릭
   - 프로젝트 이름: `sajangpick` 또는 유사한 이름

#### 2-2. Kakao Provider 활성화

1. 좌측 메뉴에서 **"Authentication"** 클릭
   - 자물쇠 아이콘입니다

2. 상단 탭에서 **"Providers"** 클릭

3. 목록에서 **"Kakao"** 찾기
   - 알파벳 순으로 정렬되어 있습니다

4. **Kakao 옆 토글 버튼**을 **ON**으로 변경
   - 회색 → 초록색으로 바뀝니다

#### 2-3. Kakao 정보 입력

토글을 ON으로 바꾸면 입력 폼이 나타납니다:

1. **Kakao Client ID**:
   - 1단계에서 복사한 **REST API 키** 붙여넣기

2. **Kakao Client Secret**:
   - **비워두세요** (입력 안 해도 됩니다)

3. **✅ Skip nonce check**:
   - **반드시 체크하세요!** ⚠️
   - 이 체크박스를 놓치면 로그인이 작동하지 않습니다!

4. **"Save"** 버튼 클릭
   - 우측 하단에 있습니다

✅ **2단계 완료!** Supabase 설정 끝!

---

### 📍 3단계: 환경변수 확인

#### 3-1. Supabase URL과 Key 확인

1. Supabase 대시보드에서:
   - 좌측 메뉴 **"Settings"** (톱니바퀴 아이콘) 클릭
   - **"API"** 클릭

2. 다음 두 값을 **복사**하세요:
   
   **Project URL**:
   ```
   https://ptuzlubggggbgsophfcna.supabase.co
   ```
   
   **anon public** (API Key):
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
   (매우 긴 문자열입니다)

#### 3-2. 로컬 개발 시 (`.env` 파일)

프로젝트 폴더에 `.env` 파일을 열고:

```bash
SUPABASE_URL=https://ptuzlubggggbgsophfcna.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 3-3. Vercel 배포 시

1. https://vercel.com 접속 → 로그인

2. **본인 프로젝트** 클릭

3. **"Settings"** 탭 클릭

4. 좌측 메뉴 **"Environment Variables"** 클릭

5. **"Add"** 버튼 클릭하여 다음 2개 추가:

**환경변수 1**:
- **Key**: `SUPABASE_URL`
- **Value**: `https://ptuzlubggggbgsophfcna.supabase.co`
- **Environments**: Production, Preview, Development 모두 체크
- "Save" 클릭

**환경변수 2**:
- **Key**: `SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (긴 문자열)
- **Environments**: Production, Preview, Development 모두 체크
- "Save" 클릭

6. **"Deployments"** 탭 → 최신 배포 옆 "..." → **"Redeploy"** 클릭

✅ **3단계 완료!** 환경변수 설정 끝!

---

### 📍 4단계: 테스트

#### 4-1. 로컬 테스트 (개발 중)

1. **터미널**을 열고 서버 실행:
   ```bash
   pnpm run dev
   ```

2. **브라우저**에서 접속:
   ```
   http://localhost:3000/login.html
   ```

3. **"카카오톡 아이디로 로그인"** 버튼 클릭

4. **카카오 로그인 화면** 확인
   - 카카오톡 계정으로 로그인

5. **자동으로 돌아오는지** 확인
   - 로그인 성공 후 원래 페이지로 리다이렉트

#### 4-2. 배포 후 테스트

1. **배포된 사이트** 접속:
   ```
   https://sajangpick.co.kr/login.html
   ```

2. **"카카오톡 아이디로 로그인"** 버튼 클릭

3. **동일하게 작동하는지** 확인

✅ **모든 단계 완료!** 🎉

---

## 📚 참고 자료

### 공식 문서
- [Supabase Kakao OAuth 가이드](https://supabase.com/docs/guides/auth/social-login/auth-kakao)
- [카카오 로그인 문서](https://developers.kakao.com/docs/latest/ko/kakaologin/common)

### 프로젝트 내 관련 파일
- `login.html`: Supabase OAuth 클라이언트 구현
- `lib/database.js`: Supabase 클라이언트 초기화
- `docs/AI_LOG.md`: 카카오 로그인 전환 히스토리 (2025-01-XX)

---

## 🎉 완료!

축하합니다! 카카오 로그인이 성공적으로 설정되었습니다! 🎊

**다음 단계**:
1. ✅ 다른 페이지에서도 로그인 상태 확인
2. ✅ 로그아웃 기능 테스트
3. ✅ 사용자 정보 표시 (닉네임, 프로필 이미지)

**문제가 발생하면**:
- 위 "트러블슈팅" 섹션 참조
- 브라우저 콘솔(F12) 확인
- AI에게 에러 메시지 공유

