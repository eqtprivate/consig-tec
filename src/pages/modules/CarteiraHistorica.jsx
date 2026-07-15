import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { carteiraApi, parseContratosCsv } from '@/lib/api/carteira';
import { auditoriaApi } from '@/lib/api/auditoria';
import { brl } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/kit';
import { Upload, Loader2, CheckCircle2, AlertTriangle, Download, BarChart3, Wallet } from 'lucide-react';

const COLS = ['numero_contrato', 'cpf', 'nome', 'convenio', 'valor_principal', 'valor_total', 'prazo', 'taxa_mensal', 'valor_parcela', 'data_assinatura', 'status'];

function Kpi({ label, value, sub }) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CarteiraHistorica() {
  const [metricas, setMetricas] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const [arquivo, setArquivo] = useState('');
  const [importando, setImportando] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const inputRef = React.useRef(null);

  const carregarMetricas = () => carteiraApi.metricas().then(setMetricas).catch(() => setMetricas(null));
  useEffect(() => { carregarMetricas(); }, []);

  const onArquivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivo(file.name);
    setRelatorio(null);
    try {
      const texto = await file.text();
      const parsed = parseContratosCsv(texto);
      setLinhas(parsed);
      if (!parsed.length) toast.error('CSV vazio ou sem linhas de dados.');
      else toast.success(`${parsed.length} linha(s) lidas de ${file.name}.`);
    } catch {
      toast.error('Falha ao ler o arquivo.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const importar = async () => {
    if (!linhas.length) return;
    setImportando(true);
    try {
      const r = await carteiraApi.importarHistorico(linhas);
      setRelatorio(r);
      await auditoriaApi.log('importar_carteira_historica', 'contratos', null, { arquivo, total: r.total, inseridos: r.inseridos, erros: (r.erros || []).length });
      toast.success(`${r.inseridos}/${r.total} contratos importados.`);
      setLinhas([]); setArquivo('');
      carregarMetricas();
    } catch (err) {
      toast.error(err.message || 'Falha na importação.');
    } finally {
      setImportando(false);
    }
  };

  const baixarModelo = () => {
    const csv = COLS.join(';') + '\n' + '000123;39053344705;Fulano de Tal;Prefeitura X;10000;13000;36;0.0199;430;2025-01-10;ativo';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'modelo_carteira_historica.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const m = metricas || {};
  const erros = relatorio?.erros || [];

  return (
    <div className="space-y-5">
      {/* KPIs reais da carteira */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Carteira (real)</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Contratos" value={m.qtd_contratos ?? '—'} sub="carteira viva" />
          <Kpi label="VOP" value={brl(m.vop || 0)} sub="valor de originação" />
          <Kpi label="VF" value={brl(m.vf || 0)} sub="valor futuro (a receber)" />
          <Kpi label="VF / VOP" value={m.vf_sobre_vop ?? '—'} sub="multiplicador" />
          <Kpi label="Ticket médio" value={brl(m.ticket_medio || 0)} />
          <Kpi label="Prazo médio" value={`${m.prazo_medio ?? '—'} meses`} />
          <Kpi label="PDD" value={brl(m.pdd || 0)} sub="parcelas em atraso" />
          <Kpi label="Deságio médio" value={`${m.desagio_medio_pct ?? 0}%`} sub="cessões" />
        </div>
      </div>

      {/* Importador */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Importar carteira histórica (CSV)</h3>
            <p className="text-xs text-muted-foreground">Colunas: {COLS.join(', ')}. Separador <code>;</code> ou <code>,</code>.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={baixarModelo} className="gap-2"><Download className="w-4 h-4" /> Modelo</Button>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onArquivo} />
            <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-2"><Upload className="w-4 h-4" /> Escolher CSV</Button>
            <Button size="sm" onClick={importar} disabled={!linhas.length || importando} className="gap-2">
              {importando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Importar {linhas.length ? `(${linhas.length})` : ''}
            </Button>
          </div>
        </div>
        {arquivo && <p className="text-xs text-muted-foreground">Arquivo: <span className="font-medium text-foreground">{arquivo}</span> — {linhas.length} linha(s) prontas.</p>}

        {/* Prévia */}
        {linhas.length > 0 && (
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-muted/50"><tr>{COLS.map((c) => <th key={c} className="text-left px-2 py-1.5 font-medium text-muted-foreground">{c}</th>)}</tr></thead>
              <tbody>
                {linhas.slice(0, 8).map((l, i) => (
                  <tr key={i} className="border-t border-border">{COLS.map((c) => <td key={c} className="px-2 py-1 truncate max-w-[120px]">{l[c]}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {linhas.length > 8 && <p className="text-[11px] text-muted-foreground px-2 py-1">+ {linhas.length - 8} linha(s)…</p>}
          </div>
        )}
      </div>

      {/* Relatório de inconsistências */}
      {relatorio && (
        <div className="bg-card rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-semibold text-foreground">Resultado: {relatorio.inseridos} de {relatorio.total} importados</h3>
          </div>
          {erros.length === 0
            ? <p className="text-sm text-muted-foreground">Sem inconsistências. 🎉</p>
            : (
              <div className="overflow-x-auto border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-800 text-xs font-medium"><AlertTriangle className="w-4 h-4" /> {erros.length} linha(s) com inconsistência (não importadas)</div>
                <table className="w-full text-xs">
                  <thead className="bg-muted/50"><tr><th className="text-left px-3 py-1.5 font-medium text-muted-foreground w-20">Linha</th><th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Motivo</th></tr></thead>
                  <tbody>{erros.map((e, i) => <tr key={i} className="border-t border-border"><td className="px-3 py-1 font-mono">{e.linha}</td><td className="px-3 py-1 text-red-700">{e.motivo}</td></tr>)}</tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {!metricas && !linhas.length && !relatorio && (
        <EmptyState icon={Wallet} title="Sem dados ainda" description="Baixe o modelo, preencha a carteira histórica e importe para alimentar os indicadores." />
      )}
    </div>
  );
}
