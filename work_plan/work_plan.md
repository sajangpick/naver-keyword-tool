# 자동 리뷰 관리 시스템 구현 계획 (Review Automation System Implementation Plan)

이 문서는 네이버 플레이스, 요기요, 배달의민족, 쿠팡이츠의 리뷰를 연동하고 AI로 답글을 생성하여 게시하는 기능을 구현하기 위한 계획입니다. 기존 프로젝트의 스타일과 구조를 유지하며 중복을 방지합니다.

## 1. 개요 (Overview)
*   **목표**: 외부 플랫폼(네이버, 배민, 요기요, 쿠팡) 로그인 연동, 리뷰 수집, AI 답글 생성, 답글 게시 기능 구현.
*   **대상 페이지**: 
    *   `mypage.html`, `ai-review-automation.html`: 연동 상태 관리 및 리뷰 관리 UI.
    *   `platform-callback.html`: 플랫폼별 로그인(계정 연동) 처리.
*   **핵심 기능**:
    1.  **플랫폼 연동**: 사용자의 플랫폼 아이디/비밀번호를 안전하게 저장.
    2.  **리뷰 수집**: 연동된 계정으로 리뷰 데이터를 크롤링/조회.
    3.  **AI 답글 생성**: 수집된 리뷰에 대해 AI가 적절한 답글 생성.
    4.  **답글 게시**: 사용자가 승인한 답글을 플랫폼에 자동 게시.

---

## 2. 기존 분석 및 파일 구조 (Analysis)
현재 프론트엔드 페이지(`platform-callback.html`, `ai-review-automation.html`)는 틀이 잡혀 있으나, 실제 백엔드 로직과의 연결 및 연동 트리거 UI가 부족함.

### 수정/생성 파일 목록

#### Front-End
*   **`mypage.html` / `ai-review-automation.html` (수정)**
    *   [UI] 각 플랫폼별 '연동하기' 버튼 추가 (연동 안 된 경우).
    *   [UI] 연동된 경우 '연동 해제' 또는 '재연동' 상태 표시.
*   **`platform-callback.html` (기존 활용)**
    *   현재 UI 훌륭함. `/api/platform/connect` 형태의 API와 통신하도록 로직 점검.

#### Back-End (`api/` 폴더)
*   **`api/platform-auth.js` (신규)**
    *   플랫폼별 로그인 정보 암호화 저장 및 검증.
    *   DB 테이블: `platform_connections` (user_id, platform, encrypted_credentials 등).
*   **`api/review-crawler.js` (신규/통합)**
    *   각 플랫폼별 크롤링/API 로직 구현.
    *   네이버: 스마트플레이스 리뷰 조회.
    *   배민/요기요/쿠팡: 사장님 사이트 리뷰 조회.
*   **`api/ai-reply.js` (신규)**
    *   OpenAI 또는 기존 AI 모델을 활용한 답글 생성 프롬프트 및 API.
*   **`api/review-poster.js` (신규)**
    *   답글 게시 로직 (Puppeteer 또는 HTTP Request 활용).

---

## 3. 상세 구현 단계 (Implementation Steps)

### Step 1: 데이터베이스 설계 및 플랫폼 연동 (Platform Connection)
가장 먼저 플랫폼 로그인을 처리하고 정보를 저장해야 함.

1.  **DB 테이블 확인/생성**: `platform_connections` 테이블이 있는지 확인하고 없으면 생성 SQL 작성.
2.  **API 구현 (`api/platform-auth.js`)**:
    *   `POST /api/naver/connect`: 네이버 아이디/비번 저장 및 검증.
    *   `POST /api/baemin/connect`: 배민 아이디/비번 저장 및 검증.
    *   (요기요, 쿠팡이츠 동일 적용)
3.  **프론트엔드 연동**:
    *   `mypage.html` 내 플랫폼 연결 상태 표시 섹션 추가.
    *   `platform-callback.html`에서 입력받은 정보를 위 API로 전송.

### Step 2: 리뷰 데이터 수집 (Review Aggregation)
연동된 정보를 바탕으로 리뷰를 가져와 화면에 보여줌.

1.  **API 구현 (`api/review-crawler.js`)**:
    *   `GET /api/reviews/fetch?platform=naver`: 실시간 또는 캐시된 리뷰 조회.
    *   크롤링 라이브러리(Puppeteer/Cheerio) 활용하여 비공식 API 또는 페이지 파싱.
2.  **UI 연동 (`ai-review-automation.html`)**:
    *   리뷰 리스트 렌더링 (작성자, 별점, 내용, 날짜).
    *   "답글 생성" 버튼 활성화.

### Step 3: AI 답글 생성 (AI Reply Generation)
리뷰 내용을 바탕으로 AI가 답글을 제안함.

1.  **API 구현 (`api/ai-reply.js`)**:
    *   `POST /api/ai/generate-reply`: 리뷰 텍스트, 별점, 가게 분위기(톤앤매너)를 입력받아 답글 생성.
    *   프로젝트 내 기존 AI 설정(톤앤매너)을 반영.
    *   **AI 프롬프트 규칙 (필수)**:
        1.  사장님 말투로 작성할 것.
        2.  리뷰에 언급된 핵심 포인트 1~2가지를 반드시 언급할 것.
        3.  과도한 사과 표현은 사용하지 말 것.
        4.  책임을 인정하거나 보상, 환불을 암시하는 표현은 사용하지 말 것.
        5.  감정적인 표현, 이모지는 사용하지 말 것.
        6.  길이는 2~3문장으로 간결하게 작성할 것.
        7.  마지막 문장은 다시 방문을 유도하는 문장으로 마무리할 것.
        8.  반드시 “저희 가게를 이용해주셔서 감사합니다” 또는 의미가 동일한 감사 문구를 포함할 것.
2.  **UI 연동**:
    *   리뷰 카드 내 "AI 답글 생성" 클릭 시 로딩 후 텍스트 에어리어에 답글 채워넣기.

### Step 4: 답글 게시 (Reply Posting)
생성된 답글을 실제 플랫폼에 등록함.

1.  **API 구현 (`api/review-poster.js`)**:
    *   `POST /api/reviews/reply`: 플랫폼, 리뷰ID, 답글 내용을 받아 게시.
2.  **UI 연동**:
    *   "답글 달기" 버튼 클릭 시 API 호출 및 성공 시 "게시 완료" 상태로 변경.

---

## 4. 스타일 가이드 (Style Guide)
*   **Color API**:
    *   Accent: `#ff7b54` (주황색 계열)
    *   Secondary: `#ffe8d9`
    *   Text: `#201a17` (Dark), `#7a6a60` (Gray)
*   **Components**: 기존 `header`, `sidebar`, `card` 스타일 클래스 재사용.
*   **Framework**: Vanilla JS + Node.js Express (기존 스택 유지).

## 5. 예상 파일 구조
```
/
├── mypage.html (수정: 연동 버튼 추가)
├── ai-review-automation.html (수정: 리뷰 관리 로직 추가)
├── api/
│   ├── platform-auth.js (신규: 인증 핸들러)
│   ├── review-crawler.js (신규: 리뷰 수집)
│   ├── ai-reply.js (신규: 답글 생성)
│   └── review-poster.js (신규: 답글 게시)
└── database/
    └── create_platform_tables.sql (신규: 테이블 생성문)
```
