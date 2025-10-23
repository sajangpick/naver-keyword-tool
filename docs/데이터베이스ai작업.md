# 데이터베이스 AI 작업 가이드

> 📋 **목적**: Supabase 클라우드 데이터베이스 구축 (리뷰 답글 자동 생성 시스템)  
> 🎯 **대상**: 이 문서를 읽는 모든 AI  
> ⏰ **작성일**: 2025-10-22  

---

## 📌 프로젝트 배경

### 서비스 개요
소상공인(식당 사장님)을 위한 AI 에이전트 프로그램:
1. **영수증 리뷰 답글 자동 생성** ⭐ 최우선 구축
2. 블로그 포스팅 작성 (향후)
3. 네이버 파워클릭 광고 지원 (향후)
4. 네이버 플레이스 순위 추적 & 분석 (향후, 애드로그 같은 기능)

### 현재 상황
- ✅ `review.html` - 리뷰 답글 생성 UI 완성
- ✅ `server.js` - AI 프롬프트 최적화 완료
- ❌ 데이터베이스 연동 없음 (답글 생성만 하고 저장 안 함)
- ❌ 카카오 로그인 미완성 (테스트 회원 필요)

### 기술 스택
- **Database**: Supabase (PostgreSQL)
- **Backend**: Node.js, Express
- **Frontend**: Vanilla JavaScript
- **AI**: Claude, ChatGPT

---

## 👥 회원 등급 체계

### 1. 관리자 (admin)
```
user_type: 'admin'
membership_level: 'admin'
권한: 전체 시스템 관리, 모든 회원 데이터 조회
```

### 2. 식당 대표 (owner)
```
user_type: 'owner'
membership_level:
  - 'seed' (씨앗)       - 무료 체험, 월 리뷰 10개, 블로그 2개
  - 'power' (파워)      - 월 리뷰 50개, 블로그 10개
  - 'big_power' (빅파워) - 월 리뷰 200개, 블로그 30개
  - 'premium' (프리미엄) - 무제한
```

### 3. 대행사 & 블로거 (agency)
```
user_type: 'agency'
membership_level:
  - 'elite' (엘리트)      - 월 리뷰 100개, 블로그 50개, 10개 계정 관리
  - 'expert' (전문가)     - 월 리뷰 500개, 블로그 200개, 30개 계정
  - 'master' (마스터)     - 월 리뷰 2000개, 블로그 500개, 100개 계정
  - 'platinum' (플래티넘) - 무제한
```

---

## 🗂️ 데이터베이스 설계

### 테이블 구조 (3단계)

#### **1단계: 핵심 기능** (지금 바로 구축)
```
1. profiles - 사용자 정보
2. places - 식당 정보 (크롤링 데이터 저장)
3. review_responses - 리뷰 & 답글 저장
```

#### **2단계: 순위 추적** (향후 확장)
```
4. rank_history - 순위 이력 (애드로그 기능)
5. crawl_logs - 크롤링 작업 이력
6. monitored_keywords - 추적 키워드 관리
```

#### **3단계: 콘텐츠 & 광고** (향후 확장)
```
7. blog_posts - 블로그 포스팅
8. ad_keywords - 파워클릭 광고 키워드
```

---

## 📋 테이블 상세 설계

### 1. profiles (사용자 정보)

**목적**: 회원 관리, 등급별 사용 한도

```sql
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 회원 분류
  user_type text NOT NULL DEFAULT 'owner',  -- 'admin', 'owner', 'agency'
  membership_level text NOT NULL DEFAULT 'seed',
  
  -- 기본 정보
  name text,
  business_name text,  -- 상호명
  kakao_id text UNIQUE,  -- 카카오 로그인 ID (나중에 연동)
  email text,
  phone text,
  
  -- 사용 한도
  monthly_review_limit integer NOT NULL DEFAULT 10,
  monthly_blog_limit integer NOT NULL DEFAULT 2,
  
  -- 구독 정보
  subscription_status text DEFAULT 'active',  -- 'active', 'expired', 'cancelled'
  subscription_started_at timestamp with time zone,
  subscription_expires_at timestamp with time zone,
  last_payment_date timestamp with time zone,
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
```

**특징**:
- `auth.users` 의존성 제거 → 테스트 회원 직접 INSERT 가능
- `kakao_id` NULL 허용 → 카카오 로그인 나중에 연동

---

### 2. places (식당 정보)

**목적**: 크롤링 데이터 재사용, 중복 방지

```sql
CREATE TABLE public.places (
  id bigserial PRIMARY KEY,
  place_id varchar(50) UNIQUE NOT NULL,  -- 네이버 place_id
  
  -- 기본 정보
  place_name varchar(200) NOT NULL,
  category varchar(100),  -- 예: "한식>육류,고기요리"
  
  -- 주소
  road_address text,  -- 도로명 주소
  lot_address text,   -- 지번 주소
  sido varchar(50),   -- 시/도
  sigungu varchar(50),  -- 시/군/구
  dong varchar(50),   -- 읍/면/동
  
  -- 연락처
  phone varchar(20),
  homepage text,
  
  -- 통계
  rating decimal(3,2),  -- 평점 (예: 4.52)
  visitor_reviews integer DEFAULT 0,  -- 방문자 리뷰 수
  blog_reviews integer DEFAULT 0,     -- 블로그 리뷰 수
  
  -- 영업 정보
  business_hours text,  -- JSON 또는 텍스트
  break_time text,
  
  -- 메타데이터
  first_crawled_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  last_crawled_at timestamp with time zone,
  crawl_count integer DEFAULT 1,
  
  created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
```

**특징**:
- `place_id`로 중복 방지 (UNIQUE)
- 한 번 저장하면 계속 재사용
- 크롤링할 때마다 `last_crawled_at` 업데이트

---

### 3. review_responses (리뷰 & 답글)

**목적**: 고객 리뷰와 AI 생성 답글 저장

```sql
CREATE TABLE public.review_responses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id varchar(50) REFERENCES public.places(place_id) ON DELETE SET NULL,
  
  -- 입력 데이터
  naver_place_url text,  -- 네이버 플레이스 URL
  customer_review text NOT NULL,  -- 고객 리뷰 원문
  owner_tips text,  -- 사장님 추천 포인트 (예: "삼겹살, 냉면 추천")
  
  -- 크롤링 데이터 (확장성)
  place_info_json jsonb,  -- 크롤링한 식당 정보 전체 (JSON)
  
  -- AI 답글
  ai_response text NOT NULL,  -- AI가 생성한 답글
  ai_model varchar(50),  -- 사용한 AI 모델 (예: "claude", "chatgpt")
  generation_time_ms integer,  -- 생성 소요 시간 (밀리초)
  
  -- 사용 여부
  is_used boolean DEFAULT false,  -- 실제로 답글을 사용했는지
  used_at timestamp with time zone,  -- 사용 시간
  
  -- 피드백
  feedback_rating integer CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_comment text,
  
  -- 수정 이력
  edited_text text,  -- 사용자가 수정한 최종 답글
  is_edited boolean DEFAULT false,
  
  -- 메타데이터
  status text DEFAULT 'draft',  -- 'draft', 'used', 'archived'
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
```

**특징**:
- `place_id` 외래 키 → `places` 테이블과 연결
- `place_info_json` → 확장 가능한 JSON 저장
- `owner_tips` → 문자열 (배열 아님, 프론트엔드와 호환)

---

### 4. rank_history (순위 이력) - 향후 확장

**목적**: 애드로그 같은 순위 추적 기능

```sql
CREATE TABLE public.rank_history (
  id bigserial PRIMARY KEY,
  place_id varchar(50) NOT NULL REFERENCES public.places(place_id) ON DELETE CASCADE,
  keyword varchar(200) NOT NULL,  -- 검색 키워드 (예: "명장동맛집")
  rank_position integer NOT NULL,  -- 순위 (1-300)
  
  -- 해당 시점의 통계
  rating decimal(3,2),
  visitor_reviews integer,
  blog_reviews integer,
  
  measured_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
```

**사용 시나리오**:
```sql
-- 순위 변동 추이
SELECT measured_at, rank_position, visitor_reviews
FROM rank_history
WHERE place_id = '1390003666' AND keyword = '명장동맛집'
ORDER BY measured_at DESC;
```

---

### 5. blog_posts (블로그) - 향후 확장

```sql
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  place_id varchar(50) REFERENCES public.places(place_id) ON DELETE SET NULL,
  
  target_platform text NOT NULL DEFAULT 'naver_blog',  -- 'naver_blog', 'tistory', 등
  keywords text[],  -- 주요 키워드 배열
  blog_title text NOT NULL,
  blog_content text NOT NULL,
  
  status text NOT NULL DEFAULT 'draft',  -- 'draft', 'published', 'scheduled'
  published_at timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);
```

---

## 🔒 보안 설정 (RLS)

### 개발 단계 (현재)
```sql
-- 모든 테이블 RLS 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_responses ENABLE ROW LEVEL SECURITY;

-- 임시 정책: 모두 허용 (개발용)
CREATE POLICY "Dev: Allow all access" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Dev: Allow all access" ON public.places FOR ALL USING (true);
CREATE POLICY "Dev: Allow all access" ON public.review_responses FOR ALL USING (true);
```

### 프로덕션 단계 (향후)
```sql
-- profiles: 본인만 조회/수정
CREATE POLICY "Users can view own profile" ON public.profiles 
  FOR SELECT USING (auth.uid()::text = kakao_id);

CREATE POLICY "Users can update own profile" ON public.profiles 
  FOR UPDATE USING (auth.uid()::text = kakao_id);

-- review_responses: 본인 리뷰만 조회/수정
CREATE POLICY "Users can manage own reviews" ON public.review_responses
  FOR ALL USING (user_id IN (SELECT id FROM profiles WHERE kakao_id = auth.uid()::text));

-- places: 모두 조회 가능 (공개 데이터)
CREATE POLICY "Public can read places" ON public.places FOR SELECT USING (true);
```

---

## 📊 테스트 데이터

### 샘플 회원 (3명)

```sql
-- 1. 관리자
INSERT INTO public.profiles (
  user_type, membership_level, name, monthly_review_limit, monthly_blog_limit
) VALUES (
  'admin', 'admin', '시스템 관리자', 99999, 99999
);

-- 2. 식당 대표 (premium)
INSERT INTO public.profiles (
  user_type, membership_level, name, business_name, monthly_review_limit, monthly_blog_limit
) VALUES (
  'owner', 'premium', '김사장', '두찜 명장점', 999, 100
);

-- 3. 대행사 (master)
INSERT INTO public.profiles (
  user_type, membership_level, name, business_name, monthly_review_limit, monthly_blog_limit
) VALUES (
  'agency', 'master', '마케팅 프로', '마케팅 대행사', 2000, 500
);
```

### 샘플 식당 (1개)

```sql
INSERT INTO public.places (
  place_id, place_name, category, road_address, phone, 
  rating, visitor_reviews, blog_reviews
) VALUES (
  '1390003666', 
  '두찜 명장점', 
  '한식>육류,고기요리', 
  '부산광역시 동래구 명장로 123', 
  '051-1234-5678',
  4.52,
  2335,
  253
);
```

### 샘플 리뷰 (1개)

```sql
INSERT INTO public.review_responses (
  user_id, 
  place_id,
  naver_place_url,
  customer_review,
  owner_tips,
  ai_response,
  ai_model,
  is_used
) VALUES (
  (SELECT id FROM profiles WHERE name = '김사장' LIMIT 1),
  '1390003666',
  'https://m.place.naver.com/restaurant/1390003666',
  '고기가 정말 맛있어요! 특히 삼겹살이 일품이었습니다. 다만 대기 시간이 조금 길었어요.',
  '삼겹살, 돼지갈비 추천',
  '안녕하세요, 두찜 명장점입니다! 저희 삼겹살을 맛있게 드셨다니 정말 기쁩니다. 대기 시간이 길어 불편을 드려 죄송합니다. 다음에는 예약 후 방문해주시면 더 편하게 이용하실 수 있습니다. 감사합니다!',
  'claude',
  false
);
```

---

## 🚀 작업 순서

### Step 1: Supabase 준비
1. [Supabase 대시보드](https://supabase.com/dashboard) 접속
2. 프로젝트 선택
3. SQL Editor 열기

### Step 2: 기존 샘플 데이터 삭제 (선택)
```sql
-- 기존 테스트 테이블 삭제 (instruments 등)
DROP TABLE IF EXISTS public.instruments CASCADE;
```

### Step 3: 확장 기능 활성화
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Step 4: 1단계 테이블 생성
```sql
-- profiles, places, review_responses 생성
-- (위의 테이블 상세 설계 참고)
```

### Step 5: 인덱스 생성
```sql
CREATE INDEX idx_profiles_kakao_id ON profiles(kakao_id);
CREATE INDEX idx_profiles_user_type ON profiles(user_type);
CREATE INDEX idx_places_place_id ON places(place_id);
CREATE INDEX idx_review_responses_user_id ON review_responses(user_id);
CREATE INDEX idx_review_responses_place_id ON review_responses(place_id);
```

### Step 6: RLS 설정
```sql
-- 개발 모드: 모두 허용
-- (위의 보안 설정 참고)
```

### Step 7: 테스트 데이터 삽입
```sql
-- 샘플 회원, 식당, 리뷰 삽입
-- (위의 테스트 데이터 참고)
```

### Step 8: 테이블 확인
```sql
-- 테이블 목록 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 데이터 확인
SELECT * FROM profiles;
SELECT * FROM places;
SELECT * FROM review_responses;
```

---

## 🔗 프론트엔드 연동

### review.html 수정 필요 사항

**현재 전송 데이터:**
```javascript
{
  reviewText: "고객 리뷰",
  ownerTips: "삼겹살 추천",
  placeInfo: { ... }
}
```

**DB 저장 시 변환:**
```javascript
{
  customer_review: reviewText,
  owner_tips: ownerTips,
  place_info_json: placeInfo,
  place_id: extractPlaceId(placeInfo),
  naver_place_url: placeUrl
}
```

### server.js 추가 필요 사항

```javascript
// Supabase 클라이언트 초기화
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 답글 생성 후 DB 저장
app.post("/api/generate-reply", async (req, res) => {
  // ... AI 답글 생성 ...
  
  // DB 저장
  const { data, error } = await supabase
    .from('review_responses')
    .insert({
      user_id: req.user.id,  // 로그인 정보에서
      place_id: placeId,
      customer_review: reviewText,
      owner_tips: ownerTips,
      place_info_json: placeInfo,
      ai_response: reply,
      ai_model: 'claude'
    });
});
```

---

## ⚠️ 중요 주의사항

### 1. 외래 키 의존성
- `review_responses.place_id` → `places.place_id`
- `places` 테이블에 식당 정보가 먼저 저장되어야 함
- 저장 순서: places → review_responses

### 2. JSONB 활용
- `place_info_json`에 확장 가능한 데이터 저장
- 나중에 컬럼 추가 없이 데이터 확장 가능

### 3. 회원 등급별 한도
- `monthly_review_limit`, `monthly_blog_limit` 확인
- 한도 초과 시 에러 처리 필요

### 4. RLS 정책
- 개발 단계: 모두 허용
- 프로덕션: 반드시 본인 데이터만 조회 가능하도록 변경

### 5. 카카오 로그인 연동
- 현재: 테스트 회원 직접 INSERT
- 향후: `kakao_id`로 회원 조회/생성

---

## 📚 참고 자료

### 기존 파일
- `docs/SUPABASE_SETUP_GUIDE.md` - Supabase 설정 가이드
- `docs/AI_LOG.md` - 작업 이력
- `review.html` - 프론트엔드
- `server.js` - 백엔드 API

### Supabase 문서
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL JSON Functions](https://www.postgresql.org/docs/current/functions-json.html)

---

## ✅ 체크리스트

작업 시작 전 확인:
- [ ] Supabase 프로젝트 생성 완료
- [ ] `.env` 파일에 Supabase 설정 확인
- [ ] 기존 샘플 데이터 삭제 결정
- [ ] 테이블 설계 이해 완료
- [ ] 회원 등급 체계 이해 완료

작업 완료 후 확인:
- [ ] 3개 테이블 생성 확인 (profiles, places, review_responses)
- [ ] 인덱스 생성 확인
- [ ] RLS 정책 적용 확인
- [ ] 테스트 데이터 삽입 확인
- [ ] Supabase Table Editor에서 데이터 조회 확인

---

## 🎯 다음 단계 (이 작업 완료 후)

1. `server.js`에 Supabase 저장 로직 추가
2. `review.html`에서 DB 저장 API 호출
3. 마이페이지 구현 (저장된 리뷰 목록)
4. 사용 통계 추가 (일별/월별)
5. 카카오 로그인 연동

---

**작성자**: AI Assistant  
**최종 수정**: 2025-10-22  
**버전**: 1.0

