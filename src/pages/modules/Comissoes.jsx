import React, { useEffect, useState } from 'react';
import { comissoesApi, regrasComissaoApi } from '@/lib/api/comissoes';
import { contratosApi } from '@/lib/api/contratos';
import { conveniosApi } from '@/lib/api/convenios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl, num, dataBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, CheckCircle2, Calculator, Trash2 } from 'lucide-react';

const STATUS = { prevista: 'Prevista', paga: 'Paga', cancelada: 'Cancelada' };
const CORES = { prevista: 'bg-blue-50 text-blue-700', paga: 'bg-green-50 text-green-700', cancelada: 'bg-slate-100 text-slate-400' };
const BENEF = { franquia: 'Franquia', lider: 'Líder', corban: 'Corban', operador: 'Operador', grupo: 'Grupo' };

/* ------------------------------ Comissões ------------------------------ */
function ComissoesTab() {
  const [itens, setItens] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ contrato_id: '', tipo: '', base_calculo: '', percentual: '', valor: '', status: 'prevista', data_pagamento: '' });
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcContrato, setCalcContrato] = useState('');
  const [calculando, setCalculando] = useState(false);

  const load = async () => {
    setLoading(true);
    const [c, ct] = await Promise.all([comissoesApi.list().catch(() => []), contratosApi.list().catch(() => [])]);
    setItens(c); setContratos(ct); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEdit(null); setForm({ contrato_id: '', tipo: '', base_calculo: '', percentual: '', valor: '', status: 'prevista', data_pagamento: '' }); setOpen(true); };
  const openEdit = (c) => {
    setEdit(c);
    setForm({ contrato_id: c.contrato_id || '', tipo: c.tipo || '', base_calculo: c.base_calculo ?? '', percentual: c.percentual ?? '', valor: c.valor ?? '', status: c.status, data_pagamento: c.data_pagamento || '' });
    setOpen(true);
  };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      contrato_id: form.contrato_id || null, tipo: form.tipo || null,
      base_calculo: num(form.base_calculo), percentual: num(form.percentual), valor: num(form.valor),
      status: form.status, data_pagamento: form.data_pagamento || null,
    };
    if (edit) { await comissoesApi.update(edit.id, payload); await auditoriaApi.log('editar_comissao', 'comissoes', edit.id, { status: form.status }); }
    else { await comissoesApi.create(payload); await auditoriaApi.log('criar_comissao', 'comissoes', null, {}); }
    setOpen(false); load();
  };
  const marcarPaga = async (c) => {
    await comissoesApi.update(c.id, { status: 'paga', data_pagamento: new Date().toISOString().slice(0, 10) });
    await auditoriaApi.log('pagar_comissao', 'comissoes', c.id, {}); load();
  };
  const calcular = async () => {
    if (!calcContrato) return;
    setCalculando(true);
    try {
      const n = await comissoesApi.calcularContrato(calcContrato);
      await auditoriaApi.log('calcular_comissoes', 'contratos', calcContrato, { geradas: n });
      alert(n === 0 ? 'Este contrato já possui comissões calculadas.' : `${n} comissão(ões) gerada(s) pelo motor de rateio.`);
      setCalcOpen(false); setCalcContrato(''); load();
    } catch (err) { alert(err.message || 'Falha ao calcular comissões.'); }
    finally { setCalculando(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Comissões por contrato e beneficiário — provisionadas automaticamente ao gerar o contrato</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCalcOpen(true)} className="gap-2"><Calculator className="w-4 h-4" /> Calcular (motor)</Button>
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova</Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : itens.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhuma comissão.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Contrato</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Beneficiário</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">%</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Valor</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.contrato?.numero_contrato || (c.contrato_id ? c.contrato_id.slice(0, 8) : '—')}</td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{BENEF[c.beneficiario] || c.tipo || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden md:table-cell">{c.percentual != null ? `${c.percentual}%` : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700 num">{brl(c.valor)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CORES[c.status]}`}>{STATUS[c.status]}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {c.status !== 'paga' && <button title="Marcar paga" onClick={() => marcarPaga(c)} className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"><CheckCircle2 className="w-4 h-4" /></button>}
                      <button title="Editar" onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Calcular pelo motor */}
      <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Calcular comissões (motor de rateio)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Aplica as regras ativas (específica do convênio &gt; global) ao contrato selecionado.</p>
            <div className="space-y-2">
              <Label>Contrato</Label>
              <Select value={calcContrato} onValueChange={setCalcContrato}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{contratos.map((c) => <SelectItem key={c.id} value={c.id}>{(c.numero_contrato || c.id.slice(0, 8)) + ' — ' + (c.cliente?.nome || '')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCalcOpen(false)}>Cancelar</Button>
            <Button onClick={calcular} disabled={!calcContrato || calculando}>{calculando ? 'Calculando…' : 'Calcular'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar comissão' : 'Nova comissão'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contrato</Label>
                <Select value={form.contrato_id} onValueChange={(v) => setForm({ ...form, contrato_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{contratos.map((c) => <SelectItem key={c.id} value={c.id}>{(c.numero_contrato || c.id.slice(0, 8)) + ' — ' + (c.cliente?.nome || '')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Tipo/beneficiário</Label><Input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="ex: franquia" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Base</Label><Input type="number" step="0.01" value={form.base_calculo} onChange={(e) => setForm({ ...form, base_calculo: e.target.value })} /></div>
              <div className="space-y-2"><Label>%</Label><Input type="number" step="0.0001" value={form.percentual} onChange={(e) => setForm({ ...form, percentual: e.target.value })} /></div>
              <div className="space-y-2"><Label>Valor</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Data de pagamento</Label><Input type="date" value={form.data_pagamento} onChange={(e) => setForm({ ...form, data_pagamento: e.target.value })} /></div>
            </div>
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

/* ------------------------------ Regras ------------------------------ */
function RegrasTab() {
  const { isAdmin } = useAuth();
  const [regras, setRegras] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ convenio_id: '', beneficiario: 'franquia', percentual: '', base: 'principal', descricao: '', ativo: true });

  const load = async () => {
    setLoading(true);
    const [r, cv] = await Promise.all([regrasComissaoApi.list().catch(() => []), conveniosApi.list().catch(() => [])]);
    setRegras(r); setConvenios(cv); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEdit(null); setForm({ convenio_id: '', beneficiario: 'franquia', percentual: '', base: 'principal', descricao: '', ativo: true }); setOpen(true); };
  const openEdit = (r) => {
    setEdit(r);
    setForm({ convenio_id: r.convenio_id || '', beneficiario: r.beneficiario, percentual: r.percentual ?? '', base: r.base || 'principal', descricao: r.descricao || '', ativo: r.ativo });
    setOpen(true);
  };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { convenio_id: form.convenio_id || null, beneficiario: form.beneficiario, percentual: num(form.percentual), base: form.base, descricao: form.descricao || null, ativo: form.ativo };
    try {
      if (edit) { await regrasComissaoApi.update(edit.id, payload); await auditoriaApi.log('editar_regra_comissao', 'regras_comissao', edit.id, {}); }
      else { await regrasComissaoApi.create(payload); await auditoriaApi.log('criar_regra_comissao', 'regras_comissao', null, {}); }
      setOpen(false); load();
    } catch (err) { alert(err.message || 'Falha ao salvar regra.'); }
  };
  const remover = async (r) => {
    if (!confirm('Excluir esta regra?')) return;
    try { await regrasComissaoApi.remove(r.id); load(); } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Regras de rateio (específica do convênio tem precedência sobre a global)</p>
        {isAdmin && <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova regra</Button>}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : regras.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhuma regra.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Convênio</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Beneficiário</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">%</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Base</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ativo</th>
              {isAdmin && <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>}
            </tr></thead>
            <tbody>
              {regras.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{r.convenio?.nome || <span className="text-slate-400">Global (padrão)</span>}</td>
                  <td className="px-4 py-3 text-slate-600">{BENEF[r.beneficiario] || r.beneficiario}</td>
                  <td className="px-4 py-3 text-right text-slate-700 num">{r.percentual}%</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{r.base}</td>
                  <td className="px-4 py-3">{r.ativo ? <span className="text-xs text-green-700">Sim</span> : <span className="text-xs text-slate-400">Não</span>}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => remover(r)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar regra' : 'Nova regra'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Convênio (vazio = global)</Label>
              <Select value={form.convenio_id || 'null'} onValueChange={(v) => setForm({ ...form, convenio_id: v === 'null' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Global (padrão)</SelectItem>
                  {convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Beneficiário</Label>
                <Select value={form.beneficiario} onValueChange={(v) => setForm({ ...form, beneficiario: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(BENEF).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>%</Label><Input type="number" step="0.0001" value={form.percentual} onChange={(e) => setForm({ ...form, percentual: e.target.value })} required /></div>
              <div className="space-y-2">
                <Label>Base</Label>
                <Select value={form.base} onValueChange={(v) => setForm({ ...form, base: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="principal">Principal</SelectItem><SelectItem value="total">Total</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="flex items-center justify-between"><Label htmlFor="ativo">Ativa</Label><Switch id="ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /></div>
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

/* ------------------------------ Wrapper ------------------------------ */
const TABS = [{ key: 'comissoes', label: 'Comissões' }, { key: 'regras', label: 'Regras de rateio' }];
export default function Comissoes() {
  const [tab, setTab] = useState('comissoes');
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
      {tab === 'comissoes' ? <ComissoesTab /> : <RegrasTab />}
    </div>
  );
}
