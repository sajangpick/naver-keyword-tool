# 🤖 새로운 AI 시작 가이드 (30초)

> ⚠️ **경고**: 이 문서를 읽지 않고 작업하면 안 됩니다!  
> **사용자에게 먼저 확인**: "AI_START_HERE.md를 확인했습니다. 작업을 시작하겠습니다." 라고 말하세요!

---

## 🚨 먼저 읽어야 할 중요 문서!

**배포 구조 변경을 제안하기 전에:**

👉 **[CRITICAL_WARNINGS.md](../CRITICAL_WARNINGS.md)** 필독! (2분)  
👉 **[docs/DEPLOY_ARCHITECTURE.md](./DEPLOY_ARCHITECTURE.md)** 필독! (3분)

**절대 제안하면 안 되는 것:**
- ❌ "Vercel Functions로 통합하자" → 이미 실패함 (2025-10-22)
- ❌ "Render 제거하자" → 사이트 전체 중단
- ❌ "vercel.json 간소화" → API 호출 실패

**현재 배포 구조는 변경 금지입니다!**

---

## ✅ 작업 전 체크리스트 (필수!)

**다음 항목을 모두 확인한 후 사용자에게 보고하세요:**

1. [ ] 이 문서(AI_START_HERE.md)를 완전히 읽었습니다
2. [ ] 프로젝트 기술 스택을 이해했습니다 (Express.js + Supabase + Vercel)
3. [ ] 주요 기능을 파악했습니다 (크롤링, 카카오 로그인)
4. [ ] 환경변수 위치를 알고 있습니다 (.env 파일)
5. [ ] 사용자 요청 내용을 정확히 이해했습니다

**사용자에게 보고 예시**:
```
✅ AI_START_HERE.md를 확인했습니다.
✅ 프로젝트 구조를 파악했습니다 (Express + Supabase + Vercel).
✅ 요청하신 [작업 내용]을 이해했습니다.

이제 작업을 시작하겠습니다. 필요한 정보는 검색으로 찾겠습니다.
```

---

## 📌 핵심 프로젝트 정보 (필독)

- **프로젝트**: 사장픽 (네이버 플레이스 순위 분석 도구)
- **기술**: Express.js + Supabase + Vercel
- **주요 기능**: 네이버 플레이스 크롤링, 순위 분석, 카카오 로그인

---

## 🎯 작업 시작 방법 (순서 준수!)

### ⚠️ 반드시 이 순서를 따르세요:

```
1️⃣ 이 문서를 끝까지 읽기 (30초)

2️⃣ 사용자에게 확인 보고:
   "✅ AI_START_HERE.md를 확인했습니다.
    ✅ 프로젝트 구조를 파악했습니다.
    ✅ [요청 내용]을 이해했습니다.
    이제 작업을 시작하겠습니다."

3️⃣ 필요한 정보만 검색:
   - 배포? → grep "배포" docs/DEPLOY_GUIDE.md
   - 카카오? → grep "카카오" docs/KAKAO_LOGIN_GUIDE.md
   - 크롤링? → grep "크롤링" docs/CRAWLING_GUIDE.md

4️⃣ 작업 시작!

5️⃣ 작업 완료 후 AI_LOG.md에 간단히 기록
```

### 🚫 절대 하지 말 것

- ❌ 이 문서를 읽지 않고 작업 시작
- ❌ 사용자에게 확인 없이 바로 작업
- ❌ 프로젝트 구조 파악 없이 코드 수정
- ❌ AI_LOG.md 전체 읽기 (메모리 낭비)

### 필요시 참조 문서 (검색으로 접근)

- `docs/DEPLOY_GUIDE.md` - 배포 관련
- `docs/KAKAO_LOGIN_GUIDE.md` - 카카오 로그인
- `docs/CRAWLING_GUIDE.md` - 크롤링
- `docs/AI_LOG.md` - 작업 이력 (완료 후 기록용)

---

## 🔑 핵심 환경변수

```bash
SUPABASE_URL=https://ptuzlubggggbgsophfcna.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
NAVER_CUSTOMER_ID=
NAVER_API_KEY=
NAVER_SECRET_KEY=
```

---

## ⚠️ 자주 발생하는 문제 (3가지만)

1. **포트 충돌**: `taskkill /IM node.exe /F`
2. **카카오 로그인 안됨**: Supabase URL/KEY 확인
3. **크롤링 0개**: Python Selenium 사용 (Puppeteer 안됨)

---

## ✅ 작업 완료 후

```
docs/AI_LOG.md → 작업 내용 간단히 기록 (10줄 이내)
docs/AI_QUICK_LOG.md → 중요한 변경사항만 업데이트
```

## 📁 로그 파일 구조 (2024.11.07 개편)

```
docs/
├── AI_QUICK_LOG.md      (최근 7일, 빠른 확인용)
├── AI_LOG.md            (최근 30일, 현재 작업 기록)
├── 10_보고_상황기록/     (월별 아카이브)
└── 11_과거_폐기자료/     (3개월 이상 된 기록)
```

---

## 🚫 하지 말 것

- ❌ AI_LOG.md 전체 읽기 (1200줄!)
- ❌ 모든 가이드 문서 읽기
- ❌ 작업 시작 전에 과도한 컨텍스트 로드

---

**원칙**: 필요한 정보만 검색하고, 바로 작업 시작! 🚀

