# 🎯 비개발자를 위한 Vercel 배포 가이드

> **이 가이드는 코딩을 모르는 분도 따라할 수 있도록 작성되었습니다!**  
> 클릭만으로 모든 걸 해결할 수 있어요! 🖱️

---

## ✅ 배포 전 준비사항

### 1. 필요한 것들 (체크해보세요!)

- [ ] **GitHub 계정** (없으면 https://github.com 에서 무료 가입)
- [ ] **네이버 API 키들** (네이버 검색광고 API에서 발급받은 것)
  - 고객 ID (Customer ID)
  - API Key
  - Secret Key
- [ ] **AI API 키들** (선택사항, 있으면 더 많은 기능 사용 가능)
  - OpenAI API Key (ChatGPT 사용)
  - Google Gemini API Key
  - Claude API Key

---

## 🚀 배포 시작하기 (5단계)

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

---

#### 📝 환경변수 입력 가이드

각 환경변수를 추가할 때:

1. **Name (이름)**: 아래 표의 "이름" 열 복사
2. **Value (값)**: 본인의 실제 API 키 입력
3. **Environments**: Production, Preview, Development **모두 체크** ✅
4. **"Add"** 버튼 클릭
5. 다음 환경변수로 반복!

---

#### 🔑 필수 환경변수 (반드시 입력!)

| 이름                | 설명                    | 예시 값                                    |
| ------------------- | ----------------------- | ------------------------------------------ |
| `NODE_ENV`          | 서버 환경               | `production`                               |
| `NAVER_CUSTOMER_ID` | 네이버 고객 ID          | `cust123456`                               |
| `NAVER_API_KEY`     | 네이버 API 키           | `01234567890abcdef`                        |
| `NAVER_SECRET_KEY`  | 네이버 시크릿 키        | `abcdefg1234567`                           |
| `JWT_SECRET`        | 인증 시크릿 (32자 이상) | `my-super-secret-key-12345678901234567890` |

💡 **JWT_SECRET 만드는 법:**

- 아무 긴 문자열이나 입력하세요 (32자 이상)
- 예: `sajangpick-secret-key-2025-very-long-string`

---

#### 🤖 선택적 환경변수 (있으면 입력)

AI 기능을 사용하려면:

| 이름             | 설명          | 어디서 발급?                           |
| ---------------- | ------------- | -------------------------------------- |
| `OPENAI_API_KEY` | ChatGPT 사용  | https://platform.openai.com/api-keys   |
| `GEMINI_API_KEY` | Google Gemini | https://aistudio.google.com/app/apikey |
| `CLAUDE_API_KEY` | Claude AI     | https://console.anthropic.com/         |

네이버 검색 API (추가 기능):

| 이름                         | 설명               | 어디서 발급?                       |
| ---------------------------- | ------------------ | ---------------------------------- |
| `NAVER_SEARCH_CLIENT_ID`     | 네이버 검색 ID     | https://developers.naver.com/apps/ |
| `NAVER_SEARCH_CLIENT_SECRET` | 네이버 검색 시크릿 | https://developers.naver.com/apps/ |

카카오 로그인 (나중에 추가 가능):

| 이름                 | 설명                       |
| -------------------- | -------------------------- |
| `KAKAO_REST_API_KEY` | 카카오 REST API 키         |
| `KAKAO_REDIRECT_URI` | 나중에 배포 후 도메인 추가 |

---

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

## 🔄 코드 수정 후 자동 재배포

**좋은 소식:** 이제 GitHub에 코드만 올리면 자동으로 배포됩니다!

**Cursor에서 코드 수정 후:**

1. 왼쪽 사이드바 **소스 제어** (Git 아이콘) 클릭
2. 변경된 파일들 확인
3. **"+"** 버튼으로 변경사항 추가 (Stage)
4. 상단 메시지 입력란에 간단히 입력: `업데이트`
5. **"✓ 커밋"** 버튼 클릭
6. **"동기화"** 버튼 클릭 (GitHub에 푸시)

→ **Vercel이 자동으로 감지하고 재배포!** 🚀

---

## ❓ 문제 해결 (자주 묻는 질문)

### Q1. 배포는 됐는데 "실시간 목록 수집"이 안 돼요!

**원인:** 환경변수가 잘못 입력되었을 가능성이 높아요.

**해결 방법:**

1. Vercel 대시보드로 돌아가기
2. 프로젝트 선택
3. **"Settings"** 탭 클릭
4. 왼쪽 메뉴에서 **"Environment Variables"** 클릭
5. 각 환경변수 값 확인:
   - 특히 `NAVER_CUSTOMER_ID`, `NAVER_API_KEY`, `NAVER_SECRET_KEY`
   - 띄어쓰기나 오타가 없는지 확인
6. 수정했다면 **"Deployments"** 탭 → 최신 배포 옆 **"..."** → **"Redeploy"**

---

### Q2. 배포가 실패했어요! (빨간색 X 표시)

**해결 방법:**

1. **"Deployments"** 탭 클릭
2. 실패한 배포 클릭
3. **로그(Log)** 확인
4. 에러 메시지 복사해서 제게 보내주세요!

---

### Q3. GitHub 레포지토리가 안 보여요!

**해결 방법:**

1. Import 화면에서 **"Adjust GitHub App Permissions"** 링크 클릭
2. Vercel 앱에 레포지토리 접근 권한 추가
3. 다시 Import 화면으로 돌아오기

---

### Q4. 환경변수를 나중에 추가/수정하고 싶어요!

**추가/수정 방법:**

1. Vercel 대시보드 → 프로젝트 선택
2. **"Settings"** → **"Environment Variables"**
3. 수정: 기존 변수 옆 **"Edit"** 클릭
4. 추가: 새 변수 **"Add"** 클릭
5. 저장 후 **"Redeploy"** 필요!

---

### Q5. 도메인을 내가 가진 것으로 바꾸고 싶어요!

**커스텀 도메인 연결:**

1. 도메인이 있어야 해요 (예: `myshop.com`)
2. Vercel 대시보드 → 프로젝트 선택
3. **"Settings"** → **"Domains"**
4. 도메인 입력 → 화면 안내 따라하기
5. 도메인 제공업체(가비아, 후이즈 등)에서 DNS 설정
6. 자동으로 SSL 인증서 발급! (HTTPS)

---

## 📞 도움이 필요하면?

- 막히는 부분이 있으면 언제든 물어보세요!
- 에러 메시지를 복사해서 보내주시면 도와드릴게요!

---

## 🎉 완료!

축하합니다! 이제 여러분의 사이트가 전 세계에 배포되었습니다! 🌍

**배포된 사이트**: https://your-domain.vercel.app

**앞으로 할 일:**

1. ✅ 실시간 목록 수집 기능 테스트
2. ✅ 다른 기능들도 확인해보기
3. ✅ 코드 수정하면 자동 재배포 확인
4. ✅ 친구들에게 사이트 공유! 🎊
