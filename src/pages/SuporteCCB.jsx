import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck, ScanLine, Cpu, Lock, FileCheck2, HelpCircle, LifeBuoy,
  Wrench, Coins, Database, ChevronRight, FolderLock, ListChecks,
} from 'lucide-react';

function Secao({ id, icon: Icon, titulo, children }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
        <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function Passo({ n, titulo, children }) {
  return (
    <div className="flex gap-3">
      <span className="w-6 h-6 rounded-md bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
      <div><p className="font-medium text-foreground">{titulo}</p><p className="text-xs text-muted-foreground">{children}</p></div>
    </div>
  );
}

function Faq({ q, children }) {
  return (
    <details className="group border border-border rounded-lg bg-card">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-foreground">
        {q}<ChevronRight className="w-4 h-4 text-muted-foreground group-open:rotate-90 transition-transform" />
      </summary>
      <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </details>
  );
}

function Problema({ sintoma, causa, solucao }) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card">
      <p className="text-sm font-medium text-foreground flex items-center gap-2"><Wrench className="w-3.5 h-3.5 text-amber-500" /> {sintoma}</p>
      <p className="text-xs text-muted-foreground mt-1"><b className="text-foreground/80">Por quê:</b> {causa}</p>
      <p className="text-xs text-muted-foreground mt-0.5"><b className="text-foreground/80">O que fazer:</b> {solucao}</p>
    </div>
  );
}

const NAV = [
  ['como-funciona', 'Como funciona'],
  ['seguranca', 'Segurança & dados'],
  ['antifraude', 'Antifraude'],
  ['custos', 'Custos & cotas'],
  ['faq', 'Perguntas frequentes'],
  ['problemas', 'Solução de problemas'],
  ['contato', 'Contato'],
];

export default function SuporteCCB() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      {/* Cabeçalho com a marca */}
      <header className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-6">
        <div className="flex items-center gap-3 mb-3">
          <img src="/brand/consigtec_logo_icon.png" alt="CONSIGTEC" className="w-10 h-10 rounded-lg" />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5"><LifeBuoy className="w-3.5 h-3.5" /> Central de suporte</p>
            <h1 className="text-xl font-bold text-foreground leading-tight">Leitura automática de CCB</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Tudo sobre como o sistema lê, valida e armazena suas CCBs — do envio do PDF à aprovação,
          com os controles de segurança e antifraude que sustentam a operação.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Link to="/seguranca"><Button size="sm" className="gap-2"><ShieldCheck className="w-4 h-4" /> Segurança &amp; Compliance</Button></Link>
          <Link to="/area/formalizacao?tab=ingestao"><Button size="sm" variant="outline" className="gap-2"><ScanLine className="w-4 h-4" /> Ir para Ingestão de CCB</Button></Link>
        </div>
      </header>

      {/* Navegação rápida */}
      <nav className="flex flex-wrap gap-1.5">
        {NAV.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">{label}</a>
        ))}
      </nav>

      <Secao id="como-funciona" icon={ScanLine} titulo="Como funciona a leitura">
        <div className="grid sm:grid-cols-2 gap-3 mt-1">
          <Passo n="1" titulo="Envie o PDF">Em Formalização → Ingestão de CCB, clique em “Enviar CCB (PDF)”. Cada arquivo é identificado por uma impressão digital (hash) que impede duplicidade.</Passo>
          <Passo n="2" titulo="A IA lê o documento">O PDF é lido por inteligência artificial (Claude), que extrai ~45 campos e informa um índice de confiança. A tela mostra o progresso e atualiza sozinha.</Passo>
          <Passo n="3" titulo="Validação automática">O sistema recalcula a parcela (tabela Price), valida o CPF, compara com a proposta e checa a coerência dos valores, sinalizando divergências.</Passo>
          <Passo n="4" titulo="Você confere e aprova">Todos os campos são editáveis, ao lado do PDF. Divergência crítica só é aprovada com justificativa. Nada é gravado sem sua aprovação.</Passo>
        </div>
        <p className="mt-3 text-xs bg-primary/5 border border-primary/20 rounded-lg p-3 text-foreground">
          <b>Princípio:</b> a extração é uma <b>sugestão</b>. A gravação no sistema sempre exige conferência humana.
        </p>
      </Secao>

      <Secao id="seguranca" icon={Lock} titulo="Segurança e proteção dos dados">
        <ul className="space-y-1.5">
          <li className="flex gap-2"><FolderLock className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span><b className="text-foreground/90">Armazenamento privado:</b> os PDFs ficam em repositório <b>não público</b>, criptografado em repouso (AES-256) e em trânsito (TLS), organizado por empresa/ano/mês.</span></li>
          <li className="flex gap-2"><Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span><b className="text-foreground/90">Acesso por link temporário:</b> a visualização/download usa links assinados que <b>expiram em 1 hora</b>.</span></li>
          <li className="flex gap-2"><Database className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span><b className="text-foreground/90">Isolamento por empresa:</b> regras no banco (RLS) garantem que uma empresa nunca acesse dados de outra.</span></li>
          <li className="flex gap-2"><Cpu className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span><b className="text-foreground/90">IA sem uso indevido:</b> conforme os termos comerciais da Anthropic, os dados enviados <b>não treinam</b> os modelos. A chave de IA fica só no backend.</span></li>
          <li className="flex gap-2"><FileCheck2 className="w-4 h-4 text-primary shrink-0 mt-0.5" /><span><b className="text-foreground/90">LGPD:</b> tratamento para execução do contrato, acesso mínimo, direitos do titular e descarte controlado.</span></li>
        </ul>
        <Link to="/seguranca" className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-1 hover:underline">Ver o documento técnico completo</Link>
      </Secao>

      <Secao id="antifraude" icon={ShieldCheck} titulo="Como mitigamos fraudes">
        <p>A defesa é em camadas — a IA acelera, mas a validação e a decisão são humanas e verificadas:</p>
        <div className="grid sm:grid-cols-2 gap-2 mt-1">
          {[
            ['Conferência humana obrigatória', 'Nada é gravado sem aprovação de um administrador.'],
            ['Recálculo de parcela (PMT)', 'A parcela é recalculada e comparada com a da CCB.'],
            ['Validação de CPF', 'Checagem dos dígitos verificadores.'],
            ['Valor × proposta', 'Confronto com a proposta vinculada.'],
            ['Limite de confiança', 'Abaixo do percentual, entra em revisão obrigatória.'],
            ['Força executiva (Lei 10.931)', 'Checklist de executividade da CCB.'],
            ['Idempotência (hash)', 'Impede reprocessar/duplicar o mesmo documento.'],
            ['Motor de travas', 'Bloqueia CCB sem averbação; travas de margem/idade/prazo.'],
          ].map(([t, d]) => (
            <div key={t} className="flex gap-2 border border-border rounded-lg p-2.5 bg-card">
              <ListChecks className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div><p className="text-xs font-medium text-foreground">{t}</p><p className="text-[11px] text-muted-foreground">{d}</p></div>
            </div>
          ))}
        </div>
      </Secao>

      <Secao id="custos" icon={Coins} titulo="Custos e cotas do plano">
        <ul className="space-y-1.5">
          <li>• <b className="text-foreground/90">Custo por leitura</b> é medido e exibido em R$ (Ajustes da leitura → Uso do plano). Uma CCB longa custa da ordem de <b>R$ 0,25</b> (Haiku) a <b>R$ 0,85</b> (Sonnet).</li>
          <li>• <b className="text-foreground/90">Cotas do pacote:</b> cada plano define tetos de leituras/mês, documentos e armazenamento. Ao exceder, novas leituras são recusadas com aviso — sem gerar custo.</li>
          <li>• <b className="text-foreground/90">Modelo configurável:</b> escolha entre Haiku (mais barato), Sonnet (equilibrado) e Opus (máxima precisão) em Ajustes da leitura.</li>
        </ul>
      </Secao>

      <Secao id="faq" icon={HelpCircle} titulo="Perguntas frequentes">
        <div className="space-y-2">
          <Faq q="A IA aprova a CCB sozinha?">Não. A extração é apenas uma sugestão. A CCB só é registrada após um administrador conferir os campos e aprovar. Divergência crítica exige justificativa.</Faq>
          <Faq q="Onde ficam os arquivos das CCBs?">Em armazenamento privado e criptografado (bucket não público), organizado por empresa/ano/mês. O acesso é feito por links temporários (1h). Opcionalmente, a empresa pode espelhar numa pasta própria do Google Drive.</Faq>
          <Faq q="Meus dados são usados para treinar a IA?">Não. Conforme os termos comerciais da Anthropic, os dados enviados via API não são usados para treinar os modelos.</Faq>
          <Faq q="Posso reprocessar uma leitura com outro modelo?">Sim. No log de tentativas (Ajustes) ou na conferência, use “Reprocessar” para reler o mesmo PDF com um modelo mais forte (ex.: Opus).</Faq>
          <Faq q="Posso excluir uma ingestão?">Sim, ingestões com erro ou pendentes podem ser excluídas (removendo também o PDF). CCB já aprovada não pode ser excluída, para proteger o dado de negócio.</Faq>
          <Faq q="Como sei quanto estou gastando?">Em Ajustes da leitura → “Uso do plano” você vê leituras do mês, documentos, armazenamento, o consumo de IA e o custo médio por leitura, tudo em R$.</Faq>
        </div>
      </Secao>

      <Secao id="problemas" icon={Wrench} titulo="Solução de problemas">
        <div className="grid sm:grid-cols-2 gap-2">
          <Problema sintoma="A CCB fica em “Extraindo”" causa="PDFs longos/escaneados levam de 10 a 40 segundos." solucao="Aguarde — a tela atualiza sozinha. Se demorar demais, use “Tentar novamente”." />
          <Problema sintoma="“Cota do plano excedida”" causa="O limite de leituras/documentos/armazenamento do pacote foi atingido." solucao="Fale com o administrador para ajustar o plano ou aguarde a virada do mês." />
          <Problema sintoma="Campos vieram vazios" causa="A tela abriu enquanto a IA ainda lia, ou a leitura falhou." solucao="Aguarde a conclusão; em caso de erro, clique em “Tentar novamente”." />
          <Problema sintoma="Divergência crítica ao aprovar" causa="Um valor extraído diverge do recalculado/da proposta." solucao="Confira o campo destacado, corrija se preciso e informe a justificativa para aprovar." />
          <Problema sintoma="Prévia do PDF não abre" causa="O link assinado pode ter expirado (1h)." solucao="Reabra a ingestão para gerar um novo link." />
          <Problema sintoma="Erro “ANTHROPIC_API_KEY não configurada”" causa="A chave de IA não está definida no backend." solucao="Ação do administrador: configurar o secret no painel. Abra um chamado se persistir." />
        </div>
      </Secao>

      <Secao id="contato" icon={LifeBuoy} titulo="Precisa de ajuda?">
        <p>Não encontrou a resposta? Você pode:</p>
        <div className="grid sm:grid-cols-2 gap-2 mt-1">
          <Link to="/area/suporte" className="border border-border rounded-lg p-3 bg-card hover:border-primary/40 transition-colors">
            <p className="text-sm font-medium text-foreground flex items-center gap-2"><LifeBuoy className="w-4 h-4 text-primary" /> Abrir um chamado</p>
            <p className="text-xs text-muted-foreground mt-0.5">Registre um chamado de suporte pelo sistema e acompanhe a resposta.</p>
          </Link>
          <div className="border border-border rounded-lg p-3 bg-card">
            <p className="text-sm font-medium text-foreground flex items-center gap-2"><HelpCircle className="w-4 h-4 text-primary" /> Administrador da empresa</p>
            <p className="text-xs text-muted-foreground mt-0.5">Questões de plano, cota e configuração são resolvidas pelo administrador da sua empresa.</p>
          </div>
        </div>
      </Secao>

      <footer className="pt-4 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between flex-wrap gap-2">
        <span className="flex items-center gap-1.5"><img src="/brand/consigtec_logo_icon.png" alt="" className="w-4 h-4 rounded" /> CONSIGTEC — Central de Suporte</span>
        <span>A leitura por IA é ferramenta de apoio; a decisão final é humana.</span>
      </footer>
    </div>
  );
}
