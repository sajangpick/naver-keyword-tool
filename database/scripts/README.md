# 🗄️ 데이터베이스 스크립트

이 폴더는 데이터베이스 관련 스크립트들을 포함합니다.

## 파일 목록

### init-database.js
- **용도**: 로컬 SQLite 데이터베이스 초기화
- **실행**: `pnpm run db:init`
- **설명**: 개발 환경용 로컬 DB 테이블 생성

### seed-database.js
- **용도**: 로컬 DB 샘플 데이터 삽입
- **실행**: `pnpm run db:seed`
- **설명**: 테스트용 더미 데이터 생성

### seed-supabase.js
- **용도**: Supabase 클라우드 DB 샘플 데이터 삽입
- **실행**: `pnpm run supabase:seed`
- **설명**: 프로덕션 DB에 초기 데이터 생성

### check-database.js
- **용도**: DB 연결 및 상태 확인
- **실행**: `pnpm run db:check`
- **설명**: 데이터베이스 연결 테스트 및 테이블 확인

## 사용 순서

```bash
# 1. 로컬 DB 초기화
pnpm run db:init

# 2. 샘플 데이터 삽입
pnpm run db:seed

# 3. DB 상태 확인
pnpm run db:check

# 4. (선택) Supabase에 데이터 삽입
pnpm run supabase:seed
```

## 주의사항

- `init-database.js`와 `seed-database.js`는 로컬 개발용입니다
- `seed-supabase.js`는 프로덕션 DB에 영향을 줄 수 있으니 주의하세요
- Supabase 스키마는 `database/schemas/` 폴더를 참고하세요

