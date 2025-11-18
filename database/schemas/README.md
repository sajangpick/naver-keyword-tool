# Database Schemas

데이터베이스 스키마를 기능별로 관리합니다.

## 폴더 구조

### core/
핵심 테이블 스키마 (필수)
- `profiles` - 회원 정보
- `users` - 인증 정보 (Supabase Auth)

### features/
기능별 테이블 스키마

#### blog/
블로그 콘텐츠 자동 생성 기능 (②)
- `blog_posts` - 블로그 글 저장
- `blog_styles` - 블로그 스타일 설정

#### review/
리뷰 분석 및 답변 기능 (①)
- `reviews` - 리뷰 데이터
- `review_responses` - AI 답변

#### store/
가게 정보 관리
- `store_promotions` - 프로모션 정보
- `store_info` - 가게 기본 정보

#### cache/
크롤링 캐시
- `place_crawl_cache` - 네이버 플레이스 크롤링 캐시
- `places` - 장소 정보

### monitoring/
어드민/모니터링 테이블 (관리자 전용)
- API 성능, 에러 로깅, 시스템 상태 등

## 향후 추가될 기능

### crm/ (예정)
③ 단골 고객 리마케팅
- `customers` - 고객 DB
- `customer_segments` - 세그먼트
- `marketing_campaigns` - 캠페인

### analytics/ (예정)
⑥⑦ 매출/유입 분석
- `sales_data` - 매출 데이터
- `traffic_sources` - 유입 경로

### sns/ (예정)
⑧ SNS 실시간 모니터링
- `sns_mentions` - SNS 언급

### weather-marketing/ (예정)
⑤ 날씨별 메뉴 추천

### ai-advisor/ (예정)
⑩ AI 챗봇 어드바이저

