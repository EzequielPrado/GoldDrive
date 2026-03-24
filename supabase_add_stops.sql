ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS stops JSONB DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';