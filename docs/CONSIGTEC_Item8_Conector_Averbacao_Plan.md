# Item 8 — Conector de averbação em tempo real (PLANO — não implementado neste ciclo)

> A trava manual do **Item 5** (motor de travas + relógio dos 30 dias) já cobre o
> risco operacional: sem averbação `averbada` o sistema **bloqueia** a emissão de
> CCB. Este documento planeja o conector automático para os próximos ciclos.

## Objetivo
Consultar margem e **averbar/desaverbar** direto nos portais das consignatárias
(**eConsig / Zetra**), eliminando o passo manual, priorizando os convênios de
maior volume.

## Priorização (maior volume primeiro)
1. **Sumaré** · 2. **Alenquer** · 3. **Itapipoca** · 4. **Magé**
(depois, os demais por volume decrescente da carteira — usar `metricas_carteira`
e contagem de propostas por convênio para reordenar).

## Arquitetura proposta
- **Padrão adapter por portal** (já usado no espelho PixConsig): uma Edge Function
  `conector_averbacao/entry.ts` com um driver por portal (`econsig`, `zetra`),
  selecionado por `averbadoras.tipo_integracao` (campo já existe — Item BPO Fase 2).
- **Operações**: `consultarMargem(cpf, matricula)`, `averbar(proposta)`,
  `desaverbar(contrato)`, `consultarStatus(protocolo)`.
- **Fila + idempotência**: tabela `averbacao_jobs` (proposta_id, portal, operação,
  status, tentativas, payload, resposta, protocolo). Retry com backoff (padrão do
  cron `espelhar_drive` / `syncPixconsig`).
- **Credenciais por empresa/averbadora**: no Vault (nunca no front), como a
  PixConsig (`pixconsig_credenciais`). Uma linha por (empresa, averbadora).
- **Escrita de resultado**: preenche `averbacoes.protocolo`, `status='averbada'`,
  `data_averbacao`, `valor_averbado` — que já destravam o Item 5 automaticamente.

## Integração com o que já existe
- `averbadoras` (Item BPO Fase 2): portal, tipo de integração, dias de corte.
- `avaliar_travas_operacao` (Item 5): passa a ver a averbação como `averbada` assim
  que o conector confirmar — sem mudança no motor.
- `relogio_margem` (Item 5): continua alertando enquanto o conector não confirma.

## Fora de escopo agora (dependências externas)
- Contrato/credenciais reais dos portais eConsig/Zetra por convênio.
- Captcha / MFA dos portais (pode exigir RPA headless — Playwright — quando não
  houver API).
- Homologação por consignatária.

## Critério de pronto (quando implementar)
- Consulta de margem e averbação de ponta a ponta em **Sumaré**, com protocolo
  gravado e trava do Item 5 liberada automaticamente; retry e auditoria por job.
