@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ============================================
echo 🚀 사장픽 백엔드 서버 Render 배포 스크립트
echo ============================================
echo.

:: 색상 설정
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "NC=[0m"

:: Node.js 확인
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo %RED%Node.js가 설치되어 있지 않습니다!%NC%
    echo https://nodejs.org 에서 설치하세요.
    pause
    exit /b 1
)

:: package.json 확인
if not exist "package.json" (
    echo %RED%package.json 파일을 찾을 수 없습니다!%NC%
    echo 프로젝트 루트 디렉토리에서 실행하세요.
    pause
    exit /b 1
)

:: render.yaml 확인
if not exist "render.yaml" (
    echo %RED%render.yaml 파일을 찾을 수 없습니다!%NC%
    pause
    exit /b 1
)

echo %GREEN%✅ 배포 준비 완료%NC%
echo.
echo 📋 체크리스트:
echo    1. Render 계정 생성 완료
echo    2. GitHub 저장소 연결 준비
echo    3. 환경변수 준비 완료
echo.

echo %YELLOW%📌 다음 단계를 따라주세요:%NC%
echo.
echo 1. Render.com 접속: https://render.com
echo 2. Dashboard에서 "New +" → "Web Service" 클릭
echo 3. GitHub 저장소 연결 또는 수동 배포 선택
echo 4. 다음 설정 입력:
echo    - Name: sajangpick-kwon-teamjang
echo    - Build Command: npm install
echo    - Start Command: node server.js
echo 5. 환경변수 설정 (Dashboard에서)
echo 6. "Create Web Service" 클릭
echo.

echo %GREEN%🎉 배포 후 확인:%NC%
echo URL: https://sajangpick-kwon-teamjang.onrender.com/api/health
echo.

echo 브라우저를 열어 Render 대시보드로 이동하시겠습니까?
choice /C YN /M "선택"
if %errorlevel%==1 (
    start https://render.com/
)

pause
