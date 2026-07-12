import React, { useEffect, useState } from 'react';
import { propostasApi } from '@/lib/api/propostas';
import { clientesApi } from '@/lib/api/clientes';
import { conveniosApi } from '@/lib/api/convenios';
import { matriculasApi } from '@/lib/api/matriculas';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl, num } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, ShieldCheck } from 'lucide-react';

const STATUS = { rascunho: 'Rascunho', em_analise: 'Em análise', aprovada: 'Aprovada', reprovada: 'Reprovada', cancelada: 'Cancelada' };
const CORES = {
  rascunho: 'bg-slate-100 text-slate-600', em_analise: 'bg-blue-50 text-blue-700',
  aprovada: 'bg-green-50 text-green-700', reprovada: 'bg-red-50 text-red-700', cancelada: 'bg-slate-100 text-slate-400',
};
const emptyForm = { cliente_id: '', matricula_id: '', convenio_id: '', valor_solicitado: '', prazo: '', taxa_mensal: '', valor_parcela: '', status: 'rascunho', observacoes: '' };

export default function Propostas() {
  const { activeUnidade } = useAuth();
  const [propostas, setPropostas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [matriculas, setMatriculas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [reservando, setReservando] = useState(null);

  const load = async () => {
    setLoading(true);
    const [p, c, cv, m] = await Promise.all([
      propostasApi.list(activeUnidade ? { franquia_id: activeUnidade.id } : {}).catch(() => []),
      clientesApi.list().catch(() => []),
      conveniosApi.list().catch(() => []),
      matriculasApi.list().catch(() => []),
    ]);
    setPropostas(p); setClientes(c); setConvenios(cv); setMatriculas(m); setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const matsDoCliente = (clienteId) => matriculas.filter((m) => m.cliente_id === clienteId);
  const matSelecionada = matriculas.find((m) => m.id === form.matricula_id);

  const openCreate = () => { setEdit(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (p) => {
    setEdit(p);
    setForm({
      cliente_id: p.cliente_id, matricula_id: p.matricula_id || '', convenio_id: p.convenio_id || '',
      valor_solicitado: p.valor_solicitado ?? '', prazo: p.prazo ?? '', taxa_mensal: p.taxa_mensal ?? '',
      valor_parcela: p.valor_parcela ?? '', status: p.status, observacoes: p.observacoes || '',
    });
    setOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.cliente_id) return alert('Selecione o cliente.');
    const payload = {
      cliente_id: form.cliente_id, matricula_id: form.matricula_id || null, convenio_id: form.convenio_id || null,
      valor_solicitado: num(form.valor_solicitado), prazo: num(form.prazo),
      taxa_mensal: num(form.taxa_mensal), valor_parcela: num(form.valor_parcela),
      status: form.status, observacoes: form.observacoes || null,
    };
    if (edit) {
      await propostasApi.update(edit.id, payload);
      await auditoriaApi.log('editar_proposta', 'propostas', edit.id, { status: form.status });
    } else {
      await propostasApi.create({ ...payload, franquia_id: activeUnidade?.id || null });
      await auditoriaApi.log('criar_proposta', 'propostas', null, {});
    }
    setOpen(false); load();
  };

  const reservarMargem = async (p) => {
    if (!p.matricula_id) return alert('Vincule uma matrícula à proposta antes de reservar margem.');
    setReservando(p.id);
    try {
      const r = await propostasApi.reservarMargem(p.id);
      await auditoriaApi.log('reservar_margem', 'propostas', p.id, { valor: r?.valor });
      alert(`Margem reservada: ${brl(r?.valor)} na matrícula ${p.matricula?.matricula || ''}.`);
      load();
    } catch (err) {
      alert(err.message || 'Não foi possível reservar a margem.');
    } finally {
      setReservando(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Propostas de crédito consignado</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova proposta</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : propostas.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">Nenhuma proposta.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Convênio</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Valor</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Prazo</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Vínculo</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.cliente?.nome || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{p.convenio?.nome || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{brl(p.valor_solicitado)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden sm:table-cell">{p.prazo ? `${p.prazo}x` : '—'}</td>
                  <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{p.matricula ? `#${p.matricula.matricula}` : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CORES[p.status]}`}>{STATUS[p.status]}</span></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => reservarMargem(p)}
                      disabled={!p.matricula_id || reservando === p.id}
                      title={p.matricula_id ? 'Reservar margem apartada' : 'Vincule uma matrícula para reservar'}
                      className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded disabled:opacity-40 disabled:hover:bg-transparent"
                    ><ShieldCheck className="w-4 h-4" /></button>
                    <button onClick={() => openEdit(p)} title="Editar" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar proposta' : 'Nova proposta'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })} disabled={!!edit}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Convênio</Label>
                <Select value={form.convenio_id} onValueChange={(v) => setForm({ ...form, convenio_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Vínculo / Matrícula</Label>
              <Select value={form.matricula_id} onValueChange={(v) => setForm({ ...form, matricula_id: v })} disabled={!form.cliente_id}>
                <SelectTrigger><SelectValue placeholder={form.cliente_id ? 'Selecionar vínculo' : 'Selecione o cliente primeiro'} /></SelectTrigger>
                <SelectContent>
                  {matsDoCliente(form.cliente_id).map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {(m.convenio?.nome || m.orgao || 'Vínculo')} · #{m.matricula} · disp. {brl(m.margem_disponivel)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {matSelecionada && (
                <p className="text-xs text-slate-400">
                  Margem disponível no vínculo: <span className="font-medium text-slate-600">{brl(matSelecionada.margem_disponivel)}</span>
                  {form.valor_parcela && Number(form.valor_parcela) > Number(matSelecionada.margem_disponivel || 0) && (
                    <span className="text-red-600"> · parcela excede a margem</span>
                  )}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Valor</Label><Input type="number" step="0.01" value={form.valor_solicitado} onChange={(e) => setForm({ ...form, valor_solicitado: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Prazo (x)</Label><Input type="number" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Taxa a.m. %</Label><Input type="number" step="0.0001" value={form.taxa_mensal} onChange={(e) => setForm({ ...form, taxa_mensal: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Valor da parcela</Label><Input type="number" step="0.01" value={form.valor_parcela} onChange={(e) => setForm({ ...form, valor_parcela: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
                {['reprovada', 'cancelada'].includes(form.status) && (
                  <p className="text-[11px] text-amber-600">A margem reservada será liberada automaticamente ao salvar.</p>
                )}
              </div>
            </div>
            <div className="space-y-2"><Label>Observações</Label><Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
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
