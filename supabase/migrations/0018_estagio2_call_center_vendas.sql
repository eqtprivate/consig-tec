-- ============================================================
-- CONSIGTEC — Estágio 2 (aprofundado): processo de venda / call center
-- Leads → Interações (discagem) → Qualificação → Oportunidades (pipeline)
-- → Proposta/Venda. Fila de trabalho + agendamento de retorno.
-- Aplicar após 0017. Idempotente.
-- ============================================================

DO $$ BEGIN CREATE TYPE tipo_interacao AS ENUM
  ('ligacao','whatsapp','email','sms','nota','retorno'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE resultado_interacao AS ENUM
  ('atendeu','nao_atendeu','caixa_postal','numero_errado','sem_interesse','agendar_retorno','qualificado','nao_perturbe'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE produto_consig AS ENUM
  ('cartao_beneficio','consignado','cartao_credito','saque_complementar'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE etapa_oportunidade AS ENUM
  ('qualificacao','simulacao','proposta_enviada','em_formalizacao','ganha','perdida'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Enriquecer leads para a operação de call center
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tentativas int NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultimo_contato timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS proximo_contato timestamptz;
CREATE INDEX IF NOT EXISTS idx_leads_proximo_contato ON leads(proximo_contato);

-- ------------------------------------------------------------
-- OPORTUNIDADES (pipeline de vendas)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES clientes(id) ON DELETE SET NULL,
  convenio_id uuid REFERENCES convenios(id),
  matricula_id uuid REFERENCES matriculas(id),
  operador_id uuid REFERENCES usuarios(id),
  franquia_id uuid REFERENCES franquias(id),
  produto produto_consig NOT NULL DEFAULT 'cartao_beneficio',
  valor_estimado numeric(12,2),
  margem_estimada numeric(12,2),
  taxa_estimada numeric(6,4),
  prazo_estimado int,
  valor_parcela numeric(12,2),
  etapa etapa_oportunidade NOT NULL DEFAULT 'qualificacao',
  probabilidade int NOT NULL DEFAULT 50,
  motivo_perda text,
  proposta_id uuid REFERENCES propostas(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_oport_etapa ON oportunidades(etapa);
CREATE INDEX IF NOT EXISTS idx_oport_franquia ON oportunidades(franquia_id);
CREATE INDEX IF NOT EXISTS idx_oport_operador ON oportunidades(operador_id);

-- ------------------------------------------------------------
-- INTERAÇÕES (discagem / atividades do call center)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  oportunidade_id uuid REFERENCES oportunidades(id) ON DELETE CASCADE,
  operador_id uuid REFERENCES usuarios(id),
  franquia_id uuid REFERENCES franquias(id),
  tipo tipo_interacao NOT NULL DEFAULT 'ligacao',
  resultado resultado_interacao,
  observacao text,
  proximo_contato timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_interacoes_lead ON interacoes(lead_id);
CREATE INDEX IF NOT EXISTS idx_interacoes_oport ON interacoes(oportunidade_id);

DROP TRIGGER IF EXISTS trg_oport_updated ON oportunidades;
CREATE TRIGGER trg_oport_updated BEFORE UPDATE ON oportunidades FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ao registrar interação, atualiza o lead (tentativas, último/próximo contato, status)
CREATE OR REPLACE FUNCTION public.trg_interacao_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    UPDATE leads SET
      tentativas = tentativas + 1,
      ultimo_contato = now(),
      proximo_contato = NEW.proximo_contato,
      status = CASE
        WHEN NEW.resultado IN ('sem_interesse','nao_perturbe','numero_errado') THEN 'perdido'::status_lead
        WHEN NEW.resultado = 'qualificado' THEN 'qualificado'::status_lead
        WHEN NEW.resultado IS NOT NULL AND status = 'novo' THEN 'contatado'::status_lead
        ELSE status
      END
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_interacao_lead ON interacoes;
CREATE TRIGGER trg_interacao_lead AFTER INSERT ON interacoes
  FOR EACH ROW EXECUTE FUNCTION trg_interacao_lead();

-- RLS (escopo por franquia / operador)
ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE interacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS oportunidades_rls ON oportunidades;
CREATE POLICY oportunidades_rls ON oportunidades FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id) OR operador_id = auth.uid())
  WITH CHECK (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id) OR operador_id = auth.uid());

DROP POLICY IF EXISTS interacoes_rls ON interacoes;
CREATE POLICY interacoes_rls ON interacoes FOR ALL TO authenticated
  USING (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id) OR operador_id = auth.uid())
  WITH CHECK (auth_is_grupo_admin() OR auth_tem_escopo(NULL, franquia_id) OR operador_id = auth.uid());
