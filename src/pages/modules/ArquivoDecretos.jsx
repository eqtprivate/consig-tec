import React, { useEffect, useMemo, useState } from 'react';
import { decretosArquivoApi } from '@/lib/api/decretosArquivo';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState, StatusBadge } from '@/components/kit';
import { Gavel, Search, FileText, ExternalLink, Loader2, Building2, CheckCircle2, Database } from 'lucide-react';

const ST = { recebido: 'Recebido', extraindo: 'Extraindo', aguardando_conferencia: 'Conferência', aprovado: 'Aplicado', rejeitado: 'Rejeitado', erro: 'Erro' };
const ST_COR = { recebido: 'bg-muted text-muted-foreground', extraindo: 'bg-blue-50 text-blue-700', aguardando_conferencia: 'bg-amber-50 text-amber-700', aprovado: 'bg-green-50 text-green-700', rejeitado: 'bg-muted text-muted-foreground', erro: 'bg-red-50 text-red-700' };

const CAMPOS = [
  ['decreto_numero', 'Nº do decreto'], ['decreto_data', 'Data'], ['ente_nome', 'Ente'], ['uf', 'UF'], ['esfera', 'Esfera'], ['lei_base', 'Lei base'],
  ['margem_total_pct', 'Margem total (%)'], ['margem_cartao_pct', 'Margem cartão (%)'], ['prazo_maximo_meses', 'Prazo máx. (meses)'],
  ['limite_adiantamento_pct', 'Adiantamento (%)'], ['recomposicao_margem_horas', 'Recompor margem (h)'], ['reposicao_erario', 'Reposição ao erário'],
  ['prioridade_desconto', 'Prioridade (nº)'], ['vigencia', 'Vigência'], ['revogacoes', 'Revogações'],
];
const mb = (b) => b ? `${(Number(b) / 1048576).toFixed(2)} MB` : '—';
const val = (v) => v == null || v === '' ? '—' : (Array.isArray(v) ? v.join(', ') : String(v));

export default function ArquivoDecretos() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [det, setDet] = useState(null);
  const [detLoading, setDetLoading] = useState(false);

  const load = async () => { setLoading(true); try { setLista(await decretosArquivoApi.list()); } catch (e) { toast.error(e.message); } setLoading(false); };
  useEffect(() => { load(); }, []);

  const kpis = useMemo(() => {
    const aplicados = lista.filter((r) => r.status === 'aprovado');
    const convenios = new Set(aplicados.map((r) => r.convenio_id).filter(Boolean));
    const bytes = lista.reduce((s, r) => s + Number(r.tamanho_bytes || 0), 0);
    return { total: lista.length, aplicados: aplicados.length, convenios: convenios.size, bytes };
  }, [lista]);

  const filtrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((r) => {
      const d = r.dados_extraidos || {};
      return [r.arquivo_nome, d.decreto_numero, d.ente_nome, r.convenio?.nome].filter(Boolean).some((x) => String(x).toLowerCase().includes(q));
    });
  }, [lista, busca]);

  const abrir = async (r) => {
    setDetLoading(true); setDet({ ing: r, pdfUrl: null, tentativas: [] });
    try { setDet(await decretosArquivoApi.detalhe(r.id)); } catch (e) { toast.error(e.message); }
    finally { setDetLoading(false); }
  };

  const dados = det?.ing?.dados_extraidos || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2"><Gavel className="w-4 h-4 text-primary" /> Arquivo de Decretos</p>
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nº, ente ou convênio…" className="pl-8 h-9 w-64" />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Decretos lidos', v: kpis.total, icon: FileText },
          { label: 'Aplicados a convênios', v: kpis.aplicados, icon: CheckCircle2 },
          { label: 'Convênios cobertos', v: kpis.convenios, icon: Building2 },
          { label: 'Armazenamento', v: mb(kpis.bytes), icon: Database },
        ].map((k) => (
          <div key={k.label} className="bg-card rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><k.icon className="w-3.5 h-3.5 text-primary" /> {k.label}</div>
            <p className="text-xl font-semibold text-foreground mt-1">{k.v}</p>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? <EmptyState title="Carregando…" />
        : filtrada.length === 0 ? <EmptyState icon={FileText} title="Nenhum decreto" description="Os decretos lidos aparecerão aqui." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Decreto / ente</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Convênio</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Confiança</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">Arquivo</th>
            </tr></thead>
            <tbody>
              {filtrada.map((r) => {
                const d = r.dados_extraidos || {};
                return (
                  <tr key={r.id} onClick={() => abrir(r)} className="border-b border-border hover:bg-muted/50 cursor-pointer">
                    <td className="px-4 py-3 font-medium text-foreground">{d.decreto_numero || '—'}<span className="text-muted-foreground font-normal">{d.ente_nome ? ` · ${d.ente_nome}` : ''}</span></td>
                    <td className="px-4 py-3 text-muted-foreground">{r.convenio?.nome || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{r.confianca != null ? `${Math.round(r.confianca * 100)}%` : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge className={ST_COR[r.status]}>{ST[r.status] || r.status}</StatusBadge></td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-[220px] hidden md:table-cell" title={r.arquivo_nome}>{r.arquivo_nome}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!det} onOpenChange={(o) => !o && setDet(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base"><Gavel className="w-4 h-4 text-primary" /> {dados.decreto_numero ? `Decreto ${dados.decreto_numero}` : det?.ing?.arquivo_nome}{dados.ente_nome ? ` · ${dados.ente_nome}` : ''}</DialogTitle>
          </DialogHeader>
          {det && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <StatusBadge className={ST_COR[det.ing.status]}>{ST[det.ing.status] || det.ing.status}</StatusBadge>
                {det.ing.convenio?.nome && <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3" /> {det.ing.convenio.nome}</span>}
                {det.ing.modelo_usado && <span>modelo: {det.ing.modelo_usado}</span>}
                <span>tamanho: {mb(det.ing.tamanho_bytes)}</span>
                {det.pdfUrl && <a href={det.pdfUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> abrir PDF</a>}
                {detLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80 border-b border-border pb-1 mb-2">Regras extraídas</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                  {CAMPOS.map(([k, label]) => (
                    <div key={k}><span className="text-muted-foreground">{label}: </span><span className="text-foreground font-medium">{val(dados[k])}</span></div>
                  ))}
                </div>
                {Array.isArray(dados.tipos_consignacao_permitidos) && dados.tipos_consignacao_permitidos.length > 0 && (
                  <div className="mt-2 text-xs"><span className="text-muted-foreground">Tipos permitidos: </span><span className="text-foreground">{dados.tipos_consignacao_permitidos.join(', ')}</span></div>
                )}
                {Array.isArray(dados.consignatarias_habilitadas) && dados.consignatarias_habilitadas.length > 0 && (
                  <div className="mt-1 text-xs"><span className="text-muted-foreground">Consignatárias: </span><span className="text-foreground">{dados.consignatarias_habilitadas.join(', ')}</span></div>
                )}
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">JSON completo extraído</summary>
                <pre className="mt-2 p-2 bg-muted/50 rounded overflow-x-auto text-[10px] leading-relaxed">{JSON.stringify(dados, null, 2)}</pre>
              </details>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80 border-b border-border pb-1 mb-2">Log de leituras ({det.tentativas.length})</p>
                {det.tentativas.length === 0 ? <p className="text-xs text-muted-foreground">Sem tentativas registradas.</p> : (
                  <div className="space-y-1">
                    {det.tentativas.map((t) => (
                      <div key={t.id} className="flex items-center justify-between text-[11px] border-b border-border/60 pb-1">
                        <span className="text-foreground">{t.modelo || '—'} · {t.status}{t.reprocessamento ? ' (reproc.)' : ''}</span>
                        <span className="text-muted-foreground">{t.tokens_entrada != null ? `${t.tokens_entrada}+${t.tokens_saida ?? 0} tok` : ''}{t.duracao_ms ? ` · ${(t.duracao_ms / 1000).toFixed(1)}s` : ''}</span>
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
