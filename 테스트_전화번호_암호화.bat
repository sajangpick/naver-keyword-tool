@echo off
chcp 65001 >nul
echo ========================================
echo 전화번호 암호화/복호화 테스트
echo ========================================
echo.

REM Python 설치 확인
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python이 설치되어 있지 않습니다.
    echo    Python을 먼저 설치해주세요.
    pause
    exit /b 1
)

echo ✅ Python 설치 확인 완료
echo.

REM 암호화 테스트
echo [1단계] 암호화 테스트
echo 입력: 010-6664-3744
echo ----------------------------------------
python api/utils/cipher_service.py encrypt "010-6664-3744"
if errorlevel 1 (
    echo.
    echo ❌ 암호화 실패!
    echo.
    echo 💡 확인 사항:
    echo    1. .env 파일에 SECRET_KEY가 설정되어 있나요?
    echo    2. cryptography 패키지가 설치되어 있나요? (pip install cryptography)
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ 암호화 테스트 완료!
echo.
echo 위에 출력된 암호화된 문자열을 복사하여
echo 아래 복호화 테스트에 사용하세요.
echo ========================================
echo.
pause

echo.
echo [2단계] 복호화 테스트
echo 위에서 나온 암호화된 문자열을 입력하세요:
set /p ENCRYPTED_TEXT="암호화된 문자열 입력: "

if "%ENCRYPTED_TEXT%"=="" (
    echo ❌ 암호화된 문자열이 입력되지 않았습니다.
    pause
    exit /b 1
)

echo.
echo ----------------------------------------
python api/utils/cipher_service.py decrypt "%ENCRYPTED_TEXT%"
if errorlevel 1 (
    echo.
    echo ❌ 복호화 실패!
    echo.
    echo 💡 확인 사항:
    echo    1. 암호화된 문자열이 정확히 입력되었나요?
    echo    2. .env 파일의 SECRET_KEY가 암호화 시와 동일한가요?
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ 복호화 테스트 완료!
echo ========================================
echo.
pause

