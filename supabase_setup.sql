-- Adicionar colunas de localização no perfil para rastreamento
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_lat DOUBLE PRECISION;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_lng DOUBLE PRECISION;

-- Garantir que as permissões de leitura pública existam para que o passageiro veja o motorista
-- (Já existe uma política de select público, mas garantindo que lat/lng sejam acessíveis)