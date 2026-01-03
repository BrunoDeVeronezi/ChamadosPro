-- Migration: Remover CASCADE da foreign key ticket_id em ticket_deletion_logs
-- Data: 2025-01-XX
-- Descrição: Remove o CASCADE para que os logs sejam mantidos mesmo após a exclusão do ticket

-- IMPORTANTE: Execute primeiro o script verificar_constraint_ticket_deletion_logs.sql
-- para descobrir o nome exato da constraint no seu banco de dados.

-- 1. Verificar o nome da constraint (execute esta query primeiro)
-- SELECT constraint_name 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'ticket_deletion_logs' 
--   AND constraint_type = 'FOREIGN KEY'
--   AND constraint_name LIKE '%ticket_id%';

-- 2. Remover a constraint antiga (substitua 'NOME_DA_CONSTRAINT' pelo nome encontrado acima)
-- ALTER TABLE ticket_deletion_logs
-- DROP CONSTRAINT IF EXISTS NOME_DA_CONSTRAINT;

-- 3. Recriar a constraint sem CASCADE
-- ALTER TABLE ticket_deletion_logs
-- ADD CONSTRAINT ticket_deletion_logs_ticket_id_fkey
-- FOREIGN KEY (ticket_id) REFERENCES tickets(id);

-- OU, se preferir uma abordagem mais segura que funciona independente do nome da constraint:

-- Opção A: Remover todas as constraints de foreign key relacionadas a ticket_id
DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    -- Encontrar e remover a constraint
    SELECT tc.constraint_name INTO constraint_name_var
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'ticket_deletion_logs'
        AND kcu.column_name = 'ticket_id'
    LIMIT 1;
    
    IF constraint_name_var IS NOT NULL THEN
        EXECUTE format('ALTER TABLE ticket_deletion_logs DROP CONSTRAINT IF EXISTS %I', constraint_name_var);
        RAISE NOTICE 'Constraint % removida', constraint_name_var;
    ELSE
        RAISE NOTICE 'Nenhuma constraint encontrada';
    END IF;
END $$;

-- Recriar a constraint sem CASCADE
ALTER TABLE ticket_deletion_logs
ADD CONSTRAINT ticket_deletion_logs_ticket_id_fkey
FOREIGN KEY (ticket_id) REFERENCES tickets(id);

-- Nota: Como os tickets já foram excluídos, os logs antigos também foram excluídos pelo CASCADE.
-- Os novos logs serão mantidos após esta correção.
