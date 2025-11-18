@echo off
chcp 65001 >nul
echo ========================================
echo 자동 커밋 스크립트
echo ========================================
echo.

REM 현재 디렉토리를 프로젝트 폴더로 변경
cd /d "%~dp0"

REM Git 저장소 확인
git status >nul 2>&1
if errorlevel 1 (
    echo [오류] 현재 폴더가 Git 저장소가 아닙니다.
    pause
    exit /b 1
)

REM 변경사항 확인
git diff --quiet
if errorlevel 1 (
    echo [1/3] 변경사항 발견! 자동으로 커밋합니다...
    echo.
    
    REM 모든 변경사항 추가
    git add .
    if errorlevel 1 (
        echo [오류] git add 실패
        pause
        exit /b 1
    )
    
    REM 자동 커밋 메시지 생성 (날짜/시간 포함)
    for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
    set datepart=%datetime:~0,8%
    set timepart=%datetime:~8,6%
    set timepart=%timepart:~0,2%:%timepart:~2,2%:%timepart:~4,2%
    
    set COMMIT_MSG=Auto commit: %datepart% %timepart%
    
    echo [2/3] 커밋 생성 중...
    git commit -m "%COMMIT_MSG%"
    if errorlevel 1 (
        echo [경고] 커밋 실패
        pause
        exit /b 1
    )
    echo ✓ 커밋 완료: %COMMIT_MSG%
    echo.
    
    echo [3/3] GitHub에 푸시 중...
    git push origin main
    if errorlevel 1 (
        echo [경고] 푸시 실패 (GitHub Desktop에서 수동으로 푸시해주세요)
    ) else (
        echo ✓ 푸시 완료! Vercel이 자동으로 배포를 시작합니다.
    )
) else (
    echo 변경사항이 없습니다. 모든 파일이 최신 상태입니다.
)

echo.
echo ========================================
echo 완료!
echo ========================================
timeout /t 3 >nul

