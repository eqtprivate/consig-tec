-- ============================================================
-- CONSIGTEC — Estágio 9: gestão da fila de notificações
-- Permite ao admin do grupo enfileirar/gerir notificações (o envio
-- em si é feito pela função backend dispatchNotificacao via Resend).
-- Aplicar após 0012. Idempotente.
-- ============================================================
DROP POLICY IF EXISTS notif_admin ON notificacoes;
CREATE POLICY notif_admin ON notificacoes FOR ALL TO authenticated
  USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());
