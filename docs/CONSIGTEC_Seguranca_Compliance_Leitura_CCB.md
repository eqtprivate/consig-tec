# Leitura automática de CCB — Segurança, Privacidade e Antifraude

> CONSIGTEC · Documento técnico v1.0 · 16/07/2026 · Uso comercial e jurídico
> Escopo: módulo de Ingestão & Leitura de CCB.

## 1. Resumo executivo
A leitura de CCB por IA é **ferramenta de apoio à conferência**, não substituto do julgamento
humano. O sistema extrai os campos de uma CCB em PDF e devolve uma **sugestão**; nada é
incorporado à operação sem **conferência e aprovação de um operador autorizado**.

**Princípio central:** extração é sugestão → gravação exige conferência humana → toda aprovação
fica auditada (autor, data, e justificativa quando há divergência).

Três camadas sustentam o mecanismo: **segurança dos dados**, **antifraude** e **rastreabilidade**.

## 2. Como o mecanismo funciona
1. **Envio autenticado** — PDF enviado por administrador; hash SHA-256 impede duplicidade.
2. **Armazenamento privado** — bucket privado, criptografado, organizado por empresa/ano/mês.
3. **Leitura por IA** — PDF nativo enviado à API da Anthropic (Claude); retorna campos + confiança.
4. **Validação automática** — recálculo de parcela (Price), CPF, comparação com a proposta, coerência de valores.
5. **Conferência humana** — operador revê cada campo (editável) ao lado do PDF; divergência crítica exige justificativa.
6. **Registro e auditoria** — CCB aprovada é persistida com todos os campos + documento completo; evento auditado.

## 3. Armazenamento e proteção dos arquivos
- **Bucket privado** (`ccb-docs`), não público — nenhum arquivo acessível sem autorização.
- **Criptografia** em repouso (AES-256, camada de armazenamento) e em trânsito (TLS/HTTPS).
- **Link assinado temporário** (expira em 1h), gerado só para quem tem permissão na empresa.
- **Organização** por empresa/ano/mês; tamanho de cada arquivo medido para controle de armazenamento.
- **Sem duplicidade** — hash SHA-256 por empresa evita armazenar/cobrar o mesmo documento duas vezes.
- **Espelho opcional** no Google Drive por pasta da empresa, via conta de serviço (a empresa compartilha a pasta; **não expõe credenciais**).

## 4. Isolamento e controle de acesso
- Multiempresa com **Row Level Security (RLS)**: cada consulta é filtrada pela empresa do usuário; uma empresa não enxerga dados de outra, mesmo em erro de aplicação.
- **Menor privilégio**: só administradores/superadministradores enviam e aprovam CCBs.
- **Segregação de credenciais**: chave da API de IA só nos *secrets* do backend — nunca no app/navegador/código.
- **Acesso cruzado auditado**: a visão "como empresa" do superadministrador é registrada em log de acesso.

## 5. Processamento por IA e tratamento de dados
- Extração via **API comercial da Anthropic (Claude)**. Conforme os **termos comerciais da Anthropic**, dados de API **não são usados para treinar** modelos; retenção limitada às finalidades do provedor.
- **Sem gravação silenciosa** — o retorno da IA é sugestão em conferência; não escreve na base de negócio por conta própria.
- **Modelo configurável por empresa**, equilibrando custo/precisão, com consumo (tokens/custo) registrado por leitura.
- **Infraestrutura** apoiada em provedores com certificações de mercado (ex.: SOC 2), conforme documentação de cada provedor.

## 6. Como mitigamos fraudes (defesa em camadas)
| Controle | Como funciona | Efeito |
|---|---|---|
| Conferência humana obrigatória | Extração é sugestão; campos editáveis; gravação exige aprovação de admin | **Bloqueia** |
| Recálculo de PMT | Parcela recalculada (Price) e comparada com a da CCB | Sinaliza |
| Validação de CPF | Dígitos verificadores do CPF extraído | Valida |
| Valor × proposta | Valor da CCB confrontado com a proposta vinculada | Sinaliza |
| Coerência de valores | Verifica valor total ≈ parcela × prazo | Valida |
| Limite de confiança | Abaixo do percentual definido → revisão obrigatória | **Bloqueia** |
| Justificativa em divergência crítica | Aprovar apesar de divergência crítica exige justificativa registrada | **Bloqueia** |
| Força executiva (Lei 10.931/04) | Checklist: denominação, promessa de pagamento, liquidez, devedor | Sinaliza |
| Idempotência por hash | SHA-256 impede reprocessar/duplicar o mesmo documento | Valida |
| Motor de travas | Bloqueia CCB sem averbação confirmada; travas de margem, idade, prazo | **Bloqueia** |

## 7. Rastreabilidade e auditoria
- **Log de leituras**: modelo, tokens, custo, confiança, duração, resultado por tentativa.
- **Trilha de aprovações**: usuário, data, ação e justificativa.
- **Logs de acesso** (somente-leitura), incluindo a visão "como empresa".
- **Documento íntegro**: CCB aprovada guarda o PDF original + todos os campos lidos.

## 8. Privacidade e LGPD
- **Finalidade e base legal**: dados tratados para execução do contrato de crédito consignado e obrigações legais.
- **Minimização e acesso restrito**: RLS por empresa; perfis autorizados; credenciais segregadas.
- **Direitos do titular**: módulo próprio de solicitações LGPD.
- **Retenção e descarte**: exclusão controlada de ingestões e do arquivo, preservando o que virou contrato.

## 9. Governança operacional
- **Cotas por pacote**: tetos de leituras/mês, documentos e armazenamento; ao exceder, novas leituras são recusadas antes de qualquer custo.
- **Exclusão protegida**: ingestões com erro/pendentes podem ser removidas (com o PDF); **CCB aprovada não pode ser excluída**.
- **Custo transparente**: custo por leitura medido e exibido.

## 10. Limitações e responsabilidades
A leitura por IA é **ferramenta de apoio à decisão** e não garante acurácia de 100% — por isso a
**conferência humana é obrigatória** no fluxo. Até a aprovação, os campos extraídos são **sugestão**.
A decisão de crédito, a validação dos dados e a responsabilidade final permanecem com o operador e a
instituição, conforme suas políticas e a regulação aplicável.

---
*Documento descritivo dos controles vigentes, para fins comerciais e de conformidade. Referências a
políticas/certificações de terceiros seguem a documentação pública de cada provedor. Não constitui
aconselhamento jurídico.*
