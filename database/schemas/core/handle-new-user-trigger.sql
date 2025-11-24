-- ============================================
-- 새 사용자 가입 시 profiles 테이블 자동 생성 트리거
-- membership_level을 'seed'로 설정 (FREE가 아닌)
-- ============================================

-- 1. 새 사용자 가입 시 profiles 레코드 자동 생성 함수
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    user_type,
    membership_level,  -- seed로 설정 (FREE가 아님)
    email,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    'owner',  -- 기본값: 식당 대표
    'seed',   -- 기본값: 씨앗 (FREE가 아님!)
    NEW.email,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. auth.users에 INSERT될 때 트리거 실행
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 3. 기존 FREE 등급 회원들을 seed로 변경
UPDATE public.profiles 
SET membership_level = 'seed' 
WHERE membership_level = 'free' OR membership_level = 'FREE' OR membership_level IS NULL;

-- 4. 테이블 기본값 변경 (신규 회원용)
ALTER TABLE public.profiles 
ALTER COLUMN membership_level SET DEFAULT 'seed';

COMMENT ON FUNCTION public.handle_new_user() IS '새 사용자 가입 시 profiles 테이블에 seed 등급으로 자동 생성';

