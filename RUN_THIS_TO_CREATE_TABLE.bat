@echo off
chcp 65001 >nul
echo ========================================
echo 🎬 shorts_videos 테이블 생성 스크립트
echo ========================================
echo.
echo 이 스크립트는 Supabase CLI를 사용해서
echo 테이블을 자동으로 생성합니다.
echo.
echo ⚠️  주의: Supabase CLI가 프로젝트에 연결되어 있어야 합니다.
echo.
pause

echo.
echo 📋 마이그레이션 파일 확인 중...
if exist "supabase\migrations\20251112000000_create_shorts_videos.sql" (
    echo ✅ 마이그레이션 파일 발견!
    echo.
    echo 🔧 Supabase CLI로 테이블 생성 시도...
    echo.
    npx supabase db push
    echo.
    echo ✅ 완료!
) else (
    echo ❌ 마이그레이션 파일을 찾을 수 없습니다.
    echo.
    echo 💡 대신 Supabase Dashboard에서 직접 실행하세요:
    echo    1. https://supabase.com/dashboard 접속
    echo    2. 프로젝트 선택 → SQL Editor
    echo    3. QUICK_FIX_SHORTS_TABLE.sql 파일의 SQL 실행
)

echo.
pause

