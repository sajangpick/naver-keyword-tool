# 🚀 장사닥터 방식 RPA 시스템 구축 계획

> **목표**: 네이버, 배달의민족, 요기요, 쿠팡이츠 플랫폼의 리뷰를 자동으로 수집하고 답글을 등록하는 서버 기반 자동화 시스템

---

## 📋 목차

1. [시스템 아키텍처](#시스템-아키텍처)
2. [핵심 기술 스택](#핵심-기술-스택)
3. [데이터베이스 스키마](#데이터베이스-스키마)
4. [구현 단계](#구현-단계)
5. [보안 고려사항](#보안-고려사항)

---

## 🏗️ 시스템 아키텍처

### 1️⃣ 세션 미러링 방식 (네이버)

```
사용자 앱 → 네이버 로그인 → 세션 쿠키 추출 → 서버 저장
                                    ↓
서버 봇 → 세션 쿠키 사용 → 네이버 스마트플레이스 접속 → 리뷰 수집/답글 등록
```

**특징:**
- 사용자가 한 번 로그인하면 세션을 서버에 저장
- 서버가 세션을 사용해 지속적으로 접속 가능
- 세션 만료 시 재로그인 유도

### 2️⃣ 인앱 자동 로그인 방식 (배달 플랫폼)

```
사용자 앱 → ID/PW 입력 → 암호화 저장 → 서버 봇
                                    ↓
서버 봇 → Puppeteer 실행 → 플랫폼 로그인 → 리뷰 수집/답글 등록
```

**특징:**
- 계정 정보를 암호화하여 서버에 저장
- 서버 측 Headless Browser로 자동 로그인
- 2단계 인증 시 사용자에게 입력 요청

### 3️⃣ 자동 답글 등록 프로세스

```
사용자 → 답글 작성 → "등록 중..." 표시
                    ↓
서버 봇 → Headless Browser → 플랫폼 관리 페이지 접속
                    ↓
봇 → 답글 입력란 찾기 → 텍스트 입력 → 등록 버튼 클릭
                    ↓
결과 반환 → "등록 완료" 표시
```

---

## 🛠️ 핵심 기술 스택

### 필수 패키지

```json
{
  "puppeteer": "^21.0.0",           // 또는 puppeteer-core
  "@sparticuz/chromium": "^119.0.0", // Render/Vercel용 경량 Chromium
  "crypto-js": "^4.2.0",            // 계정 정보 암호화
  "node-cron": "^3.0.3"             // 정기 리뷰 수집 스케줄링
}
```

### RPA 엔진 구조

```
api/
├── rpa/
│   ├── browser-controller.js      # 공통 브라우저 제어 모듈
│   ├── session-manager.js         # 세션 관리 (쿠키 저장/로드)
│   └── action-executor.js         # 액션 실행 (클릭, 입력 등)
│
├── platforms/
│   ├── naver/
│   │   ├── login.js              # 네이버 로그인
│   │   ├── collect-reviews.js    # 리뷰 수집
│   │   └── post-reply.js         # 답글 등록
│   │
│   ├── baemin/
│   │   ├── login.js
│   │   ├── collect-reviews.js
│   │   └── post-reply.js
│   │
│   ├── yogiyo/
│   │   └── ...
│   │
│   └── coupangeats/
│       └── ...
```

---

## 💾 데이터베이스 스키마

### 1. 플랫폼 연동 테이블 (통합)

```sql
-- 플랫폼별 연동 정보 통합 테이블
CREATE TABLE IF NOT EXISTS platform_connections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) NOT NULL,
    
    -- 플랫폼 정보
    platform VARCHAR(50) NOT NULL,  -- 'naver', 'baemin', 'yogiyo', 'coupangeats'
    store_id VARCHAR(100),           -- 플랫폼별 매장 ID
    store_name VARCHAR(200),         -- 매장명
    
    -- 세션 정보 (네이버용)
    session_cookies TEXT,            -- JSON 형태의 쿠키
    session_expires_at TIMESTAMP,    -- 세션 만료 시간
    
    -- 계정 정보 (배달 플랫폼용, 암호화)
    account_id_encrypted TEXT,       -- 암호화된 계정 ID
    account_password_encrypted TEXT, -- 암호화된 비밀번호
    
    -- 프로필 정보
    profile_image TEXT,              -- 매장 프로필 이미지 URL
    address TEXT,                    -- 주소
    phone VARCHAR(50),               -- 전화번호
    
    -- 설정
    reply_tone VARCHAR(20) DEFAULT 'friendly', -- 답글 톤
    is_active BOOLEAN DEFAULT TRUE,
    
    -- 동기화 정보
    last_sync_at TIMESTAMP,
    total_reviews INTEGER DEFAULT 0,
    pending_replies INTEGER DEFAULT 0,
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, platform, store_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_platform_connections_user ON platform_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_connections_platform ON platform_connections(platform);
CREATE INDEX IF NOT EXISTS idx_platform_connections_active ON platform_connections(is_active);
```

### 2. 리뷰 데이터 테이블 (플랫폼별)

```sql
-- 통합 리뷰 테이블 (모든 플랫폼)
CREATE TABLE IF NOT EXISTS platform_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    connection_id UUID REFERENCES platform_connections(id) NOT NULL,
    
    -- 리뷰 정보
    review_id VARCHAR(100) NOT NULL,  -- 플랫폼별 리뷰 ID
    platform VARCHAR(50) NOT NULL,    -- 'naver', 'baemin', etc.
    
    -- 리뷰 내용
    reviewer_name VARCHAR(100),
    rating DECIMAL(2,1),              -- 평점 (1.0 ~ 5.0)
    content TEXT,                     -- 리뷰 내용
    review_date TIMESTAMP,            -- 리뷰 작성일
    
    -- 답글 정보
    reply_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'posted', 'failed'
    ai_reply TEXT,                    -- AI 생성 답글
    posted_reply TEXT,                -- 실제 등록된 답글
    posted_at TIMESTAMP,              -- 답글 등록 시간
    
    -- 메타데이터
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(connection_id, review_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_reviews_connection ON platform_reviews(connection_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON platform_reviews(reply_status);
CREATE INDEX IF NOT EXISTS idx_reviews_platform ON platform_reviews(platform);
```

---

## 📝 구현 단계

### Phase 1: 인프라 구축 (1주)

- [x] 데이터베이스 스키마 생성
- [ ] RPA 엔진 기본 구조 (browser-controller.js)
- [ ] 세션 관리 모듈 (session-manager.js)
- [ ] 암호화/복호화 유틸리티

### Phase 2: 네이버 연동 강화 (1주)

- [x] 기존 네이버 연동 확인
- [ ] 세션 만료 감지 및 갱신 로직
- [ ] 자동 답글 등록 기능
- [ ] 리뷰 수집 스케줄링 (10분마다)

### Phase 3: 배달의민족 연동 (2주)

- [ ] 로그인 자동화 (Puppeteer)
- [ ] 리뷰 수집 로직
- [ ] 답글 등록 로직
- [ ] 2단계 인증 처리

### Phase 4: 요기요/쿠팡이츠 연동 (2주)

- [ ] 요기요 연동
- [ ] 쿠팡이츠 연동
- [ ] 통합 대시보드

### Phase 5: 고도화 (1주)

- [ ] UI 변경 감지 및 대응
- [ ] 에러 모니터링 및 알림
- [ ] 성능 최적화

---

## 🔒 보안 고려사항

### 1. 계정 정보 암호화

```javascript
// AES-256 암호화
const ENCRYPTION_KEY = process.env.PLATFORM_ENCRYPTION_KEY; // 32자 이상

function encryptAccountInfo(text) {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
}

function decryptAccountInfo(encryptedText) {
  const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}
```

### 2. 세션 만료 관리

- 세션 만료 시간 추적
- 만료 전 자동 갱신 시도
- 만료 시 사용자에게 푸시 알림

### 3. 접근 제어

- 사용자별 연동 정보 분리
- API 인증 (JWT/Supabase Auth)
- Rate Limiting

---

## 🎯 다음 단계

1. **데이터베이스 스키마 생성** (`database/schemas/features/platform-connections/`)
2. **RPA 엔진 기본 모듈 구현** (`api/rpa/`)
3. **배달의민족 연동 API 구현** (`api/baemin/`)
4. **프론트엔드 연동 UI 개선** (이미 완료)

---

## 📚 참고 자료

- [Puppeteer 공식 문서](https://pptr.dev/)
- [장사닥터 기술 분석](사용자 제공 정보)
- 기존 네이버 연동 코드 (`api/naver/connect.js`)

