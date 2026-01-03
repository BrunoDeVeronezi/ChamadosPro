-- Migration: Limpeza automática de logs de exclusão
-- Descrição: Remove logs com mais de 3 meses de idade

-- 1. Criar a função de limpeza
CREATE OR REPLACE FUNCTION cleanup_old_ticket_deletion_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM ticket_deletion_logs
    WHERE deleted_at < NOW() - INTERVAL '3 months';
END;
$$ LANGUAGE plpgsql;

-- 2. No Supabase, você pode agendar isso usando o painel "Database -> Cron"
-- Se o pg_cron estiver habilitado, você pode rodar:
-- SELECT cron.schedule('cleanup-logs-daily', '0 0 * * *', 'SELECT cleanup_old_ticket_deletion_logs()');

-- Nota para o backend: Como alternativa ao pg_cron, o backend chamará esta função periodicamente.





