import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { decretosApi } from '@/lib/api/decretos';
import { conveniosApi } from '@/lib/api/convenios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useExtracaoWatcher } from '@/lib/useExtracaoWatcher';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { EmptyState, StatusBadge } from '@/components/kit';
import PdfUpload from '@/components/PdfUpload';
import TagList from '@/components/TagList';
import ConvenioPicker from '@/components/ConvenioPicker';
import { Loader2, FileText, CheckCircle2, XCircle, AlertTriangle, ChevronRight, ScanLine, RefreshCw, Trash2, LifeBuoy, Gavel, PlusCircle, Check } from 'lucide-react';

const ST = { recebido: 'Recebido', extraindo: 'Extraindo', aguardando_conferencia: 'Conferência', aprovado: 'Aplicado', rejeitado: 'Rejeitado', erro: 'Erro' };
const ST_COR = { recebido: 'bg-muted text-muted-foreground', extraindo: 'bg-blue-50 text-blue-700', aguardando_conferencia: 'bg-amber-50 text-amber-700', aprovado: 'bg-green-50 text-green-700', rejeitado: 'bg-muted text-muted-foreground', erro: 'bg-red-50 text-red-700' };
const FILTROS = [['todos', 'Todos'], ['aguardando_conferencia', 'Conferência'], ['extraindo', 'Extraindo'], ['erro', 'Erro'], ['aprovado', 'Aplicado'], ['rejeitado', 'Rejeitado']];

// Seções de campos escalares. `sis` traz o valor equivalente no convênio selecionado.
const SECOES = [
  { titulo: 'Identificação da norma', campos: [
    { k: 'decreto_numero', label: 'Nº do decreto/lei', cmp: true, conv: (c) => c?.decreto_numero },
    { k: 'decreto_data', label: 'Data (AAAA-MM-DD)', cmp: true, conv: (c) => c?.decreto_data },
    { k: 'ente_nome', label: 'Ente / município' },
    { k: 'uf', label: 'UF' },
    { k: 'esfera', label: 'Esfera' },
    { k: 'lei_base', label: 'Lei base', cmp: true, conv: (c) => c?.lei_base },
    { k: 'vigencia', label: 'Vigência' },
    { k: 'revogacoes', label: 'Revogações' },
  ] },
  { titulo: 'Regras de margem e prazo', campos: [
    { k: 'margem_total_pct', label: 'Margem total (%)', cmp: true, num: true, conv: (c) => c?.margem_total_pct },
    { k: 'margem_cartao_pct', label: 'Margem cartão (%)', cmp: true, num: true, conv: (c) => c?.margem_cartao_pct ?? c?.margem_por_produto?.cartao },
    { k: 'prazo_maximo_meses', label: 'Prazo máx. (meses)', cmp: true, num: true, conv: (c) => c?.teto_parcelas ?? c?.prazo_maximo },
    { k: 'limite_adiantamento_pct', label: 'Adiantamento (%)', cmp: true, num: true, conv: (c) => c?.limite_adiantamento_pct },
    { k: 'recomposicao_margem_horas', label: 'Recompor margem (h)', cmp: true, num: true, conv: (c) => c?.recomposicao_margem_horas },
    { k: 'reposicao_erario', label: 'Reposição ao erário', cmp: true, conv: (c) => c?.reposicao_erario },
    { k: 'prioridade_desconto', label: 'Prioridade (nº)', cmp: true, num: true, conv: (c) => c?.prioridade_desconto },
    { k: 'prioridade_desconto_descricao', label: 'Prioridade (descrição)' },
  ] },
];
// Campos de lista (array) — editados como uma linha por item.
const LISTAS = [
  { k: 'tipos_consignacao_permitidos', label: 'Tipos de consignação permitidos' },
  { k: 'consignatarias_habilitadas', label: 'Consignatárias habilitadas' },
];

const fileToB64 = (file, onProgress) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onprogress = (e) => { if (onProgress && e.lengthComputable) onProgress(Math.min(99, Math.round((e.loaded / e.total) * 100))); };
  r.onload = () => { onProgress?.(100); res(String(r.result)); };
  r.onerror = rej;
  r.readAsDataURL(file);
});
const linhasToArr = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
const vazio = (v) => v == null || String(v).trim() === '';
const normStr = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const asNum = (v) => { if (vazio(v)) return null; const n = Number(String(v).replace(/[%\s]/g, '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : null; };

// Status da comparação de UM campo: extraído × cadastrado no convênio.
function statusCampo(ext, reg, num) {
  if (vazio(ext)) return 'sem_dado';
  if (vazio(reg)) return 'preenche';
  if (num) { const a = asNum(ext), b = asNum(reg); if (a != null && b != null) return a === b ? 'confere' : 'divergente'; }
  return normStr(ext) === normStr(reg) ? 'confere' : 'divergente';
}
const CMP_META = {
  sem_dado: { label: '—', cls: 'text-muted-foreground bg-muted' },
  preenche: { label: 'preenche', cls: 'text-blue-700 bg-blue-50 border border-blue-200' },
  confere: { label: 'confere', cls: 'text-green-700 bg-green-50 border border-green-200' },
  divergente: { label: 'DIVERGENTE', cls: 'text-red-700 bg-red-50 border border-red-300 font-semibold' },
};

export default function IngestaoDecreto() {
  const [lista, setLista] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [readPct, setReadPct] = useState(0);
  const [nomeArq, setNomeArq] = useState('');
  const pollRef = useRef(null);

  const [sel, setSel] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [dados, setDados] = useState({});
  const [convenioId, setConvenioId] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [busy, setBusy] = useState(false);
  const [reprocessando, setReprocessando] = useState(false);
  const [demorou, setDemorou] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const [filtroStatus, setFiltroStatus] = useState('todos');
  const load = async () => { setLoading(true); setLista(await decretosApi.list(filtroStatus).catch(() => [])); setLoading(false); };
  useEffect(() => { load(); }, [filtroStatus]);
  useEffect(() => { conveniosApi.list().then(setConvenios).catch(() => setConvenios([])); }, []);
  useEffect(() => () => clearInterval(pollRef.current), []);

  // Observador global de extrações em segundo plano: avisa quando cada leitura
  // conclui — mesmo com o painel fechado, após enviar vários ou recarregar a página.
  const { observar, observarVarios, pendentesCount } = useExtracaoWatcher({
    getFn: (id) => decretosApi.get(id),
    onConcluido: (full) => {
      load();
      toast.success(`Leitura concluída — ${full.arquivo_nome}`, {
        description: 'Decreto pronto para conferência.',
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

  const convSel = useMemo(() => convenios.find((c) => c.id === convenioId) || null, [convenios, convenioId]);
  const convTemDecreto = !!(convSel && (convSel.decreto_numero || convSel.regras_origem === 'decreto'));

  // Comparação campo-a-campo (extraído × cadastrado) contra o convênio selecionado.
  const comparacao = useMemo(() => {
    const alvo = convSel || convenioId === '__novo__';
    const campos = SECOES.flatMap((s) => s.campos).filter((c) => c.cmp);
    return campos.map((c) => {
      const ext = dados[c.k];
      const reg = convSel ? c.conv(convSel) : null;
      return { k: c.k, label: c.label, ext, reg, status: alvo ? statusCampo(ext, reg, c.num) : 'sem_dado' };
    });
  }, [dados, convSel, convenioId]);
  const cmpMap = useMemo(() => Object.fromEntries(comparacao.map((c) => [c.k, c])), [comparacao]);
  const resumo = useMemo(() => {
    const r = { preenche: 0, confere: 0, divergente: 0 };
    comparacao.forEach((c) => { if (r[c.status] != null) r[c.status] += 1; });
    return r;
  }, [comparacao]);
  const temDivergencia = resumo.divergente > 0;

  const excluirIng = async (r) => {
    if (!window.confirm(`Excluir o decreto "${r.arquivo_nome}"? O PDF será removido do armazenamento. Esta ação não pode ser desfeita.`)) return;
    try {
      await decretosApi.excluir(r.id);
      toast.success('Ingestão excluída.');
      if (sel?.id === r.id) { clearInterval(pollRef.current); setSel(null); }
      load();
    } catch (e) { toast.error(e.message || 'Falha ao excluir.'); }
  };

  useEffect(() => {
    if (sel?.status !== 'extraindo') { setProgresso(0); return; }
    const start = Date.now();
    const id = setInterval(() => {
      const el = Date.now() - start;
      setProgresso(Math.min(96, 100 * (1 - Math.exp(-el / 18000))));
    }, 400);
    return () => clearInterval(id);
  }, [sel?.status, sel?.id]);

  const aplicarSel = async (full) => {
    setSel(full);
    setDados({ ...(full.dados_extraidos || {}) });
    setConvenioId(full.convenio_id || full.convenio?.id || '');
    setPdfUrl(await decretosApi.pdfUrl(full.storage_path));
  };

  const pollExtracao = (id) => {
    clearInterval(pollRef.current);
    setDemorou(false);
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries += 1;
      try {
        const full = await decretosApi.get(id);
        if (full.status !== 'extraindo' || tries > 40) {
          clearInterval(pollRef.current);
          await aplicarSel(full);
          load();
          if (tries > 40 && full.status === 'extraindo') { setDemorou(true); toast.warning('A leitura está demorando mais que o esperado.'); }
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
      const r = await decretosApi.ingerir(b64, file.name, setUploadPct);
      await auditoriaApi.log('ingerir_decreto', 'ingestoes_documento', r.id, { arquivo: file.name, status: r.status, duplicado: !!r.duplicado });
      if (r.duplicado) {
        await load();
        await abrir({ id: r.id });
        toast.info('Arquivo já ingerido — abrindo a ingestão existente.');
      } else {
        // Fase 2: dispara a extração em segundo plano (keepalive) e acompanha por polling.
        await decretosApi.processar(r.id);
        observar(r.id);
        await load();
        await abrir({ id: r.id });
        toast.success('Documento recebido — a leitura roda em segundo plano. Você pode fechar esta página.');
      }
    } catch (err) {
      toast.error(err.message || 'Falha ao enviar.');
    } finally {
      setEnviando(false);
    }
  };

  const abrir = async (row) => {
    try {
      setJustificativa(''); setDemorou(false);
      const full = await decretosApi.get(row.id);
      await aplicarSel(full);
      if (full.status === 'extraindo') pollExtracao(row.id);
    } catch (err) { toast.error(err.message); }
  };

  const reprocessarSel = async () => {
    if (!sel) return;
    setReprocessando(true);
    try {
      setSel((s) => (s ? { ...s, status: 'extraindo' } : s));
      const r = await decretosApi.reprocessar(sel.id);
      await auditoriaApi.log('reprocessar_decreto', 'ingestoes_documento', sel.id, { origem: 'ingestao' });
      await abrir({ id: sel.id });
      if (r.status === 'erro') toast.error(`Falhou de novo: ${r.error || ''}`);
      else toast.success('Decreto relido.');
      load();
    } catch (err) { toast.error(err.message || 'Falha ao reprocessar.'); }
    finally { setReprocessando(false); }
  };

  const confDiv = (sel?.divergencias || []).find((d) => d.campo === 'confianca' && d.tipo === 'critica');
  const lendo = sel?.status === 'extraindo';
  const emErro = sel?.status === 'erro';
  const precisaJustificar = temDivergencia || !!confDiv;

  const aplicar = async () => {
    if (!convenioId) { toast.error('Selecione ou crie o convênio que receberá as regras.'); return; }
    if (precisaJustificar && !justificativa.trim()) { toast.error('Há divergência — justificativa é obrigatória para aplicar.'); return; }
    setBusy(true);
    try {
      const payload = { ...dados };
      LISTAS.forEach((l) => { if (typeof payload[l.k] === 'string') payload[l.k] = linhasToArr(payload[l.k]); });
      let convId = convenioId;
      if (convId === '__novo__') {
        const nome = (dados.ente_nome || '').trim() || `Convênio ${(dados.decreto_numero || '').trim()}`.trim();
        const nova = await conveniosApi.create({ nome, orgao: dados.ente_nome || null });
        convId = nova.id;
        await auditoriaApi.log('criar_convenio_por_decreto', 'convenios', convId, { nome, ingestao: sel.id });
      }
      const r = await decretosApi.aprovar({ ingestao_id: sel.id, acao: 'aplicar', convenio_id: convId, dados: payload, justificativa });
      await auditoriaApi.log('aplicar_regras_decreto', 'convenios', r.convenio_id, { ingestao: sel.id, divergencias: resumo.divergente });
      toast.success(convenioId === '__novo__' ? 'Convênio criado e regras aplicadas.' : convTemDecreto ? 'Regras validadas e atualizadas no convênio.' : 'Regras aplicadas ao convênio.');
      setSel(null); load();
    } catch (err) { toast.error(err.message || 'Falha ao aplicar.'); }
    finally { setBusy(false); }
  };
  const rejeitar = async () => {
    setBusy(true);
    try {
      await decretosApi.aprovar({ ingestao_id: sel.id, acao: 'rejeitar', dados: {}, justificativa });
      await auditoriaApi.log('rejeitar_decreto', 'ingestoes_documento', sel.id, { justificativa });
      toast.success('Ingestão rejeitada.'); setSel(null); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const setCampo = (k, v) => setDados((d) => ({ ...d, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Gavel className="w-4 h-4 text-primary" /> Ingestão & Leitura de Decretos (regras do convênio)</p>
          <p className="text-[11px] text-muted-foreground">A extração é uma <b>sugestão</b> — as regras só entram no convênio após conferência e aprovação humana. <Link to="/suporte" className="text-primary hover:underline inline-flex items-center gap-0.5"><LifeBuoy className="w-3 h-3" /> Ajuda &amp; segurança</Link></p>
        </div>
        {pendentesCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200" title="Documentos sendo lidos pela IA em segundo plano">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {pendentesCount} em leitura…
          </span>
        )}
      </div>

      {/* Upload: dropzone (ocioso) ou progresso em fases (enviando) */}
      <PdfUpload onFile={enviar} busy={enviando} readPct={readPct} uploadPct={uploadPct} tipo="decreto" fileName={nomeArq} />

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTROS.map(([k, label]) => (
          <button key={k} onClick={() => setFiltroStatus(k)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filtroStatus === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? <EmptyState title="Carregando…" />
        : lista.length === 0 ? <EmptyState icon={FileText} title="Nenhum decreto ingerido" description="Envie o PDF do decreto/lei de um convênio para leitura automática das regras." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Arquivo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Decreto / ente</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Convênio</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Divergências</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {lista.map((r) => {
                const crit = (r.divergencias || []).filter((d) => d.tipo === 'critica').length;
                const av = (r.divergencias || []).filter((d) => d.tipo === 'aviso').length;
                const rLendo = r.status === 'extraindo';
                return (
                  <tr key={r.id} className={`border-b border-border hover:bg-muted/50 ${sel?.id === r.id ? 'bg-primary/5' : ''}`}>
                    <td className="px-4 py-3 font-medium text-foreground truncate max-w-[200px]" title={r.arquivo_nome}>{r.arquivo_nome}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{r.dados_extraidos?.decreto_numero || '—'}{r.dados_extraidos?.ente_nome ? ` · ${r.dados_extraidos.ente_nome}` : ''}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.convenio?.nome || '—'}</td>
                    <td className="px-4 py-3">
                      {rLendo ? <span className="text-xs text-muted-foreground">—</span>
                        : crit > 0 ? <span className="inline-flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> {crit} crítica(s)</span>
                        : av > 0 ? <span className="text-xs text-amber-600">{av} aviso(s)</span>
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border overflow-hidden bg-muted/30 min-h-[420px]">
              {pdfUrl ? <iframe title="Decreto" src={pdfUrl} className="w-full h-[560px]" />
                : <div className="h-[420px] flex items-center justify-center text-xs text-muted-foreground">Prévia do PDF indisponível.</div>}
            </div>

            {lendo ? (
              <div className="rounded-lg border border-primary/25 bg-primary/5 flex flex-col items-center justify-center text-center p-8 gap-4 min-h-[420px]">
                <ScanLine className="w-10 h-10 text-primary animate-pulse" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">Lendo o decreto com inteligência artificial…</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">A IA está extraindo as regras de consignação. Esta tela <b className="text-foreground">atualiza sozinha</b> quando terminar.</p>
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
                <p className="text-sm font-semibold text-foreground">Não foi possível ler este decreto</p>
                <p className="text-xs text-red-600 dark:text-red-400 max-w-sm break-words">{sel.observacao || 'Falha na extração.'}</p>
                <Button onClick={reprocessarSel} disabled={reprocessando} className="gap-2 mt-1">
                  {reprocessando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Tentar novamente
                </Button>
              </div>
            ) : (
              <div className="space-y-3 lg:max-h-[560px] lg:overflow-y-auto pr-1">
                <div className="rounded-lg border border-border bg-muted/30 p-2.5 space-y-2 sticky top-0 z-10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-foreground">Convênio:</span>
                    <ConvenioPicker convenios={convenios} value={convenioId} onChange={setConvenioId} createHint={dados.ente_nome || ''} placeholder="— buscar / selecionar convênio —" />
                  </div>
                  {sel.convenio?.nome && !convenioId && <p className="text-[11px] text-amber-600">sugerido pela IA: {sel.convenio.nome}</p>}
                  {convenioId && (
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      <span className={`px-1.5 py-0.5 rounded ${convenioId === '__novo__' ? 'bg-green-50 text-green-700 border border-green-200' : convTemDecreto ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                        {convenioId === '__novo__' ? <><PlusCircle className="w-3 h-3 inline -mt-0.5" /> novo convênio será criado — preenchendo</> : convTemDecreto ? <><Check className="w-3 h-3 inline -mt-0.5" /> convênio já tem decreto — validando</> : <><PlusCircle className="w-3 h-3 inline -mt-0.5" /> convênio sem decreto — preenchendo</>}
                      </span>
                      <span className="text-blue-700">{resumo.preenche} preenche</span>
                      <span className="text-green-700">{resumo.confere} confere</span>
                      <span className={resumo.divergente ? 'text-red-700 font-semibold' : 'text-muted-foreground'}>{resumo.divergente} divergente</span>
                    </div>
                  )}
                  {temDivergencia && <p className="text-[11px] text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Há valores que <b>conflitam</b> com o cadastro do convênio. Corrija o campo ou justifique a atualização.</p>}
                </div>

                <div className="grid grid-cols-[1fr_1.1fr_1fr] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground px-1">
                  <span>Regra</span><span>Extraído (editável)</span><span>No convênio</span>
                </div>
                {SECOES.map((sec) => (
                  <div key={sec.titulo} className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80 border-b border-border pb-0.5">{sec.titulo}</p>
                    {sec.campos.map((c) => {
                      const cm = c.cmp ? cmpMap[c.k] : null;
                      const meta = cm ? CMP_META[cm.status] : null;
                      const borda = cm?.status === 'divergente' ? 'border-red-400' : 'border-border';
                      return (
                        <div key={c.k} className="grid grid-cols-[1fr_1.1fr_1fr] gap-2 items-center">
                          <span className="text-xs text-muted-foreground">{c.label}</span>
                          <Input value={dados[c.k] ?? ''} onChange={(e) => setCampo(c.k, e.target.value)} className={`h-8 text-sm ${borda}`} />
                          <div className="flex items-center gap-1 min-w-0">
                            <span className={`text-xs truncate ${cm?.status === 'divergente' ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                              {cm ? (vazio(cm.reg) ? (convenioId === '__novo__' ? '(novo)' : convenioId ? '(vazio)' : '—') : String(cm.reg)) : '—'}
                            </span>
                            {meta && cm.status !== 'sem_dado' && <span className={`text-[9px] px-1 py-0.5 rounded shrink-0 ${meta.cls}`}>{meta.label}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80 border-b border-border pb-0.5">Listas (itens separados)</p>
                  {LISTAS.map((l) => (
                    <div key={l.k} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{l.label}</Label>
                      <TagList items={dados[l.k]} onChange={(arr) => setCampo(l.k, arr)} placeholder="Adicionar item e Enter…" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {!lendo && !emErro && (
            <div className="border-t border-border pt-3 space-y-3">
              {precisaJustificar && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-red-600">Justificativa (obrigatória — {temDivergencia ? 'há divergência com o cadastro' : 'confiança abaixo do limite'})</Label>
                  <Textarea rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Explique por que a atualização é válida apesar da divergência…" />
                </div>
              )}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button onClick={reprocessarSel} disabled={reprocessando} className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
                  {reprocessando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Reprocessar
                </button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={rejeitar} disabled={busy} className="gap-2"><XCircle className="w-4 h-4" /> Rejeitar</Button>
                  <Button onClick={aplicar} disabled={busy || sel.status === 'aprovado' || !convenioId} className="gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {convTemDecreto ? 'Validar e atualizar' : 'Aplicar ao convênio'}</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
