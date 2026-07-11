import React, { useEffect, useState } from 'react';
import { areasApi } from '@/lib/api/areas';
import { papeisApi } from '@/lib/api/papeis';
import { auditoriaApi } from '@/lib/api/auditoria';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';

// Tabela genérica de cadastro (código/nome/descrição) reutilizada por Áreas e Papéis.
function CadastroTab({ api, entidade, titulo, descricao, codigoPlaceholder }) {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ codigo: '', nome: '', descricao: '' });

  const load = async () => { setLoading(true); setItens(await api.list().catch(() => [])); setLoading(false); };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEdit(null); setForm({ codigo: '', nome: '', descricao: '' }); setOpen(true); };
  const openEdit = (a) => { setEdit(a); setForm({ codigo: a.codigo, nome: a.nome, descricao: a.descricao || '' }); setOpen(true); };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { codigo: form.codigo, nome: form.nome, descricao: form.descricao || null };
    try {
      if (edit) { await api.update(edit.id, payload); await auditoriaApi.log(`editar_${entidade}`, entidade, edit.id, { nome: form.nome }); }
      else { await api.create(payload); await auditoriaApi.log(`criar_${entidade}`, entidade, null, { nome: form.nome }); }
      setOpen(false); load();
    } catch (err) { alert(err.message || 'Falha ao salvar.'); }
  };
  const handleDelete = async (a) => {
    if (!confirm(`Remover "${a.nome}"? Se estiver em uso por vínculos, a remoção pode falhar.`)) return;
    try { await api.remove(a.id); await auditoriaApi.log(`remover_${entidade}`, entidade, a.id, { nome: a.nome }); load(); }
    catch (err) { alert(err.message || 'Não foi possível remover (provavelmente está em uso).'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{descricao}</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> {titulo}</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : itens.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhum registro.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Código</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Descrição</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{a.codigo}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{a.nome}</td>
                  <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">{a.descricao || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openEdit(a)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(a)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar' : 'Novo'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2"><Label>Código</Label><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder={codigoPlaceholder} required /></div>
            <div className="space-y-2"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} /></div>
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

const TABS = [{ key: 'areas', label: 'Áreas do processo' }, { key: 'papeis', label: 'Papéis (tipos de acesso)' }];
export default function Areas() {
  const [tab, setTab] = useState('areas');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configuração de acesso</h1>
        <p className="text-sm text-slate-500 mt-1">Áreas do processo e papéis (tipos de acesso) usados nos vínculos</p>
      </div>
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'areas'
        ? <CadastroTab api={areasApi} entidade="area" titulo="Nova área" descricao="Áreas/etapas do processo de crédito consignado" codigoPlaceholder="ex: convenios" />
        : <CadastroTab api={papeisApi} entidade="papel" titulo="Novo papel" descricao="Papéis atribuídos aos usuários nos vínculos (ex.: gestor, operador, corban)" codigoPlaceholder="ex: gestor" />}
    </div>
  );
}
