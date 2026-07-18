-- 0100 — Backup diário (todos os dados) com retenção de 7 dias, via pg_cron
--
-- Snapshot lógico DIÁRIO de todas as tabelas do schema public para o schema
-- `backups`, cada uma sufixada pela data (…_AAAAMMDD). Retém 7 dias e expurga o
-- resto. Protege contra alteração/exclusão acidental (restauração lógica seletiva).
--
-- Observação de DR: este backup vive no MESMO cluster Postgres. Para disaster
-- recovery (perda do projeto), MANTENHA também os backups nativos do Supabase.
-- Roda 100% em SQL (sem edge function → sem EarlyDrop), agendado por pg_cron.

CREATE SCHEMA IF NOT EXISTS backups;

-- Log de execuções (para auditar que o backup rodou).
CREATE TABLE IF NOT EXISTS backups.log_execucao (
  id            bigserial PRIMARY KEY,
  executado_em  timestamptz NOT NULL DEFAULT now(),
  competencia   date        NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  tabelas       int         NOT NULL DEFAULT 0,
  ok            boolean     NOT NULL DEFAULT true,
  erro          text
);

-- Executa o backup: copia cada tabela base de public para backups.<tabela>_AAAAMMDD
-- e expurga snapshots com mais de 7 dias.
CREATE OR REPLACE FUNCTION backups.executar_backup_diario()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, backups
AS $$
DECLARE
  r      record;
  d      text := to_char(now() AT TIME ZONE 'utc', 'YYYYMMDD');
  n      int  := 0;
  alvo   text;
BEGIN
  -- 1) Snapshot de todas as tabelas do schema public.
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    alvo := format('backups.%I', r.tablename || '_' || d);
    EXECUTE format('DROP TABLE IF EXISTS %s', alvo);
    EXECUTE format('CREATE TABLE %s AS TABLE public.%I', alvo, r.tablename);
    n := n + 1;
  END LOOP;

  -- 2) Expurga snapshots com mais de 7 dias (data no sufixo _AAAAMMDD).
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'backups'
      AND tablename ~ '_[0-9]{8}$'
      AND to_date(right(tablename, 8), 'YYYYMMDD') < (now() AT TIME ZONE 'utc')::date - 7
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS backups.%I', r.tablename);
  END LOOP;

  INSERT INTO backups.log_execucao (tabelas, ok) VALUES (n, true);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO backups.log_execucao (tabelas, ok, erro) VALUES (n, false, SQLERRM);
  RAISE;
END;
$$;

-- Agendamento diário às 03:00 UTC (= 00:00 no horário de Brasília), via pg_cron.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Re-agendável com segurança: remove o job anterior (se existir) e recria.
DO $$
BEGIN
  PERFORM cron.unschedule('backup_diario');
EXCEPTION WHEN OTHERS THEN
  NULL;  -- job ainda não existia
END;
$$;

SELECT cron.schedule('backup_diario', '0 3 * * *', $$SELECT backups.executar_backup_diario();$$);
