# 어드민 시스템 구조 가이드

## 📊 개요

사장픽 프로젝트의 어드민 시스템은 **모니터링, 회원 관리, 분석** 기능을 제공합니다.

## 🗂️ 폴더 구조

```
admin/
├── pages/                       # HTML 페이지 (현재 위치: admin/*.html)
│   ├── index.html              # 어드민 대시보드
│   ├── analytics.html          # 분석 대시보드
│   ├── errors.html             # 에러 로그 관리
│   ├── performance.html        # 성능 모니터링
│   ├── member-management.html  # 회원 관리
│   ├── rank-report.html        # 랭킹 리포트
│   └── db-view.html            # DB 뷰어
│
├── sql/                         # SQL 스키마 & 스크립트
│   ├── monitoring/             # 모니터링 시스템 스키마
│   │   ├── analytics.sql       # 사용자 분석 (user_events, daily_stats, user_funnel)
│   │   ├── performance.sql     # 성능 로깅 (api_performance, page_performance)
│   │   └── error-logging.sql   # 에러 추적 (error_logs, error_patterns)
│   │
│   └── setup/                  # 초기 설정 & 수정 스크립트
│       ├── fix-*.sql           # 기존 테이블 수정 스크립트
│       └── simple-*.sql        # 간단한 버전 스키마
│
└── docs/                        # 어드민 관련 문서
    └── MONITORING_SETUP_COMPLETE.md
```

## 📌 주요 기능

### 1. 📊 분석 대시보드 (Analytics)

**페이지:** `admin/analytics.html`

**데이터베이스 테이블:**
- `user_events` - 사용자 행동 이벤트 로그
- `daily_stats` - 일간 통계 집계
- `user_funnel` - 전환 퍼널 추적
- `popular_features` - 인기 기능 통계

**스키마:** `admin/sql/monitoring/analytics.sql`

**주요 지표:**
- DAU/MAU (일간/월간 활성 사용자)
- 기능별 사용 통계
- 퍼널 전환율
- 시간대별 활동

### 2. ⚡ 성능 모니터링 (Performance)

**페이지:** `admin/performance.html`

**데이터베이스 테이블:**
- `api_performance` - API 요청 성능
- `page_performance` - 페이지 로딩 성능
- `crawling_performance` - 크롤링 성능
- `system_health` - 시스템 헬스 체크

**스키마:** `admin/sql/monitoring/performance.sql`

**주요 지표:**
- API 응답 시간 (평균, P95, P99)
- 에러율
- 느린 API Top 10
- 크롤링 성공률

### 3. 🐛 에러 로깅 (Error Logging)

**페이지:** `admin/errors.html`

**데이터베이스 테이블:**
- `error_logs` - 상세 에러 로그
- `error_summary` - 시간대별 요약
- `error_patterns` - 반복 발생 패턴

**스키마:** `admin/sql/monitoring/error-logging.sql`

**주요 기능:**
- 실시간 에러 추적
- 심각도별 분류 (low, medium, high, critical)
- 소스별 분류 (frontend, backend, crawling)
- 에러 패턴 자동 감지

### 4. 👥 회원 관리 (Member Management)

**페이지:** `admin/member-management.html`

**API:** `api/admin/members.js`, `api/admin/members/[memberId].js`

**주요 기능:**
- 회원 목록 조회
- 회원 상세 정보
- 가게 정보 수정
- 활동 내역 조회

## 🛡️ 보안 (RLS)

**모니터링 테이블 접근 권한:**
- ✅ 관리자 (user_type='admin') - 모든 데이터 조회 가능
- ✅ 시스템 (service_role) - 데이터 삽입 가능
- ❌ 일반 사용자 - 접근 불가

**RLS 정책 파일:** `supabase-rls-monitoring.sql` (루트)

## 📊 모니터링 테이블 상세

### user_events (사용자 이벤트)
```sql
- event_name: 'page_view', 'blog_created', 'signup', 'login', etc.
- event_category: 'user', 'blog', 'review', 'crawling'
- page_url, referrer, device_type, browser, os
- 자동 삭제: 90일 후
```

### daily_stats (일간 통계)
```sql
- total_users, new_users, active_users
- blogs_created, reviews_replied, crawling_used
- bounce_rate, retention_rate
- 자동 삭제: 1년 후
```

### error_logs (에러 로그)
```sql
- error_type: 'javascript', 'api', 'database', 'auth', 'crawling'
- severity: 'low', 'medium', 'high', 'critical'
- error_message, error_stack, file_path
- 자동 삭제: 해결됨 90일 후, 미해결 180일 후
```

### api_performance (API 성능)
```sql
- endpoint, method, response_time_ms, status_code
- user_id, ip_address
- 자동 삭제: 30일 후
```

## 🔧 설정 방법

### 1. 데이터베이스 스키마 생성

```bash
# Supabase SQL Editor에서 순차 실행
1. admin/sql/monitoring/analytics.sql
2. admin/sql/monitoring/performance.sql
3. admin/sql/monitoring/error-logging.sql
```

### 2. RLS 보안 정책 적용

```bash
# 루트의 supabase-rls-monitoring.sql 실행
```

### 3. 프론트엔드 추적 스크립트 추가

```html
<!-- 각 페이지에 추가 -->
<script src="/assets/analytics.js"></script>
<script src="/assets/error-logger.js"></script>
<script src="/assets/performance-tracker.js"></script>
```

## 📝 사용 가이드

### 통계 함수 사용 예시

```sql
-- DAU 조회
SELECT get_dau('2025-10-29');

-- MAU 조회
SELECT get_mau('2025-10-01');

-- 기능별 사용 통계 (최근 7일)
SELECT * FROM get_feature_usage(7);

-- 느린 API Top 10 (최근 1시간)
SELECT * FROM get_slow_apis(60);

-- 퍼널 전환율
SELECT * FROM get_funnel_conversion();
```

## 🔄 자동 정리

모니터링 데이터는 자동으로 정리됩니다:

```sql
-- Supabase Dashboard → Database → Cron Jobs
-- 매일 자정에 실행
SELECT cleanup_old_events();
SELECT cleanup_old_performance_logs();
SELECT cleanup_old_error_logs();
```

## 📚 참고 문서

- **모니터링 설정 완료:** `admin/docs/MONITORING_SETUP_COMPLETE.md`
- **데이터베이스 구조:** `database/DATABASE_STRUCTURE.md`
- **전체 가이드:** `docs/AI_START_HERE.md`

