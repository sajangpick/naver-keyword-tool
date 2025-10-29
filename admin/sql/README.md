# Admin SQL Files

이 폴더는 어드민 및 모니터링 관련 SQL 스키마 파일들을 보관합니다.

## 파일 구조

### monitoring/
- 시스템 모니터링, 분석, 에러 로깅 관련 테이블 스키마
- analytics, error_logs, performance 등

### setup/
- 초기 설정 및 수정 스크립트
- fix-*.sql, simple-*.sql 등

## 관련 테이블
- api_performance
- error_logs, error_patterns, error_summary
- page_performance
- system_health
- user_events, user_funnel
- daily_stats

