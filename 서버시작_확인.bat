@echo off
chcp 65001 >nul
echo ========================================
echo   서버 실행 상태 확인 및 시작
echo ========================================
echo.

REM 포트 3003이 사용 중인지 확인
netstat -ano | findstr :3003 >nul 2>&1
if %errorlevel% equ 0 (
    echo [경고] 포트 3003이 이미 사용 중입니다.
    echo 기존 서버를 종료하고 새로 시작하시겠습니까?
    echo.
    echo 실행 중인 프로세스를 확인하려면:
    netstat -ano | findstr :3003
    echo.
    pause
    exit /b
)

echo 서버를 시작합니다...
echo 브라우저에서 http://localhost:3003/health 로 접속하여 확인하세요
echo.
echo 서버를 종료하려면 Ctrl+C를 누르세요
echo.
echo ========================================
echo.

cd /d "%~dp0"
node server.js

pause


