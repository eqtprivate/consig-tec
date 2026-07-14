import React, { useEffect, useMemo, useState } from 'react';
import { averbadorasApi } from '@/lib/api/conciliacao';
import { conveniosApi } from '@/lib/api/convenios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { EmptyState, StatusBadge } from '@/components/kit';
import { Plus, Pencil, Trash2, Building2, Link2 } from 'lucide-react';

const INTEG = { manual: 'Manual', rpa: 'RPA (robô)', api: 'API/WS', ftp: 'FTP' };
const INTEG_COR = { manual: 'bg-muted text-muted-foreground', rpa: 'bg-violet-50 text-violet-700', api: 'bg-blue-50 text-blue-700', ftp: 'bg-amber-50 text-amber-700' };
const empty = { nome: '', cnpj: '', portal_url: '', tipo_integracao: 'manual', dia_retorno: '', dia_previa: '', contato: '', observacao: '', ativo: true };

export default function Averbadoras() {
  const [itens, setItens] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty);
  const [vinc, setVinc] = useState([]); // convenio ids marcados

  const load = async () => {
    setLoading(true);
    const [a, c] = await Promise.all([averbadorasApi.list().catch(() => []), conveniosApi.list().catch(() => [])]);
    setItens(a); setConvenios(c); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const countConv = useMemo(() => {
    const m = {}; convenios.forEach((c) => { if (c.averbadora_id) m[c.averbadora_id] = (m[c.averbadora_id] || 0) + 1; });
    return m;
  }, [convenios]);

  const openCreate = () => { setEdit(null); setForm(empty); setVinc([]); setOpen(true); };
  const openEdit = (a) => {
    setEdit(a);
    setForm({ nome: a.nome, cnpj: a.cnpj || '', portal_url: a.portal_url || '', tipo_integracao: a.tipo_integracao || 'manual',
      dia_retorno: a.dia_retorno ?? '', dia_previa: a.dia_previa ?? '', contato: a.contato || '', observacao: a.observacao || '', ativo: a.ativo });
    setVinc(convenios.filter((c) => c.averbadora_id === a.id).map((c) => c.id));
    setOpen(true);
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.nome.trim()) { toast.error('Informe o nome.'); return; }
    const payload = {
      nome: form.nome.trim(), cnpj: form.cnpj || null, portal_url: form.portal_url || null,
      tipo_integracao: form.tipo_integracao, dia_retorno: form.dia_retorno ? Number(form.dia_retorno) : null,
      dia_previa: form.dia_previa ? Number(form.dia_previa) : null, contato: form.contato || null,
      observacao: form.observacao || null, ativo: form.ativo,
    };
    try {
      let alvo = edit;
      if (edit) { await averbadorasApi.update(edit.id, payload); }
      else { alvo = await averbadorasApi.create(payload); }
      // reconcilia vínculos de convênios
      const antes = convenios.filter((c) => c.averbadora_id === alvo.id).map((c) => c.id);
      const adicionar = vinc.filter((id) => !antes.includes(id));
      const remover = antes.filter((id) => !vinc.includes(id));
      if (adicionar.length) await averbadorasApi.vincularConvenios(alvo.id, adicionar);
      for (const id of remover) await averbadorasApi.desvincular(id);
      await auditoriaApi.log(edit ? 'editar_averbadora' : 'criar_averbadora', 'averbadoras', alvo.id, { nome: payload.nome });
      setOpen(false); load();
    } catch (err) { toast.error(err.message || 'Falha ao salvar.'); }
  };

  const remover = async (a) => {
    if (!(await confirmar({ title: 'Remover averbadora', description: `Remover "${a.nome}"? Os convênios ficam sem averbadora.`, destructive: true, confirmText: 'Remover' }))) return;
    try { await averbadorasApi.remove(a.id); load(); } catch (err) { toast.error(err.message); }
  };

  const toggleVinc = (id) => setVinc((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Averbadoras (empregadores/portais) — parametrização, tipo de integração e convênios vinculados.</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova averbadora</Button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? <EmptyState title="Carregando…" />
        : itens.length === 0 ? <EmptyState icon={Building2} title="Nenhuma averbadora." description="Cadastre a empresa averbadora e vincule seus convênios." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Averbadora</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Integração</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Dia retorno/prévia</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Convênios</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((a) => (
                <tr key={a.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3"><p className="font-medium text-foreground">{a.nome}</p><p className="text-[11px] text-muted-foreground">{a.portal_url || a.cnpj || '—'}</p></td>
                  <td className="px-4 py-3"><StatusBadge className={INTEG_COR[a.tipo_integracao]}>{INTEG[a.tipo_integracao]}</StatusBadge></td>
                  <td className="px-4 py-3 text-right text-muted-foreground num hidden sm:table-cell">{a.dia_retorno || '—'} / {a.dia_previa || '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground num">{countConv[a.id] || 0}</td>
                  <td className="px-4 py-3"><span className={`text-xs ${a.ativo ? 'text-green-700' : 'text-muted-foreground'}`}>{a.ativo ? 'Ativa' : 'Inativa'}</span></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(a)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded inline-flex"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => remover(a)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded inline-flex"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit ? 'Editar averbadora' : 'Nova averbadora'}</DialogTitle></DialogHeader>
          <form onSubmit={salvar} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Portal (URL)</Label><Input value={form.portal_url} onChange={(e) => setForm({ ...form, portal_url: e.target.value })} placeholder="https://…" /></div>
              <div className="space-y-1.5">
                <Label>Tipo de integração</Label>
                <Select value={form.tipo_integracao} onValueChange={(v) => setForm({ ...form, tipo_integracao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(INTEG).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5"><Label>Dia retorno</Label><Input type="number" min="1" max="31" value={form.dia_retorno} onChange={(e) => setForm({ ...form, dia_retorno: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Dia prévia</Label><Input type="number" min="1" max="31" value={form.dia_previa} onChange={(e) => setForm({ ...form, dia_previa: e.target.value })} /></div>
              <div className="space-y-1.5 col-span-2"><Label>Contato</Label><Input value={form.contato} onChange={(e) => setForm({ ...form, contato: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>Observação</Label><Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Convênios vinculados ({vinc.length})</Label>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                {convenios.length === 0 ? <p className="text-xs text-muted-foreground p-1">Nenhum convênio.</p>
                  : convenios.map((c) => {
                    const outra = c.averbadora_id && (!edit || c.averbadora_id !== edit.id);
                    return (
                      <label key={c.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${outra ? 'opacity-50' : 'hover:bg-muted'}`}>
                        <input type="checkbox" checked={vinc.includes(c.id)} onChange={() => toggleVinc(c.id)} />
                        <span className="truncate">{c.nome}{outra ? ' (outra averbadora)' : ''}</span>
                      </label>
                    );
                  })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} /> Ativa</label>
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
