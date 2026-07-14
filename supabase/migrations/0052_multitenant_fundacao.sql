-- ============================================================
-- CONSIGTEC — Multi-tenant (Fase 1: FUNDAÇÃO).
-- Cria/consolida a empresa-tenant raiz "EmpresteiCard", adiciona
-- usuarios.empresa_id e faz o backfill de empresa_id em toda a base atual.
-- NÃO altera RLS ainda (comportamento de acesso é o mesmo) — isso vem na 0053.
-- Idempotente. Após 0051.
-- ============================================================

-- 1) usuarios ganha o tenant de origem
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES empresas(id);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON usuarios(empresa_id);

DO $$
DECLARE
  v_emp uuid;
  t text;
  alvos text[] := ARRAY['convenios','clientes','propostas','contratos','pendencias','threads'];
BEGIN
  -- Resolve a empresa raiz EmpresteiCard:
  --  a) se já existe pelo nome, usa;
  --  b) senão, reaproveita a empresa-grupo raiz existente (renomeia);
  --  c) senão, cria.
  SELECT id INTO v_emp FROM empresas WHERE lower(nome) = 'empresteicard' LIMIT 1;
  IF v_emp IS NULL THEN
    SELECT id INTO v_emp FROM empresas WHERE empresa_pai_id IS NULL ORDER BY created_at LIMIT 1;
    IF v_emp IS NULL THEN
      INSERT INTO empresas (nome, tipo, ativo) VALUES ('EmpresteiCard', 'grupo', true) RETURNING id INTO v_emp;
    ELSE
      UPDATE empresas SET nome = 'EmpresteiCard' WHERE id = v_emp;
    END IF;
  END IF;

  -- Guarda a referência da empresa raiz (usada pela RLS/telas depois).
  INSERT INTO configuracoes (chave, valor, descricao)
  VALUES ('empresa_raiz', to_jsonb(v_emp::text), 'Empresa/tenant raiz (EmpresteiCard) — migração multi-tenant.')
  ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, descricao = EXCLUDED.descricao;

  -- 2) Todas as franquias pertencem à EmpresteiCard.
  UPDATE franquias SET empresa_id = v_emp WHERE empresa_id IS DISTINCT FROM v_emp;

  -- 3) Todos os usuários atuais pertencem à EmpresteiCard.
  UPDATE usuarios SET empresa_id = v_emp WHERE empresa_id IS NULL;

  -- 4) Backfill de empresa_id nas tabelas de negócio que já têm a coluna.
  FOREACH t IN ARRAY alvos LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'empresa_id') THEN
      EXECUTE format('UPDATE public.%I SET empresa_id = $1 WHERE empresa_id IS NULL', t) USING v_emp;
    END IF;
  END LOOP;

  RAISE NOTICE 'EmpresteiCard = %', v_emp;
END $$;

-- Conferência
SELECT 'empresa_raiz' AS item, valor #>> '{}' AS valor FROM configuracoes WHERE chave = 'empresa_raiz'
UNION ALL SELECT 'usuarios com empresa', count(*)::text FROM usuarios WHERE empresa_id IS NOT NULL
UNION ALL SELECT 'franquias EmpresteiCard', count(*)::text FROM franquias
UNION ALL SELECT 'convenios com empresa', count(*)::text FROM convenios WHERE empresa_id IS NOT NULL;
