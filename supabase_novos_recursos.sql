-- 1. Adiciona a coluna de preço por minuto na tabela de categorias de carros
ALTER TABLE public.car_categories ADD COLUMN IF NOT EXISTS cost_per_minute numeric DEFAULT 0.00;

-- 2. Cria a tabela de cupons de desconto
CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL, -- 'PERCENTAGE' ou 'FIXED'
    discount_value NUMERIC NOT NULL,
    max_uses INTEGER DEFAULT 100,
    current_uses INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilita RLS na tabela de cupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- 4. Cria as políticas de segurança (Passageiros podem ler cupons ativos, admin pode tudo)
CREATE POLICY "Public read coupons" ON public.coupons 
FOR SELECT USING (true);

CREATE POLICY "Admin manage coupons" ON public.coupons 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);