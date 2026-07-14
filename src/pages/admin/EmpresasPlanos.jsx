import React, { useEffect, useState } from 'react';
import { empresasApi, planosApi } from '@/lib/api/tenant';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader, Panel, StatusBadge, EmptyState } from '@/components/kit';
import { Building2, Plus, Pencil, Package, ShieldAlert } from 'lucide-react';

const TIPOS = { grupo: 'Grupo', originadora: 'Originadora', franqueadora: 'Franqueadora', investidor: 'Investidor', operacional: 'Operacional' };
const AREAS_LABEL = {
  convenios: 'Convênios', crm: 'CRM/Vendas', averbacao: 'Averbação', formalizacao: 'Formalização',
  financeiro: 'Financeiro', comissoes: 'Comissões', cobranca: 'Cobrança', cessao_fidc: 'Cessão/FIDC',
  juridico: 'Jurídico', suporte: 'Suporte', admin: 'Administração',
};
const lim = (v) => (v == null ? '∞' : v.toLocaleString('pt-BR'));

export default function EmpresasPlanos() {
  const { isSuperadmin } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ nome: '', cnpj: '', tipo: 'operacional', plano_id: '', ativo: true });

  const load = async () => {
    setLoading(true);
    const [e, p] = await Promise.all([empresasApi.list().catch(() => []), planosApi.list().catch(() => [])]);
    setEmpresas(e); setPlanos(p); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEdit(null); setForm({ nome: '', cnpj: '', tipo: 'operacional', plano_id: '', ativo: true }); setOpen(true); };
  const openEdit = (e) => { setEdit(e); setForm({ nome: e.nome, cnpj: e.cnpj || '', tipo: e.tipo, plano_id: e.plano_id || '', ativo: e.ativo }); setOpen(true); };

  const save = async (ev) => {
    ev.preventDefault();
    const payload = {
      nome: form.nome, cnpj: form.cnpj || null, tipo: form.tipo, ativo: form.ativo,
      plano_id: form.plano_id || null,
      plano_desde: form.plano_id ? (edit?.plano_desde || new Date().toISOString().slice(0, 10)) : null,
    };
    try {
      if (edit) { await empresasApi.update(edit.id, payload); await auditoriaApi.log('editar_empresa', 'empresas', edit.id, { nome: form.nome, plano_id: form.plano_id }); }
      else { await empresasApi.create(payload); await auditoriaApi.log('criar_empresa', 'empresas', null, { nome: form.nome }); }
      toast.success('Empresa salva.');
      setOpen(false); load();
    } catch (err) { toast.error(err.message || 'Falha ao salvar (apenas superadmin).'); }
  };

  if (!isSuperadmin) {
    return (
      <div className="p-12 text-center">
        <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Gestão de empresas e planos é restrita a superadministradores.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas & Planos"
        subtitle="Clientes da CONSIGTEC (tenants) e seus planos de acesso."
        actions={<Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova empresa</Button>}
      />

      {/* Planos (catálogo) */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2"><Package className="w-4 h-4 text-primary" /> Planos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {planos.map((p) => (
            <Panel key={p.id}>
              <p className="text-sm font-semibold text-foreground">{p.nome}</p>
              <p className="text-[11px] text-muted-foreground mb-2">{p.descricao}</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>Usuários: <b>{lim(p.limite_usuarios)}</b></li>
                <li>Convênios: <b>{lim(p.limite_convenios)}</b></li>
                <li>Propostas/mês: <b>{lim(p.limite_propostas_mes)}</b></li>
              </ul>
              <div className="mt-2 flex flex-wrap gap-1">
                {(p.modulos || []).includes('*')
                  ? <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">Todos os módulos</span>
                  : (p.modulos || []).map((m) => <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{AREAS_LABEL[m] || m}</span>)}
              </div>
            </Panel>
          ))}
        </div>
      </div>

      {/* Empresas */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? <EmptyState title="Carregando…" />
        : empresas.length === 0 ? <EmptyState title="Nenhuma empresa." />
        : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Empresa</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Plano</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {empresas.map((e) => (
                <tr key={e.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Building2 className="w-4 h-4" /></span>
                      <div><p className="font-medium text-foreground">{e.nome}</p><p className="text-[11px] text-muted-foreground">{e.cnpj || '—'}</p></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{TIPOS[e.tipo] || e.tipo}</td>
                  <td className="px-4 py-3">
                    {e.plano ? <StatusBadge className="bg-primary/10 text-primary">{e.plano.nome}</StatusBadge>
                      : <span className="text-xs text-amber-600">sem plano</span>}
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs ${e.ativo ? 'text-green-700' : 'text-muted-foreground'}`}>{e.ativo ? 'Ativa' : 'Inativa'}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(e)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Pencil className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit ? 'Editar empresa' : 'Nova empresa'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2"><Label>Nome</Label><Input value={form.nome} onChange={(ev) => setForm({ ...form, nome: ev.target.value })} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>CNPJ</Label><Input value={form.cnpj} onChange={(ev) => setForm({ ...form, cnpj: ev.target.value })} /></div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TIPOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Plano de acesso</Label>
              <Select value={form.plano_id} onValueChange={(v) => setForm({ ...form, plano_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
                <SelectContent>{planos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="e-ativo">Empresa ativa</Label>
              <Switch id="e-ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
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
