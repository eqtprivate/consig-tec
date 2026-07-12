import React, { useEffect, useState } from 'react';
import { clientesApi } from '@/lib/api/clientes';
import { conveniosApi } from '@/lib/api/convenios';
import { matriculasApi, elegivelCartaoBeneficio } from '@/lib/api/matriculas';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import Tomador360 from '@/pages/modules/Tomador360';
import { Plus, Pencil, Trash2, IdCard, CreditCard, Eye } from 'lucide-react';

const num = (v) => (v === '' || v == null ? null : Number(v));
const emptyCliente = { nome: '', cpf: '', data_nascimento: '', telefone: '', email: '' };
const emptyMatricula = {
  convenio_id: '', matricula: '', orgao: '', cargo: '', situacao: 'ativo',
  data_admissao: '', salario_bruto: '', margem_bruta: '', margem_utilizada: '', observacao: '',
};

const SITUACAO_LABEL = {
  ativo: 'Ativo', aposentado: 'Aposentado', pensionista: 'Pensionista',
  inativo: 'Inativo', exonerado: 'Exonerado', licenca: 'Licença',
};
const SITUACAO_CHIP = {
  ativo: 'bg-green-50 text-green-700', aposentado: 'bg-blue-50 text-blue-700',
  pensionista: 'bg-blue-50 text-blue-700', inativo: 'bg-slate-100 text-slate-500',
  exonerado: 'bg-red-50 text-red-700', licenca: 'bg-amber-50 text-amber-700',
};

export default function Clientes() {
  const { activeUnidade } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [matriculas, setMatriculas] = useState([]);
  const [loading, setLoading] = useState(true);

  // dialog do tomador
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyCliente);

  // dialog de vínculos
  const [vincOpen, setVincOpen] = useState(false);
  const [vincCliente, setVincCliente] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [matForm, setMatForm] = useState(emptyMatricula);
  const [matEdit, setMatEdit] = useState(null);
  const [matSaving, setMatSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [c, cv, m] = await Promise.all([
      clientesApi.list().catch(() => []),
      conveniosApi.list().catch(() => []),
      matriculasApi.list().catch(() => []),
    ]);
    setClientes(c);
    setConvenios(cv);
    setMatriculas(m);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const matsDe = (clienteId) => matriculas.filter((m) => m.cliente_id === clienteId);
  const margemDisponivelTotal = (clienteId) =>
    matsDe(clienteId).filter((m) => m.ativo).reduce((s, m) => s + Number(m.margem_disponivel || 0), 0);
  const temElegivel = (clienteId) => matsDe(clienteId).some(elegivelCartaoBeneficio);

  // ---- Tomador ----
  const openCreate = () => { setEditItem(null); setForm(emptyCliente); setDialogOpen(true); };
  const openEdit = (c) => {
    setEditItem(c);
    setForm({
      nome: c.nome, cpf: c.cpf, data_nascimento: c.data_nascimento || '',
      telefone: c.telefone || '', email: c.email || '',
    });
    setDialogOpen(true);
  };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      nome: form.nome, cpf: form.cpf,
      data_nascimento: form.data_nascimento || null,
      telefone: form.telefone || null, email: form.email || null,
    };
    if (editItem) {
      await clientesApi.update(editItem.id, payload);
      await auditoriaApi.log('editar_tomador', 'clientes', editItem.id, { nome: form.nome });
    } else {
      await clientesApi.create({ ...payload, franquia_id: activeUnidade?.id || null });
      await auditoriaApi.log('criar_tomador', 'clientes', null, { nome: form.nome });
    }
    setDialogOpen(false);
    load();
  };

  // ---- Vínculos ----
  const openVinculos = (c) => { setVincCliente(c); setMatEdit(null); setMatForm(emptyMatricula); setVincOpen(true); };
  const startNovoVinculo = () => { setMatEdit(null); setMatForm(emptyMatricula); };
  const startEditVinculo = (m) => {
    setMatEdit(m);
    setMatForm({
      convenio_id: m.convenio_id || '', matricula: m.matricula || '', orgao: m.orgao || '',
      cargo: m.cargo || '', situacao: m.situacao || 'ativo', data_admissao: m.data_admissao || '',
      salario_bruto: m.salario_bruto ?? '', margem_bruta: m.margem_bruta ?? '',
      margem_utilizada: m.margem_utilizada ?? '', observacao: m.observacao || '',
    });
  };
  const salvarVinculo = async (e) => {
    e.preventDefault();
    setMatSaving(true);
    try {
      const payload = {
        cliente_id: vincCliente.id,
        convenio_id: matForm.convenio_id || null,
        matricula: matForm.matricula,
        orgao: matForm.orgao || null,
        cargo: matForm.cargo || null,
        situacao: matForm.situacao,
        data_admissao: matForm.data_admissao || null,
        salario_bruto: num(matForm.salario_bruto),
        margem_bruta: num(matForm.margem_bruta),
        margem_utilizada: num(matForm.margem_utilizada) ?? 0,
        observacao: matForm.observacao || null,
      };
      if (matEdit) {
        await matriculasApi.update(matEdit.id, payload);
        await auditoriaApi.log('editar_vinculo', 'matriculas', matEdit.id, { matricula: payload.matricula });
      } else {
        await matriculasApi.create(payload);
        await auditoriaApi.log('criar_vinculo', 'matriculas', null, { cliente_id: vincCliente.id, matricula: payload.matricula });
      }
      // recarrega apenas matrículas
      const m = await matriculasApi.list().catch(() => []);
      setMatriculas(m);
      setMatEdit(null);
      setMatForm(emptyMatricula);
    } catch (err) {
      alert(err.message || 'Não foi possível salvar o vínculo.');
    } finally {
      setMatSaving(false);
    }
  };
  const excluirVinculo = async (m) => {
    if (!confirm(`Excluir o vínculo ${m.matricula}?`)) return;
    await matriculasApi.remove(m.id);
    await auditoriaApi.log('excluir_vinculo', 'matriculas', m.id, { matricula: m.matricula });
    const lista = await matriculasApi.list().catch(() => []);
    setMatriculas(lista);
  };

  const vincMats = vincCliente ? matsDe(vincCliente.id) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Tomadores de crédito consignado — servidores e seus vínculos</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo tomador</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : clientes.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">Nenhum tomador cadastrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">CPF</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500 uppercase text-xs">Vínculos</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Margem apartada</th>
                <th className="text-center px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Cartão benefício</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const mats = matsDe(c.id);
                const elegivel = temElegivel(c.id);
                return (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{c.nome}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-xs">{c.cpf}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openVinculos(c)}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-primary/10 hover:text-primary text-xs font-medium"
                      >
                        <IdCard className="w-3.5 h-3.5" /> {mats.length}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 num hidden sm:table-cell">
                      {mats.length ? brl(margemDisponivelTotal(c.id)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      {elegivel ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                          <CreditCard className="w-3.5 h-3.5" /> Elegível
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button onClick={() => setFicha(c)} title="Ficha 360º" className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openVinculos(c)} title="Vínculos" className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded"><IdCard className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(c)} title="Editar" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialog do tomador */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editItem ? 'Editar tomador' : 'Novo tomador'}</DialogTitle></DialogHeader>
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
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <p className="text-xs text-slate-400">Os vínculos (matrículas, órgão, margem apartada) são gerenciados na tela de Vínculos do tomador.</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">{editItem ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de vínculos */}
      <Dialog open={vincOpen} onOpenChange={setVincOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Vínculos — {vincCliente?.nome}</DialogTitle>
          </DialogHeader>

          {/* Lista de vínculos existentes */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {vincMats.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">Nenhum vínculo cadastrado para este tomador.</p>
            ) : vincMats.map((m) => {
              const eleg = elegivelCartaoBeneficio(m);
              return (
                <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-800">{m.convenio?.nome || 'Sem convênio'}</span>
                      <span className="text-xs text-slate-500 font-mono">#{m.matricula}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${SITUACAO_CHIP[m.situacao]}`}>{SITUACAO_LABEL[m.situacao]}</span>
                      {eleg && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 inline-flex items-center gap-1"><CreditCard className="w-3 h-3" /> Elegível</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {[m.orgao, m.cargo].filter(Boolean).join(' • ') || '—'} · Disponível {brl(m.margem_disponivel)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEditVinculo(m)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => excluirVinculo(m)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Form de vínculo */}
          <form onSubmit={salvarVinculo} className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{matEdit ? 'Editar vínculo' : 'Novo vínculo'}</p>
              {matEdit && <button type="button" onClick={startNovoVinculo} className="text-xs text-primary hover:underline">+ Adicionar outro</button>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5 md:col-span-2">
                <Label>Convênio / Ente</Label>
                <Select value={matForm.convenio_id} onValueChange={(v) => setMatForm({ ...matForm, convenio_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {convenios.map((cv) => <SelectItem key={cv.id} value={cv.id}>{cv.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Matrícula</Label>
                <Input value={matForm.matricula} onChange={(e) => setMatForm({ ...matForm, matricula: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label>Órgão / Lotação</Label>
                <Input value={matForm.orgao} onChange={(e) => setMatForm({ ...matForm, orgao: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Cargo</Label>
                <Input value={matForm.cargo} onChange={(e) => setMatForm({ ...matForm, cargo: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Situação</Label>
                <Select value={matForm.situacao} onValueChange={(v) => setMatForm({ ...matForm, situacao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SITUACAO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Admissão</Label>
                <Input type="date" value={matForm.data_admissao} onChange={(e) => setMatForm({ ...matForm, data_admissao: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Salário bruto</Label>
                <Input type="number" step="0.01" value={matForm.salario_bruto} onChange={(e) => setMatForm({ ...matForm, salario_bruto: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Margem apartada</Label>
                <Input type="number" step="0.01" value={matForm.margem_bruta} onChange={(e) => setMatForm({ ...matForm, margem_bruta: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Margem utilizada</Label>
                <Input type="number" step="0.01" value={matForm.margem_utilizada} onChange={(e) => setMatForm({ ...matForm, margem_utilizada: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              {matEdit && <Button type="button" variant="outline" onClick={startNovoVinculo}>Cancelar edição</Button>}
              <Button type="submit" disabled={matSaving}>{matSaving ? 'Salvando…' : matEdit ? 'Salvar vínculo' : 'Adicionar vínculo'}</Button>
            </div>
          </form>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setVincOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ficha && <Tomador360 cliente={ficha} onClose={() => setFicha(null)} />}
    </div>
  );
}
