import React, { useEffect, useRef, useState } from 'react';
import { integracoesApi } from '@/lib/api/expansao';
import { pixconsigApi } from '@/lib/api/pixconsig';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { toast } from 'sonner';
import { dataBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { PageHeader, Panel, StatusBadge, EmptyState } from '@/components/kit';
import { Pencil, Plus, Plug, RefreshCw, Clock, CheckCircle2, AlertTriangle, Save } from 'lucide-react';

const dataHoraBR = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const h2 = (h) => String(h).padStart(2, '0') + ':00';
// horas BRT dentro da janela, de `intervalo` em `intervalo` (espelha o cálculo do backend)
const horariosBRT = (ini, fim, intervalo) => {
  const out = [];
  if (intervalo >= 1 && fim >= ini) for (let h = ini; h <= fim; h += intervalo) out.push(h);
  return out;
};
const INTERVALOS = [1, 2, 3, 4, 6, 8, 12, 24];
const EVENTO_INFO = {
  nova_prefeitura: { label: 'Novas prefeituras', dot: 'bg-blue-500' },
  mudanca_status: { label: 'Mudanças de status', dot: 'bg-amber-500' },
  ativada: { label: 'Convênios ativados', dot: 'bg-green-500' },
  decreto_enviado: { label: 'Decretos enviados', dot: 'bg-indigo-500' },
  mudanca_capag: { label: 'CAPAG alterada', dot: 'bg-violet-500' },
};

function SyncPixconsig() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [status, setStatus] = useState(null);
  const [novidades, setNovidades] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  // rascunho do editor de janela
  const [cfg, setCfg] = useState({ intervalo_horas: 4, hora_inicio: 9, hora_fim: 17, ativo: true });
  const [savingCfg, setSavingCfg] = useState(false);
  // progresso ao vivo (polling enquanto rodando)
  const [prog, setProg] = useState(null);
  const pollRef = useRef(null);

  const pararPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  const iniciarPoll = () => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const p = await pixconsigApi.progresso();
        setProg(p);
        if (!p?.rodando) { pararPoll(); carregarStatus(); }
      } catch { /* ignora blip */ }
    }, 1500);
  };
  useEffect(() => () => pararPoll(), []);

  const carregarStatus = async () => {
    setLoadingStatus(true);
    try {
      const s = await pixconsigApi.status();
      setStatus(s);
      if (s?.config) setCfg({
        intervalo_horas: s.config.intervalo_horas ?? 4,
        hora_inicio: s.config.hora_inicio ?? 9,
        hora_fim: s.config.hora_fim ?? 17,
        ativo: s.config.ativo ?? true,
      });
    } catch (err) { /* silencioso: painel apenas informativo */ }
    try { setNovidades(await pixconsigApi.novidades(60)); } catch { /* opcional */ }
    finally { setLoadingStatus(false); }
  };
  useEffect(() => {
    carregarStatus();
    // se um sync (ex.: cron) já estiver rodando, engata a barra ao vivo
    (async () => {
      try { const p = await pixconsigApi.progresso(); setProg(p); if (p?.rodando) iniciarPoll(); } catch { /* ignora */ }
    })();
  }, []);

  const sincronizar = async () => {
    setBusy(true); setRes(null); setProg(null);
    iniciarPoll();
    try {
      const r = await pixconsigApi.sync();
      await auditoriaApi.log('sync_pixconsig_manual', 'convenios', null, { ok: r.ok, total: r.total, ignorados: r.ignorados, erros: r.erros?.length || 0 });
      setRes(r);
      if (r.configurado === false) toast.warning('API PixConsig ainda não configurada (base URL / api key).');
      else toast.success(`Sync concluído: ${r.ok}/${r.total} convênios (${r.paginas} página(s)).`);
      carregarStatus();
    } catch (err) { toast.error(err.message || 'Falha na sincronização.'); setRes({ erro: err.message }); }
    finally { setBusy(false); pararPoll(); try { setProg(await pixconsigApi.progresso()); } catch { /* ignora */ } }
  };

  const salvarConfig = async () => {
    if (cfg.hora_fim < cfg.hora_inicio) { toast.error('A hora final deve ser maior ou igual à inicial.'); return; }
    setSavingCfg(true);
    try {
      await pixconsigApi.configurar(cfg);
      await auditoriaApi.log('configurar_sync_pixconsig', 'configuracoes', null, cfg);
      toast.success('Janela de sincronização atualizada.');
      carregarStatus();
    } catch (err) { toast.error(err.message || 'Falha ao salvar a janela.'); }
    finally { setSavingCfg(false); }
  };

  const previewBRT = horariosBRT(cfg.hora_inicio, cfg.hora_fim, cfg.intervalo_horas);
  const cronAtivo = status?.cron?.active;
  // Percentual = taxa de sucesso (ok/total) da última execução COM dados.
  // Preferimos a rodada manual recém-terminada; senão a última execução válida
  // no histórico. Rodadas com configurado:false / total nulo não contam.
  const resValido = res && !res.erro && res.configurado !== false && Number(res.total) > 0;
  const execValida = (status?.execucoes || []).find((e) => Number(e.total) > 0);
  const ult = resValido ? { ok: Number(res.ok), total: Number(res.total) } : execValida || null;
  const pct = ult && ult.total > 0 ? Math.round((ult.ok / ult.total) * 100) : null;
  // Progresso ao vivo: quando há um sync rodando (manual ou cron) com total conhecido.
  const rodando = busy || prog?.rodando;
  const liveTotal = Number(prog?.total || 0);
  const liveProc = Number(prog?.processados || 0);
  const livePct = rodando && liveTotal > 0 ? Math.min(100, Math.round((liveProc / liveTotal) * 100)) : null;

  return (
    <Panel bodyClassName="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Convênios PixConsig (espelho)</p>
          <p className="text-[11px] text-muted-foreground">Cadastro e margem vêm da PixConsig; taxa/spread/comissão são do CONSIGTEC.</p>
        </div>
        <div className="flex items-center gap-2">
          {!loadingStatus && (
            <Badge variant={cronAtivo ? 'default' : 'secondary'} className="gap-1">
              <Clock className="w-3 h-3" /> {cronAtivo ? 'Automático ativo' : 'Automático pausado'}
            </Badge>
          )}
          <Button variant="outline" onClick={sincronizar} disabled={busy} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> {busy ? 'Sincronizando…' : 'Sincronizar agora'}
          </Button>
        </div>
      </div>

      {/* Barra de status / percentual */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-muted-foreground">
            {rodando && livePct != null ? 'Sincronizando com a PixConsig…'
              : rodando ? 'Sincronizando com a PixConsig…'
              : pct != null ? 'Taxa de sucesso da última sincronização'
              : 'Aguardando primeira sincronização com dados'}
          </span>
          {rodando && livePct != null ? (
            <span className="font-semibold text-foreground">{liveProc.toLocaleString('pt-BR')}/{liveTotal.toLocaleString('pt-BR')}{prog?.pagina ? ` · pág. ${prog.pagina}` : ''} · <span className="text-primary">{livePct}%</span></span>
          ) : pct != null && !rodando && (
            <span className="font-semibold text-foreground">{ult.ok}/{ult.total} convênios · <span className="text-primary">{pct}%</span></span>
          )}
        </div>
        <Progress
          value={rodando ? (livePct != null ? livePct : 100) : (pct ?? 0)}
          className={rodando && livePct == null ? 'animate-pulse' : ''}
        />
        {!rodando && pct == null && (
          <p className="text-[11px] text-muted-foreground mt-1">
            Nenhuma sincronização retornou dados ainda — configure os secrets do backend e clique em “Sincronizar agora”.
          </p>
        )}
      </div>

      {/* Cartões de resumo do espelho */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg bg-muted border border-border p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Convênios (PixConsig)</p>
          <p className="text-lg font-bold text-foreground">{status?.espelho?.convenios ?? '—'}</p>
        </div>
        <div className="rounded-lg bg-muted border border-border p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Convênios (total)</p>
          <p className="text-lg font-bold text-foreground">{status?.espelho?.convenios_total ?? '—'}</p>
        </div>
        <div className="rounded-lg bg-muted border border-border p-2.5 col-span-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Última sincronização</p>
          <p className="text-sm font-semibold text-foreground">{dataHoraBR(status?.espelho?.ultima_sync)}</p>
        </div>
      </div>

      {/* Reconciliação de volume (espelho x total informado pela API) */}
      {(() => {
        const rec = status?.reconciliacao;
        if (!rec || rec.total_api == null) {
          return (
            <div className="rounded-lg border border-border p-3 text-[11px] text-muted-foreground">
              Reconciliação de volume disponível após uma sincronização com o backend v1.19.0+ (a API passa a informar o total).
            </div>
          );
        }
        const esp = Number(rec.espelho || 0);
        const api = Number(rec.total_api || 0);
        const cobre = esp >= api && api > 0;
        const recPct = api > 0 ? Math.min(100, Math.round((esp / api) * 100)) : 0;
        const amostra = Array.isArray(rec.erros_amostra) ? rec.erros_amostra : [];
        return (
          <div className={`rounded-lg border p-3 space-y-2 ${cobre ? 'border-green-200 bg-green-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                {cobre ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                Reconciliação de volume
              </p>
              <span className={`text-[11px] font-semibold ${cobre ? 'text-green-700' : 'text-amber-700'}`}>
                {cobre ? 'Espelho completo' : 'Faltam páginas'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-foreground whitespace-nowrap">{esp.toLocaleString('pt-BR')} / {api.toLocaleString('pt-BR')}</span>
              <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                <div className={`h-full rounded ${cobre ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${recPct}%` }} />
              </div>
              <span className="text-[11px] text-muted-foreground whitespace-nowrap">{recPct}%</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Espelho (PixConsig) vs total informado pela API · {rec.paginas ?? '—'} página(s){rec.erros ? ` · ${rec.erros} erro(s)` : ''} · {dataHoraBR(rec.quando)}
            </p>
            {amostra.length > 0 && (
              <ul className="text-[11px] text-red-600 list-disc list-inside max-h-24 overflow-y-auto">
                {amostra.map((e, i) => <li key={i} className="break-words">{e}</li>)}
              </ul>
            )}
          </div>
        );
      })()}

      {res && !res.erro && res.configurado !== false && (
        <div className="rounded-lg bg-muted border border-border p-3 text-sm text-foreground">
          <b>{res.ok}</b> de <b>{res.total}</b> sincronizados{res.total_api != null ? ` (API informa ${res.total_api} no total)` : ''} · {res.ignorados} ignorado(s) · {res.paginas} página(s){res.erros?.length ? ` · ${res.erros.length} erro(s)` : ''}
          {res.diag && (
            <details className="mt-2 text-[11px] text-muted-foreground">
              <summary className="cursor-pointer">Diagnóstico de paginação (1ª página)</summary>
              <pre className="mt-1 bg-muted rounded p-2 overflow-x-auto">{JSON.stringify(res.diag, null, 2)}</pre>
            </details>
          )}
          {res.erros?.length > 0 && (
            <ul className="mt-2 text-xs text-red-600 list-disc list-inside max-h-40 overflow-y-auto space-y-0.5">
              {res.erros.map((e, i) => <li key={i} className="break-words">{e}</li>)}
            </ul>
          )}
        </div>
      )}
      {res?.configurado === false && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          Configure os secrets <code>PIXCONSIG_BASE_URL</code> e <code>PIXCONSIG_API_KEY</code> no backend para habilitar.
        </div>
      )}

      {/* Editor da janela de sincronização */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Janela de sincronização automática</p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{cfg.ativo ? 'Ativa' : 'Pausada'}</span>
            <Switch checked={cfg.ativo} onCheckedChange={(v) => setCfg({ ...cfg, ativo: v })} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">A cada</Label>
            <Select value={String(cfg.intervalo_horas)} onValueChange={(v) => setCfg({ ...cfg, intervalo_horas: Number(v) })} disabled={!cfg.ativo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INTERVALOS.map((h) => <SelectItem key={h} value={String(h)}>{h === 24 ? '24 horas (1x/dia)' : `${h} em ${h} horas`}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Das (BRT)</Label>
            <Select value={String(cfg.hora_inicio)} onValueChange={(v) => setCfg({ ...cfg, hora_inicio: Number(v) })} disabled={!cfg.ativo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 24 }, (_, h) => <SelectItem key={h} value={String(h)}>{h2(h)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Até (BRT)</Label>
            <Select value={String(cfg.hora_fim)} onValueChange={(v) => setCfg({ ...cfg, hora_fim: Number(v) })} disabled={!cfg.ativo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 24 }, (_, h) => <SelectItem key={h} value={String(h)}>{h2(h)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[11px] text-muted-foreground">
            {cfg.ativo
              ? <>Rodará às <b className="text-foreground">{previewBRT.map(h2).join(' · ') || '—'}</b> (horário de Brasília){previewBRT.length ? ` · ${previewBRT.length}x/dia` : ''}</>
              : 'Sincronização automática pausada — apenas manual.'}
          </p>
          <Button size="sm" onClick={salvarConfig} disabled={savingCfg} className="gap-1.5"><Save className="w-3.5 h-3.5" /> {savingCfg ? 'Salvando…' : 'Salvar janela'}</Button>
        </div>
      </div>

      {/* Janela de avisos / novidades da sincronização */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-blue-500" /> Novidades da sincronização</p>
          <span className="text-[10px] text-muted-foreground">últimas 24h</span>
        </div>
        {(() => {
          const resumo = novidades?.resumo_24h || {};
          const chaves = Object.keys(resumo).filter((k) => resumo[k] > 0);
          const itens = Array.isArray(novidades?.itens) ? novidades.itens : [];
          if (chaves.length === 0 && itens.length === 0) {
            return <p className="text-[11px] text-muted-foreground">Sem novidades registradas ainda. A cada sincronização, novas prefeituras, mudanças de status, decretos e CAPAG aparecem aqui.</p>;
          }
          return (
            <>
              {chaves.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {chaves.map((k) => (
                    <span key={k} className="inline-flex items-center gap-1.5 text-[11px] bg-muted border border-border rounded-full px-2.5 py-1">
                      <span className={`w-2 h-2 rounded-full ${EVENTO_INFO[k]?.dot || 'bg-muted-foreground'}`} />
                      <b className="text-foreground">{resumo[k]}</b> <span className="text-muted-foreground">{EVENTO_INFO[k]?.label || k}</span>
                    </span>
                  ))}
                </div>
              )}
              {itens.length > 0 && (
                <div className="max-h-52 overflow-y-auto divide-y divide-border">
                  {itens.map((n, i) => (
                    <div key={i} className="flex items-start gap-2 py-1.5">
                      <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${EVENTO_INFO[n.evento]?.dot || 'bg-muted-foreground'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-foreground break-words">{n.mensagem}</p>
                        <p className="text-[10px] text-muted-foreground">{dataHoraBR(n.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Últimas execuções */}
      {status?.execucoes?.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs font-semibold text-foreground mb-2">Últimas execuções</p>
          <div className="space-y-1">
            {status.execucoes.map((e, i) => {
              const temErro = (e.erros || 0) > 0;
              return (
                <div key={i} className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border last:border-0 py-1">
                  <span className="flex items-center gap-1.5">
                    {temErro ? <AlertTriangle className="w-3 h-3 text-amber-500" /> : <CheckCircle2 className="w-3 h-3 text-green-500" />}
                    {dataHoraBR(e.created_at)}
                    <span className="text-muted-foreground">· {e.acao === 'sync_pixconsig_manual' ? 'manual' : 'automático'}</span>
                  </span>
                  <span className="text-muted-foreground">{e.ok ?? 0}/{e.total ?? 0}{e.ignorados ? ` · ${e.ignorados} ign.` : ''}{temErro ? ` · ${e.erros} erro(s)` : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}

const CORES = { ativo: 'bg-green-50 text-green-700', inativo: 'bg-muted text-muted-foreground', erro: 'bg-red-50 text-red-700' };

export default function Integracoes() {
  const { isAdmin } = useAuth();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ nome: '', tipo: '', status: 'inativo', observacao: '' });
  const [syncOpen, setSyncOpen] = useState(false);

  const load = async () => { setLoading(true); setItens(await integracoesApi.list().catch(() => [])); setLoading(false); };
  useEffect(() => { load(); }, []);

  const isPix = (i) => `${i.nome || ''} ${i.tipo || ''}`.toLowerCase().includes('pixconsig');
  const pixExiste = itens.some(isPix);

  const openCreate = () => { setEdit(null); setForm({ nome: '', tipo: '', status: 'inativo', observacao: '' }); setOpen(true); };
  const openEdit = (i) => { setEdit(i); setForm({ nome: i.nome, tipo: i.tipo || '', status: i.status, observacao: i.observacao || '' }); setOpen(true); };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { nome: form.nome, tipo: form.tipo || null, status: form.status, observacao: form.observacao || null };
    try {
      if (edit) { await integracoesApi.update(edit.id, payload); await auditoriaApi.log('editar_integracao', 'integracoes', edit.id, { status: form.status }); }
      else { await integracoesApi.create(payload); await auditoriaApi.log('criar_integracao', 'integracoes', null, {}); }
      setOpen(false); load();
    } catch (err) { toast.error(err.message || 'Falha ao salvar.'); }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integrações & Portais"
        subtitle="Status das integrações externas (UY3, FIDC, mensageria, notificação)"
        actions={isAdmin && <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova</Button>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <EmptyState title="Carregando…" />
        : (<>
          {/* Card PixConsig sintético, caso ainda não exista um cadastrado */}
          {isAdmin && !pixExiste && (
            <button onClick={() => setSyncOpen(true)} className="text-left bg-card rounded-xl border border-border p-4 hover:border-primary/40 hover:shadow-sm transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><RefreshCw className="w-4 h-4" /></span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">PixConsig</p>
                    <p className="text-[11px] text-muted-foreground">espelho de convênios</p>
                  </div>
                </div>
                <span className="text-[11px] text-primary font-medium">Configurar →</span>
              </div>
              <div className="mt-3 text-[11px] text-muted-foreground">Sincronização de cadastro e margem dos convênios.</div>
            </button>
          )}
          {itens.map((i) => {
            const pix = isPix(i);
            return (
              <div key={i.id} className={`bg-card rounded-xl border p-4 ${pix ? 'border-blue-200' : 'border-border'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${pix ? 'bg-blue-50 text-blue-600' : 'bg-primary/10 text-primary'}`}>{pix ? <RefreshCw className="w-4 h-4" /> : <Plug className="w-4 h-4" />}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{i.nome}</p>
                      <p className="text-[11px] text-muted-foreground">{i.tipo || '—'}</p>
                    </div>
                  </div>
                  {isAdmin && <button onClick={() => openEdit(i)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Pencil className="w-4 h-4" /></button>}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <StatusBadge className={CORES[i.status] || CORES.inativo}>{i.status}</StatusBadge>
                  <span className="text-[11px] text-muted-foreground">{i.ultima_sincronizacao ? `sync ${dataBR(i.ultima_sincronizacao)}` : 'sem sync'}</span>
                </div>
                {isAdmin && pix && (
                  <Button variant="outline" size="sm" onClick={() => setSyncOpen(true)} className="mt-3 w-full gap-2">
                    <RefreshCw className="w-3.5 h-3.5" /> Sincronização & janela
                  </Button>
                )}
              </div>
            );
          })}
        </>)}
      </div>

      {/* Subjanela de sincronização PixConsig */}
      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><RefreshCw className="w-4 h-4 text-blue-600" /> Integração PixConsig — sincronização</DialogTitle></DialogHeader>
          <SyncPixconsig />
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar integração' : 'Nova integração'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Tipo</Label><Input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="ccb, fidc, mensageria..." /></div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem><SelectItem value="erro">Erro</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Observação</Label><Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">{edit ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
