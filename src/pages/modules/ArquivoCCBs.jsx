import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ccbsArquivoApi } from '@/lib/api/ccbsArquivo';
import { brl, dataBR, brlUsd } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/kit';
import { FileText, Search, Download, ExternalLink, ShieldCheck, ShieldAlert, Loader2, Archive, Cloud, History, Eye } from 'lucide-react';

const ST_COR = {
  emitida: 'bg-blue-50 text-blue-700', assinada: 'bg-green-50 text-green-700',
  cancelada: 'bg-muted text-muted-foreground', substituida: 'bg-amber-50 text-amber-700',
};
const dt = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');
const mesDe = (iso) => (iso ? String(iso).slice(0, 7) : '');

function Kpi({ label, value, sub }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

const GRUPOS_DET = [
  { t: 'Identificação', cs: [['numero', 'Nº CCB'], ['modalidade', 'Modalidade'], ['status', 'Status'], ['praca_pagamento', 'Praça']] },
  { t: 'Financeiro', cs: [['valor_principal', 'Principal', 1], ['valor_liberado', 'Liberado', 1], ['valor_total', 'Total', 1], ['taxa_mensal', 'Taxa a.m. (%)'], ['taxa_anual', 'Taxa a.a. (%)'], ['cet_mensal', 'CET a.m. (%)'], ['cet_anual', 'CET a.a. (%)'], ['iof', 'IOF', 1], ['tarifa_cadastro', 'Tarifa', 1], ['prazo', 'Prazo'], ['primeiro_vencimento', '1º venc.'], ['ultimo_vencimento', 'Últ. venc.']] },
  { t: 'Partes / banco', cs: [['credor_nome', 'Credor'], ['credor_cnpj', 'CNPJ credor'], ['correspondente_nome', 'Correspondente'], ['banco_credito', 'Banco'], ['agencia_credito', 'Agência'], ['conta_credito', 'Conta'], ['tipo_conta', 'Tipo conta']] },
];

export default function ArquivoCCBs() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('todos');
  const [mes, setMes] = useState('todos');

  const [sel, setSel] = useState(null);
  const [det, setDet] = useState(null);
  const [loadingDet, setLoadingDet] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setLista(await ccbsArquivoApi.list()); } catch (e) { toast.error(e.message || 'Falha ao carregar.'); setLista([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const meses = useMemo(() => Array.from(new Set(lista.map((c) => mesDe(c.created_at)).filter(Boolean))).sort().reverse(), [lista]);
  const statuses = useMemo(() => Array.from(new Set(lista.map((c) => c.status).filter(Boolean))), [lista]);

  const filtrada = useMemo(() => {
    const t = q.trim().toLowerCase();
    return lista.filter((c) => {
      if (status !== 'todos' && c.status !== status) return false;
      if (mes !== 'todos' && mesDe(c.created_at) !== mes) return false;
      if (!t) return true;
      const cli = c.proposta?.cliente || {};
      return [c.numero, cli.nome, cli.cpf, c.dados_extraidos?.convenio, c.credor_nome]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(t));
    });
  }, [lista, q, status, mes]);

  const kpis = useMemo(() => ({
    total: lista.length,
    exec: lista.filter((c) => c.forca_executiva).length,
    vop: lista.reduce((s, c) => s + Number(c.valor_principal || 0), 0),
  }), [lista]);

  const abrir = async (c) => {
    setSel(c); setDet(null); setLoadingDet(true);
    try { setDet(await ccbsArquivoApi.detalhe(c.id)); } catch { setDet({}); }
    finally { setLoadingDet(false); }
  };
  const baixar = async (c) => {
    try {
      const dd = await ccbsArquivoApi.detalhe(c.id);
      if (dd.pdfUrl) window.open(dd.pdfUrl, '_blank');
      else toast.error('PDF não disponível para esta CCB.');
    } catch { toast.error('Falha ao gerar o link do PDF.'); }
  };

  const cli = sel?.proposta?.cliente || {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="CCBs" value={kpis.total} sub="geradas" />
        <Kpi label="Força executiva" value={kpis.exec} sub={`${kpis.total ? Math.round(kpis.exec / kpis.total * 100) : 0}% do total`} />
        <Kpi label="VOP" value={brl(kpis.vop)} sub="soma do principal" />
        <Kpi label="Filtradas" value={filtrada.length} />
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nº CCB, nome, CPF, convênio…" className="pl-8" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos status</SelectItem>{statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="todos">Todos meses</SelectItem>{meses.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? <EmptyState title="Carregando…" />
          : filtrada.length === 0 ? <EmptyState icon={Archive} title="Nenhuma CCB" description="CCBs aprovadas/geradas aparecem aqui, com banco completo e log." />
            : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Nº CCB</th>
                    <th className="text-left px-3 py-2 font-medium">Cliente</th>
                    <th className="text-left px-3 py-2 font-medium hidden md:table-cell">Convênio</th>
                    <th className="text-right px-3 py-2 font-medium">Principal</th>
                    <th className="text-center px-3 py-2 font-medium">Prazo</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-center px-3 py-2 font-medium">Exec.</th>
                    <th className="text-left px-3 py-2 font-medium hidden lg:table-cell">Gerada</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtrada.map((c) => {
                    const cl = c.proposta?.cliente || {};
                    return (
                      <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium text-foreground">{c.numero || '—'}</td>
                        <td className="px-3 py-2">{cl.nome || '—'}<span className="block text-[11px] text-muted-foreground">{cl.cpf || ''}</span></td>
                        <td className="px-3 py-2 text-muted-foreground hidden md:table-cell truncate max-w-[160px]">{c.dados_extraidos?.convenio || '—'}</td>
                        <td className="px-3 py-2 text-right">{brl(c.valor_principal || 0)}</td>
                        <td className="px-3 py-2 text-center">{c.prazo || '—'}</td>
                        <td className="px-3 py-2"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${ST_COR[c.status] || 'bg-muted text-muted-foreground'}`}>{c.status}</span></td>
                        <td className="px-3 py-2 text-center">{c.forca_executiva ? <ShieldCheck className="w-4 h-4 text-green-600 inline" /> : <ShieldAlert className="w-4 h-4 text-amber-500 inline" />}</td>
                        <td className="px-3 py-2 text-muted-foreground hidden lg:table-cell whitespace-nowrap">{dataBR(c.created_at)}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => abrir(c)} title="Detalhe + log"><Eye className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => baixar(c)} title="Baixar PDF"><Download className="w-4 h-4" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
      </div>

      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-4 h-4" /> CCB {sel?.numero} — {cli.nome}</DialogTitle></DialogHeader>
          {loadingDet ? <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div> : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                {det?.pdfUrl && <a href={det.pdfUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="gap-2"><Download className="w-4 h-4" /> Baixar PDF</Button></a>}
                {det?.ing?.drive_file_id && <a href={`https://drive.google.com/file/d/${det.ing.drive_file_id}/view`} target="_blank" rel="noreferrer"><Button size="sm" variant="outline" className="gap-2"><Cloud className="w-4 h-4" /> Ver no Drive</Button></a>}
                {sel?.contrato?.id && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground px-2"><ExternalLink className="w-3.5 h-3.5" /> Contrato {sel.contrato.numero_contrato || sel.contrato.id.slice(0, 8)}</span>}
                {det?.ing?.modelo_usado && <span className="text-xs text-muted-foreground px-2">Lido com {det.ing.modelo_usado} · conf. {det.ing.confianca != null ? `${Math.round(det.ing.confianca * 100)}%` : '—'}</span>}
              </div>

              {GRUPOS_DET.map((g) => (
                <div key={g.t}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80 border-b border-border pb-0.5 mb-1.5">{g.t}</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                    {g.cs.map(([k, label, moeda]) => (
                      <div key={k} className="flex justify-between gap-2 border-b border-dashed border-border/50 py-0.5">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <span className="text-foreground text-right">{sel?.[k] == null || sel?.[k] === '' ? '—' : (moeda ? brl(sel[k]) : String(sel[k]))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {sel?.dados_extraidos && (
                <details className="rounded-lg border border-border">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted-foreground">JSON completo da leitura (todos os campos)</summary>
                  <pre className="text-[11px] p-3 overflow-x-auto bg-muted/30">{JSON.stringify(sel.dados_extraidos, null, 2)}</pre>
                </details>
              )}

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80 border-b border-border pb-0.5 mb-1.5 flex items-center gap-1"><History className="w-3.5 h-3.5" /> Log</p>
                {(det?.tentativas?.length || 0) === 0 && (det?.audit?.length || 0) === 0
                  ? <p className="text-xs text-muted-foreground">Sem eventos registrados.</p>
                  : (
                    <div className="space-y-1 text-xs">
                      {(det?.tentativas || []).map((t) => (
                        <div key={t.id} className="flex justify-between gap-2 text-muted-foreground">
                          <span>{dt(t.created_at)} · leitura {t.modelo} {t.reprocessamento ? '(reproc.)' : ''}</span>
                          <span>{t.status} · {brlUsd(t.custo_usd)}</span>
                        </div>
                      ))}
                      {(det?.audit || []).map((a, i) => (
                        <div key={i} className="flex justify-between gap-2 text-muted-foreground">
                          <span>{dt(a.created_at)} · {a.acao}</span>
                          <span className="truncate max-w-[220px]">{a.valor_novo?.justificativa || ''}</span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
