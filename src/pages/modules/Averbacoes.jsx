import React, { useEffect, useState } from 'react';
import { averbacoesApi } from '@/lib/api/averbacoes';
import { contratosApi } from '@/lib/api/contratos';
import { propostasApi } from '@/lib/api/propostas';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { dataBR, brl, num } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { StatusBadge, EmptyState } from '@/components/kit';
import { Plus, Pencil } from 'lucide-react';

const STATUS = { pendente: 'Pendente', averbada: 'Averbada', recusada: 'Recusada', cancelada: 'Cancelada' };
const CORES = {
  pendente: 'bg-amber-50 text-amber-700', averbada: 'bg-green-50 text-green-700',
  recusada: 'bg-red-50 text-red-700', cancelada: 'bg-muted text-muted-foreground',
};
const emptyForm = {
  origem: 'proposta', proposta_id: '', contrato_id: '', convenio_id: '',
  protocolo: '', protocolo_uy3: '', valor_averbado: '', status: 'pendente',
  data_averbacao: '', motivo_recusa: '',
};

export default function Averbacoes() {
  const { activeUnidade } = useAuth();
  const [itens, setItens] = useState([]);
  const [contratos, setContratos] = useState([]);
  const [propostas, setPropostas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const f = activeUnidade ? { franquia_id: activeUnidade.id } : {};
    const [a, c, p] = await Promise.all([
      averbacoesApi.list().catch(() => []),
      contratosApi.list(f).catch(() => []),
      propostasApi.list(f).catch(() => []),
    ]);
    setItens(a); setContratos(c); setPropostas(p); setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const propostaSel = propostas.find((p) => p.id === form.proposta_id);

  const openCreate = () => { setEdit(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (a) => {
    setEdit(a);
    setForm({
      origem: a.proposta_id ? 'proposta' : 'contrato',
      proposta_id: a.proposta_id || '', contrato_id: a.contrato_id || '',
      convenio_id: a.convenio_id || '', protocolo: a.protocolo || '', protocolo_uy3: a.protocolo_uy3 || '',
      valor_averbado: a.valor_averbado ?? '', status: a.status,
      data_averbacao: a.data_averbacao || '', motivo_recusa: a.motivo_recusa || '',
    });
    setOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const viaProposta = form.origem === 'proposta';
    if (viaProposta && !form.proposta_id) return alert('Selecione a proposta.');
    if (!viaProposta && !form.contrato_id) return alert('Selecione o contrato.');

    const contrato = contratos.find((c) => c.id === form.contrato_id);
    const payload = {
      proposta_id: viaProposta ? form.proposta_id : null,
      contrato_id: viaProposta ? null : form.contrato_id,
      matricula_id: viaProposta ? (propostaSel?.matricula_id || null) : null,
      convenio_id: form.convenio_id || (viaProposta ? propostaSel?.convenio_id : contrato?.convenio_id) || null,
      protocolo: form.protocolo || null,
      protocolo_uy3: form.protocolo_uy3 || null,
      valor_averbado: num(form.valor_averbado) ?? (viaProposta ? num(propostaSel?.valor_parcela) : null),
      status: form.status,
      data_averbacao: form.data_averbacao || null,
      motivo_recusa: form.motivo_recusa || null,
    };
    if (edit) {
      await averbacoesApi.update(edit.id, payload);
      await auditoriaApi.log('editar_averbacao', 'averbacoes', edit.id, { status: form.status });
    } else {
      await averbacoesApi.create(payload);
      await auditoriaApi.log('criar_averbacao', 'averbacoes', null, { origem: form.origem });
    }
    setOpen(false); load();
  };

  const origemLabel = (a) =>
    a.proposta ? (a.proposta.cliente?.nome || 'Proposta')
    : (a.contrato?.numero_contrato || a.contrato_id?.slice(0, 8) || '—');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Averbação de margem apartada (proposta) e handoff UY3</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova averbação</Button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <EmptyState title="Carregando…" />
        ) : itens.length === 0 ? (
          <EmptyState title="Nenhuma averbação." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Origem</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Protocolo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">UY3</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden lg:table-cell">Data</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((a) => (
                <tr key={a.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 text-foreground">
                    {origemLabel(a)}
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{a.proposta_id ? 'Proposta' : 'Contrato'}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{a.protocolo || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell font-mono text-xs">{a.protocolo_uy3 || '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{dataBR(a.data_averbacao)}</td>
                  <td className="px-4 py-3"><StatusBadge className={CORES[a.status]}>{STATUS[a.status]}</StatusBadge></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(a)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded"><Pencil className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar averbação' : 'Nova averbação'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            {!edit && (
              <div className="space-y-2">
                <Label>Origem</Label>
                <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proposta">Proposta (pré-contrato)</SelectItem>
                    <SelectItem value="contrato">Contrato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.origem === 'proposta' ? (
              <div className="space-y-2">
                <Label>Proposta</Label>
                <Select value={form.proposta_id} onValueChange={(v) => setForm({ ...form, proposta_id: v })} disabled={!!edit}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {propostas.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {(p.cliente?.nome || 'Cliente')} — {brl(p.valor_solicitado)} {p.matricula ? `· #${p.matricula.matricula}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {propostaSel && (
                  <p className="text-xs text-muted-foreground">
                    Vínculo {propostaSel.matricula ? `#${propostaSel.matricula.matricula}` : '—'} · parcela {brl(propostaSel.valor_parcela)}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Contrato</Label>
                <Select value={form.contrato_id} onValueChange={(v) => setForm({ ...form, contrato_id: v })} disabled={!!edit}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {contratos.map((c) => <SelectItem key={c.id} value={c.id}>{(c.numero_contrato || c.id.slice(0, 8)) + ' — ' + (c.cliente?.nome || '')}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Protocolo (convênio)</Label><Input value={form.protocolo} onChange={(e) => setForm({ ...form, protocolo: e.target.value })} /></div>
              <div className="space-y-2"><Label>Protocolo UY3 (handoff)</Label><Input value={form.protocolo_uy3} onChange={(e) => setForm({ ...form, protocolo_uy3: e.target.value })} placeholder="nº na esteira UY3" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Valor averbado (margem)</Label><Input type="number" step="0.01" value={form.valor_averbado} onChange={(e) => setForm({ ...form, valor_averbado: e.target.value })} placeholder={propostaSel?.valor_parcela ? String(propostaSel.valor_parcela) : ''} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
                {form.origem === 'proposta' && form.status === 'averbada' && (
                  <p className="text-[11px] text-green-700">A margem reservada será efetivada (ajustada ao valor averbado, se divergir).</p>
                )}
                {form.origem === 'proposta' && ['recusada', 'cancelada'].includes(form.status) && (
                  <p className="text-[11px] text-amber-600">A margem reservada será liberada automaticamente.</p>
                )}
              </div>
            </div>
            <div className="space-y-2"><Label>Data da averbação</Label><Input type="date" value={form.data_averbacao} onChange={(e) => setForm({ ...form, data_averbacao: e.target.value })} /></div>
            {form.status === 'recusada' && (
              <div className="space-y-2"><Label>Motivo da recusa</Label><Textarea rows={2} value={form.motivo_recusa} onChange={(e) => setForm({ ...form, motivo_recusa: e.target.value })} /></div>
            )}
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
