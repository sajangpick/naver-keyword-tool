# 토큰 사용 제한 기능 SQL 마이그레이션

## 📋 설명

이 SQL 파일은 `token_config` 테이블에 토큰 사용 제한 기능을 위한 컬럼들을 추가합니다.

## 🚀 실행 방법

1. Supabase 대시보드에 로그인
2. SQL Editor로 이동
3. 아래 SQL 파일의 내용을 복사하여 실행:
   - `database/schemas/features/subscription/add-token-usage-restriction.sql`

## 📝 추가되는 컬럼

### 전체 토큰 사용 제어
- `token_usage_enabled` (boolean, 기본값: true)
  - false로 설정하면 모든 등급의 토큰 사용이 차단됩니다

### 등급별 토큰 사용 제어
- `owner_seed_enabled` (boolean, 기본값: true)
- `owner_power_enabled` (boolean, 기본값: true)
- `owner_bigpower_enabled` (boolean, 기본값: true)
- `owner_premium_enabled` (boolean, 기본값: true)
- `agency_elite_enabled` (boolean, 기본값: true)
- `agency_expert_enabled` (boolean, 기본값: true)
- `agency_master_enabled` (boolean, 기본값: true)
- `agency_premium_enabled` (boolean, 기본값: true)

## ⚠️ 주의사항

- 이 SQL을 실행하지 않으면 토큰 사용 제한 기능이 작동하지 않습니다
- API는 컬럼이 없어도 에러 없이 작동하지만, 실제 제한은 적용되지 않습니다
- SQL 실행 후 관리자 페이지에서 토큰 사용 제한을 설정할 수 있습니다

## ✅ 실행 확인

SQL 실행 후 다음 쿼리로 확인:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'token_config'
AND column_name LIKE '%_enabled';
```

9개의 컬럼이 표시되면 정상적으로 추가된 것입니다.

