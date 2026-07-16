import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ScanLine, Printer, LifeBuoy } from 'lucide-react';

// Documento técnico de Segurança, Privacidade e Antifraude da leitura de CCB.
// Página interna (não depende de serviços externos).

function Sec({ n, id, titulo, children }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border pt-6">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="font-mono text-sm font-bold text-primary">{n}</span>
        <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2 max-w-3xl">{children}</div>
    </section>
  );
}
function Li({ children }) {
  return (
    <li className="relative pl-5">
      <span className="absolute left-0 top-[0.55em] w-2 h-2 border-[1.5px] border-primary rotate-45 rounded-[2px]" />
      {children}
    </li>
  );
}
function Tab({ head, rows }) {
  return (
    <div className="overflow-x-auto border border-border rounded-lg my-3">
      <table className="w-full text-sm bg-card">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>{head.map((h) => <th key={h} className="text-left font-mono text-[10.5px] uppercase tracking-wide font-semibold px-3 py-2.5">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border align-top">
              {r.map((c, j) => <td key={j} className="px-3 py-2.5">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
const Sev = ({ t }) => {
  const m = { Bloqueia: 'bg-red-500/12 text-red-600', Sinaliza: 'bg-amber-500/15 text-amber-600', Valida: 'bg-green-500/15 text-green-600' };
  return <span className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded-full whitespace-nowrap ${m[t] || 'bg-muted text-muted-foreground'}`}>{t}</span>;
};
const B = ({ children }) => <b className="text-foreground/90 font-semibold">{children}</b>;

const NAV = [
  ['s1', 'Resumo'], ['s3', 'Dados tratados'], ['s4', 'Armazenamento'], ['s6', 'IA & subprocessadores'],
  ['s7', 'Antifraude'], ['s9', 'LGPD'], ['s11', 'Incidentes'], ['s13', 'Glossário'],
];

export default function SegurancaCompliance() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Cabeçalho */}
      <header className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-6">
        <div className="flex items-center gap-3 mb-3">
          <img src="/brand/consigtec_logo_icon.png" alt="CONSIGTEC" className="w-10 h-10 rounded-lg" />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Documento técnico</p>
            <h1 className="text-xl font-bold text-foreground leading-tight">Leitura de CCB — Segurança, Privacidade e Antifraude</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">Como a plataforma lê, valida e armazena Cédulas de Crédito Bancário — e os controles que sustentam o uso do mecanismo perante clientes, auditoria e requisitos legais.</p>
        <div className="flex flex-wrap gap-2 mt-4 text-[11px] font-mono text-muted-foreground">
          <span className="px-2.5 py-1 rounded-full border border-border">Versão 2.0</span>
          <span className="px-2.5 py-1 rounded-full border border-border">16/07/2026</span>
          <span className="px-2.5 py-1 rounded-full border border-border">Uso comercial e jurídico</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="w-4 h-4" /> Imprimir / PDF</Button>
          <Link to="/suporte"><Button size="sm" variant="ghost" className="gap-2"><LifeBuoy className="w-4 h-4" /> Central de suporte</Button></Link>
          <Link to="/area/formalizacao?tab=ingestao"><Button size="sm" variant="ghost" className="gap-2"><ScanLine className="w-4 h-4" /> Ingestão de CCB</Button></Link>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1.5">
        {NAV.map(([id, label]) => <a key={id} href={`#${id}`} className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">{label}</a>)}
      </nav>

      <Sec n="01" id="s1" titulo="Resumo executivo">
        <p>A leitura de CCB por inteligência artificial é uma <B>ferramenta de apoio à conferência</B>, não um substituto do julgamento humano. O sistema extrai os campos de uma CCB em PDF e devolve uma <B>sugestão</B>; nenhum dado é incorporado à operação sem <B>conferência e aprovação de um operador autorizado</B>.</p>
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-foreground text-sm"><b>Princípio central:</b> extração é sugestão → gravação exige conferência humana → toda aprovação fica auditada (autor, data, e justificativa quando há divergência).</div>
        <p>Sobre esse princípio operam três camadas: <B>segurança dos dados</B>, <B>antifraude</B> e <B>rastreabilidade</B>.</p>
      </Sec>

      <Sec n="02" id="s2" titulo="Como o mecanismo funciona">
        <ol className="space-y-2 list-none pl-0">
          {[
            ['Envio autenticado', 'PDF enviado por administrador; hash SHA-256 impede duplicidade.'],
            ['Verificação de cota', 'Confere os limites do plano antes de processar; excedido, recusa sem custo.'],
            ['Armazenamento privado', 'Grava em bucket privado, criptografado, por empresa/ano/mês.'],
            ['Leitura por IA', 'PDF nativo enviado à API da Anthropic (Claude); ~45 campos + índice de confiança.'],
            ['Validação automática', 'Recálculo de parcela (Price), CPF, comparação com a proposta, coerência de valores.'],
            ['Conferência humana', 'Operador revê cada campo (editável); divergência crítica exige justificativa.'],
            ['Registro e auditoria', 'CCB aprovada é persistida com campos + documento íntegro; evento auditado.'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="w-6 h-6 rounded-md bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <span><B>{t}.</B> {d}</span>
            </li>
          ))}
        </ol>
      </Sec>

      <Sec n="03" id="s3" titulo="Categorias de dados tratados e base legal">
        <p>O tratamento observa a <B>minimização</B>: apenas o necessário à operação de crédito consignado.</p>
        <Tab head={['Categoria', 'Exemplos', 'Finalidade']} rows={[
          ['Identificação', 'Nome, CPF, RG, órgão expedidor, nascimento, estado civil', 'Identificar o devedor e validar a operação'],
          ['Contato', 'E-mail, telefone', 'Formalização e comunicação'],
          ['Endereço', 'Logradouro, bairro, cidade, UF, CEP', 'Cadastro e conformidade'],
          ['Vínculo', 'Convênio, matrícula, órgão empregador', 'Averbação e elegibilidade de margem'],
          ['Financeiros', 'Valores, taxa, CET, IOF, prazo, parcela, vencimentos', 'Cálculo, conferência e registro'],
          ['Bancários (crédito)', 'Banco, agência, conta, tipo de conta', 'Liberação do crédito ao cliente'],
        ]} />
        <p><B>Base legal (LGPD):</B> execução de contrato e procedimentos preliminares (art. 7º, V) e cumprimento de obrigação legal/regulatória (art. 7º, II).</p>
      </Sec>

      <Sec n="04" id="s4" titulo="Armazenamento e proteção dos arquivos">
        <ul className="space-y-1.5 list-none pl-0">
          <Li><B>Bucket privado.</B> PDFs em repositório não público (<code className="text-xs">ccb-docs</code>); nenhum arquivo acessível sem autorização.</Li>
          <Li><B>Criptografia.</B> Em repouso (AES-256) e em trânsito (TLS/HTTPS).</Li>
          <Li><B>Link assinado temporário.</B> Visualização/download por URLs que expiram em 1 hora.</Li>
          <Li><B>Organização e medição.</B> Estrutura por empresa/ano/mês; tamanho medido para controle de armazenamento.</Li>
          <Li><B>Sem duplicidade.</B> Hash SHA-256 por empresa evita armazenar/cobrar o mesmo documento duas vezes.</Li>
          <Li><B>Espelho opcional.</B> Pasta própria no Google Drive via conta de serviço — sem a empresa expor credenciais.</Li>
        </ul>
      </Sec>

      <Sec n="05" id="s5" titulo="Isolamento, acesso e perfis">
        <p>Plataforma <B>multiempresa</B> com <B>Row Level Security (RLS)</B>: cada consulta é filtrada pela empresa do usuário — uma empresa não enxerga dados de outra, mesmo em erro de aplicação.</p>
        <Tab head={['Perfil', 'Pode', 'Não pode']} rows={[
          ['Operador', 'Operar módulos liberados da sua empresa', 'Enviar/aprovar CCB; ver outras empresas'],
          ['Administrador', 'Enviar, conferir e aprovar CCB; configurar a leitura', 'Acessar dados de outra empresa'],
          ['Superadministrador', 'Gestão da plataforma; visão "como empresa" (auditada)', 'Agir sem registro — acesso cruzado é logado'],
        ]} />
        <ul className="space-y-1.5 list-none pl-0">
          <Li><B>Menor privilégio.</B> Só administradores/superadministradores enviam e aprovam CCBs.</Li>
          <Li><B>Segregação de credenciais.</B> A chave da API de IA fica só nos secrets do backend — nunca no app/navegador/código.</Li>
        </ul>
      </Sec>

      <Sec n="06" id="s6" titulo="Processamento por IA e subprocessadores">
        <p>Extração via <B>API comercial da Anthropic (Claude)</B>. Conforme os termos comerciais da Anthropic, os dados enviados via API <B>não são usados para treinar</B> seus modelos, com retenção limitada às finalidades do provedor.</p>
        <Tab head={['Subprocessador', 'Função', 'Dados envolvidos']} rows={[
          ['Anthropic', 'Leitura/extração da CCB por IA', 'Conteúdo do PDF durante a leitura'],
          ['Supabase (sobre AWS)', 'Banco de dados, armazenamento e autenticação', 'PDFs e campos estruturados'],
          ['Base44', 'Hospedagem da aplicação e funções de backend', 'Tráfego da aplicação'],
          ['Google Drive', 'Espelho de arquivos opcional (quando ativado)', 'Cópia do PDF na pasta da empresa'],
        ]} />
        <p>Os provedores mantêm certificações de segurança de mercado (ex.: SOC 2), conforme a documentação pública de cada um.</p>
      </Sec>

      <Sec n="07" id="s7" titulo="Como mitigamos fraudes">
        <p>A defesa é em camadas: a IA acelera, mas <B>a decisão e a validação são humanas e verificadas</B>.</p>
        <Tab head={['Controle', 'Como funciona', 'Efeito']} rows={[
          ['Conferência humana obrigatória', 'Extração é sugestão; campos editáveis; gravação exige aprovação de admin.', <Sev t="Bloqueia" />],
          ['Recálculo de PMT', 'Parcela recalculada (Price) e comparada com a da CCB.', <Sev t="Sinaliza" />],
          ['Validação de CPF', 'Checagem dos dígitos verificadores.', <Sev t="Valida" />],
          ['Valor × proposta', 'Confronto com a proposta vinculada.', <Sev t="Sinaliza" />],
          ['Coerência de valores', 'Verifica valor total ≈ parcela × prazo.', <Sev t="Valida" />],
          ['Limite de confiança', 'Abaixo do percentual, entra em revisão obrigatória.', <Sev t="Bloqueia" />],
          ['Justificativa em divergência crítica', 'Aprovar apesar de divergência crítica exige justificativa registrada.', <Sev t="Bloqueia" />],
          ['Força executiva (Lei 10.931/04)', 'Checklist: denominação, promessa de pagamento, liquidez, devedor.', <Sev t="Sinaliza" />],
          ['Idempotência por hash', 'SHA-256 impede reprocessar/duplicar o mesmo documento.', <Sev t="Valida" />],
          ['Motor de travas', 'Bloqueia CCB sem averbação; travas de margem, idade e prazo.', <Sev t="Bloqueia" />],
        ]} />
      </Sec>

      <Sec n="08" id="s8" titulo="Rastreabilidade e auditoria">
        <ul className="space-y-1.5 list-none pl-0">
          <Li><B>Log de leituras.</B> Modelo, tokens, custo, confiança, duração e resultado por tentativa.</Li>
          <Li><B>Trilha de aprovações.</B> Usuário, data, ação e justificativa.</Li>
          <Li><B>Logs de acesso.</B> Eventos sensíveis (inclusive a visão "como empresa") registrados de forma somente-leitura.</Li>
          <Li><B>Documento íntegro.</B> CCB aprovada guarda o PDF original + todos os campos lidos.</Li>
        </ul>
      </Sec>

      <Sec n="09" id="s9" titulo="Privacidade e LGPD">
        <ul className="space-y-1.5 list-none pl-0">
          <Li><B>Finalidade e base legal.</B> Execução do contrato de crédito consignado e obrigações legais.</Li>
          <Li><B>Minimização e acesso restrito.</B> RLS por empresa; perfis autorizados; credenciais segregadas.</Li>
          <Li><B>Direitos do titular.</B> Módulo próprio para registrar e tratar solicitações LGPD.</Li>
          <Li><B>Transparência.</B> Este documento descreve fluxo, subprocessadores e controles aplicados.</Li>
        </ul>
      </Sec>

      <Sec n="10" id="s10" titulo="Retenção, descarte e portabilidade">
        <ul className="space-y-1.5 list-none pl-0">
          <Li><B>Retenção.</B> Mantidos pelo período necessário à operação e a obrigações legais/contratuais, conforme a política do cliente.</Li>
          <Li><B>Descarte controlado.</B> Ingestões com erro/pendentes podem ser excluídas com o arquivo; CCB aprovada é preservada.</Li>
          <Li><B>Portabilidade.</B> Campos lidos disponíveis em formato estruturado; PDF original baixável a qualquer momento.</Li>
        </ul>
      </Sec>

      <Sec n="11" id="s11" titulo="Resposta a incidentes e continuidade">
        <p>A plataforma provê os <B>elementos técnicos</B> para resposta a incidentes e continuidade:</p>
        <ul className="space-y-1.5 list-none pl-0">
          <Li><B>Detecção e evidência.</B> Trilhas de auditoria e logs de acesso reconstituem eventos.</Li>
          <Li><B>Contenção.</B> Isolamento por empresa (RLS), revogação de credenciais (inclusive a chave de IA) e desativação de acessos.</Li>
          <Li><B>Recuperação.</B> Dados em provedores gerenciados com redundância e backups de infraestrutura.</Li>
        </ul>
        <p>A operacionalização de um plano formal de resposta a incidentes e de comunicação a titulares/autoridade compete à instituição operadora, apoiada por estes recursos.</p>
      </Sec>

      <Sec n="12" id="s12" titulo="Governança operacional">
        <ul className="space-y-1.5 list-none pl-0">
          <Li><B>Cotas por pacote.</B> Tetos de leituras/mês, documentos e armazenamento; ao exceder, novas leituras são recusadas antes de qualquer custo.</Li>
          <Li><B>Exclusão protegida.</B> Ingestões com erro/pendentes podem ser removidas; CCB aprovada não pode ser excluída.</Li>
          <Li><B>Custo transparente.</B> Custo por leitura medido e exibido (em R$).</Li>
        </ul>
      </Sec>

      <Sec n="13" id="s13" titulo="Glossário">
        <dl className="space-y-0">
          {[
            ['CCB', 'Cédula de Crédito Bancário — título executivo da operação de crédito (Lei 10.931/2004).'],
            ['Ingestão', 'Ato de enviar um PDF de CCB para leitura e conferência.'],
            ['RLS', 'Row Level Security — regra no banco que filtra cada consulta pela empresa do usuário.'],
            ['Hash SHA-256', 'Impressão digital única do arquivo, usada para evitar duplicidade.'],
            ['PMT', 'Valor da parcela pela tabela Price, recalculado para conferência.'],
            ['Força executiva', 'Requisitos que tornam a CCB exigível judicialmente.'],
            ['Link assinado', 'URL temporária (1h) que autoriza o acesso a um arquivo privado.'],
            ['Subprocessador', 'Terceiro que trata dados em nome da operação (ex.: provedor de IA/nuvem).'],
          ].map(([t, d]) => (
            <div key={t} className="grid grid-cols-1 sm:grid-cols-[190px_1fr] gap-x-4 gap-y-0.5 py-2.5 border-t border-border first:border-t-0">
              <dt className="font-semibold text-foreground text-sm">{t}</dt>
              <dd className="text-sm text-muted-foreground">{d}</dd>
            </div>
          ))}
        </dl>
      </Sec>

      <Sec n="14" id="s14" titulo="Limitações e responsabilidades">
        <p>A leitura por IA é <B>ferramenta de apoio à decisão</B> e não garante acurácia de 100% — por isso a <B>conferência humana é obrigatória</B> no fluxo. Até a aprovação, os campos extraídos são <B>sugestão</B>. A decisão de crédito, a validação dos dados e a responsabilidade final permanecem com o operador e a instituição, conforme suas políticas e a regulação aplicável.</p>
      </Sec>

      <footer className="border-t border-border pt-4 text-[11px] text-muted-foreground">
        <div className="bg-muted/40 border border-border rounded-lg p-3 mb-3">
          <b className="text-foreground">Aviso.</b> Documento descritivo dos controles vigentes do módulo de Ingestão &amp; Leitura de CCB da CONSIGTEC, para fins comerciais e de conformidade. Referências a políticas/certificações de terceiros seguem a documentação pública de cada provedor e podem mudar. Não constitui aconselhamento jurídico.
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2 font-mono">
          <span className="flex items-center gap-1.5"><img src="/brand/consigtec_logo_icon.png" alt="" className="w-4 h-4 rounded" /> CONSIGTEC — Segurança &amp; Compliance</span>
          <span>v2.0 · 16/07/2026</span>
        </div>
      </footer>
    </div>
  );
}
