# 🎯 카카오 로그인 설정 가이드 (비개발자용)

> ⚠️ **이 문서는 구식입니다!**  
> 현재는 `docs/KAKAO_LOGIN_GUIDE.md`를 사용하세요 (Supabase 방식)

## 📌 목차

1. [카카오 개발자 등록](#1-카카오-개발자-등록)
2. [Vercel 환경변수 설정](#2-vercel-환경변수-설정)
3. [코드 활성화](#3-코드-활성화)

---

## 1. 카카오 개발자 등록

### 1-1. 카카오 개발자 사이트 접속

- 주소: https://developers.kakao.com
- 우측 상단 "로그인" 클릭
- 카카오톡 계정으로 로그인

### 1-2. 애플리케이션 추가하기

1. 로그인 후 "내 애플리케이션" 메뉴 클릭
2. "애플리케이션 추가하기" 버튼 클릭
3. 아래 정보 입력:
   - **앱 이름**: `사장픽` (원하는 이름)
   - **사업자명**: 본인 이름 또는 상호
   - **카테고리**: `기타` 선택
4. "저장" 버튼 클릭

### 1-3. 앱 키 확인하기

1. 생성된 앱을 클릭
2. 좌측 메뉴 "앱 설정 → 요약 정보" 클릭
3. **"REST API 키"** 복사해서 메모장에 저장
   - 예시: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
   - ⚠️ 이 키는 나중에 사용합니다!

### 1-4. 플랫폼 등록하기

1. 좌측 메뉴 "앱 설정 → 플랫폼" 클릭
2. "Web 플랫폼 등록" 버튼 클릭
3. **사이트 도메인** 입력:
   ```
   https://sajangpick.co.kr
   ```
4. "저장" 버튼 클릭
5. 만약 `www`도 사용한다면 하나 더 추가:
   ```
   https://www.sajangpick.co.kr
   ```

### 1-5. 카카오 로그인 활성화

1. 좌측 메뉴 "제품 설정 → 카카오 로그인" 클릭
2. 상태를 "OFF → ON"으로 변경
3. **Redirect URI** 등록:
   - 아래 "Redirect URI" 섹션에서 "Redirect URI 등록" 버튼 클릭
   - 입력:
     ```
     https://sajangpick.co.kr/auth/kakao/callback
     ```
   - "저장" 버튼 클릭

### ✅ 1단계 완료!

- REST API 키를 메모장에 복사했나요? ✓
- 플랫폼(Web) 등록 완료했나요? ✓
- Redirect URI 등록 완료했나요? ✓

---

## 2. Vercel 환경변수 설정

### 2-1. Vercel 대시보드 접속

1. https://vercel.com 접속
2. 로그인
3. `sajangpick_osm` 프로젝트 클릭

### 2-2. 환경변수 추가하기

1. 상단 메뉴 "Settings" 클릭
2. 좌측 메뉴 "Environment Variables" 클릭
3. 아래 3개의 환경변수를 하나씩 추가합니다:

#### 환경변수 1: KAKAO_REST_API_KEY

- **Key (이름)**: `KAKAO_REST_API_KEY`
- **Value (값)**: 위에서 복사한 REST API 키 붙여넣기
- **Environment**: `Production` 선택
- "Save" 버튼 클릭

#### 환경변수 2: KAKAO_REDIRECT_URI

- **Key**: `KAKAO_REDIRECT_URI`
- **Value**: `https://sajangpick.co.kr/auth/kakao/callback`
- **Environment**: `Production` 선택
- "Save" 버튼 클릭

#### 환경변수 3: JWT_SECRET

- **Key**: `JWT_SECRET`
- **Value**: 아무 긴 문자열 (예: `sajangpick2025secretkey1234567890abcdef`)
- **Environment**: `Production` 선택
- "Save" 버튼 클릭

💡 **JWT_SECRET 값은 아무거나 입력해도 되지만, 길고 복잡할수록 좋습니다!**

- 예: `mySecretKey123456789!@#$%^&*()`
- 예: `사장픽비밀키20251016랜덤문자열`

### ✅ 2단계 완료!

- 3개의 환경변수가 모두 추가되었나요? ✓

---

## 3. 코드 활성화

이 단계는 AI가 자동으로 처리합니다!

### 수정할 파일:

- `login.html`: 카카오 로그인 버튼 활성화
- `join.html`: 카카오 회원가입 버튼 활성화

### 배포:

- Git에 푸시하면 Vercel이 자동으로 배포합니다

---

## 4. 테스트하기

### 4-1. 배포 완료 기다리기

1. Vercel 대시보드에서 배포 상태 확인
2. "Ready" 상태가 되면 완료!

### 4-2. 카카오 로그인 테스트

1. https://sajangpick.co.kr/login.html 접속
2. "카카오톡 아이디로 로그인" 버튼 클릭
3. 카카오 로그인 화면이 나타나는지 확인
4. 로그인 후 메인 페이지로 돌아오는지 확인

### ✅ 완료!

카카오톡 로그인이 작동합니다! 🎉

---

## 🔧 문제 해결

### Q1. "KOE101" 오류가 나타나요

**원인**: Redirect URI가 일치하지 않음

**해결**:

1. 카카오 개발자 콘솔 확인
2. Redirect URI가 정확히 `https://sajangpick.co.kr/auth/kakao/callback`인지 확인
3. Vercel 환경변수도 똑같이 설정되어 있는지 확인

### Q2. "준비 중입니다" 메시지가 계속 나와요

**원인**: 코드가 아직 활성화되지 않음

**해결**:

1. Git push가 완료되었는지 확인
2. Vercel 배포가 완료되었는지 확인
3. 브라우저 새로고침 (Ctrl + Shift + R)

### Q3. 환경변수를 잘못 입력했어요

**해결**:

1. Vercel 대시보드 → Settings → Environment Variables
2. 잘못된 변수 찾아서 "Edit" 또는 "Delete"
3. 올바른 값으로 다시 추가
4. "Deployments" 탭에서 "Redeploy" 클릭

---

## 📞 추가 도움말

- 카카오 개발자 문서: https://developers.kakao.com/docs/latest/ko/kakaologin/common
- Vercel 환경변수 문서: https://vercel.com/docs/environment-variables

