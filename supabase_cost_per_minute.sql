ALTER TABLE public.car_categories ADD COLUMN IF NOT EXISTS cost_per_minute NUMERIC DEFAULT 0.00;

-- Atualiza o cache do schema no Supabase (opcional, mas recomendado)
NOTIFY pgrst, 'reload schema';