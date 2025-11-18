<<<<<<< HEAD
@echo off
chcp 65001
title 사장픽 서버 시작
echo.
echo ========================================
echo   서버 시작 (간단 버전)
echo ========================================
echo.

cd /d "%~dp0"
echo 현재 위치: %CD%
echo.

echo Node.js 확인 중...
node --version >nul 2>&1
if errorlevel 1 (
    echo [오류] Node.js를 찾을 수 없습니다!
    echo Node.js를 설치해주세요.
    pause
    exit /b 1
)

echo server.js 확인 중...
if not exist "server.js" (
    echo [오류] server.js 파일을 찾을 수 없습니다!
    pause
    exit /b 1
)

echo.
echo 서버를 시작합니다...
echo.
start "SajangPick Server" cmd /k "cd /d %CD% && node server.js"

timeout /t 3 /nobreak >nul
start http://localhost:3003

echo.
echo 서버가 시작되었습니다!
echo 브라우저에서 http://localhost:3003 으로 접속하세요.
echo.
pause


=======
@echo off
chcp 65001
title 사장픽 서버 시작
echo.
echo ========================================
echo   서버 시작 (간단 버전)
echo ========================================
echo.

cd /d "%~dp0"
echo 현재 위치: %CD%
echo.

echo Node.js 확인 중...
node --version >nul 2>&1
if errorlevel 1 (
    echo [오류] Node.js를 찾을 수 없습니다!
    echo Node.js를 설치해주세요.
    pause
    exit /b 1
)

echo server.js 확인 중...
if not exist "server.js" (
    echo [오류] server.js 파일을 찾을 수 없습니다!
    pause
    exit /b 1
)

echo.
echo 서버를 시작합니다...
echo.
start "SajangPick Server" cmd /k "cd /d %CD% && node server.js"

timeout /t 3 /nobreak >nul
start http://localhost:3003

echo.
echo 서버가 시작되었습니다!
echo 브라우저에서 http://localhost:3003 으로 접속하세요.
echo.
pause


>>>>>>> 2a567e81215913201059f9d99e44f40781f95bd2
