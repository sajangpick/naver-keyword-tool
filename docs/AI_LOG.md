# AI 작업 로그 (반드시 먼저 읽기)

이 문서는 이 저장소에서 작업하는 모든 사람/AI가 반드시 먼저 읽고 업데이트해야 하는 변경 이력입니다. 작은 수정이라도 여기 항목을 추가하세요. (커밋 직전 체크리스트는 아래에 있습니다.)

---

## 2025-10-14 - 모바일 헤더 겹침 전면 수정 + 배포 플로우 정리

- 배경: 모바일에서 상단 로고/로그인/탭이 겹치는 이슈 발생(여러 페이지). 작은 화면에서 클릭 시 겹침.
- 변경 파일
  - `ChatGPT.html`: 모바일에서 `.top-nav` 세로 스택, `.user-actions` absolute 해제, 버튼 줄바꿈 허용
  - `Blog-Editor.html`: 동일 규칙 적용
  - `naver_search.html`: 동일 규칙 적용
  - `place-check.html`: 동일 규칙 적용
  - `index.html`: 기존에 적용된 모바일 가로 스크롤(상단 앱 1줄, 5개 노출) 유지
- 핵심 CSS 규칙(모바일, ≤768px)
  - `.top-nav { flex-direction: column; gap: 8~15px }`
  - `.user-actions { position: static; width: 100%; justify-content: center; flex-wrap: wrap }`
  - 필요 시 버튼 패딩/폰트 축소로 오버플로 방지
- 확인 방법
  1. 각 페이지를 휴대폰 또는 DevTools(≤768px)로 열기
  2. 상단 로고/로그인/마이페이지와 메뉴 탭이 겹치지 않고 위→아래 순서로 정렬되는지 확인
  3. 캐시 무시: URL 뒤에 `?v=YYYYMMDD` 쿼리 추가
- 배포(Vercel)
  - 깃 연동이면: `git add . && git commit -m "fix(mobile): 헤더 겹침 해결" && git push`
  - CLI 즉시 배포: `pnpm dlx vercel deploy --prod`
- 주의/참고
  - 상단 기능 아이콘(메인 `index.html`)은 모바일에서 1줄 고정 + 가로 스크롤, 5개 노출
  - API는 Render로 프록시: `vercel.json`의 rewrites 참고

---

## 2025-10-13 - 상단 기능 아이콘(모바일) 1줄 스크롤 적용

- 배경: 모바일에서 상단 기능 아이콘(채팅/리뷰작성/블로그/키워드/플점검)이 2줄로 보임 → 1줄에 5개 보이고 넘치면 가로 스크롤
- 변경 파일: `index.html`
- 주요 변경점
  - `.top-actions-row .top-apps`를 가로 스크롤 가능 플렉스로 전환
  - 아이템 폭 고정: `flex: 0 0 calc((100% - 48px) / 5)`
  - 스크롤 스냅 + 스크롤바 숨김
- 확인/배포: 위와 동일

---

## 운영/구조 메모

- 정적 웹: Vercel (Framework: Other, Build/Output 비움)
- API: Render로 운영, 프론트에서 `vercel.json`으로 `/api`/`/auth` 프록시
- 백엔드 베이스 URL(프론트): `https://naver-keyword-tool.onrender.com`
- 캐시 무효화: 정적 리소스 변경 시 쿼리 버전(`?v=날짜`) 권장

---

## 커밋 직전 체크리스트(의무)

- [ ] 이 파일에 이번 변경 항목을 추가했나요?
- [ ] 변경/테스트 방법을 한 줄이라도 남겼나요?
- [ ] 배포 방식(깃 푸시 또는 Vercel CLI)을 기록했나요?

---

## 새 항목 추가 템플릿 (복사해서 사용)

### YYYY-MM-DD - 간단 제목

- 배경: 한 줄 설명
- 변경 파일: `path/to/file1`, `path/to/file2`
- 주요 변경점:
  - 변경 1
  - 변경 2
- 확인 방법:
  1. 단계1
  2. 기대 결과
- 배포: Git 푸시 또는 `pnpm dlx vercel deploy --prod`
- 주의/롤백: 위험 요소/롤백 방법(필요 시 Vercel Instant Rollback)
- 후속 작업: 다음 해야 할 일
