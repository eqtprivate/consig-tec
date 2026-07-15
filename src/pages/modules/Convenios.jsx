import React, { useEffect, useState } from 'react';
import { conveniosApi } from '@/lib/api/convenios';
import { entidadesApi } from '@/lib/api/entidades';
import { overlayApi } from '@/lib/api/overlay';
import { produtosConvenioApi } from '@/lib/api/produtosConvenio';
import { auditoriaApi } from '@/lib/api/auditoria';
import { importarConveniosCSV } from '@/lib/pixconsigImport';
import { importarConveniosPixconsigJSON } from '@/lib/pixconsigApiImport';
import { importarBaseMargemCSV } from '@/lib/margemImport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Upload, Package, Wallet, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirm';
import Tip from '@/components/Tip';
import { useSortable, sortRows, SortTh, norm } from '@/lib/table';
import { EmptyState } from '@/components/kit';

const TIPOS = { publico: 'Público', privado: 'Privado', inss: 'INSS', militar: 'Militar' };
const MARGENS = { apartada: 'Apartada', principal: 'Principal', cartao: 'Cartão' };
const PRODUTOS = {
  cartao_beneficio: 'Cartão Benefício', consignado: 'Consignado',
  cartao_credito: 'Cartão de Crédito', saque_complementar: 'Saque Complementar',
};
const emptyProd = {
  produto: 'cartao_beneficio', nome: '', tipo_margem: 'cartao', taxa_mensal: '',
  prazo_min: '', prazo_max: '', valor_min: '', valor_max: '', idade_min: '', idade_max: '',
  margem_percentual: '', rotativo: true, saque_vinculado: true, ativo: true,
};
const ORIGENS = { manual: 'Manual', csv: 'CSV', pixconsig: 'PixConsig' };
const ORIGEM_CORES = { manual: 'bg-muted text-muted-foreground', csv: 'bg-amber-50 text-amber-700', pixconsig: 'bg-blue-50 text-blue-700' };

const emptyForm = {
  nome: '', cidade: '', uf: '', cnpj: '', tipo: 'publico', tipo_margem: 'cartao',
  percentual_margem_apartada: '', taxa_mensal: '', prazo_maximo: '', ativo: true,
  idade_minima: '', idade_maxima_fim: '', teto_parcelas: '', max_contratos_servidor: '', prioridade_desconto: '',
  comissao_prefeitura: '', spread: '', habilitado_canal: false,
  rateio_canal: '', rateio_franquia: '', rateio_lider: '', rateio_corban: '', rateio_operador: '',
};
const num = (v) => (v === '' || v == null ? null : Number(v));
const ov1 = (c) => (Array.isArray(c.overlay) ? c.overlay[0] : c.overlay) || null;

export default function Convenios() {
  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);

  // Busca + filtros + ordenação
  const [busca, setBusca] = useState('');
  const [fTipo, setFTipo] = useState('todos');
  const [fOrigem, setFOrigem] = useState('todos');
  const [fStatus, setFStatus] = useState('todos');
  const { sort, toggle } = useSortable('nome', 'asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [importOpen, setImportOpen] = useState(false);
  const [importFmt, setImportFmt] = useState('csv');
  const [csv, setCsv] = useState('');
  const [importing, setImporting] = useState(false);
  const [importRes, setImportRes] = useState(null);

  // Atualização da base de margem
  const [margemOpen, setMargemOpen] = useState(false);
  const [margemConv, setMargemConv] = useState('');
  const [margemCsv, setMargemCsv] = useState('');
  const [margemBusy, setMargemBusy] = useState(false);
  const [margemRes, setMargemRes] = useState(null);

  // Produtos por convênio
  const [prodOpen, setProdOpen] = useState(false);
  const [prodConv, setProdConv] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [prodEdit, setProdEdit] = useState(null);
  const [prodForm, setProdForm] = useState(emptyProd);
  const [prodFormOpen, setProdFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setConvenios(await conveniosApi.list().catch(() => []));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const cidadeDe = (c) => c.entidade?.cidade || c.orgao || '';
  const ufDe = (c) => c.entidade?.uf || '';
  const view = React.useMemo(() => {
    const q = norm(busca.trim());
    let v = convenios.filter((c) => {
      if (fTipo !== 'todos' && c.tipo !== fTipo) return false;
      if (fOrigem !== 'todos' && (c.origem_dado || 'manual') !== fOrigem) return false;
      if (fStatus === 'ativo' && !c.ativo) return false;
      if (fStatus === 'inativo' && c.ativo) return false;
      if (q) {
        const alvo = norm([c.nome, cidadeDe(c), ufDe(c), c.entidade?.cnpj].filter(Boolean).join(' '));
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
    return sortRows(v, sort, {
      nome: (c) => c.nome,
      cidade: (c) => `${cidadeDe(c)}/${ufDe(c)}`,
      margem: (c) => MARGENS[c.tipo_margem] || '',
      apartada: (c) => (c.percentual_margem_apartada != null ? Number(c.percentual_margem_apartada) : null),
      origem: (c) => ORIGENS[c.origem_dado] || 'Manual',
      status: (c) => !!c.ativo,
    });
  }, [convenios, busca, fTipo, fOrigem, fStatus, sort]);
  const temFiltro = busca || fTipo !== 'todos' || fOrigem !== 'todos' || fStatus !== 'todos';
  const limparFiltros = () => { setBusca(''); setFTipo('todos'); setFOrigem('todos'); setFStatus('todos'); };

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (c) => {
    setEditItem(c);
    const ov = ov1(c);
    const rat = ov?.rateio || {};
    setForm({
      nome: c.nome, cidade: c.entidade?.cidade || c.orgao || '', uf: c.entidade?.uf || '', cnpj: c.entidade?.cnpj || '',
      tipo: c.tipo, tipo_margem: c.tipo_margem || 'cartao',
      percentual_margem_apartada: c.percentual_margem_apartada ?? '', taxa_mensal: c.taxa_mensal ?? '',
      prazo_maximo: c.prazo_maximo ?? '', ativo: c.ativo,
      idade_minima: c.idade_minima ?? '', idade_maxima_fim: c.idade_maxima_fim ?? '', teto_parcelas: c.teto_parcelas ?? '',
      max_contratos_servidor: c.max_contratos_servidor ?? '', prioridade_desconto: c.prioridade_desconto ?? '',
      comissao_prefeitura: ov?.comissao_prefeitura ?? '', spread: ov?.spread ?? '', habilitado_canal: ov?.habilitado_canal || false,
      rateio_canal: rat.canal ?? '', rateio_franquia: rat.franquia ?? '', rateio_lider: rat.lider ?? '',
      rateio_corban: rat.corban ?? '', rateio_operador: rat.operador ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // Entidade (espelho) — cria/atualiza quando há cidade/cnpj
    let entidadeId = editItem?.entidade_id || null;
    if (form.cidade || form.cnpj) {
      const entPayload = { nome: form.nome, cnpj: form.cnpj || null, cidade: form.cidade || null, uf: form.uf || null };
      const achado = await entidadesApi.encontrar({ cnpj: form.cnpj || null, nome: form.nome, cidade: form.cidade || null, uf: form.uf || null });
      entidadeId = achado || entidadeId;
      if (entidadeId) await entidadesApi.update(entidadeId, entPayload);
      else entidadeId = (await entidadesApi.create({ ...entPayload, origem_dado: 'manual' })).id;
    }
    const payload = {
      nome: form.nome, orgao: form.cidade || null, tipo: form.tipo, entidade_id: entidadeId,
      tipo_margem: form.tipo_margem, percentual_margem_apartada: num(form.percentual_margem_apartada),
      margem_consignavel: num(form.percentual_margem_apartada), taxa_mensal: num(form.taxa_mensal),
      prazo_maximo: num(form.prazo_maximo), ativo: form.ativo,
      // Item 2 — regras do decreto (lidas pelo motor de travas). Preenchimento
      // manual carimba regras_manuais/atualizadas_em.
      idade_minima: num(form.idade_minima), idade_maxima_fim: num(form.idade_maxima_fim),
      teto_parcelas: num(form.teto_parcelas), max_contratos_servidor: num(form.max_contratos_servidor),
      prioridade_desconto: num(form.prioridade_desconto),
      regras_manuais: true, regras_atualizadas_em: new Date().toISOString(),
      origem_dado: editItem?.origem_dado || 'manual',
    };
    const conv = editItem ? await conveniosApi.update(editItem.id, payload) : await conveniosApi.create(payload);
    await overlayApi.upsert(conv.id, {
      comissao_prefeitura: num(form.comissao_prefeitura), spread: num(form.spread), habilitado_canal: form.habilitado_canal,
      rateio: {
        canal: num(form.rateio_canal), franquia: num(form.rateio_franquia), lider: num(form.rateio_lider),
        corban: num(form.rateio_corban), operador: num(form.rateio_operador),
      },
    });
    await auditoriaApi.log(editItem ? 'editar_convenio' : 'criar_convenio', 'convenios', conv.id, { nome: form.nome });
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (c) => {
    if (!(await confirmar({ title: 'Remover convênio', description: `Remover "${c.nome}"?`, destructive: true, confirmText: 'Remover' }))) return;
    await conveniosApi.remove(c.id);
    await auditoriaApi.log('remover_convenio', 'convenios', c.id, { nome: c.nome });
    load();
  };

  const handleImport = async () => {
    setImporting(true);
    setImportRes(null);
    try {
      const now = new Date().toISOString();
      const res = importFmt === 'json'
        ? await importarConveniosPixconsigJSON(csv, now)
        : await importarConveniosCSV(csv, now);
      setImportRes(res);
      await auditoriaApi.log(importFmt === 'json' ? 'importar_convenios_api' : 'importar_convenios_csv', 'convenios', null, { total: res.total, ok: res.ok });
      load();
    } catch (err) {
      setImportRes({ total: 0, ok: 0, erros: [err.message] });
    } finally {
      setImporting(false);
    }
  };

  // ---- Base de margem (arquivo da averbadora) ----
  const handleMargem = async () => {
    if (!margemConv) { setMargemRes({ erro: 'Selecione o convênio.' }); return; }
    setMargemBusy(true); setMargemRes(null);
    try {
      const res = await importarBaseMargemCSV(margemConv, margemCsv);
      setMargemRes(res);
      await auditoriaApi.log('atualizar_base_margem', 'matriculas', margemConv, { atualizados: res.atualizados, total: res.total });
    } catch (err) {
      setMargemRes({ erro: err.message || 'Falha na atualização.' });
    } finally {
      setMargemBusy(false);
    }
  };
  const onFileMargem = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setMargemCsv(String(reader.result || ''));
    reader.readAsText(file);
  };

  // ---- Produtos por convênio ----
  const openProdutos = async (c) => {
    setProdConv(c); setProdEdit(null); setProdFormOpen(false);
    setProdutos(await produtosConvenioApi.list({ convenio_id: c.id }).catch(() => []));
    setProdOpen(true);
  };
  const reloadProdutos = async () => setProdutos(await produtosConvenioApi.list({ convenio_id: prodConv.id }).catch(() => []));
  const openProdCreate = () => {
    setProdEdit(null);
    setProdForm({ ...emptyProd, tipo_margem: prodConv?.tipo_margem || 'cartao', taxa_mensal: prodConv?.taxa_mensal ?? '', prazo_max: prodConv?.prazo_maximo ?? '', margem_percentual: prodConv?.percentual_margem_apartada ?? '' });
    setProdFormOpen(true);
  };
  const openProdEdit = (p) => {
    setProdEdit(p);
    setProdForm({
      produto: p.produto, nome: p.nome ?? '', tipo_margem: p.tipo_margem || 'cartao', taxa_mensal: p.taxa_mensal ?? '',
      prazo_min: p.prazo_min ?? '', prazo_max: p.prazo_max ?? '', valor_min: p.valor_min ?? '', valor_max: p.valor_max ?? '',
      idade_min: p.idade_min ?? '', idade_max: p.idade_max ?? '', margem_percentual: p.margem_percentual ?? '',
      rotativo: p.rotativo, saque_vinculado: p.saque_vinculado, ativo: p.ativo,
    });
    setProdFormOpen(true);
  };
  const saveProd = async (e) => {
    e.preventDefault();
    const payload = {
      convenio_id: prodConv.id, produto: prodForm.produto, nome: prodForm.nome || null, tipo_margem: prodForm.tipo_margem,
      taxa_mensal: num(prodForm.taxa_mensal), prazo_min: num(prodForm.prazo_min), prazo_max: num(prodForm.prazo_max),
      valor_min: num(prodForm.valor_min), valor_max: num(prodForm.valor_max), idade_min: num(prodForm.idade_min), idade_max: num(prodForm.idade_max),
      margem_percentual: num(prodForm.margem_percentual), rotativo: prodForm.rotativo, saque_vinculado: prodForm.saque_vinculado, ativo: prodForm.ativo,
    };
    try {
      if (prodEdit) await produtosConvenioApi.update(prodEdit.id, payload);
      else await produtosConvenioApi.create(payload);
      await auditoriaApi.log(prodEdit ? 'editar_produto_convenio' : 'criar_produto_convenio', 'produtos_convenio', prodEdit?.id || null, { convenio: prodConv.nome, produto: prodForm.produto });
      setProdFormOpen(false);
      reloadProdutos();
    } catch (err) {
      toast.error(err.message || 'Falha ao salvar produto (verifique se já existe esse produto no convênio).');
    }
  };
  const removeProd = async (p) => {
    if (!(await confirmar({ title: 'Remover produto', description: `Remover "${p.nome || PRODUTOS[p.produto]}"?`, destructive: true, confirmText: 'Remover' }))) return;
    await produtosConvenioApi.remove(p.id);
    await auditoriaApi.log('remover_produto_convenio', 'produtos_convenio', p.id, { produto: p.produto });
    reloadProdutos();
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ''));
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Convênios (espelho PixConsig) + overlay comercial</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setMargemConv(''); setMargemCsv(''); setMargemRes(null); setMargemOpen(true); }} className="gap-2"><Wallet className="w-4 h-4" /> Base de margem</Button>
          <Button variant="outline" onClick={() => { setCsv(''); setImportRes(null); setImportOpen(true); }} className="gap-2"><Upload className="w-4 h-4" /> Importar CSV</Button>
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo convênio</Button>
        </div>
      </div>

      {/* Busca + filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, cidade, UF ou CNPJ…" className="pl-9" />
        </div>
        <div className="w-40">
          <Select value={fTipo} onValueChange={setFTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {Object.entries(TIPOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={fOrigem} onValueChange={setFOrigem}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as origens</SelectItem>
              {Object.entries(ORIGENS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="w-36">
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {temFiltro && (
          <Button variant="ghost" size="sm" onClick={limparFiltros} className="gap-1 text-muted-foreground"><X className="w-3.5 h-3.5" /> Limpar</Button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <EmptyState title="Carregando…" />
        ) : convenios.length === 0 ? (
          <EmptyState icon={Wallet} title="Nenhum convênio cadastrado." />
        ) : view.length === 0 ? (
          <EmptyState icon={Search} title="Nenhum convênio corresponde aos filtros." />
        ) : (
          <>
          <div className="px-4 py-2 text-[11px] text-muted-foreground border-b border-border">{view.length} de {convenios.length} convênio(s)</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <SortTh label="Nome" sortKey="nome" sort={sort} onSort={toggle} />
                <SortTh label="Cidade/UF" sortKey="cidade" sort={sort} onSort={toggle} className="hidden md:table-cell" />
                <SortTh label="Margem" sortKey="margem" sort={sort} onSort={toggle} />
                <SortTh label="Apartada" sortKey="apartada" sort={sort} onSort={toggle} align="right" className="hidden lg:table-cell" />
                <SortTh label="Origem" sortKey="origem" sort={sort} onSort={toggle} className="hidden sm:table-cell" />
                <SortTh label="Status" sortKey="status" sort={sort} onSort={toggle} />
                <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {view.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{c.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{[c.entidade?.cidade || c.orgao, c.entidade?.uf].filter(Boolean).join('/') || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{MARGENS[c.tipo_margem] || '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">{c.percentual_margem_apartada != null ? `${c.percentual_margem_apartada}%` : '—'}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ORIGEM_CORES[c.origem_dado] || ORIGEM_CORES.manual}`}>{ORIGENS[c.origem_dado] || 'Manual'}</span>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs ${c.ativo ? 'text-green-700' : 'text-muted-foreground'}`}>{c.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Tip label="Produtos do convênio"><button onClick={() => openProdutos(c)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded"><Package className="w-4 h-4" /></button></Tip>
                      <Tip label="Editar"><button onClick={() => openEdit(c)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Pencil className="w-4 h-4" /></button></Tip>
                      <Tip label="Remover"><button onClick={() => handleDelete(c)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button></Tip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </div>

      {/* Novo/Editar convênio */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? 'Editar convênio' : 'Novo convênio'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Entidade / Convênio</p>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2 col-span-2"><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
              <div className="space-y-2"><Label>UF</Label><Input maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Tipo de convênio</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TIPOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Produto / Margem (cartão benefício)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Tipo margem</Label>
                <Select value={form.tipo_margem} onValueChange={(v) => setForm({ ...form, tipo_margem: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(MARGENS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Margem apartada %</Label><Input type="number" step="0.01" value={form.percentual_margem_apartada} onChange={(e) => setForm({ ...form, percentual_margem_apartada: e.target.value })} /></div>
              <div className="space-y-2"><Label>Prazo máx.</Label><Input type="number" value={form.prazo_maximo} onChange={(e) => setForm({ ...form, prazo_maximo: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Taxa a.m. %</Label><Input type="number" step="0.0001" value={form.taxa_mensal} onChange={(e) => setForm({ ...form, taxa_mensal: e.target.value })} /></div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Regras do decreto (motor de travas)</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Idade mín.</Label><Input type="number" value={form.idade_minima} onChange={(e) => setForm({ ...form, idade_minima: e.target.value })} /></div>
              <div className="space-y-2"><Label>Idade máx. ao fim</Label><Input type="number" value={form.idade_maxima_fim} onChange={(e) => setForm({ ...form, idade_maxima_fim: e.target.value })} /></div>
              <div className="space-y-2"><Label>Teto de parcelas</Label><Input type="number" value={form.teto_parcelas} onChange={(e) => setForm({ ...form, teto_parcelas: e.target.value })} /></div>
              <div className="space-y-2"><Label>Contratos/servidor</Label><Input type="number" value={form.max_contratos_servidor} onChange={(e) => setForm({ ...form, max_contratos_servidor: e.target.value })} /></div>
              <div className="space-y-2"><Label>Prioridade desconto</Label><Input type="number" value={form.prioridade_desconto} onChange={(e) => setForm({ ...form, prioridade_desconto: e.target.value })} /></div>
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Overlay comercial (CONSIGTEC)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Comissão prefeitura %</Label><Input type="number" step="0.0001" value={form.comissao_prefeitura} onChange={(e) => setForm({ ...form, comissao_prefeitura: e.target.value })} /></div>
              <div className="space-y-2"><Label>Spread %</Label><Input type="number" step="0.0001" value={form.spread} onChange={(e) => setForm({ ...form, spread: e.target.value })} /></div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Rateio da comissão (%)</Label>
              <div className="grid grid-cols-5 gap-2 mt-1">
                <div><span className="text-[10px] text-muted-foreground">Canal</span><Input type="number" step="0.01" value={form.rateio_canal} onChange={(e) => setForm({ ...form, rateio_canal: e.target.value })} /></div>
                <div><span className="text-[10px] text-muted-foreground">Franquia</span><Input type="number" step="0.01" value={form.rateio_franquia} onChange={(e) => setForm({ ...form, rateio_franquia: e.target.value })} /></div>
                <div><span className="text-[10px] text-muted-foreground">Líder</span><Input type="number" step="0.01" value={form.rateio_lider} onChange={(e) => setForm({ ...form, rateio_lider: e.target.value })} /></div>
                <div><span className="text-[10px] text-muted-foreground">Corban</span><Input type="number" step="0.01" value={form.rateio_corban} onChange={(e) => setForm({ ...form, rateio_corban: e.target.value })} /></div>
                <div><span className="text-[10px] text-muted-foreground">Operador</span><Input type="number" step="0.01" value={form.rateio_operador} onChange={(e) => setForm({ ...form, rateio_operador: e.target.value })} /></div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="c-hab">Habilitado para venda (canal)</Label>
              <Switch id="c-hab" checked={form.habilitado_canal} onCheckedChange={(v) => setForm({ ...form, habilitado_canal: v })} />
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

      {/* Atualizar base de margem */}
      <Dialog open={margemOpen} onOpenChange={setMargemOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Atualizar base de margem (arquivo da averbadora)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sem integração online, a margem é atualizada pelo arquivo periódico da averbadora.
              Casa por <code className="font-mono text-xs">cpf</code> (+ <code className="font-mono text-xs">matricula</code>, se houver) dentro do convênio e carimba a data de atualização.
            </p>
            <div className="space-y-2">
              <Label>Convênio / Município</Label>
              <Select value={margemConv} onValueChange={setMargemConv}>
                <SelectTrigger><SelectValue placeholder="Selecionar convênio" /></SelectTrigger>
                <SelectContent>
                  {convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}{c.entidade?.uf ? ` — ${c.entidade.uf}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input type="file" accept=".csv,text/csv" onChange={onFileMargem} />
            <Textarea rows={6} value={margemCsv} onChange={(e) => setMargemCsv(e.target.value)} placeholder="cpf,matricula,margem,situacao,salario" className="font-mono text-xs" />
            {margemRes && (
              margemRes.erro ? (
                <p className="text-sm text-red-600">{margemRes.erro}</p>
              ) : (
                <div className="rounded-lg bg-muted border border-border p-3 text-sm text-foreground">
                  <b>{margemRes.atualizados}</b> vínculo(s) atualizado(s) de <b>{margemRes.total}</b> ·
                  {' '}{margemRes.nao_encontrados} não encontrado(s) · {margemRes.ignorados} ignorado(s).
                </div>
              )
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMargemOpen(false)}>Fechar</Button>
            <Button onClick={handleMargem} disabled={margemBusy || !margemCsv.trim() || !margemConv}>{margemBusy ? 'Atualizando…' : 'Atualizar margem'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Produtos do convênio */}
      <Dialog open={prodOpen} onOpenChange={setProdOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Produtos — {prodConv?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs text-muted-foreground">Parâmetros por produto (taxa, prazo, valor, idade e margem). Usados na consulta de margem e na simulação.</p>
              <Button size="sm" onClick={openProdCreate} className="gap-1"><Plus className="w-4 h-4" /> Produto</Button>
            </div>
            {produtos.length === 0 ? (
              <EmptyState icon={Package} title="Nenhum produto parametrizado." />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase text-xs">Produto</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase text-xs">Margem</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase text-xs">Taxa</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase text-xs">Prazo</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground uppercase text-xs">Status</th>
                    <th className="text-right px-3 py-2 font-medium text-muted-foreground uppercase text-xs">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p) => (
                    <tr key={p.id} className="border-b border-border hover:bg-muted/50">
                      <td className="px-3 py-2 font-medium text-foreground">{p.nome || PRODUTOS[p.produto] || p.produto}</td>
                      <td className="px-3 py-2 text-muted-foreground">{MARGENS[p.tipo_margem] || '—'}{p.margem_percentual != null ? ` · ${p.margem_percentual}%` : ''}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{p.taxa_mensal != null ? `${p.taxa_mensal}%` : '—'}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{[p.prazo_min, p.prazo_max].filter((x) => x != null).join('–') || '—'}</td>
                      <td className="px-3 py-2"><span className={`text-xs ${p.ativo ? 'text-green-700' : 'text-muted-foreground'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openProdEdit(p)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => removeProd(p)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setProdOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Novo/Editar produto */}
      <Dialog open={prodFormOpen} onOpenChange={setProdFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{prodEdit ? 'Editar produto' : 'Novo produto'}</DialogTitle></DialogHeader>
          <form onSubmit={saveProd} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={prodForm.produto} onValueChange={(v) => setProdForm({ ...prodForm, produto: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRODUTOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Nome (rótulo)</Label><Input value={prodForm.nome} onChange={(e) => setProdForm({ ...prodForm, nome: e.target.value })} placeholder="opcional" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Tipo margem</Label>
                <Select value={prodForm.tipo_margem} onValueChange={(v) => setProdForm({ ...prodForm, tipo_margem: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(MARGENS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Taxa a.m. %</Label><Input type="number" step="0.0001" value={prodForm.taxa_mensal} onChange={(e) => setProdForm({ ...prodForm, taxa_mensal: e.target.value })} /></div>
              <div className="space-y-2"><Label>Margem %</Label><Input type="number" step="0.01" value={prodForm.margem_percentual} onChange={(e) => setProdForm({ ...prodForm, margem_percentual: e.target.value })} placeholder="% da margem" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Prazo mín.</Label><Input type="number" value={prodForm.prazo_min} onChange={(e) => setProdForm({ ...prodForm, prazo_min: e.target.value })} /></div>
              <div className="space-y-2"><Label>Prazo máx.</Label><Input type="number" value={prodForm.prazo_max} onChange={(e) => setProdForm({ ...prodForm, prazo_max: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Valor mín.</Label><Input type="number" step="0.01" value={prodForm.valor_min} onChange={(e) => setProdForm({ ...prodForm, valor_min: e.target.value })} /></div>
              <div className="space-y-2"><Label>Valor máx.</Label><Input type="number" step="0.01" value={prodForm.valor_max} onChange={(e) => setProdForm({ ...prodForm, valor_max: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Idade mín.</Label><Input type="number" value={prodForm.idade_min} onChange={(e) => setProdForm({ ...prodForm, idade_min: e.target.value })} /></div>
              <div className="space-y-2"><Label>Idade máx.</Label><Input type="number" value={prodForm.idade_max} onChange={(e) => setProdForm({ ...prodForm, idade_max: e.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between"><Label htmlFor="p-rot">Rotativo</Label><Switch id="p-rot" checked={prodForm.rotativo} onCheckedChange={(v) => setProdForm({ ...prodForm, rotativo: v })} /></div>
            <div className="flex items-center justify-between"><Label htmlFor="p-saq">Saque vinculado</Label><Switch id="p-saq" checked={prodForm.saque_vinculado} onCheckedChange={(v) => setProdForm({ ...prodForm, saque_vinculado: v })} /></div>
            <div className="flex items-center justify-between"><Label htmlFor="p-ativo">Produto ativo</Label><Switch id="p-ativo" checked={prodForm.ativo} onCheckedChange={(v) => setProdForm({ ...prodForm, ativo: v })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProdFormOpen(false)}>Cancelar</Button>
              <Button type="submit">{prodEdit ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Importar CSV */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Importar convênios (espelho PixConsig)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => setImportFmt('csv')} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${importFmt === 'csv' ? 'border-primary text-primary bg-primary/5' : 'border-border text-muted-foreground'}`}>CSV</button>
              <button type="button" onClick={() => setImportFmt('json')} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${importFmt === 'json' ? 'border-primary text-primary bg-primary/5' : 'border-border text-muted-foreground'}`}>JSON (API PixConsig v1)</button>
            </div>
            {importFmt === 'csv' ? (
              <p className="text-sm text-muted-foreground">Cole o CSV ou selecione um arquivo — upsert por <code className="font-mono text-xs">pixconsig_convenio_id</code>.</p>
            ) : (
              <p className="text-sm text-muted-foreground">Cole o JSON da API v1 (<code className="font-mono text-xs">{'{ data: [...] }'}</code> ou array). Sincroniza cadastro + margem; taxa/spread/comissão continuam do CONSIGTEC. REPROVADA é ignorada.</p>
            )}
            {importFmt === 'csv' && <Input type="file" accept=".csv,text/csv" onChange={onFile} />}
            <Textarea rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={importFmt === 'json' ? '{ "data": [ { "id": "...", "entidade": {...}, "credenciamento": {...}, "produtos": [...] } ] }' : 'pixconsig_convenio_id,cnpj,nome_oficial,cidade,uf,status,...'} className="font-mono text-xs" />
            {importRes && (
              <div className="rounded-lg bg-muted border border-border p-3 text-sm">
                <p className="text-foreground"><b>{importRes.ok}</b> de <b>{importRes.total}</b> convênios importados.</p>
                {importRes.erros.length > 0 && (
                  <ul className="mt-1 text-xs text-red-600 list-disc list-inside max-h-32 overflow-y-auto">
                    {importRes.erros.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Fechar</Button>
            <Button onClick={handleImport} disabled={importing || !csv.trim()}>{importing ? 'Importando…' : 'Importar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
