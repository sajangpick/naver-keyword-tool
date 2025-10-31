# 📦 토큰 기반 구독 시스템 배포 가이드

> **대상**: 개발자, 배포 담당자

---

## 📋 목차

1. [필수 사항](#필수-사항)
2. [설치 절차](#설치-절차)
3. [데이터베이스 초기화](#데이터베이스-초기화)
4. [환경 설정](#환경-설정)
5. [프로덕션 배포](#프로덕션-배포)
6. [문제 해결](#문제-해결)

---

## 필수 사항

### 🔧 시스템 요구사항

```
- Node.js: 18.x 이상
- npm/pnpm: 최신 버전
- Supabase: 프로젝트 생성 완료
- Render: 백엔드 배포 예정 (또는 자체 서버)
- Vercel: 프론트엔드 배포 (선택사항)
```

### 📦 설치된 패키지

```json
{
  "express": "^4.18.0",
  "axios": "^1.4.0",
  "@supabase/supabase-js": "^2.0.0",
  "dotenv": "^16.0.0",
  "cors": "^2.8.5",
  "helmet": "^7.0.0"
}
```

---

## 설치 절차

### 1️⃣ 로컬 개발 환경 설정

#### 1.1 저장소 클론
```bash
git clone https://github.com/your-repo/bosikpick.git
cd bosikpick
```

#### 1.2 패키지 설치
```bash
# npm 사용
npm install

# 또는 pnpm 사용 (권장)
pnpm install
```

#### 1.3 환경 변수 설정 (`.env`)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 서버 설정
PORT=3001
NODE_ENV=development

# CORS 설정 (개발 환경)
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:5500

# JWT
JWT_SECRET=your-secret-key-here

# Naver API (기존 설정 유지)
NAVER_CUSTOMER_ID=your-customer-id
NAVER_API_KEY=your-api-key
NAVER_SECRET_KEY=your-secret-key
NAVER_SEARCH_CLIENT_ID=your-search-id
NAVER_SEARCH_CLIENT_SECRET=your-search-secret

# Kakao OAuth
KAKAO_REST_API_KEY=your-kakao-key
KAKAO_REDIRECT_URI=http://localhost:5500/auth/kakao/callback
KAKAO_CLIENT_SECRET=your-secret

# OpenAI API
OPENAI_API_KEY=sk-...
```

#### 1.4 로컬 서버 실행
```bash
pnpm run dev
# 또는
node server.js
```

**확인:**
```bash
# 터미널 출력
✅ Supabase 클라이언트 초기화 성공
Server is running on port 3001
```

---

## 데이터베이스 초기화

### 2️⃣ Supabase 스키마 생성

#### 2.1 Supabase 대시보드 접속
1. https://app.supabase.com 접속
2. 프로젝트 선택
3. "SQL Editor" 탭 클릭

#### 2.2 스키마 파일 실행

**순서대로 실행해야 합니다:**

```sql
-- 1. 관리자 역할 (admin-roles.sql)
-- 파일: database/schemas/features/admin/admin-roles.sql

-- 2. 구독 및 청구 시스템 (subscription-billing.sql)
-- 파일: database/schemas/features/subscription/subscription-billing.sql

-- 3. 토큰 시스템 (subscription-token-system.sql)
-- 파일: database/schemas/features/subscription/subscription-token-system.sql
```

**실행 방법:**

1. `database/schemas/features/admin/admin-roles.sql` 파일 내용 복사
2. Supabase SQL Editor에 붙여넣기
3. "Run" 버튼 클릭
4. 완료 확인 후 다음 파일 실행

#### 2.3 기본 데이터 삽입

```sql
-- 기본 가격 설정
INSERT INTO pricing_config (user_type, membership_level, price, created_at, updated_at)
VALUES 
  ('owner', 'seed', 0, NOW(), NOW()),
  ('owner', 'power', 30000, NOW(), NOW()),
  ('owner', 'big_power', 50000, NOW(), NOW()),
  ('owner', 'premium', 70000, NOW(), NOW()),
  ('agency', 'elite', 100000, NOW(), NOW()),
  ('agency', 'expert', 300000, NOW(), NOW()),
  ('agency', 'master', 500000, NOW(), NOW()),
  ('agency', 'premium', 1000000, NOW(), NOW());

-- 기본 토큰 한도 설정
INSERT INTO token_config (user_type, membership_level, daily_limit, monthly_limit, created_at, updated_at)
VALUES 
  ('owner', 'seed', 60, 300, NOW(), NOW()),
  ('owner', 'power', NULL, 1000, NOW(), NOW()),
  ('owner', 'big_power', NULL, 1667, NOW(), NOW()),
  ('owner', 'premium', NULL, 2334, NOW(), NOW()),
  ('agency', 'elite', NULL, 5000, NOW(), NOW()),
  ('agency', 'expert', NULL, 15000, NOW(), NOW()),
  ('agency', 'master', NULL, 25000, NOW(), NOW()),
  ('agency', 'premium', NULL, 50000, NOW(), NOW());
```

✅ **완료 확인:**
```sql
SELECT * FROM pricing_config;
SELECT * FROM token_config;
```

---

## 환경 설정

### 3️⃣ Supabase RLS (Row Level Security) 정책

구독 시스템 테이블에 대한 보안 정책을 설정합니다.

#### 3.1 subscription_cycle 테이블
```sql
-- 사용자는 자신의 구독 사이클만 조회 가능
CREATE POLICY "Users can view their own subscription_cycle" 
ON subscription_cycle 
FOR SELECT 
USING (user_id = auth.uid());

-- 어드민만 업데이트 가능
CREATE POLICY "Only admins can update subscription_cycle" 
ON subscription_cycle 
FOR UPDATE 
USING (auth.jwt() ->> 'role' = 'admin');
```

#### 3.2 token_usage 테이블
```sql
-- 사용자는 자신의 토큰 사용량만 조회 가능
CREATE POLICY "Users can view their own token_usage" 
ON token_usage 
FOR SELECT 
USING (user_id = auth.uid());

-- 서버만 새로운 기록 생성 가능
CREATE POLICY "Only server can insert token_usage" 
ON token_usage 
FOR INSERT 
WITH CHECK (true);
```

#### 3.3 agency_managed_stores 테이블
```sql
-- 대행사는 자신의 식당만 조회/수정 가능
CREATE POLICY "Agencies can manage their own stores" 
ON agency_managed_stores 
FOR ALL 
USING (agency_id = auth.uid() OR auth.jwt() ->> 'role' = 'admin');
```

---

## 프로덕션 배포

### 4️⃣ Render에 백엔드 배포

**Render**: 24시간 실행되는 Node.js 서버를 호스팅하는 플랫폼

#### 4.1 Render 계정 생성
1. https://render.com 접속
2. 계정 가입 (GitHub 연동 권장)

#### 4.2 새 서비스 생성
1. "New +" → "Web Service"
2. GitHub 저장소 선택
3. 설정:
   - **Name**: `bosikpick-backend`
   - **Runtime**: `Node`
   - **Build Command**: `pnpm install`
   - **Start Command**: `node server.js`
   - **Branch**: `main`

#### 4.3 환경 변수 설정
1. "Environment" 섹션에서 변수 추가:

```
PORT=3000
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CORS_ORIGIN=https://bosikpick.vercel.app
JWT_SECRET=your-very-long-random-secret
OPENAI_API_KEY=sk-...
NAVER_CUSTOMER_ID=...
... (나머지 환경 변수)
```

#### 4.4 배포 실행
```bash
git push origin main
# Render가 자동으로 배포 시작
```

**확인:**
```bash
# Render 대시보드에서 "Deploy" 로그 확인
# 배포 완료 후 URL: https://bosikpick-backend.onrender.com
```

### 5️⃣ Vercel에 프론트엔드 배포

#### 5.1 Vercel 연동
1. https://vercel.com 접속
2. GitHub 저장소 연동
3. 프로젝트 생성

#### 5.2 환경 변수 설정
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

#### 5.3 vercel.json 확인

**절대 변경하지 마세요!**

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://bosikpick-backend.onrender.com/api/:path*"
    }
  ]
}
```

이 설정이 Vercel의 모든 `/api` 요청을 Render로 프록시합니다.

---

## 문제 해결

### 🔧 일반적인 문제

#### 문제 1: "Supabase 클라이언트 초기화 실패"

**원인**: 환경 변수 미설정

**해결**:
```bash
# .env 파일 확인
cat .env | grep SUPABASE

# 없으면 추가
echo "NEXT_PUBLIC_SUPABASE_URL=..." >> .env
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=..." >> .env
echo "SUPABASE_SERVICE_ROLE_KEY=..." >> .env
```

#### 문제 2: "API 호출 403 (Forbidden)"

**원인**: CORS 설정 또는 권한 부족

**해결**:
```bash
# .env의 CORS_ORIGIN 확인
# 로컬: http://localhost:5500
# 프로덕션: https://bosikpick.vercel.app
```

#### 문제 3: "토큰 사용량이 기록되지 않음"

**원인**: token_usage 테이블 쓰기 권한 없음

**해결**:
```sql
-- Supabase에서 RLS 정책 확인
SELECT * FROM pg_policies WHERE tablename = 'token_usage';

-- INSERT 정책이 있는지 확인
-- 없으면 다시 추가
CREATE POLICY "Server can insert token_usage" 
ON token_usage FOR INSERT WITH CHECK (true);
```

#### 문제 4: "구독 갱신이 되지 않음"

**원인**: 월별 갱신 로직 미실행

**해결**: 
향후 크론 작업(Cron Job)을 설정하여 자동 갱신 구현 필요

```javascript
// server.js에 추가 예정
const cron = require('node-cron');

// 매일 자정에 갱신 체크
cron.schedule('0 0 * * *', async () => {
  console.log('🔄 월별 구독 갱신 체크...');
  // subscription_cycle 갱신 로직
});
```

---

## ✅ 배포 체크리스트

배포 전 다음을 확인하세요:

- [ ] `.env` 파일의 모든 환경 변수 설정됨
- [ ] Supabase 스키마 완전히 적용됨
- [ ] Render 백엔드 배포 완료 및 URL 확인
- [ ] Vercel 프론트엔드 배포 완료
- [ ] `vercel.json`의 rewrites 설정 확인
- [ ] Supabase RLS 정책 설정됨
- [ ] 기본 가격/토큰 설정값 입력됨
- [ ] API 테스트 완료:
  ```bash
  curl https://bosikpick-backend.onrender.com/api/subscription/pricing-config
  ```
- [ ] 프론트엔드에서 API 호출 성공 확인
- [ ] 로그인 후 대시보드 로드 확인
- [ ] 토큰 사용량 기록 확인

---

## 📞 지원

**배포 문제?**

1. Render 로그 확인: 대시보드 → "Logs"
2. Vercel 로그 확인: 대시보드 → "Deployments" → "Logs"
3. Supabase 오류 확인: 대시보드 → "Logs"
4. 브라우저 콘솔: F12 → Console 탭

**추가 도움:**
- 문서: `/docs/SUBSCRIPTION_SYSTEM_GUIDE.md`
- 이메일: admin@bosikpick.com

---

**마지막 업데이트**: 2025년 10월 31일 ✅

