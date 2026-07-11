import React, { useEffect, useState } from 'react';
import {
  gestorasApi, administradorasApi, cedentesApi, fundosApi, pddApi, termosCessaoApi,
} from '@/lib/api/cessao';
import { ccbsApi } from '@/lib/api/ccbs';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl, dataBR, num } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, FileText, Layers } from 'lucide-react';

const C_STATUS = { rascunho: 'Rascunho', assinada: 'Assinada', integrada: 'Integrada', conciliada: 'Conciliada', cancelada: 'Cancelada' };
const C_CORES = {
  rascunho: 'bg-slate-100 text-slate-600', assinada: 'bg-blue-50 text-blue-700', integrada: 'bg-amber-50 text-amber-700',
  conciliada: 'bg-green-50 text-green-700', cancelada: 'bg-slate-100 text-slate-400',
};

/* ------------------------------ Termos ------------------------------ */
function TermosTab() {
  const [itens, setItens] = useState([]);
  const [fundos, setFundos] = useState([]);
  const [cedentes, setCedentes] = useState([]);
  const [ccbs, setCcbs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ referencia: '', fundo_id: '', cedente_id: '', data_cessao: '', valor_total: '', sem_coobrigacao: true, foro: '', status: 'rascunho' });
  // itens
  const [detTermo, setDetTermo] = useState(null);
  const [detItens, setDetItens] = useState([]);
  const [itemForm, setItemForm] = useState({ ccb_id: '', titulo: '', emitente: '', cpf_cnpj: '', vencimento: '', valor: '', agio_desagio: '' });

  const load = async () => {
    setLoading(true);
    const [t, f, ce, cb] = await Promise.all([
      termosCessaoApi.list().catch(() => []),
      fundosApi.list().catch(() => []),
      cedentesApi.list().catch(() => []),
      ccbsApi.list().catch(() => []),
    ]);
    setItens(t); setFundos(f); setCedentes(ce); setCcbs(cb); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEdit(null); setForm({ referencia: '', fundo_id: '', cedente_id: '', data_cessao: '', valor_total: '', sem_coobrigacao: true, foro: '', status: 'rascunho' }); setOpen(true); };
  const openEdit = (t) => {
    setEdit(t);
    setForm({ referencia: t.referencia || '', fundo_id: t.fundo_id || '', cedente_id: t.cedente_id || '', data_cessao: t.data_cessao || '', valor_total: t.valor_total ?? '', sem_coobrigacao: t.sem_coobrigacao, foro: t.foro || '', status: t.status });
    setOpen(true);
  };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { referencia: form.referencia || null, fundo_id: form.fundo_id || null, cedente_id: form.cedente_id || null, data_cessao: form.data_cessao || null, valor_total: num(form.valor_total), sem_coobrigacao: form.sem_coobrigacao, foro: form.foro || null, status: form.status };
    try {
      if (edit) { await termosCessaoApi.update(edit.id, payload); await auditoriaApi.log('editar_termo_cessao', 'termos_cessao', edit.id, {}); }
      else { await termosCessaoApi.create(payload); await auditoriaApi.log('criar_termo_cessao', 'termos_cessao', null, {}); }
      setOpen(false); load();
    } catch (err) { alert(err.message || 'Falha ao salvar termo.'); }
  };

  const abrirItens = async (t) => {
    setDetTermo(t);
    setDetItens(await termosCessaoApi.itens(t.id).catch(() => []));
  };
  const onSelCcb = (v) => {
    const c = ccbs.find((x) => x.id === v);
    setItemForm((f) => ({ ...f, ccb_id: v, titulo: f.titulo || c?.numero || '', valor: f.valor || (c?.valor_principal ?? '') }));
  };
  const addItem = async (e) => {
    e.preventDefault();
    try {
      await termosCessaoApi.addItem({
        termo_id: detTermo.id, ccb_id: itemForm.ccb_id || null, titulo: itemForm.titulo || null,
        emitente: itemForm.emitente || null, cpf_cnpj: itemForm.cpf_cnpj || null,
        vencimento: itemForm.vencimento || null, valor: num(itemForm.valor), agio_desagio: num(itemForm.agio_desagio),
      });
      setItemForm({ ccb_id: '', titulo: '', emitente: '', cpf_cnpj: '', vencimento: '', valor: '', agio_desagio: '' });
      setDetItens(await termosCessaoApi.itens(detTermo.id));
    } catch (err) { alert(err.message); }
  };
  const rmItem = async (id) => { await termosCessaoApi.removeItem(id); setDetItens(await termosCessaoApi.itens(detTermo.id)); };

  const totalItens = detItens.reduce((s, i) => s + Number(i.valor || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Termos de cessão de recebíveis ao FIDC (multi-fundo)</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo termo</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : itens.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhum termo de cessão.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Referência</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Fundo</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Valor</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Data</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{t.referencia || t.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{t.fundo?.nome || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700 num">{brl(t.valor_total)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden lg:table-cell">{dataBR(t.data_cessao)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${C_CORES[t.status]}`}>{C_STATUS[t.status]}</span></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => abrirItens(t)} title="Títulos" className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded"><Layers className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(t)} title="Editar" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form termo */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar termo' : 'Novo termo de cessão'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Referência</Label><Input value={form.referencia} onChange={(e) => setForm({ ...form, referencia: e.target.value })} /></div>
              <div className="space-y-2"><Label>Data da cessão</Label><Input type="date" value={form.data_cessao} onChange={(e) => setForm({ ...form, data_cessao: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fundo</Label>
                <Select value={form.fundo_id} onValueChange={(v) => setForm({ ...form, fundo_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{fundos.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cedente</Label>
                <Select value={form.cedente_id} onValueChange={(v) => setForm({ ...form, cedente_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{cedentes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Valor total</Label><Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(C_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Foro</Label><Input value={form.foro} onChange={(e) => setForm({ ...form, foro: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">{edit ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Itens do termo */}
      <Dialog open={!!detTermo} onOpenChange={(v) => !v && setDetTermo(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Títulos cedidos — {detTermo?.referencia || detTermo?.id?.slice(0, 8)}</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {detItens.length === 0 ? <p className="text-sm text-slate-400 py-2">Nenhum título neste termo.</p>
            : detItens.map((i) => (
              <div key={i.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{i.titulo || i.ccb?.numero || '—'} <span className="text-xs text-slate-400">{i.emitente}</span></p>
                  <p className="text-xs text-slate-400">venc. {dataBR(i.vencimento)} · {brl(i.valor)} · ágio/deságio {brl(i.agio_desagio)}</p>
                </div>
                <button onClick={() => rmItem(i.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-500 border-t border-slate-100 pt-2">Total dos títulos: <span className="font-medium text-slate-700 num">{brl(totalItens)}</span></div>
          <form onSubmit={addItem} className="space-y-3 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Adicionar título</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>CCB</Label>
                <Select value={itemForm.ccb_id} onValueChange={onSelCcb}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{ccbs.map((c) => <SelectItem key={c.id} value={c.id}>{c.numero || c.id.slice(0, 8)} — {brl(c.valor_principal)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Título</Label><Input value={itemForm.titulo} onChange={(e) => setItemForm({ ...itemForm, titulo: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Emitente</Label><Input value={itemForm.emitente} onChange={(e) => setItemForm({ ...itemForm, emitente: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>CPF/CNPJ</Label><Input value={itemForm.cpf_cnpj} onChange={(e) => setItemForm({ ...itemForm, cpf_cnpj: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Vencimento</Label><Input type="date" value={itemForm.vencimento} onChange={(e) => setItemForm({ ...itemForm, vencimento: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Valor</Label><Input type="number" step="0.01" value={itemForm.valor} onChange={(e) => setItemForm({ ...itemForm, valor: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Ágio/deságio</Label><Input type="number" step="0.01" value={itemForm.agio_desagio} onChange={(e) => setItemForm({ ...itemForm, agio_desagio: e.target.value })} /></div>
            </div>
            <div className="flex justify-end"><Button type="submit" className="gap-2"><Plus className="w-4 h-4" /> Adicionar</Button></div>
          </form>
          <DialogFooter><Button variant="outline" onClick={() => setDetTermo(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------ Fundos & Partes ------------------------------ */
function MiniCadastro({ titulo, api, extra }) {
  const [itens, setItens] = useState([]);
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const reload = async () => setItens(await api.list().catch(() => []));
  useEffect(() => { reload(); }, []);
  const add = async (e) => {
    e.preventDefault();
    if (!nome) return;
    try { await api.create({ nome, cnpj: cnpj || null, ...(extra || {}) }); setNome(''); setCnpj(''); reload(); }
    catch (err) { alert(err.message); }
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-700 mb-2">{titulo}</p>
      <div className="space-y-1 mb-3 max-h-32 overflow-y-auto">
        {itens.length === 0 ? <p className="text-xs text-slate-400">Nenhum.</p>
        : itens.map((i) => <p key={i.id} className="text-xs text-slate-600">{i.nome} {i.cnpj ? <span className="text-slate-400">· {i.cnpj}</span> : ''}</p>)}
      </div>
      <form onSubmit={add} className="flex gap-2">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="h-8 text-sm" />
        <Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="CNPJ" className="h-8 text-sm w-40" />
        <Button type="submit" size="sm" className="h-8">+</Button>
      </form>
    </div>
  );
}

function FundosTab() {
  const [fundos, setFundos] = useState([]);
  const [gestoras, setGestoras] = useState([]);
  const [adms, setAdms] = useState([]);
  const [form, setForm] = useState({ nome: '', cnpj: '', gestora_id: '', administradora_id: '', tipo: 'FIDC' });

  const load = async () => {
    const [f, g, a] = await Promise.all([fundosApi.list().catch(() => []), gestorasApi.list().catch(() => []), administradorasApi.list().catch(() => [])]);
    setFundos(f); setGestoras(g); setAdms(a);
  };
  useEffect(() => { load(); }, []);
  const addFundo = async (e) => {
    e.preventDefault();
    if (!form.nome) return;
    try {
      await fundosApi.create({ nome: form.nome, cnpj: form.cnpj || null, gestora_id: form.gestora_id || null, administradora_id: form.administradora_id || null, tipo: form.tipo || null });
      setForm({ nome: '', cnpj: '', gestora_id: '', administradora_id: '', tipo: 'FIDC' }); load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MiniCadastro titulo="Gestoras" api={gestorasApi} />
        <MiniCadastro titulo="Administradoras" api={administradorasApi} />
        <MiniCadastro titulo="Cedentes" api={cedentesApi} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-700 mb-3">Fundos</p>
        <div className="space-y-1 mb-3 max-h-40 overflow-y-auto">
          {fundos.length === 0 ? <p className="text-xs text-slate-400">Nenhum fundo.</p>
          : fundos.map((f) => <p key={f.id} className="text-sm text-slate-600">{f.nome} <span className="text-xs text-slate-400">· {f.tipo || '—'} · gestora {f.gestora?.nome || '—'} · adm {f.administradora?.nome || '—'}</span></p>)}
        </div>
        <form onSubmit={addFundo} className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome do fundo" className="h-8 text-sm md:col-span-2" />
          <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="CNPJ" className="h-8 text-sm" />
          <Select value={form.gestora_id} onValueChange={(v) => setForm({ ...form, gestora_id: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Gestora" /></SelectTrigger>
            <SelectContent>{gestoras.map((g) => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.administradora_id} onValueChange={(v) => setForm({ ...form, administradora_id: v })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Adm." /></SelectTrigger>
            <SelectContent>{adms.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="submit" size="sm" className="h-8 md:col-span-5 md:w-32"><Plus className="w-4 h-4 mr-1" /> Fundo</Button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------ PDD ------------------------------ */
function PddTab() {
  const [itens, setItens] = useState([]);
  const [fundos, setFundos] = useState([]);
  const [form, setForm] = useState({ fundo_id: '', competencia: '', saldo_carteira: '', pdd_valor: '', pdd_percentual: '' });

  const load = async () => {
    const [p, f] = await Promise.all([pddApi.list().catch(() => []), fundosApi.list().catch(() => [])]);
    setItens(p); setFundos(f);
  };
  useEffect(() => { load(); }, []);
  const add = async (e) => {
    e.preventDefault();
    if (!form.competencia) return alert('Informe a competência.');
    try {
      await pddApi.create({ fundo_id: form.fundo_id || null, competencia: form.competencia, saldo_carteira: num(form.saldo_carteira), pdd_valor: num(form.pdd_valor), pdd_percentual: num(form.pdd_percentual) });
      setForm({ fundo_id: '', competencia: '', saldo_carteira: '', pdd_valor: '', pdd_percentual: '' }); load();
    } catch (err) { alert(err.message); }
  };
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {itens.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">Nenhum registro de PDD.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Competência</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Fundo</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Saldo carteira</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">PDD</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">%</th>
            </tr></thead>
            <tbody>
              {itens.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{r.competencia}</td>
                  <td className="px-4 py-3 text-slate-600">{r.fundo?.nome || '—'}</td>
                  <td className="px-4 py-3 text-right num text-slate-700">{brl(r.saldo_carteira)}</td>
                  <td className="px-4 py-3 text-right num text-slate-700">{brl(r.pdd_valor)}</td>
                  <td className="px-4 py-3 text-right num text-slate-600">{r.pdd_percentual != null ? `${r.pdd_percentual}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <form onSubmit={add} className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-2 md:grid-cols-6 gap-2">
        <Input value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} placeholder="AAAA-MM" className="h-8 text-sm" />
        <Select value={form.fundo_id} onValueChange={(v) => setForm({ ...form, fundo_id: v })}>
          <SelectTrigger className="h-8 text-sm md:col-span-2"><SelectValue placeholder="Fundo" /></SelectTrigger>
          <SelectContent>{fundos.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" step="0.01" value={form.saldo_carteira} onChange={(e) => setForm({ ...form, saldo_carteira: e.target.value })} placeholder="Saldo" className="h-8 text-sm" />
        <Input type="number" step="0.01" value={form.pdd_valor} onChange={(e) => setForm({ ...form, pdd_valor: e.target.value })} placeholder="PDD" className="h-8 text-sm" />
        <Input type="number" step="0.0001" value={form.pdd_percentual} onChange={(e) => setForm({ ...form, pdd_percentual: e.target.value })} placeholder="%" className="h-8 text-sm" />
        <Button type="submit" size="sm" className="h-8 md:col-span-6 md:w-32"><Plus className="w-4 h-4 mr-1" /> PDD</Button>
      </form>
    </div>
  );
}

/* ------------------------------ Wrapper ------------------------------ */
const TABS = [{ key: 'termos', label: 'Termos de cessão' }, { key: 'fundos', label: 'Fundos & Partes' }, { key: 'pdd', label: 'PDD' }];
export default function Cessao() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState('termos');
  if (!isAdmin) return <p className="text-sm text-slate-500">A camada de cessão/FIDC é restrita a administradores do grupo.</p>;
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'termos' ? <TermosTab /> : tab === 'fundos' ? <FundosTab /> : <PddTab />}
    </div>
  );
}
