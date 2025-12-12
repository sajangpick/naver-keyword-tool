# 카카오페이 심사용 전체 사이트 테스트 URL 가이드

> **작성일**: 2025년 11월 25일  
> **목적**: 카카오페이 심사팀이 로그인 없이 사이트 전체를 확인할 수 있도록 제공

---

## 📋 개요

카카오페이 심사팀이 결제 페이지만이 아니라 **사이트 전체**를 확인하고 싶어하는 경우를 대비하여, 전역 데모 모드를 구현했습니다.

**특징:**
- 한 번 `?demo=true`를 추가하면 사이트 전체에서 데모 모드 유지
- 모든 페이지에서 로그인 없이 접근 가능
- 페이지 이동 시에도 데모 모드 자동 유지

---

## 🔗 테스트 URL

### 메인 페이지 (시작점)
```
https://sajangpick.co.kr/index.html?demo=true
```

**또는**
```
https://sajangpick.co.kr/?demo=true
```

### 주요 페이지들

#### 결제 페이지
```
https://sajangpick.co.kr/payment.html?demo=true
```

#### 블로그 작성
```
https://sajangpick.co.kr/Blog-Editor.html?demo=true
```

#### AI 리뷰 관리
```
https://sajangpick.co.kr/AI-Review.html?demo=true
```

#### 레시피 관리
```
https://sajangpick.co.kr/recipe-manager.html?demo=true
```

#### 쇼츠 영상 생성
```
https://sajangpick.co.kr/shorts-editor.html?demo=true
```

#### 뉴스 게시판
```
https://sajangpick.co.kr/news-board.html?demo=true
```

#### 정책 지원금
```
https://sajangpick.co.kr/policy-support.html?demo=true
```

#### 네이버 검색 도구
```
https://sajangpick.co.kr/naver_search.html?demo=true
```

#### ChatGPT
```
https://sajangpick.co.kr/ChatGPT.html?demo=true
```

---

## ✅ 전역 데모 모드 특징

### 1. **한 번 설정, 전체 적용**
- 메인 페이지(`index.html`)에서 `?demo=true` 추가
- 다른 페이지로 이동해도 자동으로 데모 모드 유지
- localStorage에 데모 모드 상태 저장

### 2. **데모 모드 배너**
- 모든 페이지 상단에 주황색 배너 표시
- "🔍 데모 모드: 카카오페이 심사용 테스트 페이지입니다" 메시지
- "데모 모드 종료" 버튼 제공

### 3. **로그인 우회**
- 모든 페이지에서 로그인 체크 우회
- 가짜 사용자 세션 자동 생성
- 실제 기능은 작동하지 않지만 UI는 모두 확인 가능

### 4. **데모 모드 종료**
- 배너의 "데모 모드 종료" 버튼 클릭
- 또는 localStorage에서 `demo_mode` 삭제

---

## 📱 확인 가능한 페이지 목록

### ✅ 일반 사용자 페이지
1. **메인 페이지** (`index.html`)
   - 서비스 소개
   - 기능 카드들
   - 메뉴 네비게이션

2. **결제 페이지** (`payment.html`)
   - 플랜 선택
   - 결제 방법 선택 (카카오페이 포함)
   - 가격 정보

3. **블로그 작성** (`Blog-Editor.html`)
   - 블로그 작성 UI
   - AI 기능 UI

4. **AI 리뷰 관리** (`AI-Review.html`)
   - 리뷰 관리 UI
   - AI 답변 생성 UI

5. **레시피 관리** (`recipe-manager.html`)
   - 레시피 목록
   - 레시피 생성 UI

6. **쇼츠 영상** (`shorts-editor.html`)
   - 영상 생성 UI

7. **뉴스 게시판** (`news-board.html`)
   - 뉴스 목록
   - 뉴스 상세

8. **정책 지원금** (`policy-support.html`)
   - 정책 목록
   - 정책 검색

9. **네이버 검색 도구** (`naver_search.html`)
   - 키워드 검색 UI

10. **ChatGPT** (`ChatGPT.html`)
    - AI 채팅 UI

### ❌ 관리자 페이지
- 관리자 페이지는 데모 모드에서도 접근 제한 (보안상 이유)

---

## 🎯 카카오페이 심사팀에 제공할 정보

### 이메일/문서에 포함할 내용

```
안녕하세요.

카카오페이 심사 요청에 따라 로그인 없이도 사이트 전체를 확인할 수 있는 
테스트 URL을 제공드립니다.

[테스트 URL - 메인 페이지]
https://sajangpick.co.kr/index.html?demo=true

[사용 방법]
1. 위 URL로 접속하시면 데모 모드가 활성화됩니다
2. 페이지 상단에 주황색 데모 모드 배너가 표시됩니다
3. 사이트 내 모든 페이지로 이동해도 데모 모드가 자동으로 유지됩니다
4. 로그인 없이 모든 페이지의 UI를 확인하실 수 있습니다

[주요 확인 페이지]
- 결제 페이지: https://sajangpick.co.kr/payment.html?demo=true
- 블로그 작성: https://sajangpick.co.kr/Blog-Editor.html?demo=true
- AI 리뷰 관리: https://sajangpick.co.kr/AI-Review.html?demo=true
- 레시피 관리: https://sajangpick.co.kr/recipe-manager.html?demo=true
- 뉴스 게시판: https://sajangpick.co.kr/news-board.html?demo=true
- 정책 지원금: https://sajangpick.co.kr/policy-support.html?demo=true

[주의사항]
- 데모 모드에서는 실제 기능이 작동하지 않습니다 (UI만 확인 가능)
- 페이지 상단에 데모 모드 배너가 표시됩니다
- 결제 버튼 등은 비활성화되어 있으나, UI는 실제와 동일합니다
- 카카오페이 결제 방법이 결제 방법 선택 UI에 포함되어 있습니다

[기술적 설명]
본 서비스는 카카오 로그인만 지원하는 구조로, 보안상의 이유로 
로그인 없이는 일반적으로 페이지에 접근할 수 없습니다.
심사 편의를 위해 ?demo=true 파라미터를 추가하여 전역 데모 모드를 
제공했습니다. 한 번 데모 모드를 활성화하면 사이트 전체에서 
자동으로 유지됩니다.

감사합니다.
```

---

## 🔒 보안 고려사항

1. **데모 모드 제한**
   - `?demo=true` 파라미터가 있을 때만 로그인 우회
   - 데모 모드에서는 실제 API 호출 불가
   - 관리자 페이지는 데모 모드에서도 접근 제한

2. **프로덕션 환경**
   - 일반 사용자는 `?demo=true` 없이 접근 시 로그인 필수
   - 데모 모드는 심사용으로만 사용 권장

---

## 📝 변경 이력

- **2025-11-25**: 전역 데모 모드 기능 추가
  - `assets/demo-mode.js` 생성 (전역 데모 모드 시스템)
  - `assets/auth-state.js` 수정 (데모 모드 지원)
  - `assets/auth-guard.js` 수정 (데모 모드에서 로그인 체크 우회)
  - `index.html`에 데모 모드 스크립트 추가

---

## 🆘 문제 해결

### 데모 모드가 작동하지 않는 경우

1. **브라우저 캐시 삭제** (Ctrl + Shift + Delete)
2. **시크릿 모드에서 접속** 시도
3. **URL에 `?demo=true` 정확히 입력** 확인

### 데모 모드를 종료하고 싶은 경우

1. 페이지 상단 배너의 "데모 모드 종료" 버튼 클릭
2. 또는 브라우저 개발자 도구(F12) → Application → Local Storage → `demo_mode` 삭제

---

**작성일**: 2025년 11월 25일  
**관련 문서**: 
- `docs/카카오페이_심사용_테스트URL.md` (결제 페이지 전용)
- `카카오페이_테스트URL_배포가이드.md` (배포 방법)

