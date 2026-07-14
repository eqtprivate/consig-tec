import React, { useEffect, useMemo, useState } from 'react';
import { conciliacaoApi, custosApi } from '@/lib/api/conciliacao';
import { conveniosApi } from '@/lib/api/convenios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { parseCSV } from '@/lib/pixconsigImport';
import { brl, num } from '@/lib/format';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { EmptyState, StatusBadge } from '@/components/kit';
import { Upload, Loader2, FileCheck2, Trash2, CheckCircle2, XCircle, ChevronRight, Coins, ArrowRightLeft, Plus } from 'lucide-react';

const CUSTO_TIPO = { por_linha: 'Por linha (R$/item)', percentual: 'Percentual (% do conciliado)', ted: 'TED do repasse (R$)', fixo: 'Fixo (R$)' };

const TIPO = { ok: 'Conciliado', parcial: 'Parcial', sem_desconto: 'Sem desconto', sem_contrato: 'Sem contrato' };
const TIPO_DESC = { ok: 'desconto = esperado', parcial: 'descontado < esperado', sem_desconto: 'esperado sem desconto (inadimplência)', sem_contrato: 'desconto sem contrato (devolução)' };
const TIPO_COR = { ok: 'bg-green-50 text-green-700', parcial: 'bg-amber-50 text-amber-700', sem_desconto: 'bg-red-50 text-red-700', sem_contrato: 'bg-violet-50 text-violet-700' };
const TIPO_DOT = { ok: 'bg-green-500', parcial: 'bg-amber-500', sem_desconto: 'bg-red-500', sem_contrato: 'bg-violet-500' };
const ORDER = ['sem_desconto', 'parcial', 'sem_contrato', 'ok'];
const soDig = (s) => (s || '').replace(/\D/g, '');
const numBR = (s) => { if (s == null || s === '') return 0; const n = Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };

// Detecta colunas do CSV do retorno e devolve itens { cpf, matricula, valor_descontado, motivo }.
function parseRetorno(texto) {
  const rows = parseCSV(texto);
  if (rows.length < 2) throw new Error('CSV vazio ou sem linhas de dados.');
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const find = (...names) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const iCpf = find('cpf');
  const iVal = find('valor_descontado', 'descontado', 'valor', 'desconto');
  const iMot = find('motivo', 'ocorr', 'status');
  const iMat = find('matricula', 'matrícula');
  if (iCpf < 0 || iVal < 0) throw new Error('O CSV precisa das colunas "cpf" e "valor" (descontado).');
  const itens = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const cpf = soDig(c[iCpf]);
    if (!cpf) continue;
    itens.push({ cpf, matricula: iMat >= 0 ? (c[iMat] || null) : null, valor_descontado: numBR(c[iVal]), motivo: iMot >= 0 ? (c[iMot] || null) : null });
  }
  if (!itens.length) throw new Error('Nenhuma linha válida (cpf + valor).');
  return itens;
}

export default function ConciliacaoFolha() {
  const [convenios, setConvenios] = useState([]);
  const [retornos, setRetornos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ convenio_id: '', competencia: '', arquivo_nome: '', csv: '' });
  const [importing, setImporting] = useState(false);
  const [sel, setSel] = useState(null);            // retorno selecionado
  const [ocorr, setOcorr] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [loadingOcc, setLoadingOcc] = useState(false);
  const [busy, setBusy] = useState(false);
  // custos de processamento
  const [custosOpen, setCustosOpen] = useState(false);
  const [custos, setCustos] = useState([]);
  const [custoForm, setCustoForm] = useState({ tipo: 'por_linha', valor: '', descricao: '' });

  const load = async () => {
    setLoading(true);
    const [r, cv] = await Promise.all([conciliacaoApi.listRetornos().catch(() => []), conveniosApi.list().catch(() => [])]);
    setRetornos(r); setConvenios(cv); setLoading(false);
    return r;
  };
  useEffect(() => { load(); }, []);

  // recarrega a lista e re-seleciona o retorno (para refletir o resumo financeiro)
  const refreshSel = async (retornoId) => {
    const rs = await load();
    const r = rs.find((x) => x.id === retornoId);
    if (r) setSel(r);
    return r;
  };

  const gerarRepasse = async () => {
    if (!sel) return;
    setBusy(true);
    try {
      await conciliacaoApi.gerarRepasse(sel.id);
      await auditoriaApi.log('gerar_repasse_conciliacao', 'retornos_folha', sel.id, { competencia: sel.competencia });
      await refreshSel(sel.id);
      toast.success('Repasse (líquido) gerado/atualizado em Conciliação (repasse).');
    } catch (err) { toast.error(err.message || 'Falha ao gerar repasse.'); }
    finally { setBusy(false); }
  };

  const abrirCustos = async () => {
    if (!sel?.convenio_id) { toast.error('Retorno sem convênio.'); return; }
    setCustos(await custosApi.list(sel.convenio_id).catch(() => []));
    setCustoForm({ tipo: 'por_linha', valor: '', descricao: '' });
    setCustosOpen(true);
  };
  const addCusto = async (e) => {
    e.preventDefault();
    if (num(custoForm.valor) == null) { toast.error('Informe o valor.'); return; }
    try {
      await custosApi.create({ convenio_id: sel.convenio_id, tipo: custoForm.tipo, valor: num(custoForm.valor), descricao: custoForm.descricao || null });
      setCustos(await custosApi.list(sel.convenio_id));
      setCustoForm({ tipo: 'por_linha', valor: '', descricao: '' });
    } catch (err) { toast.error(err.message); }
  };
  const removerCusto = async (c) => {
    try { await custosApi.remove(c.id); setCustos(await custosApi.list(sel.convenio_id)); } catch (err) { toast.error(err.message); }
  };
  const aplicarCustos = async () => {
    setBusy(true);
    try { await conciliacaoApi.recalcular(sel.id); await refreshSel(sel.id); setCustosOpen(false); toast.success('Custos aplicados ao líquido.'); }
    catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const onFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setForm((f) => ({ ...f, csv: String(e.target.result || ''), arquivo_nome: file.name }));
    reader.readAsText(file);
  };

  const importar = async () => {
    if (!form.competencia.trim()) { toast.error('Informe a competência (AAAA-MM).'); return; }
    if (!form.convenio_id) { toast.error('Selecione o convênio.'); return; }
    let itens;
    try { itens = parseRetorno(form.csv); } catch (err) { toast.error(err.message); return; }
    setImporting(true);
    try {
      const r = await conciliacaoApi.criarRetorno({ convenio_id: form.convenio_id, competencia: form.competencia.trim(), arquivo_nome: form.arquivo_nome, itens });
      const resumo = await conciliacaoApi.conciliar(r.id);
      await auditoriaApi.log('conciliar_folha', 'retornos_folha', r.id, { competencia: form.competencia, itens: itens.length, resumo });
      toast.success(`Retorno conciliado: ${itens.length} linha(s).`);
      setForm({ convenio_id: '', competencia: '', arquivo_nome: '', csv: '' });
      const rs = await load();
      verOcorrencias(rs.find((x) => x.id === r.id) || r);
    } catch (err) { toast.error(err.message || 'Falha ao conciliar.'); }
    finally { setImporting(false); }
  };

  const verOcorrencias = async (r, tipo = 'todos') => {
    setSel(r); setFiltro(tipo); setLoadingOcc(true);
    try { setOcorr(await conciliacaoApi.ocorrencias(r.id, tipo)); } catch { setOcorr([]); }
    finally { setLoadingOcc(false); }
  };

  const tratar = async (o, status) => {
    try { await conciliacaoApi.tratar(o.id, status); setOcorr((prev) => prev.map((x) => (x.id === o.id ? { ...x, status } : x))); }
    catch (err) { toast.error(err.message); }
  };

  const remover = async (r) => {
    if (!(await confirmar({ title: 'Remover retorno', description: `Remover o retorno de ${r.competencia} e suas ocorrências?`, destructive: true, confirmText: 'Remover' }))) return;
    try { await conciliacaoApi.removerRetorno(r.id); if (sel?.id === r.id) setSel(null); load(); } catch (err) { toast.error(err.message); }
  };

  const resumo = useMemo(() => {
    const m = { ok: 0, parcial: 0, sem_desconto: 0, sem_contrato: 0 };
    for (const o of ocorr) m[o.tipo] = (m[o.tipo] || 0) + 1;
    return m;
  }, [ocorr]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Conciliação de folha (BPORetorno) — importe o arquivo de retorno da averbadora e concilie, contrato a contrato, contra a expectativa (parcelas da competência).</p>

      {/* Importar retorno */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Upload className="w-4 h-4 text-primary" /> Importar arquivo de retorno</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Convênio</Label>
            <Select value={form.convenio_id} onValueChange={(v) => setForm({ ...form, convenio_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>{convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Competência (AAAA-MM)</Label><Input value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} placeholder="2026-07" /></div>
          <div className="space-y-1.5">
            <Label>Arquivo CSV</Label>
            <Input type="file" accept=".csv,text/csv,text/plain" onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
        </div>
        <Textarea rows={4} value={form.csv} onChange={(e) => setForm({ ...form, csv: e.target.value })} placeholder="ou cole o CSV aqui — colunas: cpf, valor (descontado), motivo (opcional)" className="font-mono text-xs" />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">Colunas aceitas: <b>cpf</b>, <b>valor</b>/valor_descontado, <b>motivo</b> (opcional), matrícula (opcional).</p>
          <Button onClick={importar} disabled={importing} className="gap-2">{importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />} Importar e conciliar</Button>
        </div>
      </div>

      {/* Histórico de retornos */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? <EmptyState title="Carregando…" />
        : retornos.length === 0 ? <EmptyState title="Nenhum retorno importado ainda." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Competência</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">Convênio</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Itens</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Valor</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {retornos.map((r) => (
                <tr key={r.id} className={`border-b border-border hover:bg-muted/50 ${sel?.id === r.id ? 'bg-primary/5' : ''}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{r.competencia}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.convenio?.nome || '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground num">{r.total_itens}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground num hidden sm:table-cell">{brl(r.total_valor)}</td>
                  <td className="px-4 py-3"><StatusBadge className={r.status === 'conciliado' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}>{r.status}</StatusBadge></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => verOcorrencias(r)} title="Ver ocorrências" className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded inline-flex"><ChevronRight className="w-4 h-4" /></button>
                    <button onClick={() => remover(r)} title="Remover" className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded inline-flex"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Ocorrências do retorno selecionado */}
      {sel && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold text-foreground">Ocorrências — {sel.competencia} {sel.convenio?.nome ? `· ${sel.convenio.nome}` : ''}</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={abrirCustos} className="gap-1.5"><Coins className="w-3.5 h-3.5" /> Custos</Button>
              <Button size="sm" onClick={gerarRepasse} disabled={busy} className="gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5" /> Gerar repasse</Button>
              <button onClick={() => setSel(null)} className="text-xs text-muted-foreground hover:text-foreground">fechar</button>
            </div>
          </div>

          {/* Resumo financeiro: conciliado − custos = líquido a repassar */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-border bg-muted/30 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Conciliado</p>
              <p className="text-base font-bold text-foreground num">{brl(sel.valor_conciliado)}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Custos</p>
              <p className="text-base font-bold text-red-600 num">− {brl(sel.custo_total)}</p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Líquido a repassar</p>
              <p className="text-base font-bold text-primary num">{brl(sel.valor_liquido)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => verOcorrencias(sel, 'todos')} className={`px-2.5 py-1 rounded-full text-xs border ${filtro === 'todos' ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>Todas ({ocorr.length})</button>
            {ORDER.map((t) => (
              <button key={t} onClick={() => verOcorrencias(sel, t)} title={TIPO_DESC[t]}
                className={`px-2.5 py-1 rounded-full text-xs border inline-flex items-center gap-1.5 ${filtro === t ? 'border-primary' : 'border-border'}`}>
                <span className={`w-2 h-2 rounded-full ${TIPO_DOT[t]}`} /> {TIPO[t]} ({resumo[t] || 0})
              </button>
            ))}
          </div>

          {loadingOcc ? <EmptyState title="Carregando…" />
          : ocorr.length === 0 ? <p className="text-sm text-muted-foreground py-2">Nenhuma ocorrência neste filtro.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3 font-medium">CPF</th>
                  <th className="py-2 pr-3 font-medium">Cliente</th>
                  <th className="py-2 pr-3 font-medium">Tipo</th>
                  <th className="py-2 pr-3 font-medium text-right">Esperado</th>
                  <th className="py-2 pr-3 font-medium text-right">Descontado</th>
                  <th className="py-2 pr-3 font-medium text-right">Δ</th>
                  <th className="py-2 pr-3 font-medium">Motivo</th>
                  <th className="py-2 pr-0 font-medium text-right">Ação</th>
                </tr></thead>
                <tbody>
                  {ocorr.map((o) => (
                    <tr key={o.id} className={`border-b border-border last:border-0 ${o.status === 'tratada' ? 'opacity-60' : ''}`}>
                      <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{o.cpf || '—'}</td>
                      <td className="py-2 pr-3 text-foreground">{o.cliente?.nome || '—'}</td>
                      <td className="py-2 pr-3"><StatusBadge className={TIPO_COR[o.tipo]}>{TIPO[o.tipo]}</StatusBadge></td>
                      <td className="py-2 pr-3 text-right num text-muted-foreground">{brl(o.valor_esperado)}</td>
                      <td className="py-2 pr-3 text-right num text-muted-foreground">{brl(o.valor_descontado)}</td>
                      <td className={`py-2 pr-3 text-right num ${Number(o.diferenca) < 0 ? 'text-red-600' : Number(o.diferenca) > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{brl(o.diferenca)}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground max-w-[160px] truncate" title={o.motivo || ''}>{o.motivo || '—'}</td>
                      <td className="py-2 pr-0 text-right whitespace-nowrap">
                        {o.tipo !== 'ok' && (o.status === 'aberta' ? (
                          <>
                            <button onClick={() => tratar(o, 'tratada')} title="Marcar tratada" className="p-1.5 text-green-600 hover:bg-green-50 rounded inline-flex"><CheckCircle2 className="w-4 h-4" /></button>
                            <button onClick={() => tratar(o, 'ignorada')} title="Ignorar" className="p-1.5 text-muted-foreground hover:bg-muted rounded inline-flex"><XCircle className="w-4 h-4" /></button>
                          </>
                        ) : <button onClick={() => tratar(o, 'aberta')} className="text-[11px] text-muted-foreground hover:text-foreground">reabrir</button>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Custos de processamento do convênio */}
      <Dialog open={custosOpen} onOpenChange={setCustosOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Coins className="w-4 h-4 text-primary" /> Custos de processamento {sel?.convenio?.nome ? `— ${sel.convenio.nome}` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {custos.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum custo cadastrado para este convênio.</p>
                : custos.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                    <div>
                      <p className="text-sm text-foreground">{CUSTO_TIPO[c.tipo] || c.tipo}</p>
                      <p className="text-[11px] text-muted-foreground">{c.tipo === 'percentual' ? `${c.valor}%` : brl(c.valor)}{c.descricao ? ` · ${c.descricao}` : ''}</p>
                    </div>
                    <button onClick={() => removerCusto(c)} className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
            </div>
            <form onSubmit={addCusto} className="border-t border-border pt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-[11px]">Tipo</Label>
                <Select value={custoForm.tipo} onValueChange={(v) => setCustoForm({ ...custoForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CUSTO_TIPO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label className="text-[11px]">{custoForm.tipo === 'percentual' ? 'Valor (%)' : 'Valor (R$)'}</Label><Input type="number" step="0.0001" value={custoForm.valor} onChange={(e) => setCustoForm({ ...custoForm, valor: e.target.value })} /></div>
              <Button type="submit" variant="outline" className="gap-1.5"><Plus className="w-4 h-4" /> Add</Button>
              <div className="space-y-1.5 sm:col-span-4"><Input value={custoForm.descricao} onChange={(e) => setCustoForm({ ...custoForm, descricao: e.target.value })} placeholder="Descrição (opcional)" /></div>
            </form>
            <p className="text-[11px] text-muted-foreground">Líquido = conciliado − (por-linha × itens + %·conciliado + TED + fixo).</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustosOpen(false)}>Fechar</Button>
            <Button onClick={aplicarCustos} disabled={busy} className="gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Aplicar ao líquido</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
