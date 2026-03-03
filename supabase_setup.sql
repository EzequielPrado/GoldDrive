-- 1. Tabela de Configurações Administrativas (Taxa noturna, etc)
CREATE TABLE IF NOT EXISTS admin_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir valores padrão
INSERT INTO admin_config (key, value) VALUES 
('night_active', 'true'),
('night_start', '21:00'),
('night_end', '00:00'),
('night_increase', '3'),
('midnight_min_price', '25'),
('platform_fee', '10'),
('pricing_strategy', 'FIXED'),
('cancellation_fee_type', 'FIXED'),
('cancellation_fee_value', '5.00'),
('gps_popup_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- 2. Tabela de Faixas de Preço (Para a categoria Gold Driver)
CREATE TABLE IF NOT EXISTS pricing_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label TEXT NOT NULL,
    max_distance NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir faixas iniciais padrão
INSERT INTO pricing_tiers (label, max_distance, price, display_order) VALUES 
('Até 2 km', 2, 15, 1),
('De 2 a 5 km', 5, 20, 2),
('De 5 a 10 km', 10, 30, 3),
('Acima de 10 km', 999, 45, 4)
ON CONFLICT DO NOTHING;

-- 3. Tabela de Configurações de Recursos (Dinheiro/Carteira)
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value) VALUES 
('enable_cash', true),
('enable_wallet', true),
('is_subscription_mode', false),
('enable_cancellation_fee', true)
ON CONFLICT (key) DO NOTHING;

-- 4. Tabela de Mensagens do Chat
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Transações Financeiras (Carteira)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL, -- 'CREDIT' ou 'DEBIT'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Função para calcular o total gasto/ganho de um usuário (usada no Admin)
CREATE OR REPLACE FUNCTION get_user_lifetime_total(target_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
    total NUMERIC;
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM profiles WHERE id = target_user_id;
    
    IF user_role = 'driver' THEN
        SELECT COALESCE(SUM(driver_earnings), 0) INTO total FROM rides WHERE driver_id = target_user_id AND status = 'COMPLETED';
    ELSE
        SELECT COALESCE(SUM(price), 0) INTO total FROM rides WHERE customer_id = target_user_id AND status = 'COMPLETED';
    END IF;
    
    RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Ativar Realtime para o Chat e Corridas
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE rides;