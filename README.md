# 사장픽 프론트엔드 (Vercel)

## ⚠️ 새로운 AI/기여자는 반드시 먼저 읽어주세요!

### 🚀 처음이라면 여기서 시작!

**[👉 docs/QUICK_START.md](docs/QUICK_START.md)** ← 3분 안에 핵심 파악!

### 📚 추가 문서 (필요시)

1. 📋 **[docs/AI_LOG.md](docs/AI_LOG.md)**
   - 상세한 작업 이력 (최신 TOP 3 요약 포함)
   - 모든 변경사항 기록
2. 📝 **[docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md)**

   - 전체 프로젝트 계획 및 향후 전환 계획
   - 단계별 실행 가이드 및 롤백 방법

3. 📄 **[docs/env.example.md](docs/env.example.md)**
   - 환경변수 설정 가이드

---

### 📖 읽는 순서 추천

```
처음이라면:       QUICK_START.md (3분)
├─ 빠른 파악:     AI_LOG.md의 "최신 TOP 3" (1분)
├─ 상세 확인:     AI_LOG.md 전체 (필요시)
└─ 전체 계획:     PROJECT_PLAN.md (필요시)
```

> ⚡ **중요**: 모든 작업 후에는 반드시 `docs/AI_LOG.md`에 변경사항을 기록해주세요!

## 빠른 시작

- 정적 배포: Vercel (Framework: Other, Build/Output 비움)
- API: Render → 프록시(`vercel.json`)로 연결 (점진적으로 Vercel Functions로 이전 예정)
- 로컬 변경 즉시 배포: `pnpm dlx vercel deploy --prod`
- 깃 자동 배포: `git push` (깃 연동 시)

## 반드시 지켜주세요

1. 모든 변경은 `docs/AI_LOG.md`에 기록 (새 AI/기여자도 해당 문서부터 읽기)
2. 모바일(≤768px) 헤더 레이아웃 가이드 준수
3. 캐시 이슈 시 URL에 `?v=YYYYMMDD` 쿼리 추가로 확인

## 디렉터리

- 루트: 정적 HTML들(`index.html`, `ChatGPT.html`, …)
- `docs/`: 운영 문서 및 작업 로그

## 문의

- 배포 오류는 Vercel Dashboard → Deployments → Build/Runtime Logs 확인
