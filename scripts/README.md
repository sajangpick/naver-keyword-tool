# 📜 개발 스크립트

이 폴더는 개발 및 유지보수를 위한 스크립트들을 포함합니다.

## 파일 목록

### debug-crawl.js
- **용도**: 크롤링 기능 디버깅
- **실행**: `node scripts/debug-crawl.js`
- **설명**: 네이버 플레이스 크롤링 테스트 및 문제 진단

### supabase-setup.js
- **용도**: Supabase 초기 설정
- **실행**: `pnpm run supabase:setup`
- **설명**: Supabase 프로젝트 초기화 및 테이블 생성

## 사용 방법

```bash
# 크롤링 디버그
node scripts/debug-crawl.js

# Supabase 설정
pnpm run supabase:setup
```

## 주의사항

- 이 스크립트들은 프로덕션에서 사용되지 않습니다
- 개발 및 테스트 용도로만 사용하세요
- 실행 전 환경변수(.env) 설정을 확인하세요

