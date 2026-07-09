import React, { useEffect, useState } from 'react';
import { clientesApi } from '@/lib/api/clientes';
import { conveniosApi } from '@/lib/api/convenios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil } from 'lucide-react';

const emptyForm = { nome: '', cpf: '', data_nascimento: '', telefone: '', email: '', matricula: '', convenio_id: '', margem_disponivel: '' };
const num = (v) => (v === '' || v == null ? null : Number(v));

export default function Clientes() {
  const { activeUnidade } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    const [c, cv] = await Promise.all([
      clientesApi.list().catch(() => []),
      conveniosApi.list().catch(() => []),
    ]);
    setClientes(c);
    setConvenios(cv);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c) => {
    setEditItem(c);
    setForm({
      nome: c.nome, cpf: c.cpf, data_nascimento: c.data_nascimento || '', telefone: c.telefone || '',
      email: c.email || '', matricula: c.matricula || '', convenio_id: c.convenio_id || '',
      margem_disponivel: c.margem_disponivel ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      nome: form.nome, cpf: form.cpf,
      data_nascimento: form.data_nascimento || null, telefone: form.telefone || null,
      email: form.email || null, matricula: form.matricula || null,
      convenio_id: form.convenio_id || null, margem_disponivel: num(form.margem_disponivel),
    };
    if (editItem) {
      await clientesApi.update(editItem.id, payload);
      await auditoriaApi.log('editar_cliente', 'clientes', editItem.id, { nome: form.nome });
    } else {
      await clientesApi.create({ ...payload, franquia_id: activeUnidade?.id || null });
      await auditoriaApi.log('criar_cliente', 'clientes', null, { nome: form.nome });
    }
    setDialogOpen(false);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Tomadores de crédito consignado</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo cliente</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : clientes.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">Nenhum cliente cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">CPF</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Convênio</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Telefone</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Margem</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.nome}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{c.cpf}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{c.convenio?.nome || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">{c.telefone || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden sm:table-cell">
                    {c.margem_disponivel != null ? c.margem_disponivel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(c)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Editar cliente' : 'Novo cliente'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} required disabled={!!editItem} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de nascimento</Label>
                <Input type="date" value={form.data_nascimento} onChange={(e) => setForm({ ...form, data_nascimento: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Matrícula</Label>
                <Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Convênio</Label>
                <Select value={form.convenio_id} onValueChange={(v) => setForm({ ...form, convenio_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {convenios.map((cv) => <SelectItem key={cv.id} value={cv.id}>{cv.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Margem disponível</Label>
                <Input type="number" step="0.01" value={form.margem_disponivel} onChange={(e) => setForm({ ...form, margem_disponivel: e.target.value })} />
              </div>
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
