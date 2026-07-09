import React, { useEffect, useState } from 'react';
import { conveniosApi } from '@/lib/api/convenios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const TIPOS = { publico: 'Público', privado: 'Privado', inss: 'INSS', militar: 'Militar' };
const emptyForm = { nome: '', orgao: '', tipo: 'privado', margem_consignavel: '', taxa_mensal: '', prazo_maximo: '', ativo: true };

const num = (v) => (v === '' || v == null ? null : Number(v));

export default function Convenios() {
  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    setConvenios(await conveniosApi.list().catch(() => []));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c) => {
    setEditItem(c);
    setForm({
      nome: c.nome, orgao: c.orgao || '', tipo: c.tipo,
      margem_consignavel: c.margem_consignavel ?? '', taxa_mensal: c.taxa_mensal ?? '',
      prazo_maximo: c.prazo_maximo ?? '', ativo: c.ativo,
    });
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      nome: form.nome, orgao: form.orgao || null, tipo: form.tipo,
      margem_consignavel: num(form.margem_consignavel), taxa_mensal: num(form.taxa_mensal),
      prazo_maximo: num(form.prazo_maximo), ativo: form.ativo,
    };
    if (editItem) {
      await conveniosApi.update(editItem.id, payload);
      await auditoriaApi.log('editar_convenio', 'convenios', editItem.id, { nome: form.nome });
    } else {
      await conveniosApi.create(payload);
      await auditoriaApi.log('criar_convenio', 'convenios', null, { nome: form.nome });
    }
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (c) => {
    if (!confirm(`Remover o convênio "${c.nome}"?`)) return;
    await conveniosApi.remove(c.id);
    await auditoriaApi.log('remover_convenio', 'convenios', c.id, { nome: c.nome });
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Convênios e parcerias para consignação</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo convênio</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : convenios.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">Nenhum convênio cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Órgão</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Tipo</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Margem</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Taxa a.m.</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Prazo máx.</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {convenios.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.nome}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{c.orgao || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{TIPOS[c.tipo] || c.tipo}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden lg:table-cell">{c.margem_consignavel != null ? `${c.margem_consignavel}%` : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden lg:table-cell">{c.taxa_mensal != null ? `${c.taxa_mensal}%` : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden sm:table-cell">{c.prazo_maximo != null ? `${c.prazo_maximo}x` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${c.ativo ? 'text-green-700' : 'text-slate-400'}`}>{c.ativo ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(c)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Editar convênio' : 'Novo convênio'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Órgão</Label>
                <Input value={form.orgao} onChange={(e) => setForm({ ...form, orgao: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Margem %</Label>
                <Input type="number" step="0.01" value={form.margem_consignavel} onChange={(e) => setForm({ ...form, margem_consignavel: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Taxa a.m. %</Label>
                <Input type="number" step="0.0001" value={form.taxa_mensal} onChange={(e) => setForm({ ...form, taxa_mensal: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Prazo máx.</Label>
                <Input type="number" value={form.prazo_maximo} onChange={(e) => setForm({ ...form, prazo_maximo: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="c-ativo">Convênio ativo</Label>
              <Switch id="c-ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editItem ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
