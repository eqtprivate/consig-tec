import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ingestaoApi } from '@/lib/api/ingestao';
import { auditoriaApi } from '@/lib/api/auditoria';
import { brl } from '@/lib/format';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, StatusBadge } from '@/components/kit';
import { Upload, Loader2, FileText, CheckCircle2, XCircle, AlertTriangle, ChevronRight, ScanLine } from 'lucide-react';

const ST = { recebido: 'Recebido', extraindo: 'Extraindo', aguardando_conferencia: 'Conferência', aprovado: 'Aprovado', rejeitado: 'Rejeitado', erro: 'Erro' };
const ST_COR = { recebido: 'bg-muted text-muted-foreground', extraindo: 'bg-blue-50 text-blue-700', aguardando_conferencia: 'bg-amber-50 text-amber-700', aprovado: 'bg-green-50 text-green-700', rejeitado: 'bg-muted text-muted-foreground', erro: 'bg-red-50 text-red-700' };
const ACAO = { completar_venda: 'Completar venda', novo_registro: 'Novo registro', duplicata: 'Duplicata' };

const CAMPOS = [
  { k: 'numero_ccb', label: 'Nº da CCB' },
  { k: 'cpf', label: 'CPF', sis: (p) => p?.cliente?.cpf },
  { k: 'nome_cliente', label: 'Cliente', sis: (p) => p?.cliente?.nome },
  { k: 'convenio', label: 'Convênio' },
  { k: 'valor_principal', label: 'Valor principal', num: true, sis: (p) => p?.valor_solicitado },
  { k: 'valor_total', label: 'Valor total', num: true },
  { k: 'taxa_mensal', label: 'Taxa a.m. (%)', num: true, sis: (p) => p?.taxa_mensal },
  { k: 'prazo', label: 'Prazo', num: true, sis: (p) => p?.prazo },
  { k: 'valor_parcela', label: 'Parcela (PMT)', num: true, sis: (p) => p?.valor_parcela },
  { k: 'data_emissao', label: 'Emissão' },
  { k: 'primeiro_vencimento', label: '1º vencimento' },
];

const fileToB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });

export default function IngestaoCCB() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef(null);

  const [sel, setSel] = useState(null);       // ingestão em conferência (completa)
  const [pdfUrl, setPdfUrl] = useState(null);
  const [dados, setDados] = useState({});
  const [acao, setAcao] = useState('novo_registro');
  const [justificativa, setJustificativa] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => { setLoading(true); setLista(await ingestaoApi.list().catch(() => [])); setLoading(false); };
  useEffect(() => { load(); }, []);

  const enviar = async (file) => {
    if (!file) return;
    setEnviando(true);
    try {
      const b64 = await fileToB64(file);
      const r = await ingestaoApi.ingerir(b64, file.name);
      await auditoriaApi.log('ingerir_ccb', 'ingestoes_documento', r.id, { arquivo: file.name, status: r.status, duplicado: !!r.duplicado });
      if (r.duplicado) toast.info('Arquivo já ingerido — abrindo a ingestão existente.');
      else if (r.status === 'erro') toast.error(`Extração falhou: ${r.error || ''}`);
      else toast.success('CCB lida — pronta para conferência.');
      await load();
      abrir({ id: r.id });
    } catch (err) { toast.error(err.message || 'Falha ao enviar.'); }
    finally { setEnviando(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  const abrir = async (row) => {
    try {
      const full = await ingestaoApi.get(row.id);
      setSel(full);
      setDados({ ...(full.dados_extraidos || {}) });
      setAcao(full.acao_sugerida === 'duplicata' ? 'duplicata' : (full.acao_sugerida || 'novo_registro'));
      setJustificativa('');
      setPdfUrl(await ingestaoApi.pdfUrl(full.storage_path));
    } catch (err) { toast.error(err.message); }
  };

  const divMap = useMemo(() => { const m = {}; (sel?.divergencias || []).forEach((d) => { m[d.campo] = d; }); return m; }, [sel]);
  const temCritica = (sel?.divergencias || []).some((d) => d.tipo === 'critica');

  const aprovar = async () => {
    if (temCritica && !justificativa.trim()) { toast.error('Divergência crítica — justificativa é obrigatória.'); return; }
    setBusy(true);
    try {
      const r = await ingestaoApi.aprovar({ ingestao_id: sel.id, acao, dados, justificativa });
      await auditoriaApi.log('aprovar_ingestao_ccb', 'ingestoes_documento', sel.id, { acao, ccb_id: r.ccb_id });
      toast.success(acao === 'completar_venda' || acao === 'novo_registro' ? 'CCB criada com sucesso.' : 'Ingestão finalizada.');
      setSel(null); load();
    } catch (err) { toast.error(err.message || 'Falha ao aprovar.'); }
    finally { setBusy(false); }
  };
  const rejeitar = async () => {
    setBusy(true);
    try {
      await ingestaoApi.aprovar({ ingestao_id: sel.id, acao: 'rejeitar', dados, justificativa });
      await auditoriaApi.log('rejeitar_ingestao_ccb', 'ingestoes_documento', sel.id, { justificativa });
      toast.success('Ingestão rejeitada.'); setSel(null); load();
    } catch (err) { toast.error(err.message); }
    finally { setBusy(false); }
  };

  const setCampo = (k, v) => setDados((d) => ({ ...d, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground flex items-center gap-2"><ScanLine className="w-4 h-4 text-primary" /> Ingestão & Leitura Automática de CCB</p>
          <p className="text-[11px] text-muted-foreground">A extração é uma <b>sugestão</b> — nada é gravado sem conferência e aprovação humana.</p>
        </div>
        <div>
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => enviar(e.target.files?.[0])} />
          <Button onClick={() => inputRef.current?.click()} disabled={enviando} className="gap-2">{enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar CCB (PDF)</Button>
        </div>
      </div>

      {/* Lista de ingestões */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? <EmptyState title="Carregando…" />
        : lista.length === 0 ? <EmptyState icon={FileText} title="Nenhuma CCB ingerida" description="Envie um PDF de CCB para leitura automática." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Arquivo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Nº CCB / CPF</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Sugestão</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Divergências</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {lista.map((r) => {
                const crit = (r.divergencias || []).filter((d) => d.tipo === 'critica').length;
                const av = (r.divergencias || []).filter((d) => d.tipo === 'aviso').length;
                return (
                  <tr key={r.id} className={`border-b border-border hover:bg-muted/50 ${sel?.id === r.id ? 'bg-primary/5' : ''}`}>
                    <td className="px-4 py-3 font-medium text-foreground truncate max-w-[200px]" title={r.arquivo_nome}>{r.arquivo_nome}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{r.dados_extraidos?.numero_ccb || '—'}{r.dados_extraidos?.cpf ? ` · ${r.dados_extraidos.cpf}` : ''}</td>
                    <td className="px-4 py-3">{r.acao_sugerida ? <StatusBadge className="bg-muted text-muted-foreground">{ACAO[r.acao_sugerida]}</StatusBadge> : '—'}</td>
                    <td className="px-4 py-3">
                      {crit > 0 ? <span className="inline-flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="w-3.5 h-3.5" /> {crit} crítica(s)</span>
                        : av > 0 ? <span className="text-xs text-amber-600">{av} aviso(s)</span>
                        : <span className="text-xs text-green-700">ok</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge className={ST_COR[r.status]}>{ST[r.status]}</StatusBadge></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => abrir(r)} className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded inline-flex"><ChevronRight className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Conferência: PDF × campos */}
      {sel && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm font-semibold text-foreground">Conferência — {sel.arquivo_nome}</p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Confiança: {sel.confianca != null ? `${Math.round(sel.confianca * 100)}%` : '—'}</span>
              <button onClick={() => setSel(null)} className="text-xs text-muted-foreground hover:text-foreground">fechar</button>
            </div>
          </div>

          {sel.acao_sugerida === 'duplicata' && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Nº de CCB já existe no sistema — provável <b>duplicata</b>. Confirme para descartar ou escolha outra ação.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* PDF */}
            <div className="rounded-lg border border-border overflow-hidden bg-muted/30 min-h-[420px]">
              {pdfUrl ? <iframe title="CCB" src={pdfUrl} className="w-full h-[520px]" />
                : <div className="h-[420px] flex items-center justify-center text-xs text-muted-foreground">Prévia do PDF indisponível.</div>}
            </div>

            {/* Campos: Extraído × Sistema */}
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1.2fr_1fr] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground px-1">
                <span>Campo</span><span>Extraído do PDF (editável)</span><span>No sistema</span>
              </div>
              {CAMPOS.map((c) => {
                const dv = divMap[c.k];
                const sistema = c.sis ? c.sis(sel.proposta) : null;
                const borda = dv ? (dv.tipo === 'critica' ? 'border-red-400' : 'border-amber-400') : 'border-border';
                return (
                  <div key={c.k}>
                    <div className="grid grid-cols-[1fr_1.2fr_1fr] gap-2 items-center">
                      <span className="text-xs text-muted-foreground">{c.label}</span>
                      <Input value={dados[c.k] ?? ''} onChange={(e) => setCampo(c.k, e.target.value)} className={`h-8 text-sm ${borda}`} />
                      <span className={`text-xs ${dv?.tipo === 'critica' ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {sistema != null && sistema !== '' ? (c.num ? brl(sistema) : sistema) : (acao === 'completar_venda' ? '—' : '(novo)')}
                      </span>
                    </div>
                    {dv && <p className={`text-[11px] mt-0.5 ml-[calc(33%)] ${dv.tipo === 'critica' ? 'text-red-600' : 'text-amber-600'}`}>{dv.mensagem}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ação + aprovação */}
          <div className="border-t border-border pt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-xs font-medium text-foreground">Ação:</span>
              {sel.acao_sugerida === 'duplicata' && (
                <label className="flex items-center gap-1.5 text-sm"><input type="radio" name="acao" checked={acao === 'duplicata'} onChange={() => setAcao('duplicata')} /> Duplicata (descartar)</label>
              )}
              <label className="flex items-center gap-1.5 text-sm"><input type="radio" name="acao" checked={acao === 'completar_venda'} onChange={() => setAcao('completar_venda')} disabled={!sel.proposta_id} /> Completar venda {sel.proposta?.numero ? `(${sel.proposta.numero})` : sel.proposta_id ? '' : '(sem proposta)'}</label>
              <label className="flex items-center gap-1.5 text-sm"><input type="radio" name="acao" checked={acao === 'novo_registro'} onChange={() => setAcao('novo_registro')} /> Novo registro</label>
            </div>
            {temCritica && (
              <div className="space-y-1.5">
                <Label className="text-xs text-red-600">Justificativa (obrigatória — há divergência crítica)</Label>
                <Textarea rows={2} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Explique por que a aprovação é válida apesar da divergência…" />
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={rejeitar} disabled={busy} className="gap-2"><XCircle className="w-4 h-4" /> Rejeitar</Button>
              <Button onClick={aprovar} disabled={busy || sel.status === 'aprovado'} className="gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {acao === 'duplicata' ? 'Confirmar duplicata' : 'Aprovar'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
