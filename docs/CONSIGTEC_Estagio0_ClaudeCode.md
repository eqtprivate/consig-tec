# CONSIGTEC — Estágio 0 via Claude Code (fundação)

Pacote para o **Claude Code** provisionar e versionar a fundação no **Supabase** (system of record) + **GitHub**, com o **Base44** como camada de UX consumindo o Supabase e o **Resend** para transacional. Substitui o provisionamento por MCP nesta conversa — aqui tudo é código versionado.

Decisões já travadas: Supabase Auth como identidade · pertencimento múltiplo (usuário em várias unidades, um papel por vínculo) · acesso segmentado por **área/etapa** (diretor de área só vê a sua operação) · acesso = (empresas/franquias do usuário) ∩ (áreas do usuário) · Diretoria/Grupo vê tudo.

---

## 1. Estrutura do repositório

```
consigtec/
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 0001_foundation.sql
│   └── functions/
│       └── notificar/
│           └── index.ts
├── .github/workflows/ci.yml        # testes de migration + lint das functions
├── docs/                           # roadmap v2, arquitetura, contrato PixConsig, modelo cessão
└── README.md
```

## 2. Runbook de setup (o Claude Code executa)

1. **Pré-requisitos:** Supabase CLI, Deno, Node, Git; conta Supabase nova logada.
2. **Projeto Supabase:** criar o projeto `consigtec` (região `sa-east-1`) no dashboard da conta nova ou via CLI; depois `supabase link --project-ref <ref>`.
3. **Migration:** colocar `0001_foundation.sql` em `supabase/migrations/` e rodar `supabase db push`.
4. **Segredos:** `supabase secrets set RESEND_API_KEY=...` (e usar **Vault** para segredos consumidos em runtime pela aplicação: chaves PixConsig/UY3/Resend).
5. **Edge Function:** `supabase functions deploy notificar`.
6. **GitHub:** `git init`, primeiro commit, push para o repositório novo `consigtec`.
7. **Base44 → GitHub:** conectar o app CONSIGTEC (id `6a48efd938de043868888124`) ao repositório novo (hoje o versionamento está em S3).
8. **Base44 → Supabase:** configurar o app para autenticar via Supabase Auth e ler/gravar via PostgREST/Edge Functions (sem banco de domínio paralelo no Base44).

## 3. Migration de fundação — `0001_foundation.sql`

```sql
-- CONSIGTEC — Estágio 0: fundação (multi-empresa + área, RLS, auditoria, notificações, LGPD-mín)

-- 1. ENUMS ------------------------------------------------------------
create type tipo_empresa as enum ('grupo','originadora','franqueadora','investidor','operacional');
create type prioridade_pendencia as enum ('baixa','media','alta','critica');
create type status_pendencia as enum ('aberta','em_andamento','aguardando_terceiro','vencida','resolvida','cancelada');
create type status_envio as enum ('pendente','enviado','falhou');

-- 2. HIERARQUIA -------------------------------------------------------
create table empresas (
  id uuid primary key default gen_random_uuid(),
  empresa_pai_id uuid references empresas(id),
  nome text not null,
  cnpj text unique,
  tipo tipo_empresa not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table franquias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id),
  nome text not null,
  cnpj text,
  cidade text,
  uf char(2),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. ÁREAS E PAPÉIS ---------------------------------------------------
create table areas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  nome text not null,
  descricao text
);

create table papeis (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  nome text not null,
  descricao text
);

-- 4. USUÁRIOS E VÍNCULOS ---------------------------------------------
create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  cpf text,
  is_grupo_admin boolean not null default false,   -- Diretoria/Grupo vê tudo
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Múltiplos vínculos por usuário: usuário × (empresa e/ou franquia) × área × papel
create table vinculos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  empresa_id uuid references empresas(id),
  franquia_id uuid references franquias(id),
  area_id uuid not null references areas(id),
  papel_id uuid not null references papeis(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  check (empresa_id is not null or franquia_id is not null)
);
create index on vinculos(usuario_id);

-- 5. GOVERNANÇA / OPERAÇÃO -------------------------------------------
create table pendencias (
  id uuid primary key default gen_random_uuid(),
  origem text not null,
  registro_ref text,
  empresa_id uuid references empresas(id),
  franquia_id uuid references franquias(id),
  area_id uuid not null references areas(id),
  responsavel_id uuid references usuarios(id),
  prioridade prioridade_pendencia not null default 'media',
  prazo_sla timestamptz,
  status status_pendencia not null default 'aberta',
  historico jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sla_etapas (
  id uuid primary key default gen_random_uuid(),
  etapa text not null,
  prazo_horas int not null,
  regra_escalonamento text
);

create table auditoria (
  id bigserial primary key,
  entidade text not null,
  registro_id text,
  acao text not null,
  usuario_id uuid references usuarios(id),
  valor_antigo jsonb,
  valor_novo jsonb,
  created_at timestamptz not null default now()
);

create table logs_acesso (
  id bigserial primary key,
  usuario_id uuid references usuarios(id),
  acao text not null,
  entidade text,
  registro_id text,
  ip inet,
  created_at timestamptz not null default now()
);

create table regras_notificacao (
  id uuid primary key default gen_random_uuid(),
  evento text not null,
  destinatarios_perfil jsonb not null default '[]'::jsonb,
  template text,
  ativo boolean not null default true
);

create table notificacoes (
  id uuid primary key default gen_random_uuid(),
  evento text not null,
  registro_ref text,
  destinatarios jsonb not null default '[]'::jsonb,
  canal text not null default 'email',
  assunto text,
  corpo text,
  status_envio status_envio not null default 'pendente',
  created_at timestamptz not null default now()
);

create table consentimentos (
  id uuid primary key default gen_random_uuid(),
  titular_ref text not null,
  tipo text not null,
  versao_termo text,
  canal text,
  ip inet,
  documento_url text,
  created_at timestamptz not null default now()
);

create table configuracoes (
  chave text primary key,
  valor jsonb,
  descricao text
);

-- 6. updated_at automático -------------------------------------------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text;
begin
  foreach t in array array['empresas','franquias','usuarios','pendencias'] loop
    execute format('create trigger trg_%1$s_updated before update on %1$s
                    for each row execute function set_updated_at()', t);
  end loop;
end $$;

-- 7. FUNÇÕES DE APOIO À RLS (SECURITY DEFINER) -----------------------
create or replace function auth_is_grupo_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select is_grupo_admin from usuarios where id = auth.uid()), false);
$$;

create or replace function auth_can_access(p_empresa uuid, p_franquia uuid, p_area uuid)
  returns boolean language sql stable security definer set search_path = public as $$
  select auth_is_grupo_admin()
      or exists (
        select 1 from vinculos v
        where v.usuario_id = auth.uid() and v.ativo and v.area_id = p_area
          and ( (p_franquia is not null and v.franquia_id = p_franquia)
             or (p_empresa  is not null and v.empresa_id  = p_empresa) )
      );
$$;

-- 8. RLS --------------------------------------------------------------
alter table empresas        enable row level security;
alter table franquias       enable row level security;
alter table areas           enable row level security;
alter table papeis          enable row level security;
alter table usuarios        enable row level security;
alter table vinculos        enable row level security;
alter table pendencias      enable row level security;
alter table auditoria       enable row level security;
alter table logs_acesso     enable row level security;
alter table notificacoes    enable row level security;
alter table regras_notificacao enable row level security;
alter table consentimentos  enable row level security;
alter table configuracoes   enable row level security;
alter table sla_etapas      enable row level security;

-- Catálogos: leitura para autenticados; escrita só grupo admin
create policy areas_read  on areas  for select to authenticated using (true);
create policy papeis_read on papeis for select to authenticated using (true);
create policy areas_admin on areas  for all to authenticated using (auth_is_grupo_admin()) with check (auth_is_grupo_admin());
create policy papeis_admin on papeis for all to authenticated using (auth_is_grupo_admin()) with check (auth_is_grupo_admin());

-- Usuário vê a si; grupo admin vê todos
create policy usuarios_self on usuarios for select to authenticated
  using (id = auth.uid() or auth_is_grupo_admin());
create policy usuarios_admin on usuarios for all to authenticated
  using (auth_is_grupo_admin()) with check (auth_is_grupo_admin());

-- Vínculos: usuário vê os próprios; grupo admin gerencia
create policy vinculos_self on vinculos for select to authenticated
  using (usuario_id = auth.uid() or auth_is_grupo_admin());
create policy vinculos_admin on vinculos for all to authenticated
  using (auth_is_grupo_admin()) with check (auth_is_grupo_admin());

-- Empresas/franquias: vê se tem vínculo nela ou é grupo admin
create policy empresas_scope on empresas for select to authenticated
  using (auth_is_grupo_admin()
      or id in (select empresa_id from vinculos where usuario_id = auth.uid() and ativo));
create policy franquias_scope on franquias for select to authenticated
  using (auth_is_grupo_admin()
      or id in (select franquia_id from vinculos where usuario_id = auth.uid() and ativo));

-- Pendências: padrão que se repete em TODA tabela de domínio → acesso = empresa/franquia ∩ área
create policy pendencias_rls on pendencias for all to authenticated
  using (auth_can_access(empresa_id, franquia_id, area_id))
  with check (auth_can_access(empresa_id, franquia_id, area_id));

-- Auditoria/logs/consentimentos/config: restrito a grupo admin (ajustar por área depois)
create policy audit_admin on auditoria      for select to authenticated using (auth_is_grupo_admin());
create policy logs_admin  on logs_acesso    for select to authenticated using (auth_is_grupo_admin());
create policy cons_admin  on consentimentos for all    to authenticated using (auth_is_grupo_admin()) with check (auth_is_grupo_admin());
create policy conf_admin  on configuracoes  for all    to authenticated using (auth_is_grupo_admin()) with check (auth_is_grupo_admin());
create policy regras_admin on regras_notificacao for all to authenticated using (auth_is_grupo_admin()) with check (auth_is_grupo_admin());
create policy notif_read  on notificacoes   for select to authenticated using (auth_is_grupo_admin());
create policy sla_read    on sla_etapas     for select to authenticated using (true);

-- 9. SEEDS ------------------------------------------------------------
insert into areas (codigo, nome) values
  ('convenios','Convênios'),('crm','CRM / Vendas'),('averbacao','Averbação'),
  ('formalizacao','Formalização'),('financeiro','Financeiro / Recebíveis'),
  ('comissoes','Comissões'),('cobranca','Cobrança'),('cessao_fidc','Cessão / FIDC'),
  ('juridico','Jurídico / Compliance'),('suporte','Suporte'),('admin','Administração');

insert into papeis (codigo, nome) values
  ('admin_diretoria','Admin / Diretoria'),('admin_sistema','Admin do Sistema'),
  ('gestor_area','Gestor de Área'),('diretor_area','Diretor de Área'),
  ('backoffice','Backoffice'),('operador','Operador'),
  ('corban','Corban'),('parceiro_externo','Parceiro Externo'),('lider','Líder de Equipe');

insert into empresas (nome, cnpj, tipo) values
  ('Grupo Raman', null, 'grupo'),
  ('Emprestei Card', '50.422.605/0001-49', 'originadora'),
  ('PixConsig', null, 'franqueadora'),
  ('EQT Private Capital', '65.008.789/0001-72', 'investidor');
```

> Observação: o padrão da policy `pendencias_rls` (usando `auth_can_access(empresa_id, franquia_id, area_id)`) é **replicado em toda tabela de domínio** dos próximos estágios — toda entidade de negócio carrega `empresa_id`/`franquia_id`/`area_id` para o isolamento funcionar.

## 4. Edge Function — `notificar` (Resend)

```ts
// supabase/functions/notificar/index.ts
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const { evento, contexto } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. regras ativas do evento
  const { data: regras } = await supabase
    .from("regras_notificacao").select("*").eq("evento", evento).eq("ativo", true);
  if (!regras?.length) return new Response("sem regra", { status: 200 });

  // 2. resolver destinatários + montar assunto/corpo a partir do template (contexto)
  const destinatarios = resolverDestinatarios(regras, contexto); // implementar
  const { assunto, corpo } = renderTemplate(regras[0].template, contexto); // implementar

  // 3. enviar via Resend (idempotência por evento+registro+destinatário)
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "CONSIGTEC <no-reply@SEU_DOMINIO>", to: destinatarios, subject: assunto, html: corpo }),
  });

  // 4. registrar em notificacoes
  await supabase.from("notificacoes").insert({
    evento, registro_ref: contexto?.registro_ref ?? null,
    destinatarios, canal: "email", assunto, corpo,
    status_envio: r.ok ? "enviado" : "falhou",
  });

  return new Response(r.ok ? "ok" : "falhou", { status: r.ok ? 200 : 502 });
});
```

Testes obrigatórios (CI): regra inexistente, falha de envio, reenvio idempotente.

## 5. Prompt pronto para o Claude Code

> Você vai iniciar o repositório do **CONSIGTEC** e provisionar a fundação no Supabase (conta já conectada). Passos:
> 1. Crie a estrutura do repositório conforme `docs/CONSIGTEC_Estagio0_ClaudeCode.md`.
> 2. Crie o projeto Supabase `consigtec` na região `sa-east-1` (ou linke, se já existir) e faça `supabase link`.
> 3. Adicione `supabase/migrations/0001_foundation.sql` com o conteúdo da Seção 3 e rode `supabase db push`. Valide que as policies de RLS foram aplicadas.
> 4. Implemente `supabase/functions/notificar/index.ts` (Seção 4), com `resolverDestinatarios` e `renderTemplate`, e testes para: regra inexistente, falha de envio e reenvio idempotente. Faça `supabase functions deploy notificar`.
> 5. Configure secrets: `RESEND_API_KEY` (e prepare o Vault para chaves de PixConsig/UY3).
> 6. Faça o commit inicial e push para o repositório GitHub `consigtec`.
> Não crie ainda módulos de negócio (convênios, tomadores, CCB, comissões, cessão) — apenas a fundação. Ao terminar, gere um `README.md` com como rodar migrations e functions localmente.

## 6. Depois do Estágio 0

- **Estágio 1 — Integração PixConsig:** implementar o espelho de convênios + adapter (ver `CONSIGTEC_API_PixConsig_Contrato.md`), começando pelo import CSV até a API co-desenvolvida entrar.
- **Base44:** conectar o app ao repositório GitHub e apontar auth/dados para o Supabase.
- **Estágios seguintes:** cada tabela de domínio nasce com `empresa_id/franquia_id/area_id` e a policy `auth_can_access`, mantendo o isolamento multi-empresa + área de ponta a ponta.
