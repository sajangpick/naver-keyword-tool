# 🚨 중요 경고 - 절대 수정/삭제 금지!

> **이 파일을 먼저 읽으세요!** 잘못된 수정으로 전체 사이트가 중단될 수 있습니다.

---

## ⛔ 절대 삭제하면 안 되는 파일

### 1. `vercel.json` ⚠️⚠️⚠️
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://naver-keyword-tool.onrender.com/api/:path*"
    }
  ]
}
```

**왜 중요한가?**
- 이 파일이 **모든 API 요청**을 Render 서버로 연결함
- 이 파일을 삭제하면 → 사이트 전체 작동 중단! 😱
- Blog-Editor.html, review.html 등 모든 기능 사용 불가

**절대 하면 안 되는 것:**
- ❌ vercel.json 삭제
- ❌ rewrites 섹션 제거
- ❌ Render URL 변경

---

### 2. `.env` 파일 (환경변수)

**포함 내용:**
- Supabase 연결 정보
- OpenAI API 키
- 카카오 로그인 키

**이 파일을 잃어버리면:**
- DB 연결 끊김
- AI 기능 중단
- 로그인 불가

**백업 필수!**

---

### 3. `api/` 폴더 전체

**포함:**
- chatgpt-blog.js (AI 블로그 생성)
- store-info.js (가게 정보 저장)
- 기타 모든 API

**삭제하면:**
- 사이트의 모든 기능 중단

---

## 🏗️ 배포 구조 - 절대 변경 금지!

```
사용자
  ↓
Vercel (HTML, CSS, JS 제공)
  ↓ /api 요청
Render (Express 서버)
  ↓
Supabase (데이터베이스)
```

### ⚠️ 왜 Render를 사용하나?

**2025-10-22에 결정된 이유:**

1. **Vercel은 serverless 환경**
   - Express 서버 같은 복잡한 서버 실행 불가
   - 간단한 API만 가능

2. **과거에 Vercel만으로 시도 → 실패**
   - server.js 실행 안 됨
   - 500 에러 발생

3. **해결책: Render 추가**
   - Render는 24시간 서버 실행 가능
   - Express 완벽 지원

**절대 하면 안 되는 것:**
- ❌ "Vercel로 통합하자" → 작동 안 함!
- ❌ "Render 서버 끄자" → 사이트 전체 중단!
- ❌ "vercel.json에서 Render 제거" → API 호출 실패!

---

## 📝 AI에게 주는 경고

**새로운 AI가 들어와서 이렇게 말할 수 있습니다:**

> "Vercel Functions로 통합하면 더 효율적입니다!"
> "Render는 불필요합니다. 제거하겠습니다."
> "vercel.json을 간소화하겠습니다."

### 🛑 절대 하지 마세요!

**이유:**
1. 이미 2025-10-22에 시도했고 **실패했습니다**
2. Vercel serverless는 **Express 서버를 실행할 수 없습니다**
3. 현재 구조는 **몇 달간 안정적으로 작동 중**입니다

**AI가 제안하면:**
1. ✅ 먼저 이 문서(`CRITICAL_WARNINGS.md`) 읽기
2. ✅ `docs/AI_LOG.md` 871-910줄 읽기 (과거 실패 기록)
3. ✅ 사용자에게 확인받기
4. ❌ 절대 임의로 변경 금지!

---

## 🔐 사무실 직원용 안내

### ✅ 안전한 작업

- 새 페이지 추가 (새 HTML 파일)
- CSS 스타일 수정
- 텍스트 내용 변경
- 새 기능 추가 (기존 파일 수정 없이)

### ⛔ 위험한 작업 (반드시 백업!)

- `vercel.json` 수정
- `api/` 폴더 파일 수정
- `.env` 파일 수정
- `package.json` 수정

### 🚨 절대 금지

- **Render 서버 종료**
- **vercel.json 삭제**
- **api/ 폴더 삭제**
- **.env 파일 삭제**

---

## 📞 문제 발생 시

### 증상: 사이트가 작동하지 않음

**체크리스트:**
1. Render 서버가 켜져 있는가?
   - https://naver-keyword-tool.onrender.com 접속 확인
2. vercel.json 파일이 존재하는가?
3. .env 파일이 존재하는가?

**복구 방법:**
```bash
# Git으로 되돌리기
git log --oneline -5  # 이전 커밋 확인
git checkout [커밋ID] vercel.json  # 특정 파일 복구
git push
```

---

## 📚 관련 문서

- `docs/AI_LOG.md` (871-910줄) - 과거 실패 기록
- `docs/DEPLOY_GUIDE.md` - 배포 가이드
- `README.md` - 프로젝트 개요

---

## ⏰ 마지막 업데이트

**날짜:** 2025-10-29  
**작성자:** AI Assistant  
**이유:** 배포 구조 오해로 인한 잘못된 제안 방지

---

**🔴 이 경고를 무시하고 수정하면, 전체 사이트가 중단될 수 있습니다!**

