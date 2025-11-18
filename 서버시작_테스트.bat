@echo off
chcp 65001
title 서버 시작 테스트
color 0A
echo.
echo ========================================
echo   서버 시작 테스트 (디버그 모드)
echo ========================================
echo.
echo [1단계] 배치 파일 실행 확인
echo 배치 파일이 정상적으로 실행되었습니다!
echo.
pause

echo.
echo [2단계] 현재 디렉토리 확인
cd /d "%~dp0"
echo 현재 디렉토리: %CD%
echo.
pause

echo.
echo [3단계] Node.js 설치 확인
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Node.js를 찾을 수 없습니다!
    echo.
    echo 해결 방법:
    echo 1. Node.js가 설치되어 있는지 확인하세요
    echo 2. 명령 프롬프트에서 "node --version"을 실행해보세요
    echo 3. Node.js가 설치되어 있다면 PATH 환경변수를 확인하세요
    echo.
    pause
    exit /b 1
) else (
    echo [성공] Node.js를 찾았습니다!
    node --version
)
echo.
pause

echo.
echo [4단계] server.js 파일 확인
if not exist "server.js" (
    echo [오류] server.js 파일을 찾을 수 없습니다!
    echo 현재 위치: %CD%
    echo.
    dir *.js
    echo.
    pause
    exit /b 1
) else (
    echo [성공] server.js 파일을 찾았습니다!
)
echo.
pause

echo.
echo [5단계] 서버 시작 시도
echo 서버를 시작합니다...
echo.
start "SajangPick Server" cmd /k "cd /d %CD% && echo 서버 시작 중... && node server.js"

echo.
echo 서버 창이 열렸는지 확인하세요.
echo 5초 후 브라우저를 엽니다...
timeout /t 5 /nobreak >nul

start http://localhost:3003

echo.
echo ========================================
echo 테스트 완료!
echo.
echo - 서버 창이 열렸다면 성공입니다
echo - 브라우저에서 http://localhost:3003 으로 접속하세요
echo - 서버를 종료하려면 서버 창에서 Ctrl+C를 누르세요
echo ========================================
echo.
pause


