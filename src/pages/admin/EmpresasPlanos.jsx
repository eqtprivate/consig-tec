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
import { Building2, Plus, Pencil, Package, ShieldAlert, Trash2, Archive, ArchiveRestore } from 'lucide-react';

// Segmento comercial do cliente (informativo) — organiza a carteira de tenants.
const SEGMENTOS = ['Correspondente', 'Promotora', 'Financeira', 'Banco', 'Cooperativa', 'Securitizadora/FIDC', 'Outro'];
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
  const [form, setForm] = useState({ nome: '', cnpj: '', segmento: '', plano_id: '', ativo: true });
  const [planoOpen, setPlanoOpen] = useState(false);
  const [planoEdit, setPlanoEdit] = useState(null);
  const [planoForm, setPlanoForm] = useState(null);

  const load = async () => {
    setLoading(true);
    const [e, p] = await Promise.all([empresasApi.list().catch(() => []), planosApi.list().catch(() => [])]);
    setEmpresas(e); setPlanos(p); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEdit(null); setForm({ nome: '', cnpj: '', segmento: '', plano_id: '', ativo: true }); setOpen(true); };
  const openEdit = (e) => { setEdit(e); setForm({ nome: e.nome, cnpj: e.cnpj || '', segmento: e.segmento || '', plano_id: e.plano_id || '', ativo: e.ativo }); setOpen(true); };

  const AREAS = ['convenios', 'crm', 'averbacao', 'formalizacao', 'financeiro', 'comissoes', 'cobranca', 'cessao_fidc', 'juridico', 'suporte'];
  const nn = (v) => (v === '' || v == null ? null : Number(v));
  const openEditPlano = (p) => {
    const todos = (p.modulos || []).includes('*');
    setPlanoEdit(p);
    setPlanoForm({
      nome: p.nome || '', descricao: p.descricao || '', preco_mensal: p.preco_mensal ?? '',
      limite_usuarios: p.limite_usuarios ?? '', limite_convenios: p.limite_convenios ?? '', limite_propostas_mes: p.limite_propostas_mes ?? '',
      limite_leituras_ccb_mes: p.limite_leituras_ccb_mes ?? '', limite_documentos: p.limite_documentos ?? '', limite_armazenamento_mb: p.limite_armazenamento_mb ?? '',
      modulos: todos ? [] : (p.modulos || []), todos, ativo: p.ativo,
    });
    setPlanoOpen(true);
  };
  const toggleMod = (m) => setPlanoForm((s) => ({ ...s, modulos: s.modulos.includes(m) ? s.modulos.filter((x) => x !== m) : [...s.modulos, m] }));
  const savePlano = async (ev) => {
    ev.preventDefault();
    const f = planoForm;
    const payload = {
      nome: f.nome, descricao: f.descricao || null, preco_mensal: nn(f.preco_mensal),
      limite_usuarios: nn(f.limite_usuarios), limite_convenios: nn(f.limite_convenios), limite_propostas_mes: nn(f.limite_propostas_mes),
      limite_leituras_ccb_mes: nn(f.limite_leituras_ccb_mes), limite_documentos: nn(f.limite_documentos), limite_armazenamento_mb: nn(f.limite_armazenamento_mb),
      modulos: f.todos ? ['*'] : f.modulos, ativo: f.ativo,
    };
    try {
      await planosApi.update(planoEdit.id, payload);
      await auditoriaApi.log('editar_plano', 'planos', planoEdit.id, { nome: f.nome });
      toast.success('Plano salvo.');
      setPlanoOpen(false); load();
    } catch (err) { toast.error(err.message || 'Falha ao salvar (apenas superadmin).'); }
  };

  const save = async (ev) => {
    ev.preventDefault();
    const payload = {
      nome: form.nome, cnpj: form.cnpj || null, segmento: form.segmento || null, ativo: form.ativo,
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

  // Arquivar/reativar (soft, reversível) — seguro para empresas com dados.
  const toggleAtivo = async (e) => {
    try {
      await empresasApi.arquivar(e.id, !e.ativo);
      await auditoriaApi.log(e.ativo ? 'arquivar_empresa' : 'reativar_empresa', 'empresas', e.id, { nome: e.nome });
      toast.success(e.ativo ? 'Empresa arquivada.' : 'Empresa reativada.');
      load();
    } catch (err) { toast.error(err.message || 'Falha ao atualizar a empresa.'); }
  };

  // Excluir definitivamente — só empresas vazias; a RPC bloqueia se houver dados.
  const excluir = async (e) => {
    if (!window.confirm(`Excluir DEFINITIVAMENTE a empresa "${e.nome}"? Só funciona se ela não tiver nenhum dado vinculado. Para empresas com dados, use Arquivar.`)) return;
    try {
      const r = await empresasApi.remove(e.id);
      if (r && r.ok === false) { toast.error(`${r.motivo} (${r.detalhes || r.total})`); return; }
      await auditoriaApi.log('excluir_empresa', 'empresas', e.id, { nome: e.nome });
      toast.success('Empresa excluída.');
      load();
    } catch (err) { toast.error(err.message || 'Falha ao excluir a empresa.'); }
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
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.nome}</p>
                  <p className="text-[11px] text-muted-foreground mb-2">{p.descricao}</p>
                </div>
                <button onClick={() => openEditPlano(p)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded shrink-0" title="Editar plano"><Pencil className="w-4 h-4" /></button>
              </div>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>Usuários: <b>{lim(p.limite_usuarios)}</b></li>
                <li>Convênios: <b>{lim(p.limite_convenios)}</b></li>
                <li>Propostas/mês: <b>{lim(p.limite_propostas_mes)}</b></li>
                <li>Leituras CCB/mês: <b>{lim(p.limite_leituras_ccb_mes)}</b></li>
                <li>Documentos: <b>{lim(p.limite_documentos)}</b></li>
                <li>Armazenamento: <b>{p.limite_armazenamento_mb == null ? '∞' : `${p.limite_armazenamento_mb} MB`}</b></li>
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Segmento</th>
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
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{e.segmento || '—'}</td>
                  <td className="px-4 py-3">
                    {e.plano ? <StatusBadge className="bg-primary/10 text-primary">{e.plano.nome}</StatusBadge>
                      : <span className="text-xs text-amber-600">sem plano</span>}
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs ${e.ativo ? 'text-green-700' : 'text-muted-foreground'}`}>{e.ativo ? 'Ativa' : 'Inativa'}</span></td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(e)} title="Editar" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => toggleAtivo(e)} title={e.ativo ? 'Arquivar (desativar)' : 'Reativar'} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded">{e.ativo ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}</button>
                    <button onClick={() => excluir(e)} title="Excluir definitivamente" className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-muted rounded"><Trash2 className="w-4 h-4" /></button>
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
                <Label>Segmento</Label>
                <Select value={form.segmento} onValueChange={(v) => setForm({ ...form, segmento: v })}>
                  <SelectTrigger><SelectValue placeholder="Classificação do cliente" /></SelectTrigger>
                  <SelectContent>{SEGMENTOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
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

      <Dialog open={planoOpen} onOpenChange={setPlanoOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar plano {planoEdit?.nome}</DialogTitle></DialogHeader>
          {planoForm && (
            <form onSubmit={savePlano} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label>Nome</Label><Input value={planoForm.nome} onChange={(e) => setPlanoForm({ ...planoForm, nome: e.target.value })} required /></div>
                <div className="space-y-2"><Label>Preço mensal (R$)</Label><Input type="number" step="0.01" value={planoForm.preco_mensal} onChange={(e) => setPlanoForm({ ...planoForm, preco_mensal: e.target.value })} /></div>
              </div>
              <div className="space-y-2"><Label>Descrição</Label><Input value={planoForm.descricao} onChange={(e) => setPlanoForm({ ...planoForm, descricao: e.target.value })} /></div>
              <p className="text-[11px] text-muted-foreground">Limites — deixe <b>vazio</b> para ilimitado (∞).</p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ['limite_usuarios', 'Usuários'], ['limite_convenios', 'Convênios'], ['limite_propostas_mes', 'Propostas/mês'],
                  ['limite_leituras_ccb_mes', 'Leituras CCB/mês'], ['limite_documentos', 'Documentos'], ['limite_armazenamento_mb', 'Armazenam. (MB)'],
                ].map(([k, label]) => (
                  <div key={k} className="space-y-1"><Label className="text-xs">{label}</Label><Input type="number" min="0" value={planoForm[k]} onChange={(e) => setPlanoForm({ ...planoForm, [k]: e.target.value })} placeholder="∞" /></div>
                ))}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Módulos liberados</Label>
                  <label className="flex items-center gap-1.5 text-xs"><Switch checked={planoForm.todos} onCheckedChange={(v) => setPlanoForm({ ...planoForm, todos: v })} /> Todos</label>
                </div>
                {!planoForm.todos && (
                  <div className="flex flex-wrap gap-1.5">
                    {AREAS.map((m) => (
                      <button type="button" key={m} onClick={() => toggleMod(m)} className={`text-[11px] px-2 py-1 rounded border ${planoForm.modulos.includes(m) ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-muted border-border text-muted-foreground'}`}>{AREAS_LABEL[m] || m}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between"><Label>Plano ativo</Label><Switch checked={planoForm.ativo} onCheckedChange={(v) => setPlanoForm({ ...planoForm, ativo: v })} /></div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPlanoOpen(false)}>Cancelar</Button>
                <Button type="submit">Salvar plano</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
