ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS link text,
  ADD COLUMN IF NOT EXISTS data jsonb;
