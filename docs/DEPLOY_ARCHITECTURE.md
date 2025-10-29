# 🏗️ 배포 아키텍처 - 절대 변경 금지!

> **왜 이 문서가 필요한가?** AI가 "더 나은 구조"를 제안할 수 있지만, 이미 시도했고 실패했습니다.

---

## 📊 현재 배포 구조 (변경 금지!)

```
┌─────────────┐
│   사용자    │
└──────┬──────┘
       │
       │ HTML 요청
       ↓
┌─────────────────────────────┐
│  Vercel (정적 호스팅)       │
│  - index.html               │
│  - Blog-Editor.html         │
│  - CSS, JavaScript          │
└──────┬──────────────────────┘
       │
       │ /api/* 요청
       │ (vercel.json rewrites)
       ↓
┌─────────────────────────────┐
│  Render (Express 서버)      │
│  - server.js                │
│  - api/chatgpt-blog.js      │
│  - api/store-info.js        │
│  - 모든 API 로직            │
└──────┬──────────────────────┘
       │
       │ DB 쿼리
       ↓
┌─────────────────────────────┐
│  Supabase (PostgreSQL)      │
│  - profiles                 │
│  - blog_posts               │
│  - 모든 테이블              │
└─────────────────────────────┘
```

---

## ❓ 왜 이런 구조를 사용하나?

### Vercel만 사용하면 안 되나요?

**답: 안 됩니다. 이미 시도했고 실패했습니다. (2025-10-22)**

#### 시도했던 것:
1. ✅ Express 서버(server.js)를 Vercel에 배포
2. ❌ 결과: 500 Internal Server Error
3. ❌ 원인: Vercel은 serverless 환경

#### Vercel의 한계:

**Vercel Serverless Functions:**
- ✅ 간단한 API 가능 (예: `/api/hello.js`)
- ❌ Express 앱 전체 실행 불가
- ❌ `app.listen()` 불가
- ❌ 미들웨어 체인 복잡도 제한
- ❌ Long-running 프로세스 불가

**우리 프로젝트:**
- 🔴 Express 앱 전체 사용 중 (server.js)
- 🔴 복잡한 미들웨어 체인
- 🔴 ChatGPT API 호출 (시간 오래 걸림)
- 🔴 크롤링 작업 (시간 오래 걸림)

**결론: Vercel만으로는 불가능!**

---

## 🚨 AI가 자주 하는 잘못된 제안

### 제안 1: "Vercel Functions로 통합하자"

**왜 안 되나요?**

1. **이미 실패한 방법입니다** (2025-10-22)
   - `docs/AI_LOG.md` 823-829줄 참고

2. **Express 앱 전체를 쪼개야 함**
   - server.js → 각 API마다 별도 파일
   - 미들웨어 → 각 파일에 복사
   - 설정 → 각 파일에 복사
   - **최소 2주 작업**

3. **ChatGPT API 타임아웃**
   - Vercel Functions: 10초 제한 (Hobby)
   - ChatGPT 응답: 15-30초 걸림
   - **타임아웃 에러 발생!**

### 제안 2: "Render 제거하고 비용 절감"

**실제 비용:**
- Render 무료 플랜: $0/월 (현재 사용 중)
- Vercel 무료 플랜: $0/월
- **절감할 비용 없음!**

**Render 끄면:**
- 🔴 사이트 전체 중단
- 🔴 모든 API 호출 실패
- 🔴 복구에 2주 소요

### 제안 3: "더 효율적인 구조로 개선"

**현재 구조가 이미 효율적입니다:**
- ✅ 3개월간 안정 운영
- ✅ 에러 없음
- ✅ 성능 문제 없음
- ✅ 사용자 불편 없음

**변경하면:**
- 🔴 2주 개발 시간
- 🔴 테스트 필요
- 🔴 버그 위험
- 🔴 **얻는 것: 없음**

---

## 📋 vercel.json 설정 상세

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://naver-keyword-tool.onrender.com/api/:path*"
    },
    {
      "source": "/auth/:path*",
      "destination": "https://naver-keyword-tool.onrender.com/auth/:path*"
    }
  ]
}
```

**이게 하는 일:**
1. 사용자가 `/api/chatgpt-blog`를 호출
2. Vercel이 가로챔
3. `https://naver-keyword-tool.onrender.com/api/chatgpt-blog`로 프록시
4. Render 서버가 처리
5. 결과를 사용자에게 전달

**이 설정을 제거하면:**
- 🔴 Vercel이 `/api/chatgpt-blog` 파일을 찾음
- 🔴 파일 없음 (Render에 있음)
- 🔴 404 Not Found
- 🔴 **모든 API 호출 실패**

---

## 🔧 실제 요청 흐름 예시

### Blog-Editor.html에서 블로그 생성 요청

**1. 프론트엔드 (Blog-Editor.html)**
```javascript
const response = await fetch('/api/chatgpt-blog', {
  method: 'POST',
  body: JSON.stringify({ ... })
});
```

**2. Vercel (프록시)**
```
요청: /api/chatgpt-blog
↓
vercel.json rewrites 적용
↓
프록시: https://naver-keyword-tool.onrender.com/api/chatgpt-blog
```

**3. Render (처리)**
```javascript
// server.js
app.post('/api/chatgpt-blog', async (req, res) => {
  // OpenAI API 호출 (30초 소요)
  const blog = await chatgpt.generateBlog(req.body);
  res.json(blog);
});
```

**4. Supabase (저장)**
```sql
INSERT INTO blog_posts (...) VALUES (...);
```

**5. 응답**
```
Supabase → Render → Vercel → 사용자
```

---

## 🛡️ 보호 정책

### 절대 변경 금지 파일

1. **vercel.json**
   - 변경 시 → 사이트 중단
   - 승인 필요

2. **server.js**
   - 변경 시 → API 중단 가능
   - 로컬 테스트 필수

3. **api/ 폴더**
   - 변경 시 → 기능 중단
   - 백업 필수

### AI 제안 승인 프로세스

**AI가 배포 구조 변경을 제안하면:**

1. ✅ `CRITICAL_WARNINGS.md` 읽었나?
2. ✅ `docs/DEPLOY_ARCHITECTURE.md` (이 파일) 읽었나?
3. ✅ `docs/AI_LOG.md` 823-829줄 읽었나?
4. ✅ 사용자에게 확인받았나?

**모두 YES가 아니면 → 절대 진행 금지!**

---

## 📚 참고 문서

- `CRITICAL_WARNINGS.md` - 중요 경고
- `docs/AI_LOG.md` (871-910줄) - 과거 실패 기록
- `docs/DEPLOY_GUIDE.md` - 배포 방법

---

## 📊 의사결정 기록

| 날짜 | 결정 | 이유 |
|------|------|------|
| 2025-10-22 | Render 도입 | Vercel serverless 한계 |
| 2025-10-22 | Express 유지 | 전체 재작성 불필요 |
| 2025-10-29 | 구조 고정 | 안정성 > 효율성 |

---

## ⚠️ 최종 경고

**이 구조는 변경하지 마세요.**

- ✅ 현재 안정적으로 작동 중
- ✅ 사용자 만족
- ✅ 에러 없음
- ❌ 변경할 이유 없음

**"더 나은 구조"를 제안하기 전에:**
1. 현재 구조의 문제점이 명확한가?
2. 사용자가 불편을 느끼는가?
3. 성능 문제가 있는가?

**모두 NO라면 → 변경하지 마세요!**

---

**작성일:** 2025-10-29  
**작성자:** AI Assistant  
**목적:** 잘못된 배포 구조 변경 제안 방지

