# 🤖 ChatGPT채팅 기능 가이드

> 최종 업데이트: 2025년 11월 17일  
> 기능명: ChatGPT채팅 (AI 비서)  
> 버전: v2.0 (메인 화면 통합)

---

## 📋 기능 개요

**ChatGPT채팅**은 OpenAI의 GPT-4를 활용한 실시간 AI 대화 기능입니다. 식당 운영, 마케팅, 비즈니스 상담을 모두 한 곳에서 해결할 수 있습니다.

### ✨ 핵심 기능

- 실시간 AI 대화
- **메인 화면에서 바로 질문 및 자동 답변** (v2.0 신규)
- 문맥 학습 (대화 이력 관리)
- 다양한 질문 지원
- 대화 저장 및 공유
- 토큰 사용량 추적
- **자동 연결 상태 감지** (v2.0 신규)

### 👥 대상 사용자

- 식당/카페 대표
- 마케팅 담당자
- 비즈니스 컨설턴팅 필요자

---

## 🆕 v2.0 업데이트 내용 (2025-11-17)

### 1. 메인 화면 통합 🚀

**이전**: 메인 → 질문 입력 → 엔터 → ChatGPT 페이지 이동 → **다시 전송 버튼 클릭** → 답변

**현재**: 메인 → 질문 입력 → 엔터 → ChatGPT 페이지 이동 → **자동으로 바로 답변!**

#### 구현 방식

```javascript
// index.html에서 localStorage에 질문 저장
localStorage.setItem("initialChatPrompt", userQuestion);
window.location.href = "/ChatGPT.html";

// ChatGPT.html에서 자동 전송
const saved = localStorage.getItem("initialChatPrompt");
if (saved) {
  messageInput.value = saved;
  localStorage.removeItem("initialChatPrompt");
  setTimeout(() => sendMessage(), 300); // 자동 전송!
}
```

### 2. 연결 상태 자동 감지 ✅

**이전**: 페이지 로드 시 "연결 실패"가 계속 표시됨 (실제로는 연결됨)

**현재**:

- 페이지 로드: "연결 확인 중..." (회색)
- 메시지 전송 성공 시: **"연결됨"** (초록색) 자동 변경
- 메시지 전송 실패 시: "연결 실패" (빨간색)

#### 구현 방식

```javascript
// 메시지 전송 성공 시 자동 업데이트
if (data.success && data.reply) {
  isConnected = true;
  statusDot.classList.remove("disconnected");
  statusText.textContent = "연결됨";
}
```

---

## 🛠 기술 스택

### 프론트엔드

- `index.html` - 메인 화면 AI 검색창 (v2.0)
- `ChatGPT.html` - 채팅 인터페이스
- localStorage - 페이지 간 데이터 전달 (v2.0)
- Fetch API - 실시간 통신
- 마크다운 렌더링

### 백엔드

- Express.js 서버
- OpenAI API (GPT-4)
- `/api/chat` 엔드포인트
- 토큰 카운팅

---

## 📁 파일 구조

```
프로젝트루트/
├── index.html (메인 화면 - AI 검색창 포함)
├── ChatGPT.html (채팅 인터페이스)
├── server.js (백엔드 라우팅)
├── api/
│   └── chat.js (대화 처리 API)
└── assets/
    ├── common-header.js
    └── auth-state.js
```

---

## 🔌 API 엔드포인트

### 1. 메시지 전송 (v2.0 업데이트)

**POST** `/api/chat`

#### 요청

```json
{
  "message": "오늘 날씨가 어때?"
}
```

#### 응답

```json
{
  "success": true,
  "reply": "오늘 날씨는...",
  "usage": {
    "prompt_tokens": 150,
    "completion_tokens": 200,
    "total_tokens": 350
  }
}
```

#### 에러 응답

```json
{
  "success": false,
  "error": "OpenAI API 키가 설정되지 않았습니다."
}
```

---

## 🚀 사용 방법

### 방법 1: 메인 화면에서 바로 질문 (v2.0 권장) ⭐

#### 1단계: 메인 페이지 접속

```
http://localhost:3003/index.html
```

#### 2단계: 질문 입력

- 중앙의 입력창에 질문 작성
- **엔터** 또는 **전송 버튼** 클릭

#### 3단계: 자동 답변

- 자동으로 ChatGPT 페이지로 이동
- **즉시 답변이 표시됨!** (추가 클릭 불필요)

### 방법 2: ChatGPT 페이지 직접 접속

#### 1단계: 페이지 접속

```
http://localhost:3003/ChatGPT.html
```

#### 2단계: 질문 입력

- 하단 입력창에 질문 작성
- "Enter" 또는 "전송" 버튼 클릭
- AI 응답 대기

#### 3단계: 대화 진행

- 이전 답변 기반 추가 질문 가능
- 자연스러운 대화 흐름 유지
- 필요시 새로운 주제로 전환

---

## 💡 활용 사례

### 🍽️ 식당 운영 상담

```
Q: "주말 손님이 너무 많아서 혼난다. 어떻게 해?"
A: "예약제 도입, 대기열 관리 시스템, 직원 추가 고용 등..."

Q: "신메뉴 아이디어 있을까?"
A: "계절 재료 활용, 고객 선호도 분석, 경쟁사 분석..."
```

### 📝 마케팅 문구 작성

```
Q: "식당 소개 문구 작성해줄래?"
A: "[맞춤형 소개 문구 생성]"

Q: "좀 더 감성적으로 수정해"
A: "[감성적 버전으로 수정]"
```

### 📊 경영 상담

```
Q: "원가율이 40%인데 적절한가?"
A: "식당 업종 평균은 25-35%. 개선 방안..."

Q: "점심 매출을 증대하는 방법?"
A: "세트 메뉴, 회사원 타겟팅, 배달앱 활용..."
```

---

## 🎯 시스템 프롬프트

### 기본 역할 설정

```
당신은 식당 경영 전문가이자 마케팅 컨설턴트입니다.
- 식당 운영에 대한 실질적 조언 제공
- 마케팅 전략 수립 지원
- 비즈니스 문제 해결
- 항상 한국어로 친절하게 답변
```

### 컨텍스트별 프롬프트

```
레스토랑 컨텍스트:
"당신은 고급 레스토랑 경영자입니다..."

카페 컨텍스트:
"당신은 인디펜던트 카페 운영자입니다..."

마케팅 컨텍스트:
"당신은 SNS 마케팅 전문가입니다..."
```

---

## 💰 토큰 사용 추적

### 토큰 계산

```
1 토큰 ≈ 4자 (한글)
1 토큰 ≈ 1단어 (영어)

예시:
"안녕하세요" = 약 5 토큰
"How are you?" = 3 토큰
```

### 구독별 한도

```
무료:     월 1,000 토큰
베이직:   월 10,000 토큰
프로:     월 100,000 토큰
```

---

## 💡 활용 팁

### 👍 효과적인 질문 방법

**나쁜 예시:**

```
"사업이 안 된다"
"돈을 많이 벌고 싶다"
```

**좋은 예시:**

```
"30평 식당, 월 매출 2000만원인데 수익 개선 방법?"
"직원 5명, 한달 임금 500만원인데 효율적 운영법?"
```

### 🎯 최고의 활용법

1. **구체적 상황 설명**

   - 식당 규모
   - 월 매출/수익
   - 주요 문제점

2. **단계별 질문**

   - 현 상황 분석
   - 개선책 제시 요청
   - 구체적 실행 방법

3. **피드백 반영**
   - "좀 더 구체적으로"
   - "다른 방법은?"
   - "비용은 얼마?"

---

## ⚙️ 서버 설정 가이드 (v2.0)

### 1. 환경변수 설정 (.env 파일)

프로젝트 루트에 `.env` 파일 생성:

```env
# OpenAI API 키 (필수)
OPENAI_API_KEY=sk-여기에_실제_API_키_입력

# Supabase 설정 (선택)
SUPABASE_URL=https://여기에_Supabase_URL
SUPABASE_KEY=여기에_Supabase_KEY

# 서버 포트
PORT=3003
```

### 2. 패키지 설치

```bash
# 필수 패키지 설치
npm install multer

# 또는 모든 패키지 재설치
npm install
```

### 3. 서버 실행

```bash
node server.js
```

**성공 메시지:**

```
✅ Supabase 클라이언트 초기화 성공
✅ 그룹 작업 스케줄링 활성화됨
서버가 http://localhost:3003 에서 실행 중입니다
```

### 4. 포트 충돌 해결

**증상:** `Error: listen EADDRINUSE: address already in use 0.0.0.0:3003`

**해결 방법:**

```powershell
# 1. 포트 사용 프로세스 확인
netstat -ano | findstr :3003

# 2. 프로세스 종료 (PID는 위에서 확인한 번호)
taskkill /F /PID [PID번호]

# 3. 서버 재시작
node server.js
```

---

## ⚠️ 주의사항

### 1. AI 답변의 한계

- 절대적 해결책 아님
- 전문가 상담 필요시 있음
- 개인 판단 필수

### 2. 개인정보 보호

- 민감한 정보 입력 금지
- 직원 개인정보 언급 주의
- 고객정보 절대 금지

### 3. 정보 신뢰성

- 시대 변화 반영 부족
- 최신 정보 확인 필요
- 법률 자문은 별도 필요

### 4. API 키 보안 (v2.0 추가)

- `.env` 파일을 Git에 커밋하지 말 것
- API 키를 클라이언트에 노출하지 말 것
- 주기적으로 키 갱신 권장

---

## 🔧 트러블슈팅

### Q: 메인 화면에서 전송했는데 답변이 안 나와요 (v2.0)

**A**:

1. 브라우저 콘솔(F12) 확인
2. 서버가 실행 중인지 확인 (`node server.js`)
3. `.env` 파일에 `OPENAI_API_KEY` 설정 확인
4. 페이지 새로고침 (F5)

### Q: "연결 실패"가 계속 표시돼요

**A**:

- 실제로 메시지를 전송해보세요
- 전송이 성공하면 자동으로 "연결됨"으로 변경됩니다
- 서버 콘솔에 에러가 있는지 확인하세요

### Q: 응답이 느려요

**A**:

- 간단한 질문부터 시작
- 대화 히스토리 길면 새 시작
- API 서버 상태 확인

### Q: 답변 품질이 낮아요

**A**:

- 더 구체적으로 질문
- 배경 정보 추가 제공
- 원하는 형식 명시

### Q: "Cannot find module 'multer'" 에러

**A**:

```bash
npm install multer
```

### Q: 포트 3003이 사용 중이에요

**A**:

```powershell
# Windows
netstat -ano | findstr :3003
taskkill /F /PID [PID번호]

# Mac/Linux
lsof -i :3003
kill -9 [PID번호]
```

---

## 📈 향후 개선 계획

- [x] 메인 화면 통합 (v2.0 완료)
- [x] 자동 전송 기능 (v2.0 완료)
- [x] 연결 상태 자동 감지 (v2.0 완료)
- [ ] 음성 입력/출력
- [ ] 이미지 업로드 분석
- [ ] 실시간 데이터 검색
- [ ] 맞춤형 AI 모델
- [ ] 커뮤니티 답변 공유
- [ ] 대화 히스토리 저장/불러오기

---

## 📝 개발자 노트 (v2.0)

### 주요 변경 사항

#### 1. index.html

```javascript
// AI 검색창에서 질문 전송 시 localStorage 저장
const aiSendBtn = document.getElementById("aiSendBtn");
const textarea = document.getElementById("aiPrompt");

aiSendBtn.addEventListener("click", () => {
  const value = textarea.value.trim();
  if (!value) return;

  localStorage.setItem("initialChatPrompt", value);
  window.location.href = "/ChatGPT.html";
});
```

#### 2. ChatGPT.html

```javascript
// 페이지 로드 시 localStorage에서 질문 읽어서 자동 전송
const saved = localStorage.getItem("initialChatPrompt");
if (saved) {
  messageInput.value = saved;
  localStorage.removeItem("initialChatPrompt");
  setTimeout(() => {
    messageInput.focus();
    sendMessage(); // 자동 전송!
  }, 300);
}

// 메시지 전송 성공 시 연결 상태 자동 업데이트
if (data.success && data.reply) {
  isConnected = true;
  statusDot.classList.remove("disconnected");
  statusText.textContent = "연결됨";
}
```

### 테스트 체크리스트

- [x] 메인 화면에서 질문 입력 → 자동 전송 확인
- [x] 연결 상태 자동 감지 확인
- [x] 서버 에러 처리 확인
- [x] localStorage 정리 확인
- [x] 다양한 브라우저에서 테스트

---

## 🎓 배운 교훈

### 1. UX 개선의 중요성

- 사용자가 버튼을 두 번 클릭하는 것은 불편함
- 한 번에 처리되는 것이 훨씬 직관적
- "자동화"는 최고의 UX

### 2. 에러 처리의 중요성

- "연결 실패"보다 "연결 확인 중..."이 더 정확
- 실제 동작 결과에 따라 상태 업데이트
- 사용자에게 혼란을 주지 않는 메시지

### 3. 개발 환경 관리

- `.env` 파일 설정은 필수
- 포트 충돌 문제는 자주 발생
- 명확한 에러 메시지가 디버깅의 핵심

---

> 🎯 AI와의 대화는 당신의 사업 성장을 위한 24시간 컨설턴트입니다!

> 💡 **v2.0 핵심**: 이제 메인 화면에서 한 번에! 빠르고 간편하게!
