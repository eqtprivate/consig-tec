import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ingestaoApi } from '@/lib/api/ingestao';
import { ccbTemplatesApi } from '@/lib/api/ccbTemplates';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useExtracaoWatcher } from '@/lib/useExtracaoWatcher';
import { brl } from '@/lib/format';
import { displayMask, storeMask, isoToBR } from '@/lib/masks';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { EmptyState, StatusBadge } from '@/components/kit';
import PdfUpload from '@/components/PdfUpload';
import { Loader2, FileText, CheckCircle2, XCircle, AlertTriangle, ChevronRight, ScanLine, RefreshCw, Trash2, LifeBuoy } from 'lucide-react';

const ST = { recebido: 'Recebido', extraindo: 'Extraindo', aguardando_conferencia: 'Conferência', aprovado: 'Aprovado', rejeitado: 'Rejeitado', erro: 'Erro' };
const ST_COR = { recebido: 'bg-muted text-muted-foreground', extraindo: 'bg-blue-50 text-blue-700', aguardando_conferencia: 'bg-amber-50 text-amber-700', aprovado: 'bg-green-50 text-green-700', rejeitado: 'bg-muted text-muted-foreground', erro: 'bg-red-50 text-red-700' };
const ACAO = { completar_venda: 'Completar venda', novo_registro: 'Novo registro', duplicata: 'Duplicata' };
const FILTROS = [['todos', 'Todos'], ['aguardando_conferencia', 'Conferência'], ['extraindo', 'Extraindo'], ['erro', 'Erro'], ['aprovado', 'Aprovado'], ['rejeitado', 'Rejeitado']];

// Conferência agrupada por seção. `moeda` formata o valor do sistema em R$;
// `sis` traz o valor equivalente já no sistema (para comparar/destacar divergência).
const SECOES = [
  { titulo: 'Identificação da CCB', campos: [
    { k: 'numero_ccb', label: 'Nº da CCB' },
    { k: 'data_emissao', label: 'Emissão' },
    { k: 'modalidade', label: 'Modalidade' },
    { k: 'praca_pagamento', label: 'Praça de pagamento' },
  ] },
  { titulo: 'Devedor (emitente)', campos: [
    { k: 'nome_cliente', label: 'Nome', sis: (p) => p?.cliente?.nome },
    { k: 'cpf', label: 'CPF', sis: (p) => p?.cliente?.cpf },
    { k: 'rg', label: 'RG' },
    { k: 'orgao_expedidor', label: 'Órgão exp./UF' },
    { k: 'data_nascimento', label: 'Nascimento' },
    { k: 'estado_civil', label: 'Estado civil' },
    { k: 'nacionalidade', label: 'Nacionalidade' },
    { k: 'naturalidade', label: 'Naturalidade' },
    { k: 'profissao', label: 'Profissão' },
    { k: 'email', label: 'E-mail' },
    { k: 'telefone', label: 'Telefone' },
  ] },
  { titulo: 'Endereço', campos: [
    { k: 'endereco', label: 'Logradouro' },
    { k: 'numero_endereco', label: 'Número' },
    { k: 'complemento', label: 'Complemento' },
    { k: 'bairro', label: 'Bairro' },
    { k: 'cidade', label: 'Cidade' },
    { k: 'uf', label: 'UF' },
    { k: 'cep', label: 'CEP' },
  ] },
  { titulo: 'Convênio / empregador', campos: [
    { k: 'convenio', label: 'Convênio' },
    { k: 'matricula', label: 'Matrícula' },
    { k: 'orgao_empregador', label: 'Órgão/empregador' },
  ] },
  { titulo: 'Credor / correspondente', campos: [
    { k: 'credor_nome', label: 'Credor' },
    { k: 'credor_cnpj', label: 'CNPJ credor' },
    { k: 'correspondente_nome', label: 'Correspondente' },
    { k: 'correspondente_cnpj', label: 'CNPJ corresp.' },
  ] },
  { titulo: 'Condições financeiras', campos: [
    { k: 'valor_principal', label: 'Valor principal', moeda: true, sis: (p) => p?.valor_solicitado },
    { k: 'valor_liberado', label: 'Valor liberado', moeda: true },
    { k: 'valor_total', label: 'Valor total', moeda: true },
    { k: 'taxa_mensal', label: 'Taxa a.m. (%)', sis: (p) => p?.taxa_mensal },
    { k: 'taxa_anual', label: 'Taxa a.a. (%)' },
    { k: 'cet_mensal', label: 'CET a.m. (%)' },
    { k: 'cet_anual', label: 'CET a.a. (%)' },
    { k: 'iof', label: 'IOF', moeda: true },
    { k: 'tarifa_cadastro', label: 'Tarifa cadastro', moeda: true },
    { k: 'prazo', label: 'Prazo', sis: (p) => p?.prazo },
    { k: 'valor_parcela', label: 'Parcela (PMT)', moeda: true, sis: (p) => p?.valor_parcela },
    { k: 'primeiro_vencimento', label: '1º vencimento' },
    { k: 'ultimo_vencimento', label: 'Último vencimento' },
  ] },
  { titulo: 'Crédito ao cliente (banco)', campos: [
    { k: 'banco_credito', label: 'Banco' },
    { k: 'agencia_credito', label: 'Agência' },
    { k: 'conta_credito', label: 'Conta' },
    { k: 'tipo_conta', label: 'Tipo de conta' },
  ] },
  { titulo: 'Endosso / Cessão (repasse do pagamento)', campos: [
    { k: 'endosso_beneficiario', label: 'Beneficiário do repasse' },
    { k: 'endosso_cnpj', label: 'CNPJ do beneficiário' },
    { k: 'endosso_tipo', label: 'Tipo de endosso' },
  ] },
];

const fileToB64 = (file, onProgress) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onprogress = (e) => { if (onProgress && e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
  r.onload = () => { onProgress?.(100); res(String(r.result)); };
  r.onerror = rej;
  r.readAsDataURL(file);
});

export default function IngestaoCCB() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [readPct, setReadPct] = useState(0);
  const [nomeArq, setNomeArq] = useState('');
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState('');
  const pollRef = useRef(null);

  const [sel, setSel] = useState(null);       // ingestão em conferência (completa)
  const [pdfUrl, setPdfUrl] = useState(null);
  const [dados, setDados] = useState({});
  const [acao, setAcao] = useState('novo_registro');
  const [justificativa, setJustificativa] = useState('');
  const [busy, setBusy] = useState(false);
  const [reprocessando, setReprocessando] = useState(false);
  const [demorou, setDemorou] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const [filtroStatus, setFiltroStatus] = useState('todos');
  const load = async () => { setLoading(true); setLista(await ingestaoApi.list(filtroStatus).catch(() => [])); setLoading(false); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filtroStatus]);
  useEffect(() => () => clearInterval(pollRef.current), []);
  useEffect(() => { ccbTemplatesApi.listAtivos().then((t) => { setTemplates(t); setTemplateId((id) => id || (t[0]?.id ?? '')); }).catch(() => {}); }, []);

  // Observador global de extrações em segundo plano: avisa quando cada leitura
  // conclui — mesmo com o painel fechado, após enviar vários ou recarregar a página.
  const { observarVarios, pendentesCount } = useExtracaoWatcher({
    getFn: (id) => ingestaoApi.get(id),
    onConcluido: (full) => {
      load();
      toast.success(`Leitura concluída — ${full.arquivo_nome}`, {
        description: 'CCB pronta para conferência.',
        action: { label: 'Abrir', onClick: () => abrir({ id: full.id }) },
      });
    },
    onErro: (full) => {
      load();
      toast.error(`Falha na leitura — ${full.arquivo_nome}`, { description: full.observacao || 'Tente novamente.' });
    },
  });

  // Semeia o observador com o que já estiver 'extraindo' na lista (ex.: page reload).
  useEffect(() => {
    observarVarios(lista.filter((r) => r.status === 'extraindo').map((r) => r.id));
  }, [lista, observarVarios]);

  const excluirIng = async (r) => {
    if (!window.confirm(`Excluir a ingestão "${r.arquivo_nome}"? O PDF será removido do armazenamento. Esta ação não pode ser desfeita.`)) return;
    try {
      await ingestaoApi.excluir(r.id);
      toast.success('Ingestão excluída.');
      if (sel?.id === r.id) { clearInterval(pollRef.current); setSel(null); }
      load();
    } catch (e) { toast.error(e.message || 'Falha ao excluir.'); }
  };

  // Barra de progresso estimada enquanto a IA lê (a API não devolve progresso real):
  // avança rápido no início e desacelera, saturando em ~96% até concluir.
  useEffect(() => {
    if (sel?.status !== 'extraindo') { setProgresso(0); return; }
    const start = Date.now();
    const id = setInterval(() => {
      const el = Date.now() - start;
      setProgresso(Math.min(96, 100 * (1 - Math.exp(-el / 18000))));
    }, 400);
    return () => clearInterval(id);
  }, [sel?.status, sel?.id]);

  // Carrega a ingestão completa na conferência.
  const aplicarSel = async (full) => {
    setSel(full);
    setDados({ ...(full.dados_extraidos || {}) });
    setAcao(full.acao_sugerida === 'duplicata' ? 'duplicata' : (full.acao_sugerida || 'novo_registro'));
    setPdfUrl(await ingestaoApi.pdfUrl(full.storage_path));
  };

  // Enquanto o status for 'extraindo', consulta a cada 3s até concluir (~2min máx).
  const pollExtracao = (id) => {
    clearInterval(pollRef.current);
    setDemorou(false);
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries += 1;
      try {
        const full = await ingestaoApi.get(id);
        if (full.status !== 'extraindo' || tries > 40) {
          clearInterval(pollRef.current);
          await aplicarSel(full);
          load();
          if (tries > 40 && full.status === 'extraindo') { setDemorou(true); toast.warning('A leitura está demorando mais que o esperado. Você pode tentar novamente.'); }
        } else {
          setSel((s) => (s && s.id === id ? { ...s, status: 'extraindo' } : s));
        }
      } catch { /* mantém o polling */ }
    }, 3000);
  };

  const enviar = async (file) => {
    if (!file) return;
    setEnviando(true); setReadPct(0); setUploadPct(0); setNomeArq(file.name);
    try {
      const b64 = await fileToB64(file, setReadPct);
      const tpl = templates.find((t) => t.id === templateId);
      const r = await ingestaoApi.ingerir(b64, file.name, setUploadPct, { paginas: tpl?.paginas, template_id: templateId || undefined });
      await auditoriaApi.log('ingerir_ccb', 'ingestoes_documento', r.id, { arquivo: file.name, status: r.status, duplicado: !!r.duplicado });
      await load();
      await abrir({ id: r.id });
      if (r.duplicado) toast.info('Arquivo já ingerido — abrindo a ingestão existente.');
      else if (r.status === 'erro') toast.error(`Extração falhou: ${r.error || ''}`);
      else if (r.status === 'aguardando_conferencia') toast.success('CCB lida — pronta para conferência.');
    } catch (err) {
      toast.error(err.message || 'Falha ao enviar.');
    } finally {
      setEnviando(false);
    }
  };

  const abrir = async (row) => {
    try {
      setJustificativa(''); setDemorou(false);
      const full = await ingestaoApi.get(row.id);
      await aplicarSel(full);
      if (full.status === 'extraindo') pollExtracao(row.id);   // ainda lendo → acompanha
    } catch (err) { toast.error(err.message); }
  };

  // Tenta novamente a leitura (mesmo PDF), útil quando ficou em erro ou travou.
  const reprocessarSel = async () => {
    if (!sel) return;
    setReprocessando(true);
    try {
      setSel((s) => (s ? { ...s, status: 'extraindo' } : s));
      const r = await ingestaoApi.reprocessar(sel.id);
      await auditoriaApi.log('reprocessar_ccb', 'ingestoes_documento', sel.id, { origem: 'ingestao' });
      await abrir({ id: sel.id });
      if (r.status === 'erro') toast.error(`Falhou de novo: ${r.error || ''}`);
      else toast.success('CCB relida.');
      load();
    } catch (err) { toast.error(err.message || 'Falha ao reprocessar.'); }
    finally { setReprocessando(false); }
  };

  const divMap = useMemo(() => { const m = {}; (sel?.divergencias || []).forEach((d) => { m[d.campo] = d; }); return m; }, [sel]);
  const temCritica = (sel?.divergencias || []).some((d) => d.tipo === 'critica');
  const lendo = sel?.status === 'extraindo';
  const emErro = sel?.status === 'erro';

  const aprovar = async () => {
    if (temCritica && !justificativa.trim()) { toast.error('Divergência crítica — justificativa é obrigatória.'); return; }
    setBusy(true);
    try {
      const r = await ingestaoApi.aprovar({ ingestao_id: sel.id, acao, dados, justificativa });
      await auditoriaApi.log('aprovar_ingestao_ccb', 'ingestoes_documento', sel.id, { acao, ccb_id: r.ccb_id });
      toast.success(acao === 'completar_venda' || acao === 'novo_registro' ? 'CCB criada com sucesso.' : 'Ingestão finalizada.');
      setSel(null); load();
    } catch (err) { toast.error(err.message || 'Falha ao aprovar.'); }
    finally { setBusy(false); }
  };
  const rejeitar = async () => {
    setBusy(true);
    try {
      await ingestaoApi.aprovar({ ingestao_id: sel.id, acao: 'rejeitar', dados, justificativa });
      await auditoriaApi.log('rejeitar_ingestao_ccb', 'ingestoes_documento', sel.id, { justificativa });
      toast.success('Ingestão rejeitada.'); setSel(null); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const setCampo = (k, v) => setDados((d) => ({ ...d, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-2"><ScanLine className="w-4 h-4 text-primary" /> Ingestão & Leitura Automática de CCB</p>
          <p className="text-[11px] text-muted-foreground">A extração é uma <b>sugestão</b> — nada é gravado sem conferência e aprovação humana. <Link to="/suporte" className="text-primary hover:underline inline-flex items-center gap-0.5"><LifeBuoy className="w-3 h-3" /> Ajuda &amp; segurança</Link></p>
        </div>
        {pendentesCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200" title="Documentos sendo lidos pela IA em segundo plano">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {pendentesCount} em leitura…
          </span>
        )}
      </div>

      {/* Padrão da CCB: define quais páginas do PDF a IA vai ler */}
      <div className="flex items-center gap-2 flex-wrap bg-card rounded-lg border border-border px-3 py-2">
        <span className="text-xs font-medium text-foreground">Padrão da CCB:</span>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="h-8 text-sm rounded-md border border-border bg-card px-2 min-w-[200px]">
          {templates.length === 0 && <option value="">(nenhum padrão — usando o default)</option>}
          {templates.map((t) => <option key={t.id} value={t.id}>{t.nome}{Array.isArray(t.paginas) && t.paginas.length ? ` · págs. ${t.paginas.join(', ')}` : ''}</option>)}
        </select>
        <span className="text-[11px] text-muted-foreground">a leitura usa só as páginas deste padrão</span>
      </div>

      {/* Upload: dropzone (ocioso) ou progresso em fases (enviando) */}
      <PdfUpload onFile={enviar} busy={enviando} readPct={readPct} uploadPct={uploadPct} tipo="CCB" fileName={nomeArq} />

      {/* Filtro por status */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTROS.map(([k, label]) => (
          <button key={k} onClick={() => setFiltroStatus(k)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filtroStatus === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Lista de ingestões */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? <EmptyState title="Carregando…" />
        : lista.length === 0 ? <EmptyState icon={FileText} title="Nenhuma CCB ingerida" description="Envie um PDF de CCB para leitura automática." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Arquivo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Nº CCB / CPF</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Sugestão</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Divergências</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {lista.map((r) => {
                const crit = (r.divergencias || []).filter((d) => d.tipo === 'critica').length;
                const av = (r.divergencias || []).filter((d) => d.tipo === 'aviso').length;
                const msgs = (r.divergencias || []).map((d) => `• ${d.mensagem}`).join('\n');
                const rLendo = r.status === 'extraindo';
                return (
                  <tr key={r.id} className={`border-b border-border hover:bg-muted/50 ${sel?.id === r.id ? 'bg-primary/5' : ''}`}>
                    <td className="px-4 py-3 font-medium text-foreground truncate max-w-[200px]" title={r.arquivo_nome}>{r.arquivo_nome}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{r.dados_extraidos?.numero_ccb || '—'}{r.dados_extraidos?.cpf ? ` · ${r.dados_extraidos.cpf}` : ''}</td>
                    <td className="px-4 py-3">{r.acao_sugerida ? <StatusBadge className="bg-muted text-muted-foreground">{ACAO[r.acao_sugerida]}</StatusBadge> : '—'}</td>
                    <td className="px-4 py-3">
                      {rLendo ? <span className="text-xs text-muted-foreground">—</span>
                        : crit > 0 ? <span title={msgs} className="inline-flex items-center gap-1 text-xs text-red-600 cursor-help underline decoration-dotted underline-offset-2"><AlertTriangle className="w-3.5 h-3.5" /> {crit} crítica(s)</span>
                        : av > 0 ? <span title={msgs} className="text-xs text-amber-600 cursor-help underline decoration-dotted underline-offset-2">{av} aviso(s)</span>
                        : <span className="text-xs text-green-700">ok</span>}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge className={ST_COR[r.status]}>
                        <span className="inline-flex items-center gap-1">{rLendo && <Loader2 className="w-3 h-3 animate-spin" />}{ST[r.status]}</span>
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {r.status !== 'aprovado' && <button onClick={() => excluirIng(r)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-muted rounded inline-flex" title="Excluir ingestão"><Trash2 className="w-4 h-4" /></button>}
                      <button onClick={() => abrir(r)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded inline-flex" title="Abrir"><ChevronRight className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Conferência: PDF × campos */}
      {sel && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              {lendo && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              Conferência — {sel.arquivo_nome}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Confiança: {sel.confianca != null ? `${Math.round(sel.confianca * 100)}%` : '—'}</span>
              {sel.modelo_usado && <span className="text-[11px] text-muted-foreground">· {sel.modelo_usado}</span>}
              <button onClick={() => { clearInterval(pollRef.current); setSel(null); }} className="text-xs text-muted-foreground hover:text-foreground">fechar</button>
            </div>
          </div>

          {sel.acao_sugerida === 'duplicata' && !lendo && !emErro && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Nº de CCB já existe no sistema — provável <b>duplicata</b>. Confirme para descartar ou escolha outra ação.
            </div>
          )}

          {(sel.divergencias || []).length > 0 && !lendo && !emErro && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 p-2.5 space-y-1">
              <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Conferências da leitura</p>
              <ul className="space-y-0.5">
                {(sel.divergencias || []).map((d, i) => (
                  <li key={i} className={`text-[11px] flex items-start gap-1.5 ${d.tipo === 'critica' ? 'text-red-600' : 'text-amber-700 dark:text-amber-400'}`}>
                    <span className="mt-1 w-1 h-1 rounded-full bg-current shrink-0" /> {d.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* PDF */}
            <div className="rounded-lg border border-border overflow-hidden bg-muted/30 min-h-[420px]">
              {pdfUrl ? <iframe title="CCB" src={pdfUrl} className="w-full h-[520px]" />
                : <div className="h-[420px] flex items-center justify-center text-xs text-muted-foreground">Prévia do PDF indisponível.</div>}
            </div>

            {/* Coluna direita: leitura / erro / campos */}
            {lendo ? (
              <div className="rounded-lg border border-primary/25 bg-primary/5 flex flex-col items-center justify-center text-center p-8 gap-4 min-h-[420px]">
                <ScanLine className="w-10 h-10 text-primary animate-pulse" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Lendo o PDF com inteligência artificial…</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">A IA está extraindo os dados da CCB. PDFs com muitas páginas levam de 10 a 40 segundos. Esta tela <b className="text-foreground">atualiza sozinha</b> quando terminar.</p>
                </div>
                <div className="w-full max-w-xs space-y-1.5">
                  <Progress value={progresso} className="h-2" />
                  <p className="text-[11px] font-medium text-muted-foreground">{Math.round(progresso)}%</p>
                </div>
                {demorou && (
                  <Button onClick={reprocessarSel} disabled={reprocessando} variant="outline" className="gap-2">
                    {reprocessando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Está demorando — tentar novamente
                  </Button>
                )}
              </div>
            ) : emErro ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 flex flex-col items-center justify-center text-center p-8 gap-3 min-h-[420px]">
                <AlertTriangle className="w-9 h-9 text-red-500" />
                <p className="text-sm font-semibold text-foreground">Não foi possível ler esta CCB</p>
                <p className="text-xs text-red-600 dark:text-red-400 max-w-sm break-words">{sel.observacao || 'Falha na extração.'}</p>
                <Button onClick={reprocessarSel} disabled={reprocessando} className="gap-2 mt-1">
                  {reprocessando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Tentar novamente
                </Button>
              </div>
            ) : (
              <div className="space-y-3 lg:max-h-[520px] lg:overflow-y-auto pr-1">
                <div className="grid grid-cols-[1fr_1.2fr_1fr] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground px-1 sticky top-0 bg-card pb-1 z-10">
                  <span>Campo</span><span>Extraído (editável)</span><span>No sistema</span>
                </div>
                {SECOES.map((sec) => (
                  <div key={sec.titulo} className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80 border-b border-border pb-0.5">{sec.titulo}</p>
                    {sec.campos.map((c) => {
                      const dv = divMap[c.k];
                      const sistema = c.sis ? c.sis(sel.proposta) : null;
                      const borda = dv ? (dv.tipo === 'critica' ? 'border-red-400' : 'border-amber-400') : 'border-border';
                      return (
                        <div key={c.k}>
                          <div className="grid grid-cols-[1fr_1.2fr_1fr] gap-2 items-center">
                            <span className="text-xs text-muted-foreground">{c.label}</span>
                            <Input value={dados[c.k] ?? ''} onChange={(e) => setCampo(c.k, e.target.value)} className={`h-8 text-sm ${borda}`} />
                            <span className={`text-xs ${dv?.tipo === 'critica' ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                              {sistema != null && sistema !== '' ? (c.moeda ? brl(sistema) : sistema) : (acao === 'completar_venda' ? '—' : '(novo)')}
                            </span>
                          </div>
                          {dv && <p className={`text-[11px] mt-0.5 ${dv.tipo === 'critica' ? 'text-red-600' : 'text-amber-600'}`}>{dv.mensagem}</p>}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {Array.isArray(dados.cronograma) && dados.cronograma.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80 border-b border-border pb-0.5">Cronograma de parcelas ({dados.cronograma.length})</p>
                    <div className="max-h-52 overflow-y-auto rounded border border-border">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted/70"><tr>
                          <th className="text-left px-2 py-1 font-medium text-muted-foreground">Parc.</th>
                          <th className="text-left px-2 py-1 font-medium text-muted-foreground">Vencimento</th>
                          <th className="text-right px-2 py-1 font-medium text-muted-foreground">Valor</th>
                        </tr></thead>
                        <tbody>
                          {dados.cronograma.map((p, i) => (
                            <tr key={i} className="border-t border-border">
                              <td className="px-2 py-1">{p?.parcela ?? '—'}</td>
                              <td className="px-2 py-1">{p?.vencimento || '—'}</td>
                              <td className="px-2 py-1 text-right">{p?.valor != null ? brl(p.valor) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ação + aprovação (só quando há dados para conferir) */}
          {!lendo && !emErro && (
            <div className="border-t border-border pt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-xs font-medium text-foreground">Ação:</span>
                {sel.acao_sugerida === 'duplicata' && (
                  <label className="flex items-center gap-1.5 text-sm"><input type="radio" name="acao" checked={acao === 'duplicata'} onChange={() => setAcao('duplicata')} /> Duplicata (descartar)</label>
                )}
                <label className="flex items-center gap-1.5 text-sm"><input type="radio" name="acao" checked={acao === 'completar_venda'} onChange={() => setAcao('completar_venda')} disabled={!sel.proposta_id} /> Completar venda {sel.proposta?.numero ? `(${sel.proposta.numero})` : sel.proposta_id ? '' : '(sem proposta)'}</label>
                <label className="flex items-center gap-1.5 text-sm"><input type="radio" name="acao" checked={acao === 'novo_registro'} onChange={() => setAcao('novo_registro')} /> Novo registro</label>
                <button onClick={reprocessarSel} disabled={reprocessando} className="ml-auto text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                  {reprocessando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Reprocessar
                </button>
              </div>
              {temCritica && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-red-600">Justificativa (obrigatória — há divergência crítica)</Label>
                  <Textarea rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Explique por que a aprovação é válida apesar da divergência…" />
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={rejeitar} disabled={busy} className="gap-2"><XCircle className="w-4 h-4" /> Rejeitar</Button>
                <Button onClick={aprovar} disabled={busy || sel.status === 'aprovado'} className="gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {acao === 'duplicata' ? 'Confirmar duplicata' : 'Aprovar'}</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
