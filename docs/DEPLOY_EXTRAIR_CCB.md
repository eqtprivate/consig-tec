# Deploy da Edge Function `extrair_ccb` (Supabase)

A leitura de CCB roda numa **Edge Function do Supabase** (não no Base44), porque
as functions do Base44 têm teto de ~30s por requisição e a CCB (PDF grande, ~45
campos) estoura esse limite — deixando a ingestão presa em `extraindo`. No
Supabase o limite é bem maior e usamos `EdgeRuntime.waitUntil` para concluir em
segundo plano.

Arquivo: `supabase/functions/extrair_ccb/index.ts`

## Pré-requisitos (uma vez)
- Ter o **Supabase CLI** instalado: https://supabase.com/docs/guides/cli
- Estar logado: `supabase login`
- Project ref: **`blnslbrflspiflrwsuzh`**

## Passos

```bash
# 1) na raiz do repositório (onde existe a pasta supabase/)
supabase link --project-ref blnslbrflspiflrwsuzh

# 2) deploy da function
supabase functions deploy extrair_ccb --project-ref blnslbrflspiflrwsuzh

# 3) secret da API do Claude (a MESMA chave usada no Base44)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref blnslbrflspiflrwsuzh

# 4) (opcional) modelo padrão — se omitir, usa claude-sonnet-5
supabase secrets set CLAUDE_MODEL=claude-sonnet-5 --project-ref blnslbrflspiflrwsuzh
```

> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente pela
> plataforma — **não** precisa setar.

### Alternativa pelo Dashboard (sem CLI)
Supabase → **Edge Functions** → **Deploy a new function** → nome `extrair_ccb` →
cole o conteúdo de `supabase/functions/extrair_ccb/index.ts`. Depois em
**Edge Functions → Secrets**, adicione `ANTHROPIC_API_KEY` (e, se quiser,
`CLAUDE_MODEL`).

## Como validar
1. Envie uma CCB pela tela **Formalização ▸ Ingestão de CCB**.
2. O status vai para **Extraindo** e, em ~30–60s, deve virar **Conferência**
   (a tela atualiza sozinha; pode fechar a aba que o servidor conclui).
3. Se algo falhar, o status vira **Erro** com a mensagem — e o log de tentativas
   (Ajustes da leitura de CCB) registra modelo, tokens, custo e duração.

## Observações
- **Segurança:** a function exige JWT de `admin`/`superadmin` (o mesmo controle do
  Base44). O bucket `ccb-docs` continua privado; a function baixa o PDF via
  service role.
- **Decreto:** continua no fluxo do Base44 (leitura rápida, cabe no limite). Se um
  decreto muito grande também passar a travar, dá para replicar esta mesma função
  para decretos.
- **Reprocessar** uma CCB (na conferência) também passa a usar esta function.
