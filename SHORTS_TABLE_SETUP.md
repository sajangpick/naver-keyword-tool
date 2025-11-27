# 🎬 쇼츠 영상 테이블 생성 가이드

## ⚠️ 현재 문제
에러: `Could not find the table 'public.shorts_videos' in the schema cache`

## ✅ 해결 방법 (단계별)

### 1단계: Supabase 대시보드 접속
1. 브라우저에서 https://supabase.com/dashboard 접속
2. 로그인
3. **사장픽 프로젝트** 선택

### 2단계: SQL Editor 열기
1. 왼쪽 메뉴에서 **"SQL Editor"** 클릭
2. **"New query"** 버튼 클릭 (또는 빈 에디터 클릭)

### 3단계: SQL 복사하기
아래 SQL 전체를 복사하세요 (Ctrl + A → Ctrl + C):

```sql
-- ========================================
-- 🎬 사장픽 쇼츠 영상 관리 시스템 데이터베이스 스키마
-- ========================================
CREATE TABLE IF NOT EXISTS public.shorts_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 영상 정보
  title text,
  description text,
  style text,
  duration_sec integer,
  music_type text,
  
  -- 메뉴 정보
  menu_name text NOT NULL,
  menu_features text,
  menu_price text,
  
  -- 이미지 및 영상 파일
  image_url text,
  video_url text,
  thumbnail_url text,
  job_id text,
  
  -- 생성 상태
  status text NOT NULL DEFAULT 'processing',
  error_message text,
  
  -- AI 생성 정보
  generation_time_ms integer,
  ai_model text,
  
  -- 메타데이터
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.shorts_videos IS 'AI 생성 쇼츠 영상 저장';
COMMENT ON COLUMN public.shorts_videos.status IS 'processing: 생성 중, completed: 완료, failed: 실패';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_shorts_videos_user_id ON public.shorts_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_shorts_videos_status ON public.shorts_videos(status);
CREATE INDEX IF NOT EXISTS idx_shorts_videos_created_at ON public.shorts_videos(created_at DESC);
```

### 4단계: SQL 실행
1. Supabase SQL Editor에 붙여넣기 (Ctrl + V)
2. 오른쪽 아래 **"RUN"** 버튼 클릭 (또는 Ctrl + Enter)
3. **"Success. No rows returned"** 메시지 확인

### 5단계: 테이블 생성 확인
1. 왼쪽 메뉴에서 **"Table Editor"** 클릭
2. 테이블 목록에서 **"shorts_videos"** 찾기
3. 있으면 ✅ 성공!

### 6단계: 페이지 새로고침
1. 브라우저에서 `sajangpick.co.kr/shorts-editor` 페이지 새로고침 (F5)
2. 다시 영상 생성 시도

---

## 🔍 문제 해결

### "relation 'profiles' does not exist" 에러가 나면?
→ `profiles` 테이블이 먼저 생성되어야 합니다. 다른 SQL 파일을 먼저 실행하세요.

### "permission denied" 에러가 나면?
→ 프로젝트 소유자 계정으로 로그인했는지 확인하세요.

### "already exists" 메시지가 나오면?
→ 이미 테이블이 있다는 뜻입니다. ✅ 정상입니다!

### 여전히 에러가 나면?
1. Supabase에서 **Table Editor**로 가서 `shorts_videos` 테이블이 있는지 확인
2. 없으면 SQL을 다시 실행
3. 있으면 서버를 재시작해보세요

---

## 📞 도움이 필요하면
스크린샷을 찍어서 보여주시면 더 정확히 도와드릴 수 있습니다!

