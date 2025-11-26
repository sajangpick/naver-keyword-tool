-- ============================================
-- 회원 등급 변경 RPC 함수
-- 스키마 캐시 문제를 우회하기 위한 함수
-- ============================================

CREATE OR REPLACE FUNCTION update_member_level(
  p_member_id uuid,
  p_user_type text DEFAULT NULL,
  p_membership_level text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_update_sql text;
  v_result jsonb;
BEGIN
  -- 동적으로 UPDATE 쿼리 생성 (role 컬럼 제외)
  v_update_sql := 'UPDATE public.profiles SET updated_at = NOW()';
  
  IF p_user_type IS NOT NULL THEN
    v_update_sql := v_update_sql || format(', user_type = %L', p_user_type);
  END IF;
  
  IF p_membership_level IS NOT NULL THEN
    v_update_sql := v_update_sql || format(', membership_level = %L', p_membership_level);
  END IF;
  
  v_update_sql := v_update_sql || format(' WHERE id = %L', p_member_id);
  
  -- 쿼리 실행
  EXECUTE v_update_sql;
  
  -- 업데이트된 데이터 조회
  SELECT jsonb_build_object(
    'id', id,
    'name', name,
    'email', email,
    'user_type', user_type,
    'membership_level', membership_level,
    'updated_at', updated_at
  ) INTO v_result
  FROM public.profiles
  WHERE id = p_member_id;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION update_member_level IS '회원 등급 변경 함수 (스키마 캐시 문제 우회)';

