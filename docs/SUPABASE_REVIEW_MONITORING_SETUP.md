# 🗄️ Supabase 리뷰 모니터링 테이블 생성 가이드

> 리뷰 모니터링 시스템을 사용하기 위해 Supabase에 테이블을 생성하는 가이드

---

## 📝 실행 방법

### 1. Supabase Dashboard 접속

```
https://app.supabase.com
```

### 2. 프로젝트 선택

사장픽 프로젝트 선택

### 3. SQL Editor 열기

좌측 메뉴: **SQL Editor**

### 4. SQL 파일 복사 & 실행

**파일 위치:**
```
database/schemas/features/review/review-monitoring.sql
```

**내용을 복사해서 SQL Editor에 붙여넣고 RUN 클릭!**

---

## ✅ 생성되는 테이블

### 1. review_monitoring
- 사용자별 리뷰 모니터링 설정
- 플레이스 URL, 알림 설정 저장

### 2. review_alerts
- 수집된 리뷰 알림 저장
- 긴급 리뷰, 고평점 리뷰 등

### 3. review_crawl_logs
- 크롤링 실행 로그
- 성공/실패 기록

---

## 🧪 테스트

SQL 실행 후 테이블 확인:

```sql
-- 테이블 존재 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'review_%';

-- 결과: review_monitoring, review_alerts, review_crawl_logs
```

---

## 🚨 주의사항

- 이미 테이블이 존재하면 `IF NOT EXISTS`로 인해 에러 없이 스킵됩니다
- RLS (Row Level Security)가 자동으로 설정됩니다
- 사용자는 본인의 데이터만 볼 수 있습니다

---

**작성일:** 2025-10-30  
**업데이트:** 테이블 생성 후 리뷰 모니터링 기능 사용 가능

