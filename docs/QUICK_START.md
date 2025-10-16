# 🚀 빠른 시작 가이드 (새 AI 필독)

> **⏱️ 3분 안에 읽기** - 이 프로젝트에서 작업하기 전 꼭 알아야 할 핵심 정보

---

## 📌 현재 프로젝트 상태 (2025-10-16)

### 아키텍처

- **프론트엔드**: Vercel (정적 HTML 배포)
- **백엔드**: Render Express 서버 (`https://naver-keyword-tool.onrender.com`)
- **API 프록시**: `vercel.json`으로 `/api/*` 요청을 Render로 전달
- **인증**: Kakao OAuth → Vercel Functions 이전 완료 ✅

### 최근 완료된 중요 작업

1. ✅ **naver-keyword-tool 폴더 삭제** (서브모듈 정리)

   - vercel.json에 Render 프록시 URL 유지 중
   - 현재 코드는 정상 작동 (Render 서버가 계속 운영 중)

2. ✅ **Kakao 로그인 Vercel 이전** 완료

   - `/auth/*` 경로는 이제 Vercel Functions 사용
   - Render 의존도 감소

3. ✅ **로그인 상태 확인 로직 개선** (모든 HTML 페이지)

---

## ⚠️ 작업 시 주의사항

### 반드시 지켜야 할 것

1. **환경변수 확인 필수**

   - Vercel: KAKAO\_\*, JWT_SECRET, AI API 키들
   - Render: NAVER*API*_, OPENAI\__, GEMINI*\*, CLAUDE*\*

2. **배포 프로세스**

   - HTML/정적 파일 변경: `git push` → Vercel 자동 배포
   - Vercel Functions 추가/변경: `pnpm dlx vercel deploy --prod`
   - Render는 자동 배포 (git push 시)

3. **작업 후 반드시 기록**
   - `docs/AI_LOG.md`에 변경사항 상세 기록
   - 날짜, 배경, 변경 파일, 확인 방법 포함

### 하지 말아야 할 것

1. ❌ vercel.json 프록시 함부로 수정 (API 끊김)
2. ❌ 환경변수 없이 API 함수 배포 (500 에러)
3. ❌ 모바일 헤더 레이아웃 가이드 무시 (≤768px)
4. ❌ AI_LOG.md 업데이트 누락 (다음 AI가 혼란)

---

## 🎯 진행 중인 계획

### Render → Vercel Functions 완전 이관 (단계적)

- **Phase 1**: 인증 ✅ 완료
- **Phase 2**: 읽기 API (keywords, search/local) - 예정
- **Phase 3**: 쓰기 API (chat, generate-blog, analyze-review) - 예정
- **Phase 4**: 정적 페이지 Next.js 전환 - 장기

자세한 내용: `docs/PROJECT_PLAN.md` 참고

---

## 📂 주요 파일 구조

```
sajangpick_osm/
├── index.html              # 메인 허브
├── ChatGPT.html           # AI 채팅
├── Blog-Editor.html       # 블로그 생성
├── AI-Review.html         # 리뷰 분석
├── rank-report.html       # 순위 리포트
├── naver_search.html      # 키워드 검색
├── place-check.html       # 플레이스 점검
├── api/                   # Vercel Functions
│   ├── auth/              # 인증 (Kakao OAuth)
│   ├── compute-rank.js    # 순위 계산
│   └── rank-list-crawl.js # 순위 크롤링
├── server.js              # Render Express 서버 (아직 사용 중)
├── vercel.json            # Vercel 설정 (프록시 포함)
└── docs/
    ├── AI_LOG.md          # 상세 작업 이력
    ├── PROJECT_PLAN.md    # 전체 계획
    └── QUICK_START.md     # 이 문서
```

---

## 🔗 다음 단계

1. **지금 바로**: `docs/AI_LOG.md` 최신 3개 항목 읽기
2. **필요시**: `docs/PROJECT_PLAN.md`로 전체 맥락 파악
3. **작업 후**: `docs/AI_LOG.md`에 기록 추가

---

## 💬 자주 묻는 질문

**Q: API 호출이 느려요**
A: Render 콜드 스타트 문제. Vercel Functions로 이관 진행 중.

**Q: 로그인이 안 돼요**
A: Vercel 환경변수 확인 (KAKAO_REST_API_KEY, JWT_SECRET)

**Q: 배포 후 변경사항이 안 보여요**
A: 브라우저 캐시. URL에 `?v=20251016` 같은 버전 쿼리 추가.

**Q: Render 서버 건드려도 되나요?**
A: 조심해서! 아직 메인 API가 여기 있어요. 이관 계획 확인 후 작업.

---

**마지막 업데이트**: 2025-10-16  
**문서 관리**: 프로젝트 상태 변경 시 이 문서도 업데이트
