# 사장픽 프론트엔드 (Vercel)

---

## 🚨 **새 AI 필수 체크리스트** (작업 전 반드시 확인!)

**아래 항목을 확인하지 않고 작업하면 안 됩니다!**

- [ ] ✅ **1단계**: `@docs/AI_START_HERE.md` 읽었나요? (30초)
- [ ] ✅ **2단계**: 현재 프로젝트 상태 파악했나요?
  - 기술 스택: Express.js + Supabase + Vercel
  - 주요 기능: 네이버 플레이스 크롤링, 카카오 로그인
  - 환경변수: SUPABASE_URL, SUPABASE_ANON_KEY 등
- [ ] ✅ **3단계**: 사용자 요청 내용 이해했나요?
- [ ] ✅ **4단계**: 필요한 정보 검색했나요? (grep 활용)

**위 체크리스트를 완료하지 않으면 작업을 시작하지 마세요!**

---

> 🤖 **AI 작업 시작 전 필독**: `@docs/AI_START_HERE.md` (30초, 메모리 효율)

## 📚 문서 구조

### 🚀 새 AI 필독 (순서대로!)
1. **[docs/AI_START_HERE.md](docs/AI_START_HERE.md)** ⚡ **30초, 프로젝트 핵심 정보**
2. **[docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md)** ⚡ **1분, 작업 순서 필수!**
3. **사용자에게 확인 보고** ← 이거 안 하면 작업 금지!

### 📋 작업별 가이드 (필요시 검색)
- **[docs/DEPLOY_GUIDE.md](docs/DEPLOY_GUIDE.md)** - Vercel 배포
- **[docs/KAKAO_LOGIN_GUIDE.md](docs/KAKAO_LOGIN_GUIDE.md)** - 카카오 로그인 (Supabase)
- **[docs/CRAWLING_GUIDE.md](docs/CRAWLING_GUIDE.md)** - 네이버 플레이스 크롤링 (Python)

### 📖 참고 문서
- **[docs/AI_LOG.md](docs/AI_LOG.md)** - 작업 이력 (완료 후 기록용)
- **[docs/env.example.md](docs/env.example.md)** - 환경변수
- **[docs/archive/](docs/archive/)** - 구식 문서

---

## ⚡ AI 작업 원칙

```
✅ 해야 할 것:
- AI_START_HERE.md만 읽고 시작 (30초)
- 필요한 정보는 grep/검색으로 찾기
- 작업 완료 후 AI_LOG.md에 간단히 기록

❌ 하지 말 것:
- AI_LOG.md 전체 읽기 (1200줄, 메모리 낭비!)
- 모든 가이드 문서 미리 읽기
- 작업 전 과도한 컨텍스트 로드
```

> 💡 **효율성**: 필요한 정보만 검색 → 메모리 절약 → 작업 성능 향상!

## ⚡ 빠른 배포 가이드

### 🌐 Vercel 배포 (프로덕션)

1. **GitHub 연동 배포** (추천 ⭐)
   ```bash
   git push origin main
   # → Vercel이 자동으로 감지하고 배포!
   ```

2. **수동 배포** (CLI 사용)
   ```bash
   pnpm dlx vercel deploy --prod
   ```

3. **처음 배포하는 경우**
   - 👉 **[docs/DEPLOY_GUIDE.md](docs/DEPLOY_GUIDE.md)** 참고
   - Vercel 계정 연동
   - 환경변수 설정 필수!

### 📝 배포 체크리스트

- ✅ GitHub에 코드 푸시 완료
- ✅ Vercel 프로젝트 연결
- ✅ 환경변수 설정 ([템플릿](docs/env.example.md) 참고)
- ✅ 배포 후 "실시간 목록 수집" 기능 테스트

---

## 🏗️ 아키텍처

- **정적 배포**: Vercel (Framework: Other, Build/Output 비움)
- **API**: 
  - 기본: Render → 프록시(`vercel.json`)로 연결
  - 크롤링: Vercel Functions (`api/rank-list-crawl.js`)
  - 점진적으로 Vercel Functions로 전체 이전 예정

## 반드시 지켜주세요

1. 모든 변경은 `docs/AI_LOG.md`에 기록 (새 AI/기여자도 해당 문서부터 읽기)
2. 모바일(≤768px) 헤더 레이아웃 가이드 준수
3. 캐시 이슈 시 URL에 `?v=YYYYMMDD` 쿼리 추가로 확인

## 디렉터리

- 루트: 정적 HTML들(`index.html`, `ChatGPT.html`, …)
- `docs/`: 운영 문서 및 작업 로그

## 문의

- 배포 오류는 Vercel Dashboard → Deployments → Build/Runtime Logs 확인
