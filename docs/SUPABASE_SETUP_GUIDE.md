# Supabase 데이터베이스 설정 가이드

리뷰 답글 관리 시스템을 위한 Supabase 클라우드 데이터베이스 설정 방법입니다.

## 📋 순서

### 1단계: Supabase 프로젝트 확인

1. [Supabase 대시보드](https://supabase.com/dashboard) 접속
2. 기존 프로젝트 선택 (또는 새로 생성)
3. 프로젝트 설정 → API 섹션에서 다음 정보 복사:
   - `Project URL` (예: `https://abcdefgh.supabase.co`)
   - `anon` public key
   - `service_role` secret key

### 2단계: 환경 변수 설정

프로젝트 루트에 `.env` 파일을 열고 다음 내용 추가:

```bash
# Supabase (데이터베이스)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3단계: 기존 샘플 데이터 정리 (선택)

기존 테스트 데이터를 정리하려면:

1. Supabase 대시보드 → SQL Editor
2. 다음 SQL 실행:

```sql
-- 기존 샘플 데이터 삭제
TRUNCATE TABLE rank_history CASCADE;
TRUNCATE TABLE photos CASCADE;
TRUNCATE TABLE menus CASCADE;
TRUNCATE TABLE place_details CASCADE;
TRUNCATE TABLE places CASCADE;
TRUNCATE TABLE crawl_logs CASCADE;
```

⚠️ **주의**: 이 작업은 되돌릴 수 없습니다!

### 4단계: 리뷰 관리 테이블 생성

1. Supabase 대시보드 → SQL Editor
2. `supabase-schema-reviews.sql` 파일 내용 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭

또는 터미널에서:

**Windows**:
```powershell
Get-Content supabase-schema-reviews.sql | clip
```

**Mac/Linux**:
```bash
cat supabase-schema-reviews.sql | pbcopy
```

### 5단계: 테이블 확인

SQL Editor에서 다음 쿼리로 테이블 생성 확인:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

다음 테이블이 보여야 합니다:
- ✅ `users` - 사용자 정보
- ✅ `reviews` - 리뷰 관리
- ✅ `review_replies` - 답글 관리
- ✅ `usage_stats` - 사용 통계
- ✅ `reply_templates` - 답글 템플릿

### 6단계: 서버 재시작

```bash
node server.js
```

---

## 🔒 보안 설정

### Row Level Security (RLS)

리뷰 테이블은 자동으로 RLS가 활성화되어 있습니다:
- 사용자는 **자신의 데이터만** 조회/수정 가능
- 다른 사용자의 리뷰나 답글은 볼 수 없음

### API Key 보호

⚠️ **절대로** 다음 키를 공개하지 마세요:
- `service_role` key - 모든 권한 포함
- `.env` 파일을 Git에 커밋하지 않도록 `.gitignore`에 포함

---

## 📊 데이터 확인

### Supabase 대시보드에서 확인:

1. **Table Editor** → 각 테이블 클릭
2. 데이터 직접 조회/수정 가능

### API로 확인:

```javascript
// 사용자 조회
const { data, error } = await supabase
  .from('users')
  .select('*')
  .limit(10);

// 리뷰 조회
const { data, error } = await supabase
  .from('reviews')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(20);
```

---

## ❓ 문제 해결

### "relation does not exist" 오류

→ 테이블이 생성되지 않았습니다. 4단계 다시 실행

### "permission denied" 오류

→ RLS 정책 확인 또는 `service_role` key 사용

### 연결 안 됨

→ `.env` 파일의 URL과 Key 확인

---

## 🔄 백업 및 복구

### 자동 백업

Supabase는 매일 자동으로 백업합니다:
- 대시보드 → Database → Backups에서 확인
- Point-in-time recovery 가능 (유료 플랜)

### 수동 백업

SQL Editor에서:

```sql
-- CSV로 내보내기
COPY (SELECT * FROM reviews) TO '/tmp/reviews_backup.csv' WITH CSV HEADER;
```

---

## 📈 다음 단계

데이터베이스 설정이 완료되었습니다!

이제 다음 작업을 진행할 수 있습니다:
- ✅ 리뷰 작성 및 저장
- ✅ AI 답글 생성 및 저장
- ✅ 사용 통계 추적
- ✅ 답글 템플릿 관리

