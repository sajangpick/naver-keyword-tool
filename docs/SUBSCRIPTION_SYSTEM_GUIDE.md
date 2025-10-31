# 🎯 토큰 기반 구독 시스템 가이드

> **최종 완성**: 2025년 10월 31일

---

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [회원 계층 구조](#회원-계층-구조)
3. [관리자 기능](#관리자-기능)
4. [사용자 기능](#사용자-기능)
5. [API 레퍼런스](#api-레퍼런스)
6. [데이터베이스 스키마](#데이터베이스-스키마)
7. [테스트 방법](#테스트-방법)
8. [FAQ](#faq)

---

## 시스템 개요

### 🎪 기본 원리

```
구독 시작 → 토큰 할당 → AI 사용 (토큰 소비) → 한도 초과 시 중지 → 월 갱신
```

- **토큰 단위**: ChatGPT API 기본 가격 대비 배수로 계산
- **갱신 주기**: 사용자의 구독 시작일을 기준으로 약 30일 (월별 다를 수 있음)
- **이월 정책**: 미사용 토큰은 다음 달로 이월되지 않음 (소멸)
- **초과 정책**: 한도 초과 시 즉시 사용 중지 → 업그레이드 요청 가능

---

## 회원 계층 구조

### 🍽️ 식당 대표 (Owner) 계층

| 등급 | 월 가격 | 월 토큰 | 일일 토큰 | 특징 |
|------|--------|--------|----------|------|
| **씨앗** | 무료 | 300 | 60 | 무료 체험 |
| **파워** | 30,000원 | 1,000 | 200 | 기본 플랜 |
| **빅파워** | 50,000원 | 1,667 | 333 | 인기 플랜 |
| **프리미엄** | 70,000원 | 2,334 | 467 | 최고 플랜 |

> **씨앗 등급**의 일일/월별 토큰은 어드민이 직접 수정 가능

### 🏢 대행사 (Agency) 계층

| 등급 | 월 가격 | 월 토큰 | 특징 |
|------|--------|--------|------|
| **엘리트** | 100,000원 | 5,000 | 시작 플랜 |
| **전문가** | 300,000원 | 15,000 | 기본 플랜 |
| **마스터** | 500,000원 | 25,000 | 인기 플랜 |
| **프리미엄** | 1,000,000원 | 50,000 | 최고 플랜 |

> **모든 가격과 토큰 한도는 어드민이 일괄/개별 수정 가능**

---

## 관리자 기능

### 1️⃣ 가격 설정 (`/admin/pages/subscription-settings.html`)

**탭 1: 가격 설정 (식당 대표)**

```
🏷️ 씨앗: 무료 (수정 불가)
🏷️ 파워: 30,000원 (수정 가능)
🏷️ 빅파워: 50,000원 (수정 가능)
🏷️ 프리미엄: 70,000원 (수정 가능)
```

- 모든 식당 대표에 적용되는 **기본 가격**
- 개별 회원별로 다른 가격을 적용하려면 **개인별 맞춤 설정** 사용

**탭 1: 가격 설정 (대행사)**

```
🏷️ 엘리트: 100,000원 (수정 가능)
🏷️ 전문가: 300,000원 (수정 가능)
🏷️ 마스터: 500,000원 (수정 가능)
🏷️ 프리미엄: 1,000,000원 (수정 가능)
```

### 2️⃣ 토큰 한도 설정 (`/admin/pages/token-settings.html`)

**탭 2: 토큰 한도 (식당 대표)**

```
🎯 씨앗: 월 300토큰, 일 60토큰 (수정 가능)
🎯 파워: 월 1,000토큰 (수정 가능)
🎯 빅파워: 월 1,667토큰 (수정 가능)
🎯 프리미엄: 월 2,334토큰 (수정 가능)
```

**탭 2: 토큰 한도 (대행사)**

```
🎯 엘리트: 월 5,000토큰 (수정 가능)
🎯 전문가: 월 15,000토큰 (수정 가능)
🎯 마스터: 월 25,000토큰 (수정 가능)
🎯 프리미엄: 월 50,000토큰 (수정 가능)
```

### 3️⃣ 개인별 맞춤 설정 (`/admin/pages/member-customization.html`)

특정 회원에게만 다른 가격/토큰을 적용합니다.

**예시:**
- "김태희" 회원 → 파워 등급이지만 월 50,000원에 2,000토큰 제공

**동작:**
1. 회원 검색 (이름/이메일)
2. 맞춤 가격 설정 (체크 ON → 금액 입력)
3. 맞춤 토큰 설정 (체크 ON → 토큰 입력)
4. 저장

### 4️⃣ 대행사 식당 관리 (`/admin/pages/agency-stores.html`)

대행사가 직접 관리할 수 없는 식당들을 관리합니다.

**기본 정보:**
- 식당명, 전화, 주소, 네이버 플레이스 URL

**계정 정보 (암호화 저장):**
- 네이버 ID / 비밀번호 🔐
- 구글 이메일 / 비밀번호 🔐

**동작:**
- 식당 등록 → 수정 → 삭제 (소프트 삭제)

---

## 사용자 기능

### 📊 대시보드 (`/user/dashboard.html`)

**주요 정보:**

```
┌─────────────────────────────────────────┐
│ 현재 사용 가능 토큰: 650 / 1,000         │ ← 진행 바 표시
├─────────────────────────────────────────┤
│ 이번 달 사용량: 350 / 1,000 (사용률 35%) │
│ 다음 갱신일: 2025년 11월 15일 (15일 후) │
│ 현재 구독 등급: 파워 (월 30,000원)       │
└─────────────────────────────────────────┘

구독 정보:
- 가입 날짜: 2025년 10월 15일
- 마지막 갱신: 2025년 10월 15일
- 구독 상태: ✅ 활성
- 사용자 타입: 🍽️ 식당 대표

토큰 사용 현황:
- 총 할당 토큰: 1,000
- 사용한 토큰: 350
- 남은 토큰: 650
- 초과 여부: ✅ 정상

토큰 사용 내역: (최근 10개)
2025-10-31 14:23:45 | 입력: 150 토큰 | 출력: 120 토큰
2025-10-30 10:15:20 | 입력: 100 토큰 | 출력: 80 토큰
...
```

### 💳 구독 관리 (`/user/subscription-management.html`)

**플랜 선택:**

```
┌────────────────────┐
│ 씨앗 (무료)        │
│ 월 300 토큰        │
│ [현재 플랜] 버튼   │
└────────────────────┘

┌────────────────────┐
│ 파워 (30,000원)    │
│ 월 1,000 토큰      │ ← 현재 구독
│ [현재 플랜] 버튼   │
└────────────────────┘

┌────────────────────┐
│ 빅파워 (50,000원)  │
│ 월 1,667 토큰      │
│ [업그레이드] 버튼  │
└────────────────────┘
```

**청구 내역:**

```
청구일 | 구독 등급 | 금액 | 토큰 사용량 | 상태
2025-10-15 | 파워 | 30,000원 | 350 | ✅ 완료
2025-09-15 | 파워 | 30,000원 | 980 | ✅ 완료
```

---

## API 레퍼런스

### 📡 구독 설정 API

#### 1. 가격 설정 조회
```http
GET /api/subscription/pricing-config
```

**응답:**
```json
{
  "success": true,
  "pricing": {
    "owner": {
      "seed": 0,
      "power": 30000,
      "big_power": 50000,
      "premium": 70000
    },
    "agency": {
      "elite": 100000,
      "expert": 300000,
      "master": 500000,
      "premium": 1000000
    }
  }
}
```

#### 2. 가격 설정 수정
```http
PUT /api/subscription/pricing-config
Content-Type: application/json

{
  "owner": {
    "power": 35000,
    "big_power": 55000,
    "premium": 75000
  },
  "agency": {
    "elite": 120000
  }
}
```

#### 3. 토큰 한도 조회
```http
GET /api/subscription/token-config
```

**응답:**
```json
{
  "success": true,
  "tokenConfig": {
    "owner": {
      "seed": { "daily": 60, "monthly": 300 },
      "power": 1000,
      "big_power": 1667,
      "premium": 2334
    },
    "agency": {
      "elite": 5000,
      "expert": 15000,
      "master": 25000,
      "premium": 50000
    }
  }
}
```

#### 4. 개인별 맞춤 가격 조회
```http
GET /api/subscription/member-pricing/:memberId
```

#### 5. 개인별 맞춤 가격 설정
```http
POST /api/subscription/member-pricing
Content-Type: application/json

{
  "member_id": "user-123",
  "membership_level": "power",
  "custom_price": 50000,
  "reason": "VIP 회원"
}
```

#### 6. 토큰 사용량 기록
```http
POST /api/subscription/token-usage
Content-Type: application/json

{
  "user_id": "user-123",
  "store_id": "store-456",
  "input_tokens": 150,
  "output_tokens": 120,
  "api_used": "chatgpt"
}
```

#### 7. 대행사 관리 식당 조회
```http
GET /api/subscription/agency-stores/:agencyId
```

**응답:**
```json
{
  "success": true,
  "stores": [
    {
      "id": "store-123",
      "agency_id": "agency-456",
      "store_name": "맛있는 우육탕",
      "store_phone": "02-1234-5678",
      "store_address": "서울시 강남구...",
      "naver_place_url": "https://place.naver.com/...",
      "naver_id": "***",
      "google_id": "***",
      "is_active": true,
      "created_at": "2025-10-15T10:00:00Z"
    }
  ]
}
```

#### 8. 대행사 식당 등록/수정
```http
POST /api/subscription/agency-stores
Content-Type: application/json

{
  "agency_id": "agency-456",
  "store_name": "맛있는 우육탕",
  "store_phone": "02-1234-5678",
  "store_address": "서울시 강남구...",
  "naver_place_url": "https://place.naver.com/...",
  "naver_id": "naver_user",
  "naver_password": "password123",
  "google_id": "user@gmail.com",
  "google_password": "googlepass"
}
```

#### 9. 대행사 식당 삭제
```http
DELETE /api/subscription/agency-stores/:storeId
```

---

## 데이터베이스 스키마

### 주요 테이블

#### `profiles` (확장)
```sql
ALTER TABLE profiles ADD COLUMN role text DEFAULT 'member';
ALTER TABLE profiles ADD COLUMN membership_level text DEFAULT 'seed';
```

#### `pricing_config`
```sql
CREATE TABLE pricing_config (
  id uuid PRIMARY KEY,
  user_type text,           -- 'owner' or 'agency'
  membership_level text,    -- 'seed', 'power', ...
  price bigint,             -- 원 단위
  created_at timestamp,
  updated_at timestamp
);
```

#### `token_config`
```sql
CREATE TABLE token_config (
  id uuid PRIMARY KEY,
  user_type text,
  membership_level text,
  daily_limit bigint,       -- 일일 한도 (NULL이면 무제한)
  monthly_limit bigint,     -- 월 한도
  created_at timestamp,
  updated_at timestamp
);
```

#### `subscription_cycle`
```sql
CREATE TABLE subscription_cycle (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles(id),
  cycle_start_date date,
  token_limit bigint,
  monthly_price bigint,
  status text,              -- 'active', 'paused', 'cancelled'
  created_at timestamp,
  updated_at timestamp
);
```

#### `token_usage`
```sql
CREATE TABLE token_usage (
  id uuid PRIMARY KEY,
  user_id uuid,
  store_id uuid,
  input_tokens bigint,
  output_tokens bigint,
  api_used text,            -- 'chatgpt', 'claude', 'gemini'
  created_at timestamp
);
```

#### `billing_history`
```sql
CREATE TABLE billing_history (
  id uuid PRIMARY KEY,
  user_id uuid,
  cycle_id uuid,
  membership_level text,
  monthly_price bigint,
  token_used bigint,
  payment_status text,      -- 'completed', 'pending', 'failed'
  created_at timestamp
);
```

#### `agency_managed_stores`
```sql
CREATE TABLE agency_managed_stores (
  id uuid PRIMARY KEY,
  agency_id uuid,
  store_name text,
  store_phone text,
  store_address text,
  naver_place_url text,
  naver_id text,
  naver_password_encrypted text,
  google_id text,
  google_password_encrypted text,
  is_active boolean DEFAULT true,
  created_at timestamp,
  updated_at timestamp
);
```

---

## 테스트 방법

### 🧪 단위 테스트

#### 1. 가격 설정 테스트
```bash
# 가격 조회
curl http://localhost:3001/api/subscription/pricing-config

# 가격 수정
curl -X PUT http://localhost:3001/api/subscription/pricing-config \
  -H "Content-Type: application/json" \
  -d '{
    "owner": {
      "power": 35000
    }
  }'
```

#### 2. 토큰 한도 테스트
```bash
# 토큰 한도 조회
curl http://localhost:3001/api/subscription/token-config

# 토큰 한도 수정
curl -X PUT http://localhost:3001/api/subscription/token-config \
  -H "Content-Type: application/json" \
  -d '{
    "owner": {
      "power": 1200
    }
  }'
```

#### 3. 개인별 맞춤 설정 테스트
```bash
# 맞춤 가격 설정
curl -X POST http://localhost:3001/api/subscription/member-pricing \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": "user-123",
    "membership_level": "power",
    "custom_price": 50000,
    "reason": "VIP 할인"
  }'

# 맞춤 토큰 설정
curl -X POST http://localhost:3001/api/subscription/member-token-limit \
  -H "Content-Type: application/json" \
  -d '{
    "member_id": "user-123",
    "membership_level": "power",
    "custom_token_limit": 1500,
    "reason": "프로모션"
  }'
```

### 🎮 통합 테스트 시나리오

#### **시나리오 1: 새 사용자 가입 및 씨앗 등급 시작**

```
1. 사용자 가입 (카카오 로그인)
   ✓ profiles 테이블에 user_type='owner', membership_level='seed' 저장
   ✓ subscription_cycle 테이블에 seed 등급의 토큰 한도 생성

2. 대시보드 확인
   ✓ 토큰 상태 표시: 300/300
   ✓ 갱신일 표시: 30일 후

3. AI 기능 사용
   ✓ token_usage 테이블에 기록
   ✓ 남은 토큰 실시간 감소
```

#### **시나리오 2: 업그레이드 (씨앗 → 파워)**

```
1. 사용자가 대시보드에서 "파워" 플랜 선택
   ✓ subscription_management.html 오픈

2. 파워 플랜 "업그레이드" 버튼 클릭
   ✓ 어드민에게 업그레이드 요청 생성
   ✓ upgrade_requests 테이블에 'pending' 상태로 저장

3. 어드민 승인
   ✓ 새 subscription_cycle 생성 (파워 등급, 1000 토큰)
   ✓ 기존 씨앗 등급의 남은 토큰 소멸

4. 사용자 대시보드 업데이트
   ✓ "파워" 등급으로 표시
   ✓ 1000 토큰으로 초기화
```

#### **시나리오 3: 토큰 초과 (사용 중지)**

```
1. 사용자가 950/1000 토큰 사용

2. 50 토큰 필요한 AI 작업 시도
   ✓ 토큰 부족 (950 + 50 > 1000)
   ✓ API 응답: 403 Forbidden "토큰 한도 초과"
   ✓ 사용 즉시 중지

3. 대시보드 표시
   ✓ 상태: "❌ 토큰 초과 - 사용 중지됨"
   ✓ 버튼: "업그레이드 요청하기"

4. 사용자 업그레이드 요청
   ✓ upgrade_requests 테이블에 저장

5. 어드민 승인
   ✓ 새 subscription_cycle 생성
   ✓ 사용자 다시 AI 사용 가능
```

#### **시나리오 4: 월 갱신 자동 처리**

```
1. 2025-10-15 가입 (파워 등급, 1000 토큰)

2. 2025-10-31 (16일 후) - 950 토큰 사용
   ✓ 남은 토큰: 50

3. 2025-11-15 (30일 후) - 자동 갱신
   ✓ 새 subscription_cycle 생성
   ✓ 토큰 초기화: 1000
   ✓ 기존의 남은 50 토큰 소멸
   ✓ billing_history에 청구 기록

4. 사용자 확인
   ✓ 대시보드: 토큰 1000/1000
   ✓ 다음 갱신일: 2025-12-15
```

### ✅ 체크리스트

- [ ] 어드민이 가격을 30,000 → 35,000으로 수정했을 때, 새 회원부터 35,000 적용
- [ ] 개인별 맞춤 가격 50,000원 설정 시, 해당 회원만 50,000원 청구
- [ ] 파워 토큰을 1,000 → 1,200으로 수정 시, 신규 사이클부터 1,200 적용
- [ ] 토큰 초과 시 API 호출 차단
- [ ] 월 갱신 시 남은 토큰 완전 소멸 (이월 없음)
- [ ] 업그레이드 요청이 어드민 페이지에 보이고 승인/거부 가능
- [ ] 대행사가 카카오 계정 없는 식당 등록 가능
- [ ] 네이버/구글 비밀번호 암호화 저장 확인
- [ ] 대시보드에 실시간 토큰 상태 표시
- [ ] 구독 관리 페이지에서 플랜 선택 가능

---

## FAQ

### ❓ 토큰은 무엇인가요?

토큰은 AI 사용에 대한 사용량 단위입니다. 1토큰 = ChatGPT API의 기본 가격입니다. 예를 들어, 파워 등급 (1000 토큰/월)은 약 2~3개월 동안 블로그 글 100~150개 작성이 가능합니다.

### ❓ 씨앗 등급은 정말 무료인가요?

네, 씨앗 등급은 완전히 무료입니다. 월 300 토큰의 한도가 있으며, 입문 사용자에게 적합합니다.

### ❓ 토큰이 남으면 어떻게 되나요?

매월 갱신 시 남은 토큰은 **소멸**됩니다. 예를 들어, 파워 등급으로 1000 토큰을 받았는데 800만 사용했다면, 나머지 200 토큰은 다음 달로 넘어가지 않습니다.

### ❓ 중간에 등급을 변경할 수 있나요?

네, 언제든지 업그레이드할 수 있습니다. 다운그레이드는 다음 월 갱신부터 적용됩니다.

### ❓ 토큰이 초과되면 어떻게 되나요?

토큰이 한도를 초과하면 **즉시 사용이 중지**됩니다. 어드민에게 업그레이드를 요청할 수 있으며, 승인되면 추가 토큰을 받을 수 있습니다.

### ❓ 대행사는 어떤 계정 정보를 등록하나요?

대행사는 관리할 식당의 **네이버 ID/비밀번호**와 **구글 이메일/비밀번호**를 등록합니다. 모든 정보는 암호화되어 저장됩니다.

### ❓ 개인별 맞춤 가격은 언제 적용되나요?

**즉시** 적용됩니다. 어드민이 개인별 맞춤 가격을 설정하면 다음 월 갱신 시 해당 가격으로 청구됩니다.

### ❓ 여러 식당을 관리하는 대행사의 토큰 사용은?

**모든 식당의 토큰 사용이 집계되어** 하나의 subscription_cycle에서 관리됩니다. 예를 들어, 대행사가 3개 식당을 관리 중이면, 3개 식당의 AI 사용량이 모두 합산되어 대행사의 토큰 한도에서 차감됩니다.

---

## 📞 지원

**문제가 발생하면:**

1. 로그 확인: `server.js` 콘솔
2. Supabase 대시보드 확인: DB 상태
3. 브라우저 개발자 도구: 네트워크 탭에서 API 응답 확인

**문의:**
- 이메일: admin@bosikpick.com
- 문서: `/docs/SUBSCRIPTION_SYSTEM_GUIDE.md`

---

**마지막 업데이트**: 2025년 10월 31일 ✅
