import React, { useEffect, useState } from 'react';
import { conveniosApi } from '@/lib/api/convenios';
import { entidadesApi } from '@/lib/api/entidades';
import { overlayApi } from '@/lib/api/overlay';
import { produtosConvenioApi } from '@/lib/api/produtosConvenio';
import { auditoriaApi } from '@/lib/api/auditoria';
import { importarConveniosCSV } from '@/lib/pixconsigImport';
import { importarBaseMargemCSV } from '@/lib/margemImport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Upload, Package, Wallet } from 'lucide-react';

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
const ORIGEM_CORES = { manual: 'bg-slate-100 text-slate-600', csv: 'bg-amber-50 text-amber-700', pixconsig: 'bg-blue-50 text-blue-700' };

const emptyForm = {
  nome: '', cidade: '', uf: '', cnpj: '', tipo: 'publico', tipo_margem: 'cartao',
  percentual_margem_apartada: '', taxa_mensal: '', prazo_maximo: '', ativo: true,
  comissao_prefeitura: '', spread: '', habilitado_canal: false,
  rateio_canal: '', rateio_franquia: '', rateio_lider: '', rateio_corban: '', rateio_operador: '',
};
const num = (v) => (v === '' || v == null ? null : Number(v));
const ov1 = (c) => (Array.isArray(c.overlay) ? c.overlay[0] : c.overlay) || null;

export default function Convenios() {
  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [importOpen, setImportOpen] = useState(false);
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
    if (!confirm(`Remover o convênio "${c.nome}"?`)) return;
    await conveniosApi.remove(c.id);
    await auditoriaApi.log('remover_convenio', 'convenios', c.id, { nome: c.nome });
    load();
  };

  const handleImport = async () => {
    setImporting(true);
    setImportRes(null);
    try {
      const res = await importarConveniosCSV(csv, new Date().toISOString());
      setImportRes(res);
      await auditoriaApi.log('importar_convenios_csv', 'convenios', null, { total: res.total, ok: res.ok });
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
      alert(err.message || 'Falha ao salvar produto (verifique se já existe esse produto no convênio).');
    }
  };
  const removeProd = async (p) => {
    if (!confirm(`Remover o produto "${p.nome || PRODUTOS[p.produto]}"?`)) return;
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
        <p className="text-sm text-slate-500">Convênios (espelho PixConsig) + overlay comercial</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setMargemConv(''); setMargemCsv(''); setMargemRes(null); setMargemOpen(true); }} className="gap-2"><Wallet className="w-4 h-4" /> Base de margem</Button>
          <Button variant="outline" onClick={() => { setCsv(''); setImportRes(null); setImportOpen(true); }} className="gap-2"><Upload className="w-4 h-4" /> Importar CSV</Button>
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo convênio</Button>
        </div>
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
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Cidade/UF</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Margem</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Apartada</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Origem</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
              </tr>
            </thead>
            <tbody>
              {convenios.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.nome}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{[c.entidade?.cidade || c.orgao, c.entidade?.uf].filter(Boolean).join('/') || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{MARGENS[c.tipo_margem] || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden lg:table-cell">{c.percentual_margem_apartada != null ? `${c.percentual_margem_apartada}%` : '—'}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ORIGEM_CORES[c.origem_dado] || ORIGEM_CORES.manual}`}>{ORIGENS[c.origem_dado] || 'Manual'}</span>
                  </td>
                  <td className="px-4 py-3"><span className={`text-xs ${c.ativo ? 'text-green-700' : 'text-slate-400'}`}>{c.ativo ? 'Ativo' : 'Inativo'}</span></td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openProdutos(c)} title="Produtos do convênio" className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded"><Package className="w-4 h-4" /></button>
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

      {/* Novo/Editar convênio */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editItem ? 'Editar convênio' : 'Novo convênio'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Entidade / Convênio</p>
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

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">Produto / Margem (cartão benefício)</p>
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

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-2">Overlay comercial (CONSIGTEC)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Comissão prefeitura %</Label><Input type="number" step="0.0001" value={form.comissao_prefeitura} onChange={(e) => setForm({ ...form, comissao_prefeitura: e.target.value })} /></div>
              <div className="space-y-2"><Label>Spread %</Label><Input type="number" step="0.0001" value={form.spread} onChange={(e) => setForm({ ...form, spread: e.target.value })} /></div>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Rateio da comissão (%)</Label>
              <div className="grid grid-cols-5 gap-2 mt-1">
                <div><span className="text-[10px] text-slate-400">Canal</span><Input type="number" step="0.01" value={form.rateio_canal} onChange={(e) => setForm({ ...form, rateio_canal: e.target.value })} /></div>
                <div><span className="text-[10px] text-slate-400">Franquia</span><Input type="number" step="0.01" value={form.rateio_franquia} onChange={(e) => setForm({ ...form, rateio_franquia: e.target.value })} /></div>
                <div><span className="text-[10px] text-slate-400">Líder</span><Input type="number" step="0.01" value={form.rateio_lider} onChange={(e) => setForm({ ...form, rateio_lider: e.target.value })} /></div>
                <div><span className="text-[10px] text-slate-400">Corban</span><Input type="number" step="0.01" value={form.rateio_corban} onChange={(e) => setForm({ ...form, rateio_corban: e.target.value })} /></div>
                <div><span className="text-[10px] text-slate-400">Operador</span><Input type="number" step="0.01" value={form.rateio_operador} onChange={(e) => setForm({ ...form, rateio_operador: e.target.value })} /></div>
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
            <p className="text-sm text-slate-500">
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
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700">
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
              <p className="text-xs text-slate-500">Parâmetros por produto (taxa, prazo, valor, idade e margem). Usados na consulta de margem e na simulação.</p>
              <Button size="sm" onClick={openProdCreate} className="gap-1"><Plus className="w-4 h-4" /> Produto</Button>
            </div>
            {produtos.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">Nenhum produto parametrizado.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-3 py-2 font-medium text-slate-500 uppercase text-xs">Produto</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500 uppercase text-xs">Margem</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-500 uppercase text-xs">Taxa</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-500 uppercase text-xs">Prazo</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500 uppercase text-xs">Status</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-500 uppercase text-xs">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium text-slate-800">{p.nome || PRODUTOS[p.produto] || p.produto}</td>
                      <td className="px-3 py-2 text-slate-600">{MARGENS[p.tipo_margem] || '—'}{p.margem_percentual != null ? ` · ${p.margem_percentual}%` : ''}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{p.taxa_mensal != null ? `${p.taxa_mensal}%` : '—'}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{[p.prazo_min, p.prazo_max].filter((x) => x != null).join('–') || '—'}</td>
                      <td className="px-3 py-2"><span className={`text-xs ${p.ativo ? 'text-green-700' : 'text-slate-400'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</span></td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openProdEdit(p)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => removeProd(p)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
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
          <DialogHeader><DialogTitle>Importar convênios (CSV — espelho PixConsig)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Cole o CSV ou selecione um arquivo. Mesmo schema da API — upsert por <code className="font-mono text-xs">pixconsig_convenio_id</code>.</p>
            <Input type="file" accept=".csv,text/csv" onChange={onFile} />
            <Textarea rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="pixconsig_convenio_id,cnpj,nome_oficial,cidade,uf,status,..." className="font-mono text-xs" />
            {importRes && (
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
                <p className="text-slate-700"><b>{importRes.ok}</b> de <b>{importRes.total}</b> convênios importados.</p>
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
