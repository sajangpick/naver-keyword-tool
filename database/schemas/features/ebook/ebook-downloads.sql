CREATE TABLE IF NOT EXISTS public.ebook_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text,
  name text,
  membership_level text,
  user_type text,
  download_source text DEFAULT 'hero_primary',
  download_method text DEFAULT 'unknown',
  device_type text,
  user_agent text,
  ip_address text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ebook_downloads_user_id ON public.ebook_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_ebook_downloads_created_at ON public.ebook_downloads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ebook_downloads_source ON public.ebook_downloads(download_source);

ALTER TABLE public.ebook_downloads ENABLE ROW LEVEL SECURITY;