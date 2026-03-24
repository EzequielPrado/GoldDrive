-- Adiciona a coluna para armazenar as paradas (em formato JSON)
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS stops JSONB DEFAULT '[]'::jsonb;

-- Insere a configuração padrão do custo por parada no painel admin se não existir
INSERT INTO public.admin_config (key, value, description)
SELECT 'cost_per_stop', '2.50', 'Custo adicional cobrado por cada parada extra na corrida'
WHERE NOT EXISTS (SELECT 1 FROM public.admin_config WHERE key = 'cost_per_stop');