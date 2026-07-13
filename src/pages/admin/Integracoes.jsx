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
import { Pencil, Plus, Plug, RefreshCw } from 'lucide-react';

function SyncPixconsig() {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const sincronizar = async () => {
    setBusy(true); setRes(null);
    try {
      const r = await pixconsigApi.sync();
      await auditoriaApi.log('sync_pixconsig_manual', 'convenios', null, { ok: r.ok, total: r.total });
      setRes(r);
      if (r.configurado === false) toast.warning('API PixConsig ainda não configurada (base URL / api key).');
      else toast.success(`Sync concluído: ${r.ok}/${r.total} convênios (${r.paginas} página(s)).`);
    } catch (err) { toast.error(err.message || 'Falha na sincronização.'); setRes({ erro: err.message }); }
    finally { setBusy(false); }
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-800">Convênios PixConsig (espelho)</p>
          <p className="text-[11px] text-slate-400">Full sync diário automático + botão manual. Cadastro e margem vêm da PixConsig; taxa/spread/comissão são do CONSIGTEC.</p>
        </div>
        <Button variant="outline" onClick={sincronizar} disabled={busy} className="gap-2"><RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> {busy ? 'Sincronizando…' : 'Sincronizar agora'}</Button>
      </div>
      {res && !res.erro && res.configurado !== false && (
        <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
          <b>{res.ok}</b> de <b>{res.total}</b> sincronizados · {res.ignorados} ignorado(s) · {res.paginas} página(s){res.erros?.length ? ` · ${res.erros.length} erro(s)` : ''}
        </div>
      )}
      {res?.configurado === false && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          Configure os secrets <code>PIXCONSIG_BASE_URL</code> e <code>PIXCONSIG_API_KEY</code> no backend para habilitar.
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

  const load = async () => { setLoading(true); setItens(await integracoesApi.list().catch(() => [])); setLoading(false); };
  useEffect(() => { load(); }, []);

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

      {isAdmin && <SyncPixconsig />}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <p className="text-sm text-slate-400">Carregando...</p>
        : itens.map((i) => (
          <div key={i.id} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Plug className="w-4 h-4" /></span>
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
          </div>
        ))}
      </div>

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
