import React, { useEffect, useState } from 'react';
import { contratosApi } from '@/lib/api/contratos';
import { clientesApi } from '@/lib/api/clientes';
import { conveniosApi } from '@/lib/api/convenios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl, num, dataBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { EmptyState, StatusBadge } from '@/components/kit';
import { Plus, Pencil, FileText, Loader2 } from 'lucide-react';

const STATUS = { ativo: 'Ativo', quitado: 'Quitado', cancelado: 'Cancelado', inadimplente: 'Inadimplente' };
const CORES = {
  ativo: 'bg-green-50 text-green-700', quitado: 'bg-muted text-muted-foreground',
  cancelado: 'bg-muted text-muted-foreground/70', inadimplente: 'bg-red-50 text-red-700',
};
const emptyForm = { numero_contrato: '', cliente_id: '', convenio_id: '', valor_principal: '', valor_total: '', prazo: '', taxa_mensal: '', valor_parcela: '', data_assinatura: '', status: 'ativo' };

export default function Contratos() {
  const { activeUnidade } = useAuth();
  const [contratos, setContratos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const [ct, c, cv] = await Promise.all([
      contratosApi.list(activeUnidade ? { franquia_id: activeUnidade.id } : {}).catch(() => []),
      clientesApi.list().catch(() => []),
      conveniosApi.list().catch(() => []),
    ]);
    setContratos(ct); setClientes(c); setConvenios(cv); setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const openCreate = () => { setEdit(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c) => {
    setEdit(c);
    setForm({
      numero_contrato: c.numero_contrato || '', cliente_id: c.cliente_id, convenio_id: c.convenio_id || '',
      valor_principal: c.valor_principal ?? '', valor_total: c.valor_total ?? '', prazo: c.prazo ?? '',
      taxa_mensal: c.taxa_mensal ?? '', valor_parcela: c.valor_parcela ?? '',
      data_assinatura: c.data_assinatura || '', status: c.status,
    });
    setOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.cliente_id) return alert('Selecione o cliente.');
    const payload = {
      numero_contrato: form.numero_contrato || null, cliente_id: form.cliente_id, convenio_id: form.convenio_id || null,
      valor_principal: num(form.valor_principal), valor_total: num(form.valor_total), prazo: num(form.prazo),
      taxa_mensal: num(form.taxa_mensal), valor_parcela: num(form.valor_parcela),
      data_assinatura: form.data_assinatura || null, status: form.status,
    };
    if (edit) {
      await contratosApi.update(edit.id, payload);
      await auditoriaApi.log('editar_contrato', 'contratos', edit.id, { status: form.status });
    } else {
      await contratosApi.create({ ...payload, franquia_id: activeUnidade?.id || null });
      await auditoriaApi.log('criar_contrato', 'contratos', null, {});
    }
    setOpen(false); load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Contratos formalizados</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo contrato</Button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <EmptyState icon={Loader2} title="Carregando…" />
        ) : contratos.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum contrato." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Nº</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Cliente</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Principal</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden lg:table-cell">Assinatura</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.numero_contrato || '—'}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{c.cliente?.nome || '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{brl(c.valor_principal)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{dataBR(c.data_assinatura)}</td>
                  <td className="px-4 py-3"><StatusBadge className={CORES[c.status]}>{STATUS[c.status]}</StatusBadge></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(c)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded"><Pencil className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar contrato' : 'Novo contrato'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nº do contrato</Label><Input value={form.numero_contrato} onChange={(e) => setForm({ ...form, numero_contrato: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })} disabled={!!edit}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Convênio</Label>
                <Select value={form.convenio_id} onValueChange={(v) => setForm({ ...form, convenio_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Data de assinatura</Label><Input type="date" value={form.data_assinatura} onChange={(e) => setForm({ ...form, data_assinatura: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Principal</Label><Input type="number" step="0.01" value={form.valor_principal} onChange={(e) => setForm({ ...form, valor_principal: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Total</Label><Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} /></div>
              <div className="space-y-2"><Label>Prazo (x)</Label><Input type="number" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} required /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Taxa a.m. %</Label><Input type="number" step="0.0001" value={form.taxa_mensal} onChange={(e) => setForm({ ...form, taxa_mensal: e.target.value })} /></div>
              <div className="space-y-2"><Label>Parcela</Label><Input type="number" step="0.01" value={form.valor_parcela} onChange={(e) => setForm({ ...form, valor_parcela: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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
