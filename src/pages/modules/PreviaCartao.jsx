import React, { useEffect, useMemo, useState } from 'react';
import { previaApi } from '@/lib/api/conciliacao';
import { conveniosApi } from '@/lib/api/convenios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { parseCSV } from '@/lib/pixconsigImport';
import { brl } from '@/lib/format';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { EmptyState, StatusBadge } from '@/components/kit';
import { CreditCard, Upload, Send, FileCheck2, Wand2, Loader2, Trash2, ChevronRight } from 'lucide-react';

const P_STATUS = { rascunho: 'Rascunho', enviada: 'Enviada', processada: 'Processada' };
const P_COR = { rascunho: 'bg-muted text-muted-foreground', enviada: 'bg-blue-50 text-blue-700', processada: 'bg-green-50 text-green-700' };
const I_STATUS = { pendente: 'Pendente', processado: 'Processado', critica: 'Crítica', reprocessar: 'Reprocessar' };
const I_COR = { pendente: 'bg-muted text-muted-foreground', processado: 'bg-green-50 text-green-700', critica: 'bg-red-50 text-red-700', reprocessar: 'bg-amber-50 text-amber-700' };
const soDig = (s) => (s || '').replace(/\D/g, '');
const numBR = (s) => { if (s == null || s === '') return 0; const n = Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };

export default function PreviaCartao() {
  const [convenios, setConvenios] = useState([]);
  const [previas, setPrevias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ convenio_id: '', competencia: '', arquivo_nome: '', csv: '' });
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState(null);
  const [itens, setItens] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  // resultado + críticas
  const [resOpen, setResOpen] = useState(false);
  const [resCsv, setResCsv] = useState('');
  const [valorMin, setValorMin] = useState('');

  const load = async () => {
    setLoading(true);
    const [p, cv] = await Promise.all([previaApi.list().catch(() => []), conveniosApi.list().catch(() => [])]);
    setPrevias(p); setConvenios(cv); setLoading(false);
    return p;
  };
  useEffect(() => { load(); }, []);

  const criar = async () => {
    if (!form.convenio_id || !form.competencia.trim()) { toast.error('Convênio e competência.'); return; }
    const rows = parseCSV(form.csv);
    if (rows.length < 2) { toast.error('CSV vazio (cpf, valor).'); return; }
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const iCpf = head.findIndex((h) => h.includes('cpf'));
    const iVal = head.findIndex((h) => h.includes('valor'));
    if (iCpf < 0 || iVal < 0) { toast.error('CSV precisa de cpf e valor.'); return; }
    const dados = [];
    for (let r = 1; r < rows.length; r++) { const cpf = soDig(rows[r][iCpf]); if (cpf) dados.push({ cpf, valor_a_descontar: numBR(rows[r][iVal]) }); }
    if (!dados.length) { toast.error('Nenhuma linha válida.'); return; }
    setBusy(true);
    try {
      const p = await previaApi.criar({ convenio_id: form.convenio_id, competencia: form.competencia.trim(), arquivo_nome: form.arquivo_nome, itens: dados });
      await auditoriaApi.log('criar_previa', 'previas', p.id, { competencia: form.competencia, itens: dados.length });
      toast.success(`Prévia criada: ${dados.length} item(ns).`);
      setForm({ convenio_id: '', competencia: '', arquivo_nome: '', csv: '' });
      const ps = await load(); verItens(ps.find((x) => x.id === p.id) || p);
    } catch (err) { toast.error(err.message || 'Falha ao criar prévia.'); }
    finally { setBusy(false); }
  };

  const verItens = async (p, status = 'todos') => {
    setSel(p); setFiltro(status);
    try { setItens(await previaApi.itens(p.id, status)); } catch { setItens([]); }
  };

  const enviar = async (p) => {
    try { await previaApi.enviar(p.id); await auditoriaApi.log('enviar_previa', 'previas', p.id, {}); toast.success('Prévia marcada como enviada (portais).'); const ps = await load(); if (sel?.id === p.id) setSel(ps.find((x) => x.id === p.id)); }
    catch (err) { toast.error(err.message); }
  };

  const importarResultado = async () => {
    const rows = parseCSV(resCsv);
    if (rows.length < 2) { toast.error('CSV vazio.'); return; }
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const iCpf = head.findIndex((h) => h.includes('cpf'));
    const iSt = head.findIndex((h) => h.includes('status') || h.includes('resultado'));
    const iMg = head.findIndex((h) => h.includes('margem'));
    const iMt = head.findIndex((h) => h.includes('motivo') || h.includes('critica') || h.includes('crítica'));
    if (iCpf < 0) { toast.error('CSV precisa de cpf.'); return; }
    const dados = [];
    for (let r = 1; r < rows.length; r++) {
      const cpf = soDig(rows[r][iCpf]); if (!cpf) continue;
      dados.push({ cpf, status: iSt >= 0 ? (rows[r][iSt] || '').trim().toLowerCase() : 'processado', margem: iMg >= 0 ? numBR(rows[r][iMg]) : null, motivo: iMt >= 0 ? (rows[r][iMt] || null) : null });
    }
    if (!dados.length) { toast.error('Nenhuma linha válida.'); return; }
    setBusy(true);
    try {
      const n = await previaApi.importarResultado(sel.id, dados);
      await auditoriaApi.log('resultado_previa', 'previas', sel.id, { aplicados: n });
      toast.success(`Resultado aplicado a ${n} item(ns).`);
      setResOpen(false); setResCsv('');
      const ps = await load(); setSel(ps.find((x) => x.id === sel.id) || sel); verItens(sel, filtro);
    } catch (err) { toast.error(err.message || 'Falha ao importar resultado.'); }
    finally { setBusy(false); }
  };

  const tratarCriticas = async () => {
    setBusy(true);
    try {
      const n = await previaApi.tratarCriticas(sel.id, numBR(valorMin));
      await auditoriaApi.log('tratar_criticas_previa', 'previas', sel.id, { reprocessadas: n, valor_minimo: numBR(valorMin) });
      toast.success(n > 0 ? `${n} crítica(s) reprocessada(s) pela margem disponível.` : 'Nenhuma crítica elegível (margem < mínimo).');
      verItens(sel, filtro);
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const remover = async (p) => {
    if (!(await confirmar({ title: 'Remover prévia', description: `Remover a prévia de ${p.competencia}?`, destructive: true, confirmText: 'Remover' }))) return;
    try { await previaApi.remover(p.id); if (sel?.id === p.id) setSel(null); load(); } catch (err) { toast.error(err.message); }
  };

  const resumo = useMemo(() => { const m = { pendente: 0, processado: 0, critica: 0, reprocessar: 0 }; itens.forEach((i) => { m[i.status] = (m[i.status] || 0) + 1; }); return m; }, [itens]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">BPOPrévia (cartão) — prévia mensal dos descontos a processar nos portais, captura do resultado e tratamento automático de críticas (reprocessa pela margem disponível).</p>

      {/* Criar prévia */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2"><CreditCard className="w-4 h-4 text-primary" /> Nova prévia</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Convênio</Label>
            <Select value={form.convenio_id} onValueChange={(v) => setForm({ ...form, convenio_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>{convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Competência (AAAA-MM)</Label><Input value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} placeholder="2026-07" /></div>
        </div>
        <Textarea rows={3} value={form.csv} onChange={(e) => setForm({ ...form, csv: e.target.value })} placeholder="CSV: cpf, valor (a descontar)" className="font-mono text-xs" />
        <div className="flex justify-end"><Button onClick={criar} disabled={busy} className="gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileCheck2 className="w-4 h-4" />} Criar prévia</Button></div>
      </div>

      {/* Prévias */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? <EmptyState title="Carregando…" />
        : previas.length === 0 ? <EmptyState icon={CreditCard} title="Nenhuma prévia." />
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
              {previas.map((p) => (
                <tr key={p.id} className={`border-b border-border hover:bg-muted/50 ${sel?.id === p.id ? 'bg-primary/5' : ''}`}>
                  <td className="px-4 py-3 font-medium text-foreground">{p.competencia}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.convenio?.nome || '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground num">{p.total_itens}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground num hidden sm:table-cell">{brl(p.total_valor)}</td>
                  <td className="px-4 py-3"><StatusBadge className={P_COR[p.status]}>{P_STATUS[p.status]}</StatusBadge></td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {p.status === 'rascunho' && <button onClick={() => enviar(p)} title="Marcar enviada" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded inline-flex"><Send className="w-4 h-4" /></button>}
                    <button onClick={() => verItens(p)} title="Ver itens" className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded inline-flex"><ChevronRight className="w-4 h-4" /></button>
                    <button onClick={() => remover(p)} title="Remover" className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded inline-flex"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Itens da prévia */}
      {sel && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold text-foreground">Itens — {sel.competencia} {sel.convenio?.nome ? `· ${sel.convenio.nome}` : ''}</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setResOpen(true)} className="gap-1.5"><Upload className="w-3.5 h-3.5" /> Resultado</Button>
              <div className="flex items-center gap-1">
                <Input value={valorMin} onChange={(e) => setValorMin(e.target.value)} placeholder="mín. R$" className="w-24 h-8 text-xs" />
                <Button size="sm" onClick={tratarCriticas} disabled={busy} className="gap-1.5"><Wand2 className="w-3.5 h-3.5" /> Tratar críticas</Button>
              </div>
              <button onClick={() => setSel(null)} className="text-xs text-muted-foreground hover:text-foreground">fechar</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => verItens(sel, 'todos')} className={`px-2.5 py-1 rounded-full text-xs border ${filtro === 'todos' ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>Todos ({itens.length})</button>
            {['pendente', 'processado', 'critica', 'reprocessar'].map((s) => (
              <button key={s} onClick={() => verItens(sel, s)} className={`px-2.5 py-1 rounded-full text-xs border ${filtro === s ? 'border-primary' : 'border-border'}`}>{I_STATUS[s]} ({resumo[s] || 0})</button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">CPF</th>
                <th className="py-2 pr-3 font-medium text-right">A descontar</th>
                <th className="py-2 pr-3 font-medium text-right">Margem disp.</th>
                <th className="py-2 pr-3 font-medium text-right">Efetivo</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-0 font-medium">Motivo</th>
              </tr></thead>
              <tbody>
                {itens.slice(0, 500).map((i) => (
                  <tr key={i.id} className="border-b border-border last:border-0">
                    <td className="py-2 pr-3 font-mono text-xs text-muted-foreground">{i.cpf || '—'}</td>
                    <td className="py-2 pr-3 text-right num">{brl(i.valor_a_descontar)}</td>
                    <td className="py-2 pr-3 text-right num text-muted-foreground">{i.margem_disponivel != null ? brl(i.margem_disponivel) : '—'}</td>
                    <td className="py-2 pr-3 text-right num text-foreground">{i.valor_efetivo != null ? brl(i.valor_efetivo) : '—'}</td>
                    <td className="py-2 pr-3"><StatusBadge className={I_COR[i.status]}>{I_STATUS[i.status]}</StatusBadge></td>
                    <td className="py-2 pr-0 text-xs text-muted-foreground max-w-[160px] truncate" title={i.motivo_critica || ''}>{i.motivo_critica || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Importar resultado */}
      <Dialog open={resOpen} onOpenChange={setResOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resultado do processamento — {sel?.competencia}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground">CSV do portal: colunas <b>cpf</b>, <b>status</b> (processado/critica), <b>margem</b> (disponível), <b>motivo</b>.</p>
            <Textarea rows={6} value={resCsv} onChange={(e) => setResCsv(e.target.value)} placeholder="cpf,status,margem,motivo" className="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResOpen(false)}>Cancelar</Button>
            <Button onClick={importarResultado} disabled={busy} className="gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Aplicar resultado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
