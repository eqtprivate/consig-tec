import React, { useEffect, useState } from 'react';
import { oportunidadesApi } from '@/lib/api/crm';
import { clientesApi } from '@/lib/api/clientes';
import { conveniosApi } from '@/lib/api/convenios';
import { propostasApi } from '@/lib/api/propostas';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl, num } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Calculator, FileUp } from 'lucide-react';

const ETAPA = { qualificacao: 'Qualificação', simulacao: 'Simulação', proposta_enviada: 'Proposta enviada', em_formalizacao: 'Em formalização', ganha: 'Ganha', perdida: 'Perdida' };
const ETAPA_ORDER = ['qualificacao', 'simulacao', 'proposta_enviada', 'em_formalizacao', 'ganha', 'perdida'];
const ETAPA_COR = {
  qualificacao: 'bg-slate-100 text-slate-600', simulacao: 'bg-blue-50 text-blue-700', proposta_enviada: 'bg-amber-50 text-amber-700',
  em_formalizacao: 'bg-violet-50 text-violet-700', ganha: 'bg-green-50 text-green-700', perdida: 'bg-red-50 text-red-700',
};
const PRODUTO = { cartao_beneficio: 'Cartão benefício', consignado: 'Consignado', cartao_credito: 'Cartão de crédito', saque_complementar: 'Saque complementar' };
const emptyForm = {
  cliente_id: '', convenio_id: '', produto: 'cartao_beneficio', valor_estimado: '', taxa_estimada: '',
  prazo_estimado: '', valor_parcela: '', etapa: 'qualificacao', probabilidade: '50', motivo_perda: '', observacao: '',
};

export default function Oportunidades() {
  const { activeUnidade, perfil } = useAuth();
  const [itens, setItens] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const f = activeUnidade ? { franquia_id: activeUnidade.id } : {};
    const [o, c, cv] = await Promise.all([
      oportunidadesApi.list(f).catch(() => []),
      clientesApi.list().catch(() => []),
      conveniosApi.list().catch(() => []),
    ]);
    setItens(o); setClientes(c); setConvenios(cv); setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const openCreate = () => { setEdit(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (o) => {
    setEdit(o);
    setForm({
      cliente_id: o.cliente_id || '', convenio_id: o.convenio_id || '', produto: o.produto, valor_estimado: o.valor_estimado ?? '',
      taxa_estimada: o.taxa_estimada ?? '', prazo_estimado: o.prazo_estimado ?? '', valor_parcela: o.valor_parcela ?? '',
      etapa: o.etapa, probabilidade: String(o.probabilidade ?? 50), motivo_perda: o.motivo_perda || '', observacao: o.observacao || '',
    });
    setOpen(true);
  };

  const onSelConvenio = (v) => {
    const cv = convenios.find((x) => x.id === v);
    setForm((f) => ({ ...f, convenio_id: v, taxa_estimada: f.taxa_estimada || (cv?.taxa_mensal ?? '') }));
  };

  const simular = async () => {
    const p = num(form.valor_estimado), t = num(form.taxa_estimada), n = num(form.prazo_estimado);
    if (!p || !n) return alert('Informe valor e prazo para simular.');
    try {
      const parcela = await oportunidadesApi.simular(p, t ?? 0, n);
      setForm((f) => ({ ...f, valor_parcela: parcela }));
    } catch (err) { alert(err.message || 'Falha ao simular.'); }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      cliente_id: form.cliente_id || null, convenio_id: form.convenio_id || null, produto: form.produto,
      valor_estimado: num(form.valor_estimado), taxa_estimada: num(form.taxa_estimada), prazo_estimado: num(form.prazo_estimado),
      valor_parcela: num(form.valor_parcela), etapa: form.etapa, probabilidade: num(form.probabilidade) ?? 50,
      motivo_perda: form.etapa === 'perdida' ? (form.motivo_perda || null) : null, observacao: form.observacao || null,
    };
    try {
      if (edit) { await oportunidadesApi.update(edit.id, payload); await auditoriaApi.log('editar_oportunidade', 'oportunidades', edit.id, { etapa: form.etapa }); }
      else { await oportunidadesApi.create({ ...payload, operador_id: perfil?.id || null, franquia_id: activeUnidade?.id || null }); await auditoriaApi.log('criar_oportunidade', 'oportunidades', null, {}); }
      setOpen(false); load();
    } catch (err) { alert(err.message || 'Falha ao salvar.'); }
  };

  const gerarProposta = async (o) => {
    if (!o.cliente_id) return alert('Vincule um tomador (cliente) à oportunidade antes de gerar a proposta.');
    if (o.proposta_id) return alert('Esta oportunidade já gerou uma proposta.');
    if (!confirm('Gerar proposta a partir desta oportunidade?')) return;
    setBusy(true);
    try {
      const prop = await propostasApi.create({
        cliente_id: o.cliente_id, convenio_id: o.convenio_id || null,
        valor_solicitado: o.valor_estimado, prazo: o.prazo_estimado, taxa_mensal: o.taxa_estimada,
        valor_parcela: o.valor_parcela, status: 'em_analise', franquia_id: activeUnidade?.id || null,
      });
      await oportunidadesApi.update(o.id, { proposta_id: prop.id, etapa: 'proposta_enviada' });
      await auditoriaApi.log('gerar_proposta_oportunidade', 'oportunidades', o.id, { proposta_id: prop.id });
      alert('Proposta criada (em análise). Acompanhe em CRM → Propostas.');
      load();
    } catch (err) { alert(err.message || 'Falha ao gerar proposta.'); }
    finally { setBusy(false); }
  };

  // Resumo do pipeline
  const resumo = ETAPA_ORDER.map((et) => {
    const l = itens.filter((o) => o.etapa === et);
    return { etapa: et, n: l.length, valor: l.reduce((s, o) => s + Number(o.valor_estimado || 0), 0) };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Pipeline de vendas — oportunidades qualificadas</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova oportunidade</Button>
      </div>

      {/* Pipeline resumo */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {resumo.map((r) => (
          <div key={r.etapa} className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{ETAPA[r.etapa]}</p>
            <p className="text-lg font-bold text-slate-900 num">{r.n}</p>
            <p className="text-[11px] text-slate-400 num">{brl(r.valor)}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : itens.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhuma oportunidade. Qualifique um lead na aba Leads.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Cliente/Lead</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Produto</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Valor</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Parcela</th>
              <th className="text-center px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Prob.</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Etapa</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((o) => (
                <tr key={o.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{o.cliente?.nome || o.lead?.nome || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{PRODUTO[o.produto]}</td>
                  <td className="px-4 py-3 text-right text-slate-700 num">{brl(o.valor_estimado)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 num hidden lg:table-cell">{brl(o.valor_parcela)}</td>
                  <td className="px-4 py-3 text-center text-slate-500 hidden sm:table-cell num">{o.probabilidade ?? '—'}%</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ETAPA_COR[o.etapa]}`}>{ETAPA[o.etapa]}</span></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {!o.proposta_id && o.cliente_id && (
                      <button onClick={() => gerarProposta(o)} disabled={busy} title="Gerar proposta" className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded"><FileUp className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => openEdit(o)} title="Editar" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar oportunidade' : 'Nova oportunidade'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tomador (cliente)</Label>
                <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                  <SelectTrigger><SelectValue placeholder="(opcional até qualificar)" /></SelectTrigger>
                  <SelectContent>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={form.produto} onValueChange={(v) => setForm({ ...form, produto: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRODUTO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Convênio</Label>
              <Select value={form.convenio_id} onValueChange={onSelConvenio}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Valor</Label><Input type="number" step="0.01" value={form.valor_estimado} onChange={(e) => setForm({ ...form, valor_estimado: e.target.value })} /></div>
              <div className="space-y-2"><Label>Taxa a.m. %</Label><Input type="number" step="0.0001" value={form.taxa_estimada} onChange={(e) => setForm({ ...form, taxa_estimada: e.target.value })} /></div>
              <div className="space-y-2"><Label>Prazo (x)</Label><Input type="number" value={form.prazo_estimado} onChange={(e) => setForm({ ...form, prazo_estimado: e.target.value })} /></div>
            </div>
            <div className="flex items-end gap-3">
              <div className="space-y-2 flex-1"><Label>Parcela estimada</Label><Input type="number" step="0.01" value={form.valor_parcela} onChange={(e) => setForm({ ...form, valor_parcela: e.target.value })} /></div>
              <Button type="button" variant="outline" onClick={simular} className="gap-2"><Calculator className="w-4 h-4" /> Simular (PMT)</Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Etapa</Label>
                <Select value={form.etapa} onValueChange={(v) => setForm({ ...form, etapa: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ETAPA).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Probabilidade %</Label><Input type="number" min="0" max="100" value={form.probabilidade} onChange={(e) => setForm({ ...form, probabilidade: e.target.value })} /></div>
            </div>
            {form.etapa === 'perdida' && (
              <div className="space-y-2"><Label>Motivo da perda</Label><Textarea rows={2} value={form.motivo_perda} onChange={(e) => setForm({ ...form, motivo_perda: e.target.value })} /></div>
            )}
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
