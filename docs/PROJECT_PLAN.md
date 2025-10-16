# 사장픽 전환 계획(Plan) 및 롤백 가이드

본 문서는 Render → Vercel Functions 전환을 단계적으로 수행하기 위한 실행 계획과, 문제 발생 시 즉시 원복하는 방법을 정리합니다. 비개발자도 그대로 따라 할 수 있도록 단계를 작고 명확하게 구성했습니다.

## 목표

- 프론트와 API를 모두 Vercel로 통합하여 지연/복잡도 감소
- 무중단 단계적 이전, 문제 시 5분 내 롤백 가능

## 현재 상태(요약)

- 프론트: Vercel 정적 배포
- API: Render(Express) 운영, 프론트는 `/api/*` 호출을 `vercel.json`으로 Render에 프록시 또는 페이지 내 `BACKEND_URL` 하드코딩 호출

## 단계별 계획

### 단계 0. 준비 (필수)

1. Vercel 프로젝트 환경변수 등록
   - OPENAI_API_KEY, GEMINI_API_KEY, CLAUDE_API_KEY
   - NAVER_CUSTOMER_ID, NAVER_API_KEY, NAVER_SECRET_KEY
   - NAVER_SEARCH_CLIENT_ID, NAVER_SEARCH_CLIENT_SECRET
   - NAVER_DATALAB_CLIENT_ID, NAVER_DATALAB_CLIENT_SECRET
   - KAKAO_REST_API_KEY, KAKAO_REDIRECT_URI, KAKAO_CLIENT_SECRET(옵션)
   - JWT_SECRET (충분히 긴 임의 문자열)
2. 배포 권장 명령
   - `pnpm dlx vercel`
   - `pnpm dlx vercel deploy --prod`

### 단계 1. 빠른 체감 개선(채팅/답글)

범위: `/api/chat`, `/api/generate-reply`

- 실행: 동일 로직을 `api/chat.js`, `api/generate-reply.js`로 구현
- 프런트: 해당 화면의 `BACKEND_URL` 하드코딩 제거 → 상대경로(`/api/...`)
- 검증: 페이지에서 채팅/답글 정상 응답 확인

### 단계 2. 데이터 기능 이전

범위: `/api/keywords`, `/api/keyword-trend`, `/api/related-keywords`, `/api/search/local`

- 실행: 각 엔드포인트를 Vercel Functions로 이전
- 프런트: 호출을 상대경로로 전환
- 검증: 표/트렌드/검색이 정상 노출되는지 확인

### 단계 3. 정리

- `vercel.json`의 Render 프록시 제거
- `render.yaml`(루트, 하위) 삭제
- 문서/코드 내 `https://naver-keyword-tool.onrender.com` 문자열 제거

## 롤백 가이드(5분 내)

문제 발생 시 즉시 Render 경로로 복구합니다.

1. 프런트 호출을 원복
   - 상대경로(`/api/...`) → `https://naver-keyword-tool.onrender.com/api/...`
2. `vercel.json` 프록시를 되돌림
   - 기존 항목 유지 또는 복원:
     ```json
     {
       "version": 2,
       "framework": null,
       "rewrites": [
         {
           "source": "/api/:path((?!auth).*)*",
           "destination": "https://naver-keyword-tool.onrender.com/api/:path*"
         }
       ]
     }
     ```
3. 배포
   - `pnpm dlx vercel deploy --prod`

복구 후 API가 정상 동작하면, 원인 분석 뒤 재시도합니다(부분 단계로 재진행 권장).

## 체크리스트

- [ ] 단계 0: 환경변수 모두 입력 완료
- [ ] 단계 1: chat/reply 함수 동작, 프런트 상대경로화, 정상 응답 확인
- [ ] 단계 2: keywords/trend/related/local 이전 및 검증 완료
- [ ] 단계 3: Render 프록시/파일 제거, 문자열 정리, 링크 점검 완료

## 변경 기록

- 모든 변경은 `docs/AI_LOG.md`에 간단히 요약 기록합니다.
