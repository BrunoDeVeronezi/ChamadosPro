-- Migração: Adicionar campo fuel_type na tabela vehicle_settings
-- Data: 2025-01-XX
-- Descrição: Adiciona campo para armazenar o tipo de combustível (GASOLINA, GNV, DIESEL, ELETRICO)

-- Verificar se a coluna já existe antes de adicionar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'vehicle_settings' 
        AND column_name = 'fuel_type'
    ) THEN
        -- Adicionar coluna fuel_type
        ALTER TABLE vehicle_settings 
        ADD COLUMN fuel_type TEXT NOT NULL DEFAULT 'GASOLINA';
        
        -- Adicionar comentário na coluna
        COMMENT ON COLUMN vehicle_settings.fuel_type IS 'Tipo de combustível: GASOLINA, GNV, DIESEL, ELETRICO';
        
        RAISE NOTICE 'Coluna fuel_type adicionada com sucesso à tabela vehicle_settings';
    ELSE
        RAISE NOTICE 'Coluna fuel_type já existe na tabela vehicle_settings';
    END IF;
END $$;

-- Verificar se a migração foi aplicada
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'vehicle_settings' 
AND column_name = 'fuel_type';




