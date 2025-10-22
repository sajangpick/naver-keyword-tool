# 🧪 로컬에서 Supabase 데이터 확인하는 방법

> 영상처럼 로컬 서버 → 브라우저에서 JSON 데이터 확인! 🚀

---

## 📋 준비물

- ✅ Supabase 프로젝트 (이미 있음)
- ✅ `.env` 파일에 Supabase 정보 입력

---

## 1️⃣ 환경변수 설정 (.env 파일)

프로젝트 루트에 `.env` 파일을 만들고 다음 내용을 추가하세요:

```bash
# Supabase 정보
SUPABASE_URL=https://ptuzlubggggbgsophfcna.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0dXpsdWJnZ2diZ3NvcGhmY25hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0MjEzMzQsImV4cCI6MjA3NTk5NzMzNH0.NaMMH7vVpcrFAi9IOQ0o_HF6rQ7dOdiAXAkxu6r84CE
```

### 📝 어디서 찾나요?

1. **Supabase 대시보드** 접속 (https://supabase.com)
2. 프로젝트 선택
3. 좌측 메뉴 **"Settings"** → **"API"** 클릭
4. **Project URL** → `SUPABASE_URL`에 복사
5. **anon public** 키 → `SUPABASE_ANON_KEY`에 복사

---

## 2️⃣ 로컬 서버 실행

터미널을 열고 다음 명령어 실행:

```bash
pnpm run dev
```

또는

```bash
npm run dev
```

서버가 시작되면 다음과 같은 메시지가 보입니다:

```
🚀 통합 API 서버가 시작되었습니다!
🌐 서버 주소: http://0.0.0.0:3000
```

---

## 3️⃣ 브라우저에서 데이터 확인

브라우저를 열고 다음 주소로 접속:

### 기본 테스트 (places 테이블 10개)
```
http://localhost:3000/api/test-supabase
```

### 다른 테이블 조회
```
http://localhost:3000/api/test-supabase?table=menus
http://localhost:3000/api/test-supabase?table=photos
http://localhost:3000/api/test-supabase?table=rank_history
```

### 더 많은 데이터 조회 (limit 변경)
```
http://localhost:3000/api/test-supabase?limit=50
```

### 특정 테이블 + 개수 지정
```
http://localhost:3000/api/test-supabase?table=places&limit=20
```

---

## 4️⃣ 결과 확인

### ✅ 성공 시 (영상처럼!)

```json
{
  "success": true,
  "message": "✅ Supabase 연결 성공!",
  "data": [
    {
      "id": 1,
      "place_id": "1234567",
      "place_name": "맛있는 식당",
      "category": "한식",
      "rating": 4.5,
      ...
    },
    ...
  ],
  "metadata": {
    "table": "places",
    "count": 10,
    "limit": 10,
    "timestamp": "2025-10-22T...",
    "connection": "OK"
  }
}
```

### ❌ 환경변수가 없는 경우

```json
{
  "success": false,
  "error": "Supabase 환경변수가 설정되지 않았습니다.",
  "missing": {
    "url": true,
    "key": true
  },
  "hint": ".env 파일에 SUPABASE_URL과 SUPABASE_ANON_KEY를 추가하세요"
}
```

→ `.env` 파일 확인!

### ❌ 테이블이 없는 경우

```json
{
  "success": false,
  "error": "Supabase 데이터 조회 실패",
  "hint": "테이블 'places'이(가) 존재하지 않거나 권한이 없습니다. supabase-schema.sql을 실행했는지 확인하세요."
}
```

→ Supabase SQL Editor에서 `supabase-schema.sql` 실행!

---

## 5️⃣ 데이터가 없다면? (테이블 생성)

### Supabase 대시보드에서:

1. 좌측 메뉴 **"SQL Editor"** 클릭
2. **"New query"** 클릭
3. `supabase-schema.sql` 파일 내용 복사해서 붙여넣기
4. **"Run"** 버튼 클릭
5. 테이블 생성 완료! ✅

### 테스트 데이터 추가

SQL Editor에서 실행:

```sql
-- 테스트 식당 데이터 추가
INSERT INTO places (place_id, place_name, category, rating, visitor_reviews, blog_reviews)
VALUES 
  ('test001', '맛있는 식당', '한식', 4.5, 120, 45),
  ('test002', '멋진 카페', '카페', 4.2, 89, 32),
  ('test003', '좋은 치킨집', '치킨', 4.7, 203, 67);
```

---

## 📊 사용 가능한 테이블 목록

| 테이블 이름 | 설명 |
|------------|------|
| `places` | 식당 기본 정보 |
| `place_details` | 식당 상세 정보 |
| `menus` | 메뉴 정보 |
| `photos` | 사진 정보 |
| `rank_history` | 순위 히스토리 |
| `crawl_logs` | 크롤링 로그 |

---

## 🎯 활용 예시

### 1. 평점 높은 식당 TOP 10

Supabase Dashboard → SQL Editor:

```sql
SELECT place_name, rating, visitor_reviews
FROM places
WHERE rating IS NOT NULL
ORDER BY rating DESC
LIMIT 10;
```

### 2. 로컬 API로 확인

```
http://localhost:3000/api/test-supabase?table=places&limit=10
```

---

## 🔧 문제 해결

### Q1. "Module not found: @supabase/supabase-js"

**해결:**
```bash
pnpm install @supabase/supabase-js
```

### Q2. 포트 3000이 이미 사용 중

**해결:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID [PID번호] /F

# macOS/Linux
lsof -i :3000
kill -9 [PID번호]
```

### Q3. .env 파일을 못 읽어요

**확인사항:**
- `.env` 파일이 프로젝트 **루트 폴더**에 있는지 확인
- `SUPABASE_URL=` 형식 확인 (띄어쓰기 없이)
- 서버 재시작 (Ctrl + C → `pnpm run dev`)

---

## 🎉 완료!

이제 영상처럼 로컬에서 Supabase 데이터를 JSON으로 확인할 수 있습니다!

### 다음 단계

1. ✅ 데이터 조회 성공
2. 📝 프론트엔드에서 데이터 표시
3. 🚀 프로덕션 배포

---

**궁금한 점이 있으면 언제든지 물어보세요!** 😊



