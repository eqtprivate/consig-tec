import React, { useEffect, useState } from 'react';
import { campanhasApi } from '@/lib/api/crm';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { dataBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader, EmptyState } from '@/components/kit';
import { Plus, Pencil, Megaphone } from 'lucide-react';

const emptyForm = { nome: '', canal: '', data_inicio: '', data_fim: '', meta_leads: '', meta_valor: '', ativo: true, descricao: '' };
const num = (v) => (v === '' || v == null ? null : Number(v));

export default function Campanhas() {
  const { activeUnidade } = useAuth();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    setItens(await campanhasApi.list(activeUnidade ? { franquia_id: activeUnidade.id } : {}).catch(() => []));
    setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const openCreate = () => { setEdit(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (c) => {
    setEdit(c);
    setForm({ nome: c.nome, canal: c.canal || '', data_inicio: c.data_inicio || '', data_fim: c.data_fim || '', meta_leads: c.meta_leads ?? '', meta_valor: c.meta_valor ?? '', ativo: c.ativo, descricao: c.descricao || '' });
    setOpen(true);
  };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { nome: form.nome, canal: form.canal || null, data_inicio: form.data_inicio || null, data_fim: form.data_fim || null, meta_leads: num(form.meta_leads), meta_valor: num(form.meta_valor), ativo: form.ativo, descricao: form.descricao || null };
    try {
      if (edit) { await campanhasApi.update(edit.id, payload); await auditoriaApi.log('editar_campanha', 'campanhas', edit.id, {}); }
      else { await campanhasApi.create({ ...payload, franquia_id: activeUnidade?.id || null }); await auditoriaApi.log('criar_campanha', 'campanhas', null, {}); }
      setOpen(false); load();
    } catch (err) { alert(err.message || 'Falha ao salvar campanha.'); }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Campanhas"
        subtitle="Campanhas de originação e metas"
        actions={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova campanha</Button>}
      />
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? <EmptyState title="Carregando…" />
        : itens.length === 0 ? <EmptyState icon={Megaphone} title="Nenhuma campanha." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Canal</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">Meta leads</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden lg:table-cell">Período</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ativa</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{c.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{c.canal || '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell num">{c.meta_leads ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell text-xs">{dataBR(c.data_inicio)}{c.data_fim ? ` – ${dataBR(c.data_fim)}` : ''}</td>
                  <td className="px-4 py-3">{c.ativo ? <span className="text-xs text-green-700">Sim</span> : <span className="text-xs text-muted-foreground">Não</span>}</td>
                  <td className="px-4 py-3 text-right"><button onClick={() => openEdit(c)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded"><Pencil className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar campanha' : 'Nova campanha'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Canal</Label><Input value={form.canal} onChange={(e) => setForm({ ...form, canal: e.target.value })} placeholder="whatsapp, telemarketing..." /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div className="space-y-2"><Label>Fim</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Meta de leads</Label><Input type="number" value={form.meta_leads} onChange={(e) => setForm({ ...form, meta_leads: e.target.value })} /></div>
              <div className="space-y-2"><Label>Meta de valor</Label><Input type="number" step="0.01" value={form.meta_valor} onChange={(e) => setForm({ ...form, meta_valor: e.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between"><Label htmlFor="ativa">Campanha ativa</Label><Switch id="ativa" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /></div>
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
