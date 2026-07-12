-- ============================================================
-- CONSIGTEC — Call center: roteiro de atendimento, motivos de perda
-- padronizados e comissão do operador por venda. Após 0019. Idempotente.
-- ============================================================

-- ---------------- Motivos de perda padronizados ----------------
CREATE TABLE IF NOT EXISTS motivos_perda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO motivos_perda (codigo, nome, ordem)
SELECT * FROM (VALUES
  ('sem_margem','Sem margem disponível',1),
  ('sem_interesse','Sem interesse',2),
  ('ja_possui','Já possui contrato/concorrente',3),
  ('taxa_alta','Achou a taxa alta',4),
  ('nao_elegivel','Não elegível (vínculo/convênio)',5),
  ('nao_atende','Não atende / inlocalizável',6),
  ('desistiu','Desistiu na formalização',7),
  ('outro','Outro',99)
) v(codigo, nome, ordem)
WHERE NOT EXISTS (SELECT 1 FROM motivos_perda);

-- ---------------- Roteiro / script de atendimento ----------------
CREATE TABLE IF NOT EXISTS roteiro_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL DEFAULT 'abordagem',  -- abordagem, sondagem, oferta, objecoes, fechamento
  titulo text NOT NULL,
  conteudo text NOT NULL,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_roteiro_updated ON roteiro_scripts;
CREATE TRIGGER trg_roteiro_updated BEFORE UPDATE ON roteiro_scripts FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO roteiro_scripts (categoria, titulo, conteudo, ordem)
SELECT * FROM (VALUES
  ('abordagem','Saudação','Bom dia/tarde, falo com {NOME}? Aqui é da CONSIGTEC, tudo bem? Tenho uma condição de crédito consignado pra você.',1),
  ('sondagem','Vínculo e margem','O(a) senhor(a) é servidor(a) de qual órgão? Já usa margem de cartão benefício? Posso verificar sua margem disponível.',2),
  ('oferta','Oferta','Consigo liberar até {VALOR} com parcela de {PARCELA} descontada em folha. Fica bom pra você?',3),
  ('objecoes','Objeção: taxa','Entendo. Nossa taxa é competitiva pro consignado, e o desconto é direto na folha, sem risco de esquecer. Vale a simulação sem compromisso.',4),
  ('fechamento','Fechamento','Perfeito! Vou te enviar o link de formalização por WhatsApp agora. É rápido: selfie, aceite e pronto.',5)
) v(categoria, titulo, conteudo, ordem)
WHERE NOT EXISTS (SELECT 1 FROM roteiro_scripts);

-- Vincular motivo de perda padronizado a leads e oportunidades
ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivo_perda_id uuid REFERENCES motivos_perda(id);
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS motivo_perda_id uuid REFERENCES motivos_perda(id);

-- Ligar comissão à oportunidade (dedupe da comissão do operador)
ALTER TABLE comissoes ADD COLUMN IF NOT EXISTS oportunidade_id uuid REFERENCES oportunidades(id) ON DELETE SET NULL;

-- RLS: leitura autenticada, escrita admin (config)
ALTER TABLE motivos_perda ENABLE ROW LEVEL SECURITY;
ALTER TABLE roteiro_scripts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS motivos_read ON motivos_perda;
CREATE POLICY motivos_read ON motivos_perda FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS motivos_admin ON motivos_perda;
CREATE POLICY motivos_admin ON motivos_perda FOR ALL TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());
DROP POLICY IF EXISTS roteiro_read ON roteiro_scripts;
CREATE POLICY roteiro_read ON roteiro_scripts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS roteiro_admin ON roteiro_scripts;
CREATE POLICY roteiro_admin ON roteiro_scripts FOR ALL TO authenticated USING (auth_is_grupo_admin()) WITH CHECK (auth_is_grupo_admin());

-- ------------------------------------------------------------
-- FUNÇÃO/TRIGGER: comissão do operador quando a oportunidade é GANHA
-- Reusa regras_comissao (beneficiario='operador'; convênio-específica >
-- global). Idempotente por oportunidade. base = valor_estimado.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_comissao_operador()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE r regras_comissao; base_val numeric;
BEGIN
  IF NEW.etapa = 'ganha' AND NEW.etapa IS DISTINCT FROM OLD.etapa AND NEW.operador_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM comissoes WHERE oportunidade_id = NEW.id) THEN RETURN NEW; END IF;
    SELECT * INTO r FROM regras_comissao
      WHERE ativo AND beneficiario = 'operador' AND (convenio_id = NEW.convenio_id OR convenio_id IS NULL)
      ORDER BY convenio_id NULLS LAST LIMIT 1;
    IF FOUND THEN
      base_val := COALESCE(NEW.valor_estimado, 0);
      INSERT INTO comissoes (contrato_id, usuario_id, franquia_id, beneficiario, tipo, base_calculo, percentual, valor, status, regra_id, oportunidade_id)
      VALUES (NULL, NEW.operador_id, NEW.franquia_id, 'operador', 'venda_operador', base_val, r.percentual,
              round(base_val * r.percentual / 100.0, 2), 'prevista', r.id, NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_comissao_operador ON oportunidades;
CREATE TRIGGER trg_comissao_operador AFTER UPDATE ON oportunidades
  FOR EACH ROW EXECUTE FUNCTION trg_comissao_operador();

-- Regra padrão de comissão do operador (2% sobre a venda), se não houver
INSERT INTO regras_comissao (convenio_id, beneficiario, percentual, base, descricao)
SELECT NULL, 'operador'::beneficiario_comissao, 2.0, 'principal', 'Comissão padrão do operador (venda)'
WHERE NOT EXISTS (SELECT 1 FROM regras_comissao WHERE beneficiario = 'operador');
