ALTER TABLE public.car_categories ADD COLUMN IF NOT EXISTS cost_per_minute NUMERIC DEFAULT 0.00;

NOTIFY pgrst, 'reload schema';