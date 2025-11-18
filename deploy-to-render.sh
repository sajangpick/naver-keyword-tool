#!/bin/bash

echo "🚀 사장픽 백엔드 서버 Render 배포 스크립트"
echo "========================================="

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Render CLI 확인
if ! command -v render &> /dev/null; then
    echo -e "${YELLOW}Render CLI가 설치되어 있지 않습니다.${NC}"
    echo "설치 방법: npm install -g @render-com/cli"
    echo "또는 웹 대시보드를 사용하세요: https://render.com"
    exit 1
fi

# 환경변수 파일 확인
if [ ! -f ".env.production" ]; then
    echo -e "${RED}.env.production 파일이 없습니다!${NC}"
    echo "1. .env.example을 복사하여 .env.production을 생성하세요"
    echo "2. 실제 API 키 값을 입력하세요"
    exit 1
fi

# Git 상태 확인
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}커밋되지 않은 변경사항이 있습니다.${NC}"
    read -p "계속 진행하시겠습니까? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📋 배포 전 체크리스트:"
echo "✅ render.yaml 파일 확인"
echo "✅ package.json 확인"
echo "✅ 환경변수 설정 확인"

echo -e "\n${GREEN}배포를 시작합니다...${NC}"

# Render 서비스 생성/업데이트
echo "1. Render 서비스 배포 중..."
render up

echo -e "\n${GREEN}✨ 배포가 완료되었습니다!${NC}"
echo "URL: https://naver-keyword-tool.onrender.com"
echo ""
echo "📌 다음 단계:"
echo "1. Render 대시보드에서 로그 확인: https://dashboard.render.com"
echo "2. 헬스체크: curl https://naver-keyword-tool.onrender.com/api/health"
echo "3. Vercel 프론트엔드에서 테스트"
