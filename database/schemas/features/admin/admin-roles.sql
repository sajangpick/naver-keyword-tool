-- ============================================
-- 관리자/매니저 역할 및 권한 관리 스키마
-- 작성일: 2025-10-31
-- ============================================

-- ==================== 1. profiles 테이블 수정 ====================
-- 기존 profiles 테이블에 역할 필드 추가
-- ALTER TABLE public.profiles ADD COLUMN role text DEFAULT 'member';
-- 주석: role 필드 추가 시 다음과 같이 설정됩니다.
-- - owner, agency: 사용 안함 (NULL 또는 'member')
-- - manager: 'general' (일반 매니저), 'super' (수퍼 매니저)
-- - admin: 'general' (일반 관리자), 'owner' (오너 관리자)

-- ==================== 2. admin_permissions 테이블 ====================
-- 오너 관리자가 일반 관리자에게 제약할 권한 저장
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 일반 관리자 ID (역할이 'general'인 admin 사용자)
  general_admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 오너 관리자 ID (역할이 'owner'인 admin 사용자)
  owner_admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 권한 설정 (JSON 형식)
  -- 예: { "members_view": true, "members_edit": false, "news_view": true, "news_edit": true, ... }
  permissions jsonb DEFAULT '{}'::jsonb,
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.admin_permissions IS '오너 관리자가 일반 관리자의 권한을 제약할 수 있는 설정 저장';
COMMENT ON COLUMN public.admin_permissions.permissions IS 'JSON 형식: {"members_view": true, "members_edit": false, "news_view": true, "news_edit": true, ...}';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_admin_permissions_general ON public.admin_permissions(general_admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_owner ON public.admin_permissions(owner_admin_id);

-- ==================== 3. manager_roles 테이블 ====================
-- 관리자가 매니저에게 지정한 역할 저장
CREATE TABLE IF NOT EXISTS public.manager_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 매니저 ID
  manager_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 할당한 관리자 ID
  assigned_by_admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- 매니저의 역할
  -- 'general' (일반 매니저): 기본 어드민 페이지 뷰만 가능
  -- 'super' (수퍼 매니저): 제한된 편집 권한 가능
  manager_role text NOT NULL DEFAULT 'general',
  
  -- 매니저 권한 설정 (JSON 형식)
  -- 예: { "dashboard_view": true, "dashboard_edit": false, "members_view": true, "members_edit": false, ... }
  permissions jsonb DEFAULT '{}'::jsonb,
  
  -- 관리 범위 (선택)
  -- 예: "region", "category", "all" 등
  scope text DEFAULT 'all',
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.manager_roles IS '관리자가 매니저에게 지정한 역할 및 권한 저장';
COMMENT ON COLUMN public.manager_roles.manager_role IS 'general: 뷰 권한만, super: 제한된 편집 권한';
COMMENT ON COLUMN public.manager_roles.permissions IS 'JSON 형식으로 각 기능별 뷰/편집 권한 저장';

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_manager_roles_manager ON public.manager_roles(manager_id);
CREATE INDEX IF NOT EXISTS idx_manager_roles_admin ON public.manager_roles(assigned_by_admin_id);

-- ==================== 4. 기본 권한 설정 ====================
-- 모든 기능이 허용된 기본 권한 세트
-- 사용: INSERT INTO admin_permissions(general_admin_id, owner_admin_id, permissions) 
--       VALUES(?, ?, '{"dashboard": true, "members": true, "news": true, ...}'::jsonb)

-- 기본 권한 상수 (주석)
-- 관리자 전체 권한:
-- {
--   "dashboard_view": true,
--   "dashboard_edit": true,
--   "members_view": true,
--   "members_edit": true,
--   "members_delete": true,
--   "news_view": true,
--   "news_edit": true,
--   "news_delete": true,
--   "analytics_view": true,
--   "performance_view": true,
--   "review_monitoring_view": true,
--   "review_monitoring_edit": true,
--   "errors_view": true,
--   "rank_report_view": true
-- }

-- 매니저 기본 권한 (뷰만):
-- {
--   "dashboard_view": true,
--   "dashboard_edit": false,
--   "members_view": true,
--   "members_edit": false,
--   "members_delete": false,
--   "news_view": true,
--   "news_edit": false,
--   "news_delete": false,
--   "analytics_view": true,
--   "performance_view": true,
--   "review_monitoring_view": true,
--   "review_monitoring_edit": false,
--   "errors_view": true,
--   "rank_report_view": true
-- }

-- ==================== 5. 업데이트 함수 ====================
-- 권한 업데이트 시 updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_admin_permissions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER admin_permissions_updated_at
BEFORE UPDATE ON public.admin_permissions
FOR EACH ROW
EXECUTE FUNCTION update_admin_permissions_timestamp();

CREATE TRIGGER manager_roles_updated_at
BEFORE UPDATE ON public.manager_roles
FOR EACH ROW
EXECUTE FUNCTION update_admin_permissions_timestamp();

-- ==================== 완료 ====================
SELECT '✅ 관리자/매니저 역할 및 권한 시스템 생성 완료!' as result;
