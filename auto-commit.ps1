# 자동 커밋 PowerShell 스크립트
# 사용법: PowerShell에서 .\auto-commit.ps1 실행

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "자동 커밋 스크립트" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 현재 디렉토리로 이동
Set-Location $PSScriptRoot

# Git 저장소 확인
try {
    $null = git status 2>&1
} catch {
    Write-Host "[오류] 현재 폴더가 Git 저장소가 아닙니다." -ForegroundColor Red
    Read-Host "아무 키나 누르세요"
    exit 1
}

# 변경사항 확인
$status = git status --porcelain
if ($status) {
    Write-Host "[1/3] 변경사항 발견! 자동으로 커밋합니다..." -ForegroundColor Yellow
    Write-Host ""
    
    # 모든 변경사항 추가
    Write-Host "[2/3] 파일 추가 중..." -ForegroundColor Yellow
    git add .
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[오류] git add 실패" -ForegroundColor Red
        Read-Host "아무 키나 누르세요"
        exit 1
    }
    
    # 자동 커밋 메시지 생성
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $commitMsg = "Auto commit: $timestamp"
    
    Write-Host "[3/3] 커밋 생성 중..." -ForegroundColor Yellow
    git commit -m $commitMsg
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[경고] 커밋 실패" -ForegroundColor Yellow
        Read-Host "아무 키나 누르세요"
        exit 1
    }
    Write-Host "✓ 커밋 완료: $commitMsg" -ForegroundColor Green
    Write-Host ""
    
    # 푸시
    Write-Host "GitHub에 푸시 중..." -ForegroundColor Yellow
    git push origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[경고] 푸시 실패 (GitHub Desktop에서 수동으로 푸시해주세요)" -ForegroundColor Yellow
    } else {
        Write-Host "✓ 푸시 완료! Vercel이 자동으로 배포를 시작합니다." -ForegroundColor Green
    }
} else {
    Write-Host "변경사항이 없습니다. 모든 파일이 최신 상태입니다." -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "완료!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Start-Sleep -Seconds 3

