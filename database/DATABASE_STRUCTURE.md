# 데이터베이스 구조 가이드

## 📊 개요

사장픽 프로젝트의 데이터베이스는 **기능별로 모듈화**되어 있습니다.

## 🗂️ 폴더 구조

```
database/
├── schemas/
│   ├── core/                    # 핵심 테이블
│   │   ├── profiles             # 회원 프로필
│   │   └── users                # 인증 (Supabase Auth)
│   │
│   ├── features/                # 기능별 테이블
│   │   ├── blog/               # ② 블로그 자동 생성
│   │   │   ├── blog-posts.sql
│   │   │   └── blog-diversity.sql
│   │   │
│   │   ├── review/             # ① 리뷰 분석 & 답변
│   │   │   └── reviews.sql
│   │   │
│   │   ├── store/              # 가게 정보 관리
│   │   │   └── store-promotion.sql
│   │   │
│   │   ├── cache/              # 크롤링 캐시
│   │   │   └── place-cache.sql
│   │   │
│   │   ├── crm/                # ③ 단골 리마케팅 (예정)
│   │   ├── analytics/          # ⑥⑦ 매출/유입 분석 (예정)
│   │   ├── sns/                # ⑧ SNS 모니터링 (예정)
│   │   ├── weather-marketing/  # ⑤ 날씨별 추천 (예정)
│   │   └── ai-advisor/         # ⑩ AI 챗봇 (예정)
│   │
│   └── monitoring/              # 어드민/모니터링 (→ admin/sql/monitoring/)
│
└── migrations/                  # 버전별 마이그레이션 (향후)
```

## 📌 핵심 테이블

### profiles
- 회원 프로필 정보
- 가게 정보 (place_url, store_name, address, business_hours 등)
- 전화번호 (phone_number, store_phone_number)
- 블로그 스타일 설정 (blog_style jsonb)
- 위치: `database/schemas/core/`

## 🎯 기능별 테이블

### ② 블로그 자동 생성
**테이블:**
- `blog_posts` - 생성된 블로그 글 저장
  - user_id, blog_type (our_store, review_team, visit_review)
  - blog_content, selected_topic
  - writing_angle, diversity_keywords

**스키마 위치:** `database/schemas/features/blog/`

### ① 리뷰 분석 & 답변
**테이블:**
- `reviews` - 리뷰 데이터
- `review_replies` - AI 생성 답변
- `reply_templates` - 답변 템플릿

**스키마 위치:** `database/schemas/features/review/`

### 가게 정보 관리
**테이블:**
- `store_promotions` - 내 가게 알리기
  - 7개 항목: signature_menu, special_ingredients, atmosphere_facilities, owner_story, recommended_situations, sns_photo_points, special_events

**스키마 위치:** `database/schemas/features/store/`

### 크롤링 캐시
**테이블:**
- `place_crawl_cache` - 네이버 플레이스 크롤링 캐시 (24시간)
  - place_url, place_info, crawl_count
  - 중복 크롤링 방지

**스키마 위치:** `database/schemas/features/cache/`

## 🔮 향후 추가될 기능

### ③ 단골 리마케팅 (CRM)
```sql
customers              -- 고객 DB
customer_segments      -- 세그먼트 분류
marketing_campaigns    -- 캠페인 관리
campaign_history       -- 발송 이력
```

### ⑥⑦ 매출/유입 분석
```sql
sales_data            -- 매출 데이터
traffic_sources       -- 유입 경로
conversion_tracking   -- 전환 추적
```

### ⑧ SNS 실시간 모니터링
```sql
sns_mentions          -- 인스타/블로그 언급
sentiment_analysis    -- 감성 분석
trending_keywords     -- 트렌딩 키워드
```

### ⑤ 날씨별 메뉴 추천
```sql
weather_campaigns     -- 날씨 기반 캠페인
weather_history       -- 날씨별 성과 이력
```

### ⑩ AI 챗봇 어드바이저
```sql
chat_sessions         -- 대화 세션
chat_messages         -- 메시지 이력
recommendations       -- 추천 내역
```

## 🛡️ 보안 (RLS)

모든 테이블은 **Row Level Security (RLS)** 정책이 적용되어 있습니다.

- **회원:** 본인 데이터만 접근 가능
- **관리자:** 모든 데이터 조회 가능
- **시스템 (service_role):** 데이터 삽입/관리 가능

## 📝 스키마 적용 방법

### 1. Supabase SQL Editor 사용
```bash
# 1. Supabase 대시보드 → SQL Editor
# 2. 각 스키마 파일 내용 복사
# 3. 실행 (Run)
```

### 2. 순서
1. **Core 테이블** 먼저
   - profiles, users
   
2. **기능별 테이블** 순차적으로
   - blog → review → store → cache
   
3. **모니터링 테이블** (선택)
   - admin/sql/monitoring/ 참조

## 🔄 마이그레이션

향후 스키마 변경 시:
1. `database/migrations/YYYYMMDD_description.sql` 형식으로 생성
2. 변경 내역 기록
3. 롤백 스크립트 포함

## 📚 참고 문서

- **어드민/모니터링:** `admin/sql/README.md`
- **전체 구조:** `docs/AI_START_HERE.md`
- **배포 가이드:** `docs/DEPLOY_GUIDE.md`

