# 사장픽 프론트엔드 (Vercel)

## ⚠️ 새로운 AI/기여자는 반드시 먼저 읽어주세요!

### 🚀 처음이라면 여기서 시작!

**[👉 docs/QUICK_START.md](docs/QUICK_START.md)** ← 3분 안에 핵심 파악!

### 📚 추가 문서 (필요시)

1. 🎯 **[docs/BEGINNER_DEPLOY_GUIDE.md](docs/BEGINNER_DEPLOY_GUIDE.md)** ⭐ **비개발자용!**
   - 클릭만으로 배포하는 완전 초보 가이드
   - 코딩 몰라도 따라할 수 있어요!
   
2. 🚀 **[docs/VERCEL_배포가이드.md](docs/VERCEL_배포가이드.md)**
   - Vercel 배포 완벽 가이드
   - 환경변수 설정 방법
   - 도메인 연결 및 문제 해결

3. 📋 **[docs/AI_LOG.md](docs/AI_LOG.md)**
   - 상세한 작업 이력 (최신 TOP 3 요약 포함)
   - 모든 변경사항 기록

4. 📝 **[docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md)**
   - 전체 프로젝트 계획 및 향후 전환 계획
   - 단계별 실행 가이드 및 롤백 방법

5. 📄 **[docs/env.example.md](docs/env.example.md)**
   - 환경변수 설정 가이드
   
6. ⚙️ **[docs/환경변수_템플릿.env](docs/환경변수_템플릿.env)**
   - Vercel 배포용 환경변수 템플릿

---

### 📖 읽는 순서 추천

```
처음이라면:       QUICK_START.md (3분)
├─ 빠른 파악:     AI_LOG.md의 "최신 TOP 3" (1분)
├─ 상세 확인:     AI_LOG.md 전체 (필요시)
└─ 전체 계획:     PROJECT_PLAN.md (필요시)
```

> ⚡ **중요**: 모든 작업 후에는 반드시 `docs/AI_LOG.md`에 변경사항을 기록해주세요!

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
   - 👉 **[docs/VERCEL_배포가이드.md](docs/VERCEL_배포가이드.md)** 참고
   - Vercel 계정 연동
   - 환경변수 설정 필수!

### 📝 배포 체크리스트

- ✅ GitHub에 코드 푸시 완료
- ✅ Vercel 프로젝트 연결
- ✅ 환경변수 설정 ([템플릿](docs/환경변수_템플릿.env) 참고)
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
