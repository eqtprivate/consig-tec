import React, { useEffect, useState } from 'react';
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

function SyncPixconsig() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  // rascunho do editor de janela
  const [cfg, setCfg] = useState({ intervalo_horas: 4, hora_inicio: 9, hora_fim: 17, ativo: true });
  const [savingCfg, setSavingCfg] = useState(false);

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
    finally { setLoadingStatus(false); }
  };
  useEffect(() => { carregarStatus(); }, []);

  const sincronizar = async () => {
    setBusy(true); setRes(null);
    try {
      const r = await pixconsigApi.sync();
      await auditoriaApi.log('sync_pixconsig_manual', 'convenios', null, { ok: r.ok, total: r.total, ignorados: r.ignorados, erros: r.erros?.length || 0 });
      setRes(r);
      if (r.configurado === false) toast.warning('API PixConsig ainda não configurada (base URL / api key).');
      else toast.success(`Sync concluído: ${r.ok}/${r.total} convênios (${r.paginas} página(s)).`);
      carregarStatus();
    } catch (err) { toast.error(err.message || 'Falha na sincronização.'); setRes({ erro: err.message }); }
    finally { setBusy(false); }
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

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">Convênios PixConsig (espelho)</p>
          <p className="text-[11px] text-slate-400">Cadastro e margem vêm da PixConsig; taxa/spread/comissão são do CONSIGTEC.</p>
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
          <span className="text-slate-500">
            {busy ? 'Sincronizando com a PixConsig…'
              : pct != null ? 'Taxa de sucesso da última sincronização'
              : 'Aguardando primeira sincronização com dados'}
          </span>
          {pct != null && !busy && (
            <span className="font-semibold text-slate-700">{ult.ok}/{ult.total} convênios · <span className="text-primary">{pct}%</span></span>
          )}
        </div>
        <Progress value={busy ? 100 : (pct ?? 0)} className={busy ? 'animate-pulse' : ''} />
        {!busy && pct == null && (
          <p className="text-[11px] text-slate-400 mt-1">
            Nenhuma sincronização retornou dados ainda — configure os secrets do backend e clique em “Sincronizar agora”.
          </p>
        )}
      </div>

      {/* Cartões de resumo do espelho */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Convênios (PixConsig)</p>
          <p className="text-lg font-bold text-slate-800">{status?.espelho?.convenios ?? '—'}</p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Convênios (total)</p>
          <p className="text-lg font-bold text-slate-800">{status?.espelho?.convenios_total ?? '—'}</p>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 col-span-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">Última sincronização</p>
          <p className="text-sm font-semibold text-slate-800">{dataHoraBR(status?.espelho?.ultima_sync)}</p>
        </div>
      </div>

      {res && !res.erro && res.configurado !== false && (
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
          <b>{res.ok}</b> de <b>{res.total}</b> sincronizados{res.total_api != null ? ` (API informa ${res.total_api} no total)` : ''} · {res.ignorados} ignorado(s) · {res.paginas} página(s){res.erros?.length ? ` · ${res.erros.length} erro(s)` : ''}
          {res.diag && (
            <details className="mt-2 text-[11px] text-slate-500">
              <summary className="cursor-pointer">Diagnóstico de paginação (1ª página)</summary>
              <pre className="mt-1 bg-slate-100 rounded p-2 overflow-x-auto">{JSON.stringify(res.diag, null, 2)}</pre>
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
      <div className="rounded-lg border border-slate-200 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Janela de sincronização automática</p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">{cfg.ativo ? 'Ativa' : 'Pausada'}</span>
            <Switch checked={cfg.ativo} onCheckedChange={(v) => setCfg({ ...cfg, ativo: v })} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">A cada</Label>
            <Select value={String(cfg.intervalo_horas)} onValueChange={(v) => setCfg({ ...cfg, intervalo_horas: Number(v) })} disabled={!cfg.ativo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INTERVALOS.map((h) => <SelectItem key={h} value={String(h)}>{h === 24 ? '24 horas (1x/dia)' : `${h} em ${h} horas`}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">Das (BRT)</Label>
            <Select value={String(cfg.hora_inicio)} onValueChange={(v) => setCfg({ ...cfg, hora_inicio: Number(v) })} disabled={!cfg.ativo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 24 }, (_, h) => <SelectItem key={h} value={String(h)}>{h2(h)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-slate-500">Até (BRT)</Label>
            <Select value={String(cfg.hora_fim)} onValueChange={(v) => setCfg({ ...cfg, hora_fim: Number(v) })} disabled={!cfg.ativo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 24 }, (_, h) => <SelectItem key={h} value={String(h)}>{h2(h)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[11px] text-slate-500">
            {cfg.ativo
              ? <>Rodará às <b className="text-slate-700">{previewBRT.map(h2).join(' · ') || '—'}</b> (horário de Brasília){previewBRT.length ? ` · ${previewBRT.length}x/dia` : ''}</>
              : 'Sincronização automática pausada — apenas manual.'}
          </p>
          <Button size="sm" onClick={salvarConfig} disabled={savingCfg} className="gap-1.5"><Save className="w-3.5 h-3.5" /> {savingCfg ? 'Salvando…' : 'Salvar janela'}</Button>
        </div>
      </div>

      {/* Últimas execuções */}
      {status?.execucoes?.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-semibold text-slate-700 mb-2">Últimas execuções</p>
          <div className="space-y-1">
            {status.execucoes.map((e, i) => {
              const temErro = (e.erros || 0) > 0;
              return (
                <div key={i} className="flex items-center justify-between text-[11px] text-slate-600 border-b border-slate-100 last:border-0 py-1">
                  <span className="flex items-center gap-1.5">
                    {temErro ? <AlertTriangle className="w-3 h-3 text-amber-500" /> : <CheckCircle2 className="w-3 h-3 text-green-500" />}
                    {dataHoraBR(e.created_at)}
                    <span className="text-slate-400">· {e.acao === 'sync_pixconsig_manual' ? 'manual' : 'automático'}</span>
                  </span>
                  <span className="text-slate-500">{e.ok ?? 0}/{e.total ?? 0}{e.ignorados ? ` · ${e.ignorados} ign.` : ''}{temErro ? ` · ${e.erros} erro(s)` : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const CORES = { ativo: 'bg-green-50 text-green-700', inativo: 'bg-slate-100 text-slate-500', erro: 'bg-red-50 text-red-700' };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Integrações & Portais</h1>
          <p className="text-sm text-slate-500 mt-1">Status das integrações externas (UY3, FIDC, mensageria, notificação)</p>
        </div>
        {isAdmin && <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova</Button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <p className="text-sm text-slate-400">Carregando...</p>
        : (<>
          {/* Card PixConsig sintético, caso ainda não exista um cadastrado */}
          {isAdmin && !pixExiste && (
            <button onClick={() => setSyncOpen(true)} className="text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-primary/40 hover:shadow-sm transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><RefreshCw className="w-4 h-4" /></span>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">PixConsig</p>
                    <p className="text-[11px] text-slate-400">espelho de convênios</p>
                  </div>
                </div>
                <span className="text-[11px] text-primary font-medium">Configurar →</span>
              </div>
              <div className="mt-3 text-[11px] text-slate-400">Sincronização de cadastro e margem dos convênios.</div>
            </button>
          )}
          {itens.map((i) => {
            const pix = isPix(i);
            return (
              <div key={i.id} className={`bg-white rounded-xl border p-4 ${pix ? 'border-blue-200' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${pix ? 'bg-blue-50 text-blue-600' : 'bg-primary/10 text-primary'}`}>{pix ? <RefreshCw className="w-4 h-4" /> : <Plug className="w-4 h-4" />}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{i.nome}</p>
                      <p className="text-[11px] text-slate-400">{i.tipo || '—'}</p>
                    </div>
                  </div>
                  {isAdmin && <button onClick={() => openEdit(i)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CORES[i.status] || CORES.inativo}`}>{i.status}</span>
                  <span className="text-[11px] text-slate-400">{i.ultima_sincronizacao ? `sync ${dataBR(i.ultima_sincronizacao)}` : 'sem sync'}</span>
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
