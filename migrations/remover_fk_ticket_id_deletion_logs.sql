-- Migration: Remover FK de ticket_id em ticket_deletion_logs
-- Descrição: Permite excluir o ticket mantendo o log (que já tem os dados no campo ticket_data)

DO $$
DECLARE
    constraint_name_var TEXT;
BEGIN
    SELECT tc.constraint_name INTO constraint_name_var
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'ticket_deletion_logs'
        AND kcu.column_name = 'ticket_id'
        AND tc.constraint_type = 'FOREIGN KEY';

    IF constraint_name_var IS NOT NULL THEN
        EXECUTE format('ALTER TABLE ticket_deletion_logs DROP CONSTRAINT %I', constraint_name_var);
        RAISE NOTICE 'Constraint %% removida com sucesso', constraint_name_var;
    ELSE
        RAISE NOTICE 'Constraint não encontrada';
    END IF;
END $$;
