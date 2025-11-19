@echo off
chcp 949 >nul
title Server Status Check
echo ========================================
echo   서버 상태 확인
echo ========================================
echo.

REM 포트 3003이 사용 중인지 확인
netstat -ano | findstr :3003 >nul 2>&1
if %errorlevel% equ 0 (
    echo [성공] 포트 3003이 사용 중입니다 - 서버가 실행 중입니다!
    echo.
    netstat -ano | findstr :3003
    echo.
    echo 브라우저에서 http://localhost:3003 으로 접속하세요
) else (
    echo [오류] 포트 3003이 사용되지 않습니다 - 서버가 실행되지 않았습니다!
    echo.
    echo 서버를 시작하려면 서버시작_안정.bat 파일을 실행하세요
)

echo.
pause
