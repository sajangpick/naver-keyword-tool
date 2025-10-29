#!/bin/bash
# ============================================
# 사장픽 프로젝트 정리 스크립트
# ============================================
# 사용법: Git Bash에서 실행
# bash CLEANUP_COMMANDS.sh
# ============================================

echo "🎯 사장픽 프로젝트 정리 시작..."
echo ""

# 1. 백업 폴더 생성
echo "📦 1단계: 백업 폴더 생성..."
mkdir -p backup/sql-files-$(date +%Y%m%d)

# 2. 루트의 SQL 파일 백업
echo "💾 2단계: SQL 파일 백업 중..."
cp *.sql backup/sql-files-$(date +%Y%m%d)/ 2>/dev/null || echo "  일부 파일이 없을 수 있습니다 (정상)"

echo ""
echo "⚠️  다음 파일들을 삭제할 예정입니다:"
echo ""
ls -1 *.sql 2>/dev/null | grep -E "(supabase-schema-|fix-|simple-|db-schema)" || echo "  삭제할 SQL 파일이 없습니다."
echo ""

read -p "계속하시겠습니까? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ 취소되었습니다."
    exit 1
fi

# 3. SQL 파일 삭제 (이미 새 위치에 복사됨)
echo "🗑️  3단계: 루트의 SQL 파일 삭제 중..."

# 모니터링 관련
rm -f supabase-schema-analytics.sql
rm -f supabase-schema-monitoring.sql
rm -f supabase-schema-monitoring-fixed.sql
rm -f supabase-schema-error-logging.sql
rm -f fix-analytics.sql
rm -f fix-error-logging.sql
rm -f fix-monitoring.sql
rm -f simple-analytics.sql
rm -f simple-error-logging.sql
rm -f simple-monitoring.sql
rm -f supabase-rls-monitoring.sql

# 기능 관련
rm -f supabase-schema-blog-posts.sql
rm -f supabase-schema-blog-diversity.sql
rm -f supabase-schema-store-promotion.sql
rm -f supabase-schema-place-cache.sql
rm -f supabase-rls-store-promotions.sql
rm -f db-schema-reviews.sql

echo "✅ SQL 파일 삭제 완료!"

# 4. 문서 이동
echo ""
echo "📄 4단계: 문서 이동 중..."
mv -f docs/MONITORING_SETUP_COMPLETE.md admin/docs/ 2>/dev/null && echo "  ✓ MONITORING_SETUP_COMPLETE.md 이동 완료" || echo "  - 파일이 이미 이동되었거나 없습니다"

echo ""
echo "============================================"
echo "✅ 정리 완료!"
echo "============================================"
echo ""
echo "📋 생성된 폴더:"
echo "  - admin/sql/monitoring/    (모니터링 SQL)"
echo "  - admin/sql/setup/         (설정 스크립트)"
echo "  - admin/docs/              (어드민 문서)"
echo "  - database/schemas/        (기능별 스키마)"
echo ""
echo "💾 백업 위치:"
echo "  - backup/sql-files-$(date +%Y%m%d)/"
echo ""
echo "📚 문서 참고:"
echo "  - REORGANIZATION_GUIDE.md  (전체 가이드)"
echo "  - database/DATABASE_STRUCTURE.md"
echo "  - admin/ADMIN_STRUCTURE.md"
echo ""
echo "🎉 완료!"

