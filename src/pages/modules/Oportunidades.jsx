import React, { useEffect, useState } from 'react';
import { oportunidadesApi, motivosPerdaApi } from '@/lib/api/crm';
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
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { toast } from 'sonner';
import { Plus, Pencil, Calculator, FileUp, Loader2, Inbox, LayoutGrid, List } from 'lucide-react';
import { PageHeader, StatCard, StatusBadge, EmptyState } from '@/components/kit';

const ETAPA = { qualificacao: 'Qualificação', simulacao: 'Simulação', proposta_enviada: 'Proposta enviada', em_formalizacao: 'Em formalização', ganha: 'Ganha', perdida: 'Perdida' };
const ETAPA_ORDER = ['qualificacao', 'simulacao', 'proposta_enviada', 'em_formalizacao', 'ganha', 'perdida'];
const ETAPA_COR = {
  qualificacao: 'bg-muted text-muted-foreground', simulacao: 'bg-blue-50 text-blue-700', proposta_enviada: 'bg-amber-50 text-amber-700',
  em_formalizacao: 'bg-violet-50 text-violet-700', ganha: 'bg-green-50 text-green-700', perdida: 'bg-red-50 text-red-700',
};
const ETAPA_DOT = { qualificacao: 'bg-slate-400', simulacao: 'bg-blue-400', proposta_enviada: 'bg-amber-400', em_formalizacao: 'bg-violet-400', ganha: 'bg-green-400', perdida: 'bg-red-400' };
const PRODUTO = { cartao_beneficio: 'Cartão benefício', consignado: 'Consignado', cartao_credito: 'Cartão de crédito', saque_complementar: 'Saque complementar' };
const emptyForm = {
  cliente_id: '', convenio_id: '', produto: 'cartao_beneficio', valor_estimado: '', taxa_estimada: '',
  prazo_estimado: '', valor_parcela: '', etapa: 'qualificacao', probabilidade: '50', motivo_perda_id: '', motivo_perda: '', observacao: '',
};

export default function Oportunidades() {
  const { activeUnidade, perfil } = useAuth();
  const [itens, setItens] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [motivos, setMotivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('funil'); // funil (kanban) | lista

  const load = async () => {
    setLoading(true);
    const f = activeUnidade ? { franquia_id: activeUnidade.id } : {};
    const [o, c, cv, mp] = await Promise.all([
      oportunidadesApi.list(f).catch(() => []),
      clientesApi.list().catch(() => []),
      conveniosApi.list().catch(() => []),
      motivosPerdaApi.list().catch(() => []),
    ]);
    setItens(o); setClientes(c); setConvenios(cv); setMotivos(mp); setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const openCreate = () => { setEdit(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (o) => {
    setEdit(o);
    setForm({
      cliente_id: o.cliente_id || '', convenio_id: o.convenio_id || '', produto: o.produto, valor_estimado: o.valor_estimado ?? '',
      taxa_estimada: o.taxa_estimada ?? '', prazo_estimado: o.prazo_estimado ?? '', valor_parcela: o.valor_parcela ?? '',
      etapa: o.etapa, probabilidade: String(o.probabilidade ?? 50), motivo_perda_id: o.motivo_perda_id || '', motivo_perda: o.motivo_perda || '', observacao: o.observacao || '',
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
      motivo_perda_id: form.etapa === 'perdida' ? (form.motivo_perda_id || null) : null,
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
  // Pipeline ponderado (valor × probabilidade) das etapas em aberto.
  const ponderado = itens
    .filter((o) => !['ganha', 'perdida'].includes(o.etapa))
    .reduce((s, o) => s + Number(o.valor_estimado || 0) * (Number(o.probabilidade || 0) / 100), 0);

  // Arrastar cartão entre colunas → muda a etapa (otimista + persiste).
  const onDragEnd = async (r) => {
    if (!r.destination) return;
    const novaEtapa = r.destination.droppableId;
    const id = r.draggableId;
    const o = itens.find((x) => x.id === id);
    if (!o || o.etapa === novaEtapa) return;
    const prev = itens;
    setItens(itens.map((x) => (x.id === id ? { ...x, etapa: novaEtapa } : x)));
    try {
      await oportunidadesApi.update(id, { etapa: novaEtapa });
      await auditoriaApi.log('mover_oportunidade', 'oportunidades', id, { de: o.etapa, para: novaEtapa });
    } catch (e) { toast.error('Não foi possível mover a oportunidade.'); setItens(prev); }
  };

  const ViewToggle = () => (
    <div className="flex rounded-lg border border-border overflow-hidden">
      <button onClick={() => setView('funil')} className={`px-2.5 py-1.5 flex items-center gap-1.5 text-xs ${view === 'funil' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}><LayoutGrid className="w-3.5 h-3.5" /> Funil</button>
      <button onClick={() => setView('lista')} className={`px-2.5 py-1.5 flex items-center gap-1.5 text-xs ${view === 'lista' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}><List className="w-3.5 h-3.5" /> Lista</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Oportunidades"
        subtitle="Pipeline de vendas — oportunidades qualificadas"
        actions={<div className="flex items-center gap-2"><ViewToggle /><Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova oportunidade</Button></div>}
      />

      {/* Funil visual (Kanban) — arraste os cartões entre as etapas */}
      {view === 'funil' && (
        loading ? <div className="bg-card rounded-xl border border-border p-8"><EmptyState icon={Loader2} title="Carregando…" /></div>
        : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>Pipeline ponderado (em aberto): <b className="text-foreground num">{brl(ponderado)}</b></span>
            <span>· {itens.filter((o) => !['ganha', 'perdida'].includes(o.etapa)).length} oportunidade(s) ativa(s)</span>
          </div>
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {ETAPA_ORDER.map((et) => {
                const col = itens.filter((o) => o.etapa === et);
                const val = col.reduce((s, o) => s + Number(o.valor_estimado || 0), 0);
                return (
                  <Droppable droppableId={et} key={et}>
                    {(prov, snap) => (
                      <div ref={prov.innerRef} {...prov.droppableProps}
                        className={`w-60 shrink-0 rounded-xl border p-2 transition-colors ${snap.isDraggingOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}`}>
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${ETAPA_DOT[et] || 'bg-muted-foreground'}`} />{ETAPA[et]}
                          </span>
                          <span className="text-[11px] text-muted-foreground">{col.length}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground px-1 mt-0.5 mb-2 num">{brl(val)}</p>
                        <div className="space-y-2 min-h-[48px]">
                          {col.map((o, idx) => (
                            <Draggable draggableId={o.id} index={idx} key={o.id}>
                              {(dp, ds) => (
                                <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps}
                                  onClick={() => openEdit(o)}
                                  className={`rounded-lg border bg-card p-2.5 cursor-grab active:cursor-grabbing ${ds.isDragging ? 'shadow-lg border-primary' : 'border-border hover:border-primary/40'}`}>
                                  <p className="text-xs font-medium text-foreground truncate">{o.cliente?.nome || o.lead?.nome || '—'}</p>
                                  <p className="text-[11px] text-muted-foreground truncate">{PRODUTO[o.produto] || '—'}</p>
                                  <div className="flex items-center justify-between mt-1.5">
                                    <span className="text-xs font-semibold text-foreground num">{brl(o.valor_estimado)}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground num">{o.probabilidade ?? '—'}%</span>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {prov.placeholder}
                          {col.length === 0 && <p className="text-[11px] text-muted-foreground/60 text-center py-2">—</p>}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </DragDropContext>
        </>
        )
      )}

      {/* Pipeline resumo (lista) */}
      {view === 'lista' && (
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {resumo.map((r) => (
          <StatCard key={r.etapa} label={ETAPA[r.etapa]} value={r.n} hint={brl(r.valor)} />
        ))}
      </div>
      )}

      {view === 'lista' && (
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? <EmptyState icon={Loader2} title="Carregando…" />
        : itens.length === 0 ? <EmptyState icon={Inbox} title="Nenhuma oportunidade" description="Qualifique um lead na aba Leads." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Cliente/Lead</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">Produto</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Valor</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden lg:table-cell">Parcela</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Prob.</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Etapa</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((o) => (
                <tr key={o.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{o.cliente?.nome || o.lead?.nome || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{PRODUTO[o.produto]}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground num">{brl(o.valor_estimado)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground num hidden lg:table-cell">{brl(o.valor_parcela)}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground hidden sm:table-cell num">{o.probabilidade ?? '—'}%</td>
                  <td className="px-4 py-3"><StatusBadge className={ETAPA_COR[o.etapa]}>{ETAPA[o.etapa]}</StatusBadge></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {!o.proposta_id && o.cliente_id && (
                      <button onClick={() => gerarProposta(o)} disabled={busy} title="Gerar proposta" className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted/50 rounded"><FileUp className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => openEdit(o)} title="Editar" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded"><Pencil className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}

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
              <>
                <div className="space-y-2">
                  <Label>Motivo da perda</Label>
                  <Select value={form.motivo_perda_id} onValueChange={(v) => setForm({ ...form, motivo_perda_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{motivos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Detalhe (opcional)</Label><Textarea rows={2} value={form.motivo_perda} onChange={(e) => setForm({ ...form, motivo_perda: e.target.value })} /></div>
              </>
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
