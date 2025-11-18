# 뉴스 게시판 데이터 삭제 가이드

## 📋 목적
기존 뉴스 데이터를 모두 삭제하고, `news-management.html` 관리자 페이지에서 작성한 뉴스만 저장되도록 합니다.

## 🔧 실행 방법

### 1. Supabase에서 SQL 실행

1. Supabase 대시보드 접속
2. SQL Editor 메뉴로 이동
3. `scripts/delete-all-news.sql` 파일의 내용을 복사하여 실행

```sql
-- 모든 뉴스 삭제
DELETE FROM news_board;

-- 삭제 확인 (결과가 0개여야 함)
SELECT COUNT(*) as remaining_news FROM news_board;
```

### 2. 확인 사항

- ✅ `news_board` 테이블의 모든 데이터가 삭제되었는지 확인
- ✅ `news-management.html`에서 새 뉴스를 작성할 수 있는지 확인
- ✅ `news-board.html`에서 뉴스 목록이 비어있는지 확인

## 📝 참고사항

- **백업 권장**: 삭제 전에 중요한 데이터가 있다면 백업하세요.
- **새 뉴스 작성**: 삭제 후에는 `news-management.html` 관리자 페이지에서만 뉴스를 작성할 수 있습니다.
- **자동 저장**: `news-management.html`에서 "저장" 버튼을 클릭하면 자동으로 `news_board` 테이블에 저장됩니다.

## 🚨 주의사항

- 이 작업은 **되돌릴 수 없습니다**.
- 삭제 후에는 기존 뉴스 데이터를 복구할 수 없으니 신중하게 진행하세요.

