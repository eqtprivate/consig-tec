import React, { useEffect, useState } from 'react';
import { conveniosApi } from '@/lib/api/convenios';
import { entidadesApi } from '@/lib/api/entidades';
import { overlayApi } from '@/lib/api/overlay';
import { auditoriaApi } from '@/lib/api/auditoria';
import { importarConveniosCSV } from '@/lib/pixconsigImport';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';

const TIPOS = { publico: 'Público', privado: 'Privado', inss: 'INSS', militar: 'Militar' };
const MARGENS = { apartada: 'Apartada', principal: 'Principal', cartao: 'Cartão' };
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
