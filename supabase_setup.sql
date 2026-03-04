-- Habilitar extensão para UUID se não existir
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Configurações Administrativas
CREATE TABLE IF NOT EXISTS admin_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura pública de configs" ON admin_config FOR SELECT USING (true);
CREATE POLICY "Apenas admin altera configs" ON admin_config FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

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

-- 2. Tabela de Faixas de Preço (Gold Driver)
CREATE TABLE IF NOT EXISTS pricing_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label TEXT NOT NULL,
    max_distance NUMERIC NOT NULL,
    price NUMERIC NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pricing_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura pública de taxas" ON pricing_tiers FOR SELECT USING (true);
CREATE POLICY "Apenas admin altera taxas" ON pricing_tiers FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Tabela de Configurações de Recursos
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value BOOLEAN NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir leitura pública de settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Apenas admin altera settings" ON app_settings FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

INSERT INTO app_settings (key, value) VALUES 
('enable_cash', true),
('enable_wallet', true),
('is_subscription_mode', false),
('enable_cancellation_fee', true)
ON CONFLICT (key) DO NOTHING;

-- 4. Mensagens do Chat
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID REFERENCES rides(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participantes podem ver mensagens" ON messages FOR SELECT 
USING (EXISTS (SELECT 1 FROM rides WHERE id = messages.ride_id AND (customer_id = auth.uid() OR driver_id = auth.uid())));
CREATE POLICY "Participantes podem enviar mensagens" ON messages FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM rides WHERE id = ride_id AND (customer_id = auth.uid() OR driver_id = auth.uid())));

-- 5. Transações Financeiras
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios vêem suas transações" ON transactions FOR SELECT 
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));