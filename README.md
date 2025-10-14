# 사장픽 프론트엔드 (Vercel)

작업 전 반드시 `docs/AI_LOG.md`를 먼저 읽고, 변경 후에는 로그를 업데이트하세요.

## 빠른 시작

- 정적 배포: Vercel (Framework: Other, Build/Output 비움)
- API: Render → 프록시(`vercel.json`)로 연결
- 로컬 변경 즉시 배포: `pnpm dlx vercel deploy --prod`
- 깃 자동 배포: `git push` (깃 연동 시)

## 반드시 지켜주세요

1. 모든 변경은 `docs/AI_LOG.md`에 기록
2. 모바일(≤768px) 헤더 레이아웃 가이드 준수
3. 캐시 이슈 시 URL에 `?v=YYYYMMDD` 쿼리 추가로 확인

## 디렉터리

- 루트: 정적 HTML들(`index.html`, `ChatGPT.html`, …)
- `docs/`: 운영 문서 및 작업 로그

## 문의

- 배포 오류는 Vercel Dashboard → Deployments → Build/Runtime Logs 확인
