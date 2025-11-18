# ChatGPT Function Calling 기능 가이드

## 📋 개요

ChatGPT 채팅 API에 Function Calling 기능을 추가하여 실제 데이터(뉴스, 레시피, 정책 지원금)를 검색하고 답변할 수 있도록 개선했습니다.

## ✨ 추가된 기능

### 1. 뉴스 검색
- 사용자가 뉴스 관련 질문을 하면 자동으로 `/api/news-search` API를 호출
- 최신 뉴스 정보를 가져와서 답변에 포함

**예시 질문:**
- "최근 소상공인 지원금에 대한 뉴스를 알려줘"
- "음식점 마케팅 트렌드 뉴스가 있나요?"
- "레스토랑 관련 최신 뉴스를 찾아줘"

### 2. 레시피 검색
- 레시피 관련 질문 시 `/api/recipes/search` API 호출
- 실제 레시피 데이터를 검색하여 상세 정보 제공

**예시 질문:**
- "김치찌개 레시피 알려줘"
- "파스타 만드는 방법"
- "초밥 레시피 추천해줘"

### 3. 정책 지원금 검색
- 정책 관련 질문 시 `/api/policy-support` API 호출
- 실제 정책 지원금 정보를 검색하여 답변

**예시 질문:**
- "창업 지원금 정책이 있나요?"
- "소상공인 지원금 정보 알려줘"
- "마케팅 지원 정책 찾아줘"

## 🔧 기술적 구현

### Function Calling 프로세스

1. 사용자 질문 수신
2. OpenAI API에 질문 전달 (tools 포함)
3. AI가 필요한 함수 호출 결정
4. 함수 실행 (실제 API 호출)
5. 함수 결과를 AI에 전달
6. 최종 답변 생성

### 최대 반복 횟수
- 함수 호출은 최대 3회까지 반복 가능
- 여러 함수를 동시에 호출할 수 있음

## 🧪 테스트 방법

### 방법 1: 테스트 HTML 파일 사용

1. `test-chat-function-calling.html` 파일을 브라우저에서 열기
2. 각 테스트 케이스의 "테스트 실행" 버튼 클릭
3. 결과 확인:
   - ✅ 성공: 함수 호출 횟수와 답변 확인
   - ❌ 오류: 오류 메시지 확인

### 방법 2: ChatGPT.html 페이지에서 직접 테스트

1. `ChatGPT.html` 페이지 열기
2. 다음 질문들을 입력하여 테스트:

#### 뉴스 검색 테스트
```
최근 소상공인 지원금에 대한 뉴스를 알려줘
```

#### 레시피 검색 테스트
```
김치찌개 레시피 알려줘
```

#### 정책 검색 테스트
```
창업 지원금 정책이 있나요?
```

#### 일반 대화 테스트 (함수 호출 불필요)
```
점심메뉴 추천해줘
```

## 🔍 배포 전 확인사항

### 1. 환경 변수 확인

다음 환경 변수들이 설정되어 있는지 확인하세요:

```bash
# 필수
OPENAI_API_KEY=your_openai_api_key

# 뉴스 검색을 위한 네이버 API 키 (선택)
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret

# Supabase (레시피, 정책 검색용)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

### 2. API 엔드포인트 확인

다음 API들이 정상 작동하는지 확인:

- `/api/news-search` - 뉴스 검색 API
- `/api/recipes/search` - 레시피 검색 API
- `/api/policy-support` - 정책 지원금 API

### 3. 로컬 테스트

로컬 환경에서 테스트:

```bash
# 서버 실행
pnpm install
node server.js

# 또는
npm run dev
```

브라우저에서 `http://localhost:3003/ChatGPT.html` 접속하여 테스트

### 4. Vercel 배포 시 확인

Vercel에 배포할 경우:

1. 환경 변수를 Vercel 대시보드에 설정
2. `vercel.json`에서 `/api/chat` 경로가 올바르게 설정되어 있는지 확인
3. 배포 후 `test-chat-function-calling.html`을 사용하여 테스트

## 🐛 문제 해결

### 문제: 함수가 호출되지 않음

**원인:**
- OpenAI API 키가 설정되지 않음
- 질문이 함수 호출이 필요하지 않은 일반 질문

**해결:**
- 환경 변수 확인
- 명확한 데이터 검색 질문 사용 (예: "뉴스 검색", "레시피 찾기")

### 문제: API 호출 실패

**원인:**
- 내부 API 엔드포인트가 작동하지 않음
- 네트워크 오류

**해결:**
- 각 API 엔드포인트를 개별적으로 테스트
- 서버 로그 확인

### 문제: Vercel에서 작동하지 않음

**원인:**
- Vercel 환경에서 내부 API 호출 URL 문제

**해결:**
- `VERCEL_URL` 환경 변수 확인
- 또는 `NEXT_PUBLIC_SITE_URL` 환경 변수 설정

## 📊 성능 최적화

- 함수 호출은 최대 3회까지 제한
- 각 API 호출 타임아웃: 30초
- 전체 요청 타임아웃: 45초

## 📝 참고사항

- 일반적인 대화는 함수 호출 없이 처리됩니다
- 함수 호출이 필요한 경우에만 자동으로 호출됩니다
- 함수 호출 횟수는 응답의 `metadata.function_calls_used`에서 확인할 수 있습니다

