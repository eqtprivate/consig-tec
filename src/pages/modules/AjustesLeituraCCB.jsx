import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { ingestaoConfigApi, MODELOS_CCB, MODELO_LABEL } from '@/lib/api/ingestaoConfig';
import { ingestaoApi } from '@/lib/api/ingestao';
import { auditoriaApi } from '@/lib/api/auditoria';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/kit';
import { SlidersHorizontal, Save, Loader2, RefreshCw, Cpu, AlertTriangle, ShieldQuestion, History, HardDrive, Cloud, FolderOpen, ShieldCheck, Package } from 'lucide-react';

const dt = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '—');
const usd = (v) => (v == null ? '—' : `US$ ${Number(v).toFixed(4)}`);
const pct = (v) => (v == null ? '—' : `${Math.round(Number(v) * 100)}%`);

const ST_TENT = {
  ok: { label: 'OK', cor: 'bg-green-50 text-green-700 border-green-200' },
  erro: { label: 'Erro', cor: 'bg-red-50 text-red-700 border-red-200' },
  duplicado: { label: 'Duplicado', cor: 'bg-muted text-muted-foreground border-border' },
};

export default function AjustesLeituraCCB() {
  const { isAdmin, isSuperadmin, empresaView } = useAuth();
  const [modelo, setModelo] = useState('claude-sonnet-5');
  const [confPct, setConfPct] = useState(75);
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [tentativas, setTentativas] = useState([]);
  const [loadingLog, setLoadingLog] = useState(true);
  const [uso, setUso] = useState(null);
  const [driveAtivo, setDriveAtivo] = useState(false);
  const [driveFolder, setDriveFolder] = useState('');
  const [salvandoArq, setSalvandoArq] = useState(false);

  // Reprocessar
  const [repRow, setRepRow] = useState(null);
  const [repModelo, setRepModelo] = useState('claude-opus-4-8');
  const [repBusy, setRepBusy] = useState(false);

  const bloqueadoSuper = isSuperadmin && !empresaView; // superadmin precisa focar uma empresa

  const carregarConfig = async () => {
    try {
      const c = await ingestaoConfigApi.get();
      if (c) {
        setModelo(c.modelo || 'claude-sonnet-5');
        setConfPct(Math.round(Number(c.confianca_minima ?? 0.75) * 100));
        setDriveAtivo(!!c.drive_ativo);
        setDriveFolder(c.drive_folder_id || '');
      }
    } catch { /* usa defaults */ }
    finally { setCarregado(true); }
  };
  const carregarUso = () => ingestaoConfigApi.usoIngestao().then(setUso).catch(() => setUso(null));
  const carregarLog = async () => {
    setLoadingLog(true);
    try { setTentativas(await ingestaoConfigApi.tentativas(80)); } catch { setTentativas([]); }
    finally { setLoadingLog(false); }
  };
  useEffect(() => { carregarConfig(); carregarLog(); carregarUso(); /* eslint-disable-next-line */ }, [empresaView]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await ingestaoConfigApi.salvar({ modelo, confianca_minima: Math.min(100, Math.max(0, confPct)) / 100 });
      await auditoriaApi.log('config_leitura_ccb', 'config_ingestao_ccb', null, { modelo, confianca_minima: confPct / 100 });
      toast.success('Ajustes salvos. Valem na próxima leitura de CCB.');
    } catch (e) { toast.error(e.message || 'Falha ao salvar.'); }
    finally { setSalvando(false); }
  };

  const salvarArq = async () => {
    setSalvandoArq(true);
    try {
      await ingestaoConfigApi.salvarArquivamento({ drive_folder_id: driveFolder.trim(), drive_ativo: driveAtivo });
      await auditoriaApi.log('config_arquivamento_ccb', 'config_ingestao_ccb', null, { drive_ativo: driveAtivo, drive_folder_id: driveFolder.trim() });
      toast.success('Arquivamento salvo.');
    } catch (e) { toast.error(e.message || 'Falha ao salvar.'); }
    finally { setSalvandoArq(false); }
  };

  const reprocessar = async () => {
    if (!repRow) return;
    setRepBusy(true);
    try {
      const r = await ingestaoApi.reprocessar(repRow.ingestao_id, repModelo);
      await auditoriaApi.log('reprocessar_ccb', 'ingestoes_documento', repRow.ingestao_id, { modelo: repModelo });
      if (r.status === 'erro') toast.error(`Reprocessamento falhou: ${r.error || ''}`);
      else toast.success(`Reprocessado com ${MODELO_LABEL[repModelo] || repModelo}.`);
      setRepRow(null); carregarLog();
    } catch (e) { toast.error(e.message || 'Falha ao reprocessar.'); }
    finally { setRepBusy(false); }
  };

  if (!isAdmin) return <EmptyState icon={ShieldQuestion} title="Restrito a administradores" description="Os ajustes da leitura de CCB são visíveis apenas para administradores." />;

  return (
    <div className="space-y-5">
      {/* Uso do plano (cota) */}
      {uso?.uso && (
        <div className={`bg-card rounded-xl border shadow-sm p-4 space-y-3 ${uso.bloqueia ? 'border-red-300' : 'border-border'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Package className="w-4 h-4 text-primary" /><h3 className="text-sm font-semibold text-foreground">Uso do plano{uso.plano_nome ? ` — ${uso.plano_nome}` : ''}</h3></div>
            {uso.bloqueia && <span className="text-[11px] text-red-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> cota excedida</span>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'Leituras (mês)', usado: uso.uso.leituras_mes, limite: uso.limites?.leituras_ccb_mes },
              { label: 'Documentos', usado: uso.uso.documentos, limite: uso.limites?.documentos },
              { label: 'Armazenamento (MB)', usado: uso.uso.armazenamento_mb, limite: uso.limites?.armazenamento_mb },
            ].map((m) => {
              const excedido = m.limite != null && Number(m.usado) >= Number(m.limite);
              const pct = m.limite ? Math.min(100, Math.round((Number(m.usado) / Number(m.limite)) * 100)) : 6;
              return (
                <div key={m.label}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className={`font-semibold ${excedido ? 'text-red-600' : 'text-foreground'}`}>{Number(m.usado || 0).toLocaleString('pt-BR')} / {m.limite == null ? '∞' : Number(m.limite).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded overflow-hidden"><div className={`h-full rounded ${excedido ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">Consumo de IA no mês: <b>{Number(uso.uso.tokens_mes || 0).toLocaleString('pt-BR')}</b> tokens · <b>US$ {Number(uso.uso.custo_mes || 0).toFixed(2)}</b>.</p>
        </div>
      )}

      {/* Config */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Ajustes da leitura de CCB</h3>
        </div>

        {bloqueadoSuper ? (
          <div className="flex items-start gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span>Você é superadmin. Selecione uma empresa em <b>“Ver como”</b> para configurar o modelo dela.</span>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Modelo */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" /> Modelo de leitura</Label>
              <Select value={modelo} onValueChange={setModelo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELOS_CCB.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label} — {m.tag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(() => { const m = MODELOS_CCB.find((x) => x.value === modelo); return m ? (
                <p className="text-[11px] text-muted-foreground">{m.preco} · <b>{m.custoCcb}</b></p>
              ) : null; })()}
            </div>

            {/* Limite de confiança */}
            <div className="space-y-1.5">
              <Label>Limite de confiança para revisão obrigatória</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={100} step={5} value={confPct}
                  onChange={(e) => setConfPct(Number(e.target.value))} className="w-24" />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Abaixo disso a CCB entra <b>marcada para revisão</b> (exige justificativa), mesmo sem divergência de valores.</p>
            </div>
          </div>
        )}

        {!bloqueadoSuper && (
          <div className="flex justify-end">
            <Button onClick={salvar} disabled={salvando || !carregado} className="gap-2">
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar ajustes
            </Button>
          </div>
        )}
      </div>

      {/* Arquivamento dos PDFs */}
      <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Arquivamento dos PDFs</h3>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <ShieldCheck className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
          <div className="text-xs text-muted-foreground">
            <p className="text-foreground font-medium">Supabase Storage — principal (sempre ativo)</p>
            <p>Cada CCB fica em bucket <b>privado</b> (<code>ccb-docs</code>), criptografado em repouso, organizado por <b>empresa/ano/mês</b>. Acesso só por link assinado temporário — nunca público.</p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Espelhar também no Google Drive (alternativa)</span>
            </div>
            <Switch checked={driveAtivo} onCheckedChange={setDriveAtivo} disabled={bloqueadoSuper} />
          </div>
          {driveAtivo && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><FolderOpen className="w-3.5 h-3.5" /> ID da pasta do Drive</Label>
              <Input value={driveFolder} onChange={(e) => setDriveFolder(e.target.value)} placeholder="ex.: 1AbC…xyz (ID da pasta no Google Drive)" disabled={bloqueadoSuper} />
              <p className="text-[11px] text-muted-foreground">Compartilhe essa pasta com a <b>conta de serviço do Google</b> (permissão de Editor) para o sistema poder gravar. O espelho roda na aprovação de cada CCB, organizando por ano.</p>
            </div>
          )}
          {!bloqueadoSuper && (
            <div className="flex justify-end">
              <Button onClick={salvarArq} disabled={salvandoArq} size="sm" className="gap-2">
                {salvandoArq ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar arquivamento
              </Button>
            </div>
          )}
          {bloqueadoSuper && <p className="text-[11px] text-amber-600">Selecione uma empresa em “Ver como” para configurar o Drive dela.</p>}
        </div>
      </div>

      {/* Log de tentativas */}
      <div className="bg-card rounded-xl border border-border shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Log de tentativas de leitura</h3>
          </div>
          <Button variant="outline" size="sm" onClick={carregarLog} className="gap-2"><RefreshCw className="w-3.5 h-3.5" /> Atualizar</Button>
        </div>
        {loadingLog ? <EmptyState title="Carregando…" />
          : tentativas.length === 0 ? <EmptyState icon={History} title="Sem leituras ainda" description="Cada CCB enviada para leitura aparece aqui, com modelo, custo e resultado." />
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Data</th>
                      <th className="text-left px-3 py-2 font-medium">Arquivo</th>
                      <th className="text-left px-3 py-2 font-medium">Modelo</th>
                      <th className="text-left px-3 py-2 font-medium">Status</th>
                      <th className="text-right px-3 py-2 font-medium">Confiança</th>
                      <th className="text-right px-3 py-2 font-medium">Tokens (E/S)</th>
                      <th className="text-right px-3 py-2 font-medium">Custo</th>
                      <th className="text-right px-3 py-2 font-medium">Tempo</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tentativas.map((t) => {
                      const st = ST_TENT[t.status] || ST_TENT.ok;
                      const podeReprocessar = t.ingestao_id && (t.status === 'erro' || t.revisao_forcada);
                      return (
                        <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                          <td className="px-3 py-2 whitespace-nowrap">{dt(t.created_at)}</td>
                          <td className="px-3 py-2 max-w-[180px] truncate" title={t.arquivo_nome}>{t.arquivo_nome || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {MODELO_LABEL[t.modelo] || t.modelo || '—'}
                            {t.reprocessamento && <span className="ml-1 text-[10px] text-primary">↻</span>}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium ${st.cor}`}>{st.label}</span>
                            {t.revisao_forcada && <span className="ml-1 text-[10px] text-amber-600" title="Confiança abaixo do limite">⚠ revisão</span>}
                          </td>
                          <td className="px-3 py-2 text-right">{pct(t.confianca)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{t.tokens_entrada != null ? `${t.tokens_entrada}/${t.tokens_saida ?? '—'}` : '—'}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{usd(t.custo_usd)}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">{t.duracao_ms != null ? `${(t.duracao_ms / 1000).toFixed(1)}s` : '—'}</td>
                          <td className="px-3 py-2 text-right">
                            {podeReprocessar && (
                              <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]"
                                onClick={() => { setRepRow(t); setRepModelo('claude-opus-4-8'); }}>
                                <RefreshCw className="w-3 h-3" /> Reprocessar
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        {tentativas.some((t) => t.erro) && (
          <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
            Erros recentes: {tentativas.filter((t) => t.erro).slice(0, 3).map((t) => t.erro).join(' · ')}
          </div>
        )}
      </div>

      {/* Dialog reprocessar */}
      <Dialog open={!!repRow} onOpenChange={(o) => !o && setRepRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reprocessar leitura</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Relê <b>{repRow?.arquivo_nome || 'a CCB'}</b> a partir do PDF já armazenado, com o modelo escolhido.
              A ingestão volta para conferência com o novo resultado.
            </p>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Select value={repModelo} onValueChange={setRepModelo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELOS_CCB.map((m) => <SelectItem key={m.value} value={m.value}>{m.label} — {m.tag}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepRow(null)} disabled={repBusy}>Cancelar</Button>
            <Button onClick={reprocessar} disabled={repBusy} className="gap-2">
              {repBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Reprocessar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
