@echo off
chcp 949 >nul
title Server Start
echo ========================================
echo   Server Start
echo ========================================
echo.

REM Change to batch file directory
cd /d "%~dp0"
if errorlevel 1 (
    echo [ERROR] Failed to change directory
    pause
    exit /b 1
)
echo Current directory: %CD%
echo.

REM Check Node.js installation
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js or add it to PATH
    pause
    exit /b 1
)

REM Check Node.js version
echo Checking Node.js version...
node --version
if errorlevel 1 (
    echo [ERROR] Failed to run Node.js
    pause
    exit /b 1
)
echo.

REM Check server.js file
if not exist "server.js" (
    echo [ERROR] server.js file not found
    echo Current directory: %CD%
    pause
    exit /b 1
)
echo server.js file found
echo.

REM Check and install dependencies
if not exist "node_modules" (
    echo ========================================
    echo Installing required packages...
    echo This will only run once.
    echo ========================================
    echo.
    
    REM Try pnpm first, fallback to npm if it fails
    where pnpm >nul 2>&1
    if %errorlevel% equ 0 (
        echo Trying pnpm to install packages...
        pnpm install
        if errorlevel 1 (
            echo pnpm failed, trying npm instead...
            npm install
            if errorlevel 1 (
                echo [ERROR] Failed to install packages with npm
                echo Please check your internet connection or run as administrator
                pause
                exit /b 1
            )
        )
    ) else (
        REM Use npm if pnpm not available
        echo pnpm not found, using npm to install packages...
        npm install
        if errorlevel 1 (
            echo [ERROR] Failed to install packages
            echo Please check your internet connection or run as administrator
            pause
            exit /b 1
        )
    )
    echo.
    echo Packages installed successfully!
    echo.
) else (
    echo Packages already installed.
    echo.
)

echo ========================================
echo Starting server...
echo Access http://localhost:3003 in browser
echo.
echo Press Ctrl+C in server window to stop
echo ========================================
echo.

REM Start server in new window
echo Starting server in new window...
cd /d "%~dp0"

REM Use pushd/popd for better path handling
pushd "%~dp0"
start "SajangPick Server" cmd /k "cd /d %CD% && echo ======================================== && echo Server Starting... && echo ======================================== && node server.js"
popd

REM Wait a bit for server to start
echo Waiting for server to start (10 seconds)...
timeout /t 10 /nobreak >nul

REM Check if server is running
netstat -ano | findstr :3003 >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Server is running on port 3003!
    echo.
    echo Opening browser...
    start http://localhost:3003
    echo.
    echo ========================================
    echo Server started successfully!
    echo.
    echo - Server is running in separate window
    echo - Press Ctrl+C in server window to stop
    echo - Access http://localhost:3003 in browser
    echo - You can close this window
    echo ========================================
) else (
    echo [ERROR] Server failed to start!
    echo.
    echo Please check the server window for error messages.
    echo Common issues:
    echo - Missing environment variables
    echo - Port 3003 already in use
    echo - Node.js errors
    echo.
    echo Press any key to close...
)

echo.
pause

