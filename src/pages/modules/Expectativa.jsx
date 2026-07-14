import React, { useState } from 'react';
import { expectativaApi } from '@/lib/api/conciliacao';
import { conveniosApi } from '@/lib/api/convenios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { parseCSV } from '@/lib/pixconsigImport';
import { brl } from '@/lib/format';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, StatusBadge } from '@/components/kit';
import { Wand2, Upload, Loader2, RefreshCw } from 'lucide-react';

const soDig = (s) => (s || '').replace(/\D/g, '');
const numBR = (s) => { if (s == null || s === '') return 0; const n = Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };

export default function Expectativa() {
  const [convenios, setConvenios] = useState([]);
  const [convenio, setConvenio] = useState('');
  const [competencia, setCompetencia] = useState('');
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [csv, setCsv] = useState('');

  useEffect(() => { conveniosApi.list().then(setConvenios).catch(() => setConvenios([])); }, []);

  const carregar = async () => {
    if (!convenio || !competencia) return;
    setLoading(true);
    try { setItens(await expectativaApi.list(convenio, competencia)); } catch { setItens([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(); }, [convenio, competencia]); // eslint-disable-line react-hooks/exhaustive-deps

  const gerar = async () => {
    if (!convenio || !competencia.trim()) { toast.error('Selecione convênio e competência.'); return; }
    setBusy(true);
    try {
      const n = await expectativaApi.gerar(convenio, competencia.trim());
      await auditoriaApi.log('gerar_expectativa', 'expectativas_recebimento', null, { convenio, competencia, linhas: n });
      toast.success(`${n} linha(s) geradas da carteira.`);
      carregar();
    } catch (err) { toast.error(err.message || 'Falha ao gerar.'); }
    finally { setBusy(false); }
  };

  const importar = async () => {
    if (!convenio || !competencia.trim()) { toast.error('Selecione convênio e competência.'); return; }
    const rows = parseCSV(csv);
    if (rows.length < 2) { toast.error('CSV vazio.'); return; }
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const iCpf = head.findIndex((h) => h.includes('cpf'));
    const iVal = head.findIndex((h) => h.includes('valor'));
    if (iCpf < 0 || iVal < 0) { toast.error('CSV precisa de colunas cpf e valor.'); return; }
    const dados = [];
    for (let r = 1; r < rows.length; r++) { const cpf = soDig(rows[r][iCpf]); if (cpf) dados.push({ cpf, valor_esperado: numBR(rows[r][iVal]) }); }
    if (!dados.length) { toast.error('Nenhuma linha válida.'); return; }
    setBusy(true);
    try {
      const n = await expectativaApi.importar(convenio, competencia.trim(), dados);
      await auditoriaApi.log('importar_expectativa', 'expectativas_recebimento', null, { convenio, competencia, linhas: n });
      toast.success(`${n} linha(s) importadas.`); setCsv(''); carregar();
    } catch (err) { toast.error(err.message || 'Falha ao importar.'); }
    finally { setBusy(false); }
  };

  const total = itens.reduce((s, i) => s + Number(i.valor_esperado || 0), 0);
  const origem = itens[0]?.origem;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Expectativa de recebimento da competência — gerada da carteira (parcelas) ou importada do banco. É a base da conciliação.</p>

      <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Convênio</Label>
            <Select value={convenio} onValueChange={setConvenio}>
              <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
              <SelectContent>{convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Competência (AAAA-MM)</Label><Input value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="2026-07" /></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={gerar} disabled={busy} className="gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Gerar da carteira</Button>
          <Button variant="outline" onClick={carregar} className="gap-2"><RefreshCw className="w-4 h-4" /> Recarregar</Button>
        </div>
        <div className="border-t border-border pt-3 space-y-2">
          <Label className="text-[11px] text-muted-foreground">Ou importe do banco (CSV: cpf, valor)</Label>
          <Textarea rows={3} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="cpf,valor" className="font-mono text-xs" />
          <Button variant="outline" onClick={importar} disabled={busy} className="gap-2"><Upload className="w-4 h-4" /> Importar expectativa</Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border text-xs">
          <span className="text-muted-foreground">{itens.length} linha(s){origem ? <> · <StatusBadge className={origem === 'importada' ? 'bg-blue-50 text-blue-700' : 'bg-muted text-muted-foreground'}>{origem}</StatusBadge></> : ''}</span>
          <span className="font-semibold text-foreground num">Total: {brl(total)}</span>
        </div>
        {loading ? <EmptyState title="Carregando…" />
        : itens.length === 0 ? <EmptyState title="Sem expectativa" description="Selecione convênio + competência e gere da carteira ou importe." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground uppercase text-xs">CPF</th>
              <th className="text-left px-4 py-2 font-medium text-muted-foreground uppercase text-xs">Cliente</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground uppercase text-xs">Valor esperado</th>
            </tr></thead>
            <tbody>
              {itens.slice(0, 500).map((i) => (
                <tr key={i.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{i.cpf || '—'}</td>
                  <td className="px-4 py-2 text-foreground">{i.cliente?.nome || '—'}</td>
                  <td className="px-4 py-2 text-right num">{brl(i.valor_esperado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
