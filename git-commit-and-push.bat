@echo off
chcp 65001 >nul
echo ========================================
echo Git 커밋 및 푸시 스크립트
echo ========================================
echo.

REM 현재 디렉토리를 프로젝트 폴더로 변경
cd /d "%~dp0"

REM Git 저장소 확인
git status >nul 2>&1
if errorlevel 1 (
    echo [오류] 현재 폴더가 Git 저장소가 아닙니다.
    echo.
    echo GitHub Desktop을 사용하시는 경우:
    echo 1. GitHub Desktop을 엽니다
    echo 2. 이 프로젝트를 선택합니다
    echo 3. 변경사항을 확인하고 커밋 메시지를 입력합니다
    echo 4. "Commit to main" 버튼을 클릭합니다
    echo 5. "Push origin" 버튼을 클릭합니다
    echo.
    pause
    exit /b 1
)

echo [1/4] 변경사항 확인 중...
git status
echo.

echo [2/4] 모든 변경사항 추가 중...
git add .
if errorlevel 1 (
    echo [오류] git add 실패
    pause
    exit /b 1
)
echo ✓ 파일 추가 완료
echo.

echo [3/4] 커밋 생성 중...
set /p COMMIT_MSG="커밋 메시지를 입력하세요 (기본값: Update files): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update files
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo [경고] 커밋할 변경사항이 없거나 커밋 실패
    echo 변경사항이 없으면 이미 최신 상태일 수 있습니다.
    echo.
)
echo ✓ 커밋 완료
echo.

echo [4/4] GitHub에 푸시 중...
git push origin main
if errorlevel 1 (
    echo [오류] 푸시 실패
    echo.
    echo 원격 저장소가 설정되지 않았을 수 있습니다.
    echo GitHub Desktop을 사용하여 푸시해주세요.
    pause
    exit /b 1
)
echo ✓ 푸시 완료
echo.

echo ========================================
echo 완료! Vercel이 자동으로 배포를 시작합니다.
echo ========================================
echo.
echo Vercel 대시보드에서 배포 상태를 확인하세요:
echo https://vercel.com/dashboard
echo.
pause

