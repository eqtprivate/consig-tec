-- ============================================================
-- CONSIGTEC — Documentos de Superadmin (confidenciais).
-- Tabela com RLS liberando APENAS o superadmin; leitura de um documento passa
-- por RPC SECURITY DEFINER que grava trilha em logs_acesso (registrar_log_acesso,
-- migr. 0081). Edição audita em `auditoria`. Semeia o Roadmap do projeto e o
-- Briefing confidencial. Após 0094. Idempotente.
-- ============================================================

CREATE TABLE IF NOT EXISTS documentos_admin (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  categoria text NOT NULL DEFAULT 'briefing',   -- briefing | roadmap | seguranca | estrategia
  conteudo text NOT NULL,                        -- markdown
  confidencial boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES usuarios(id),
  updated_by uuid REFERENCES usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_documentos_admin_updated ON documentos_admin;
CREATE TRIGGER trg_documentos_admin_updated BEFORE UPDATE ON documentos_admin
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE documentos_admin ENABLE ROW LEVEL SECURITY;
-- Cinto-e-suspensório: mesmo com o bypass global do superadmin, a ÚNICA política
-- libera exclusivamente o superadmin. Qualquer outro papel é negado por padrão.
DROP POLICY IF EXISTS documentos_admin_superadmin ON documentos_admin;
CREATE POLICY documentos_admin_superadmin ON documentos_admin FOR ALL TO authenticated
  USING (auth_is_superadmin()) WITH CHECK (auth_is_superadmin());

-- ------------------------------------------------------------
-- Leitura auditada: exige superadmin e grava quem abriu (logs_acesso).
-- A tela chama ESTA função (não um SELECT direto) ao abrir um documento.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_documento_admin(p_id uuid)
RETURNS documentos_admin
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE d documentos_admin;
BEGIN
  IF NOT auth_is_superadmin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO d FROM documentos_admin WHERE id = p_id;
  IF d.id IS NULL THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  PERFORM registrar_log_acesso('leitura_documento_admin', NULL,
    jsonb_build_object('documento_id', p_id, 'titulo', d.titulo, 'categoria', d.categoria));
  RETURN d;
END $$;
GRANT EXECUTE ON FUNCTION public.get_documento_admin(uuid) TO authenticated;

-- ------------------------------------------------------------
-- Gravação (criar/editar) — superadmin; audita em `auditoria`.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.salvar_documento_admin(
  p_id uuid, p_titulo text, p_categoria text, p_conteudo text, p_confidencial boolean DEFAULT true
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT auth_is_superadmin() THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO documentos_admin (titulo, categoria, conteudo, confidencial, created_by, updated_by)
    VALUES (p_titulo, coalesce(nullif(p_categoria,''),'briefing'), p_conteudo, coalesce(p_confidencial,true), auth.uid(), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE documentos_admin
       SET titulo = p_titulo, categoria = coalesce(nullif(p_categoria,''),'briefing'),
           conteudo = p_conteudo, confidencial = coalesce(p_confidencial,true), updated_by = auth.uid()
     WHERE id = p_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Documento não encontrado.'; END IF;
  END IF;
  INSERT INTO auditoria (entidade, registro_id, acao, valor_novo)
  VALUES ('documentos_admin', v_id, CASE WHEN p_id IS NULL THEN 'criar_documento_admin' ELSE 'editar_documento_admin' END,
          jsonb_build_object('titulo', p_titulo, 'categoria', p_categoria));
  RETURN v_id;
END $$;
GRANT EXECUTE ON FUNCTION public.salvar_documento_admin(uuid, text, text, text, boolean) TO authenticated;

-- ------------------------------------------------------------
-- Seed: Roadmap do projeto + Briefing confidencial. Idempotente por título.
-- ------------------------------------------------------------
INSERT INTO documentos_admin (titulo, categoria, conteudo, confidencial, ordem)
SELECT 'Roadmap do Projeto — CONSIGTEC', 'roadmap', $md$# Roadmap do Projeto — CONSIGTEC

> **CONFIDENCIAL — acesso restrito ao superadmin.** Visão viva do roadmap. Detalhe completo
> em `docs/CONSIGTEC_Roadmap_v2_Enriquecido.md`, `docs/STATUS.md` e
> `docs/CONSIGTEC_Auditoria_Externa.md`. Última revisão: 16/07/2026.

## Onde estamos
Plataforma SaaS multi-tenant de consignado (Vite/React + Base44 + Supabase + Edge Functions
+ IA Anthropic). Esteira das 7 etapas estruturalmente completa (migrações até **0094**).
Regra de ouro: **"implementado" = código/migração aplicada; "validado" = provado com dado real**.

## Backbone (6 etapas executivas)
Comercial → Formalização → Análise → Liberação → Operação → Cessão FIDC.

## Estágios (resumo)
- **0** Fundação & Setup — auth, ecossistema Grupo→Empresa→Franquia→Líder→Corban, RLS, auditoria. ✅
- **1** Convênios — PixConsig como fonte da verdade (API + espelho/overlay comercial). ✅ (MVP via CSV)
- **2** CRM/Vendas · **3** Tomadores · **4** Margem & Averbação. ✅ núcleo
- **5** Formalização, Antifraude & CCB (UY3). ✅ registro
- **6** Recebíveis/PMT & Conciliação (paridade BPO). ✅
- **7** Comissões (rateio franquia/líder/corban). ✅
- **8** Cessão, Lastro & FIDC (deságio, coobrigação, bordereau). ✅ registro
- **9** SLA/Notificações · **10** Dashboards executivo/investidor. ✅ base
- **11–16** Cobrança, Chamados, LGPD, Carteiras adquiridas, Refin, Integrações. 🟡

## Módulos de IA para documentos (destaque 2026-07)
- **Leitura de CCB** (migr. 0078–0093) — EM PRODUÇÃO: ~45 campos, conferência humana,
  arquivamento criptografado, cota por plano, log de custo em R$.
- **Leitura de Decretos** (migr. 0094) — construído + validado (Manaus): extrai regras,
  **compara com o convênio (preenche/confere/DIVERGENTE)**, aplica sob conferência; Arquivo de Decretos.

## Próximos passos priorizados
1. **P0 de segurança** (ver Briefing): fechar signups públicos, ativar proteção de senha vazada.
2. **Publish** do frontend no Base44 (telas de decretos, arquivo, cota, suporte/segurança).
3. Validar por **evidência E2E** com 1–2 convênios reais (não por "feito").
4. Integrações reais (UY3/CNAB, Kanastra/Utility FIDC, WhatsApp) + RPA/conector das averbadoras.
5. Pen test de isolamento cross-tenant antes do 1º cliente externo.
$md$, true, 1
WHERE NOT EXISTS (SELECT 1 FROM documentos_admin WHERE titulo = 'Roadmap do Projeto — CONSIGTEC');

INSERT INTO documentos_admin (titulo, categoria, conteudo, confidencial, ordem)
SELECT 'Briefing do Superadmin — CONSIGTEC', 'seguranca', $md$# Briefing do Superadmin — CONSIGTEC

> **CONFIDENCIAL — ACESSO RESTRITO AO SUPERADMIN DO PROJETO.** Estado de segurança, riscos e
> decisões estratégicas. Não exibir a usuários comuns, admins de cliente (tenant) nem a
> terceiros. Última revisão: 15/07/2026.

## 1. Estado do projeto
Plataforma SaaS multi-cliente de consignado (Vite/React + Base44 + Supabase). Esteira das 7
etapas estruturalmente completa: núcleo 0–16, SaaS multi-tenant/white-label, CRM evoluído,
conciliação (paridade BPO), ingestão de CCB e de decretos. **"Implementado" = código/migração
aplicada, não "provado com dado real".**

## 2. Estado de segurança (prioridade máxima)
- 🔴 **Signups do Supabase possivelmente abertos em produção.** Com CPF, margem e dados
  bancários de servidores, signup público é exposição direta. Verificar e fechar (security advisors).
- 🔴 **Proteção de senha vazada** (HaveIBeenPwned) — confirmar se está ativa no Auth.
- 🔴 **Superadmin cross-tenant e irrestrito pela RLS.** Decisão legítima de SaaS, mas dá poder
  total sobre a PII de todos os clientes. **Contrapartida:** todo acesso do superadmin (inclusive
  "ver como"/impersonação) grava em `logs_acesso`. Poder sem trilha é achado grave de auditoria LGPD.
- ⚠️ Antes do 1º cliente externo: **pen test de isolamento cross-tenant** (A não vê dado de B).

## 3. Riscos operacionais
- **Averbação e conciliação são os vazamentos silenciosos.** Sem averbação com lastro,
  empresta-se sem garantia; sem conciliação fina, "acha que lucra e está sangrando". Ambas
  dependem de integração externa hoje tratada como manual.
- **Ingestão de CCB/decreto validada em leitura, mas ainda não homologada E2E com aprovação real** em produção.
- **Fragilidade de frontend já derrubou produção** (import faltando no Sidebar). Mitigar com smoke test no CI.

## 4. Decisões estratégicas em aberto (diretoria)
- **Vender o SaaS para fora?** Muda prioridades (billing, suporte, isolamento) e exige o pen test cross-tenant.
- **RPA das averbadoras:** construir (custo recorrente) × contratar a captura.
- **FIDC:** próprio × terceiros; coobrigação (pro solvendo × pro soluto) define o que monitorar após a cessão.

## 5. Governança de acessos e segredos
- **Segredos de runtime** (chave PixConsig por cliente, chave do Claude, service account do
  Drive, Resend) nos **secrets** — nunca no repositório. `service_role` só no backend.
- **Contas dedicadas do projeto:** Supabase, GitHub, Google (Gmail/Drive), Resend. Manter
  inventário de quem acessa cada uma (gerenciador de senhas do time).
- **PixConsig** = fonte da verdade dos convênios; credenciais por empresa.

## 6. Próximos passos priorizados
CI (smoke test) → **P0 de segurança** → decreto-como-dado → ingestão ao vivo + validação legal
→ conciliação "repasse perdido" → motor de travas + relógio 30 dias → cessão
(deságio/coobrigação/bordereau) → semear carteira. Validar por **evidência** e por **teste E2E
de um convênio real**, não por "feito".
$md$, true, 2
WHERE NOT EXISTS (SELECT 1 FROM documentos_admin WHERE titulo = 'Briefing do Superadmin — CONSIGTEC');
