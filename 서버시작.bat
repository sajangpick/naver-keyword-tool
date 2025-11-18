@echo off
chcp 65001 >nul
echo ========================================
echo   서버 시작
echo ========================================
echo.

REM 현재 디렉토리로 이동
cd /d "%~dp0"
echo 현재 디렉토리: %CD%
echo.

REM Node.js 설치 확인
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Node.js가 설치되어 있지 않거나 PATH에 등록되지 않았습니다.
    echo Node.js를 설치하거나 PATH에 추가해주세요.
    pause
    exit /b 1
)

REM Node.js 버전 확인
echo Node.js 버전 확인 중...
node --version
if %errorlevel% neq 0 (
    echo [오류] Node.js 실행에 실패했습니다.
    pause
    exit /b 1
)
echo.

REM server.js 파일 존재 확인
if not exist "server.js" (
    echo [오류] server.js 파일을 찾을 수 없습니다.
    echo 현재 디렉토리: %CD%
    pause
    exit /b 1
)
echo server.js 파일 확인 완료
echo.

echo ========================================
echo 서버를 시작합니다...
echo 브라우저에서 http://localhost:3003/health 로 접속하여 확인하세요
echo.
echo 서버를 종료하려면 Ctrl+C를 누르세요
echo ========================================
echo.

REM 서버 실행
node server.js

REM 서버가 종료되면 메시지 표시
echo.
echo 서버가 종료되었습니다.
pause

