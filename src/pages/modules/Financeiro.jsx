import React, { useEffect, useState } from 'react';
import { useTabParam } from '@/lib/useTabParam';
import { toast } from 'sonner';
import { contratosApi } from '@/lib/api/contratos';
import { parcelasApi, carteiraApi } from '@/lib/api/parcelas';
import { repassesApi } from '@/lib/api/repasses';
import { conveniosApi } from '@/lib/api/convenios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl, dataBR, num } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { EmptyState, StatusBadge } from '@/components/kit';
import ConciliacaoFolha from '@/pages/modules/ConciliacaoFolha';
import Averbadoras from '@/pages/modules/Averbadoras';
import Expectativa from '@/pages/modules/Expectativa';
import PreviaCartao from '@/pages/modules/PreviaCartao';
import MonitorCaptura from '@/pages/modules/MonitorCaptura';
import { Wallet, CheckCircle2, ListPlus, Plus } from 'lucide-react';

const TABS = [
  { key: 'receb', label: 'Recebíveis' },
  { key: 'carteira', label: 'Carteira' },
  { key: 'concil', label: 'Conciliação (repasse)' },
  { key: 'expectativa', label: 'Expectativa' },
  { key: 'previa', label: 'Prévia (cartão)' },
  { key: 'folha', label: 'Conciliação (folha)' },
  { key: 'monitor', label: 'Monitor' },
  { key: 'averbadoras', label: 'Averbadoras' },
];
const C_CT = { ativo: 'bg-green-50 text-green-700', quitado: 'bg-muted text-muted-foreground', inadimplente: 'bg-red-50 text-red-700', cancelado: 'bg-muted text-muted-foreground' };
const C_CT_LBL = { ativo: 'Ativo', quitado: 'Quitado', inadimplente: 'Inadimplente', cancelado: 'Cancelado' };
const STATUS = { aberta: 'Aberta', paga: 'Paga', atrasada: 'Atrasada', renegociada: 'Renegociada' };
const CORES = {
  aberta: 'bg-muted text-muted-foreground', paga: 'bg-green-50 text-green-700',
  atrasada: 'bg-red-50 text-red-700', renegociada: 'bg-amber-50 text-amber-700',
};

/* ------------------------------ Recebíveis ------------------------------ */
function RecebiveisTab() {
  const { activeUnidade } = useAuth();
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [parcelas, setParcelas] = useState([]);
  const [loadingP, setLoadingP] = useState(false);
  const [gerando, setGerando] = useState(false);

  const load = async () => {
    setLoading(true);
    setContratos(await contratosApi.list(activeUnidade ? { franquia_id: activeUnidade.id } : {}).catch(() => []));
    setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const abrir = async (c) => {
    setSel(c); setLoadingP(true);
    setParcelas(await parcelasApi.listByContrato(c.id).catch(() => []));
    setLoadingP(false);
  };
  const recarregar = async () => {
    if (!sel) return;
    setParcelas(await parcelasApi.listByContrato(sel.id).catch(() => []));
  };

  const gerar = async () => {
    if (!sel?.prazo) return toast.error('Contrato sem prazo definido.');
    setGerando(true);
    try {
      const n = await parcelasApi.gerarCronograma(sel.id); // motor PMT no banco
      await auditoriaApi.log('gerar_cronograma_pmt', 'contratos', sel.id, { parcelas: n });
      if (n === 0) toast.info('Este contrato já possui cronograma.'); else toast.success(`${n} parcelas geradas.`);
      recarregar();
    } catch (err) {
      toast.error(err.message || 'Falha ao gerar cronograma.');
    } finally { setGerando(false); }
  };

  const pagar = async (p) => {
    await parcelasApi.registrarPagamento(p.id, p.valor, new Date().toISOString().slice(0, 10));
    await auditoriaApi.log('pagar_parcela', 'parcelas', p.id, {});
    recarregar();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Contratos e parcelas — cronograma pela tabela Price (motor de PMT)</p>
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? <EmptyState title="Carregando…" />
        : contratos.length === 0 ? <EmptyState title="Nenhum contrato." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Nº</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Cliente</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Principal</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">Taxa a.m.</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Prazo</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Parcelas</th>
            </tr></thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/50 cursor-pointer" onClick={() => abrir(c)}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.numero_contrato || c.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{c.cliente?.nome || '—'}</td>
                  <td className="px-4 py-3 text-right text-foreground hidden sm:table-cell">{brl(c.valor_principal)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{c.taxa_mensal != null ? `${c.taxa_mensal}%` : '—'}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{c.prazo ? `${c.prazo}x` : '—'}</td>
                  <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Wallet className="w-3.5 h-3.5" /> ver</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!sel} onOpenChange={(v) => !v && setSel(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Parcelas — {sel?.cliente?.nome} ({sel?.numero_contrato || sel?.id?.slice(0, 8)})</DialogTitle></DialogHeader>
          {loadingP ? <EmptyState title="Carregando…" />
          : parcelas.length === 0 ? (
            <EmptyState
              title="Nenhuma parcela gerada."
              description={`Cronograma pela tabela Price (${sel?.taxa_mensal != null ? `${sel.taxa_mensal}% a.m.` : 'sem juros'} · ${sel?.prazo || 0}x)`}
              action={<Button onClick={gerar} disabled={gerando} className="gap-2"><ListPlus className="w-4 h-4" /> {gerando ? 'Gerando…' : `Gerar ${sel?.prazo || 0} parcelas (PMT)`}</Button>}
            />
          ) : (
            <div className="max-h-96 overflow-y-auto -mx-2">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                  <th className="px-3 py-2">#</th><th className="px-3 py-2">Vencimento</th>
                  <th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th>
                </tr></thead>
                <tbody>
                  {parcelas.map((p) => (
                    <tr key={p.id} className="border-b border-border">
                      <td className="px-3 py-2 text-muted-foreground">{p.numero}</td>
                      <td className="px-3 py-2 text-foreground">{dataBR(p.vencimento)}</td>
                      <td className="px-3 py-2 text-right text-foreground num">{brl(p.valor)}</td>
                      <td className="px-3 py-2"><StatusBadge className={CORES[p.status]}>{STATUS[p.status]}</StatusBadge></td>
                      <td className="px-3 py-2 text-right">
                        {p.status !== 'paga' && <button title="Marcar paga" onClick={() => pagar(p)} className="p-1 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded"><CheckCircle2 className="w-4 h-4" /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------ Conciliação ------------------------------ */
const R_STATUS = { pendente: 'Pendente', conciliado: 'Conciliado', divergente: 'Divergente' };
const R_CORES = { pendente: 'bg-amber-50 text-amber-700', conciliado: 'bg-green-50 text-green-700', divergente: 'bg-red-50 text-red-700' };
const emptyR = { convenio_id: '', competencia: '', valor_previsto: '', valor_recebido: '', arquivo_cnab: '', observacao: '' };

function ConciliacaoTab() {
  const { activeUnidade } = useAuth();
  const [itens, setItens] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyR);

  const load = async () => {
    setLoading(true);
    const [r, cv] = await Promise.all([
      repassesApi.list(activeUnidade ? { franquia_id: activeUnidade.id } : {}).catch(() => []),
      conveniosApi.list().catch(() => []),
    ]);
    setItens(r); setConvenios(cv); setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const statusAuto = (prev, receb) => {
    if (receb == null || receb === '') return 'pendente';
    return Number(receb) === Number(prev) ? 'conciliado' : 'divergente';
  };

  const openCreate = () => { setEdit(null); setForm(emptyR); setOpen(true); };
  const openEdit = (r) => {
    setEdit(r);
    setForm({
      convenio_id: r.convenio_id || '', competencia: r.competencia || '', valor_previsto: r.valor_previsto ?? '',
      valor_recebido: r.valor_recebido ?? '', arquivo_cnab: r.arquivo_cnab || '', observacao: r.observacao || '',
    });
    setOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.competencia) return toast.error('Informe a competência (AAAA-MM).');
    const receb = num(form.valor_recebido);
    const prev = num(form.valor_previsto);
    const status = statusAuto(prev, form.valor_recebido);
    const payload = {
      convenio_id: form.convenio_id || null, competencia: form.competencia,
      valor_previsto: prev, valor_recebido: receb, arquivo_cnab: form.arquivo_cnab || null,
      status, conciliado_em: status === 'conciliado' ? new Date().toISOString() : null,
      observacao: form.observacao || null,
    };
    try {
      if (edit) {
        await repassesApi.update(edit.id, payload);
        await auditoriaApi.log('editar_repasse', 'repasses_folha', edit.id, { competencia: form.competencia, status });
      } else {
        await repassesApi.create({ ...payload, franquia_id: activeUnidade?.id || null });
        await auditoriaApi.log('criar_repasse', 'repasses_folha', null, { competencia: form.competencia });
      }
      setOpen(false); load();
    } catch (err) { toast.error(err.message || 'Falha ao salvar repasse.'); }
  };

  const diff = (r) => (r.valor_recebido != null && r.valor_previsto != null) ? Number(r.valor_recebido) - Number(r.valor_previsto) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Conciliação de repasse/folha — previsto × recebido (CNAB444)</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo repasse</Button>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? <EmptyState title="Carregando…" />
        : itens.length === 0 ? <EmptyState title="Nenhum repasse registrado." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Competência</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">Convênio</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Previsto</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Recebido</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Δ</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((r) => {
                const d = diff(r);
                return (
                  <tr key={r.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">{r.competencia}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{r.convenio?.nome || '—'}</td>
                    <td className="px-4 py-3 text-right text-foreground num">{brl(r.valor_previsto)}</td>
                    <td className="px-4 py-3 text-right text-foreground num">{brl(r.valor_recebido)}</td>
                    <td className={`px-4 py-3 text-right num hidden sm:table-cell ${d != null && d < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>{d != null ? brl(d) : '—'}</td>
                    <td className="px-4 py-3"><StatusBadge className={R_CORES[r.status]}>{R_STATUS[r.status]}</StatusBadge></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => openEdit(r)} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"><CheckCircle2 className="w-4 h-4" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar repasse' : 'Novo repasse'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Competência (AAAA-MM)</Label><Input value={form.competencia} onChange={(e) => setForm({ ...form, competencia: e.target.value })} placeholder="2026-07" required /></div>
              <div className="space-y-2">
                <Label>Convênio</Label>
                <Select value={form.convenio_id} onValueChange={(v) => setForm({ ...form, convenio_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Valor previsto</Label><Input type="number" step="0.01" value={form.valor_previsto} onChange={(e) => setForm({ ...form, valor_previsto: e.target.value })} /></div>
              <div className="space-y-2"><Label>Valor recebido</Label><Input type="number" step="0.01" value={form.valor_recebido} onChange={(e) => setForm({ ...form, valor_recebido: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Arquivo CNAB (retorno)</Label><Input value={form.arquivo_cnab} onChange={(e) => setForm({ ...form, arquivo_cnab: e.target.value })} placeholder="referência do CNAB444" /></div>
            <div className="space-y-2"><Label>Observação</Label><Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Status é calculado automaticamente: recebido = previsto → conciliado; diferente → divergente.</p>
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

/* ------------------------------ Wrapper ------------------------------ */
/* ------------------------------ Carteira ------------------------------ */
function CarteiraTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [filtro, setFiltro] = useState('todos');

  const load = async () => {
    setLoading(true);
    setRows(await carteiraApi.contratos().catch(() => []));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const atualizar = async () => {
    setAtualizando(true);
    try {
      const r = await carteiraApi.atualizar();
      await auditoriaApi.log('atualizar_carteira', 'contratos', null, r || {});
      toast.success(`Carteira: ${r?.parcelas_atrasadas || 0} em atraso · ${r?.contratos_inadimplentes || 0} inadimplente(s) · ${r?.contratos_quitados || 0} quitado(s) · ${r?.cobrancas_geradas || 0} cobrança(s).`);
      load();
    } catch (err) { toast.error(err.message || 'Falha ao atualizar carteira.'); }
    finally { setAtualizando(false); }
  };

  const view = rows.filter((r) => (filtro === 'todos' ? true : filtro === 'atraso' ? r.parcelas_atrasadas > 0 : r.status === filtro));
  const saldoTotal = rows.reduce((s, r) => s + Number(r.saldo_devedor || 0), 0);
  const emAtraso = rows.filter((r) => r.parcelas_atrasadas > 0);
  const saldoAtraso = emAtraso.reduce((s, r) => s + Number(r.saldo_devedor || 0), 0);
  const ativos = rows.filter((r) => r.status === 'ativo').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">Carteira de contratos — saldo devedor, parcelas em aberto e inadimplência</p>
        <Button variant="outline" onClick={atualizar} disabled={atualizando} className="gap-2"><CheckCircle2 className="w-4 h-4" /> {atualizando ? 'Atualizando…' : 'Atualizar carteira'}</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Saldo devedor total" value={brl(saldoTotal)} />
        <Kpi label="Contratos ativos" value={String(ativos)} />
        <Kpi label="Em atraso" value={String(emAtraso.length)} tone={emAtraso.length ? 'warn' : 'ok'} />
        <Kpi label="Saldo em atraso" value={brl(saldoAtraso)} tone={saldoAtraso ? 'warn' : 'ok'} />
      </div>

      <div className="w-52">
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os contratos</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="atraso">Com atraso</SelectItem>
            <SelectItem value="inadimplente">Inadimplentes</SelectItem>
            <SelectItem value="quitado">Quitados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        {loading ? <EmptyState title="Carregando…" />
        : view.length === 0 ? <EmptyState title="Nenhum contrato." />
        : (
          <table className="w-full text-sm min-w-[720px]">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Contrato / Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Pagas/Abertas/Atraso</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Saldo devedor</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">Próx. venc.</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Atraso</th>
            </tr></thead>
            <tbody>
              {view.map((r) => (
                <tr key={r.contrato_id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{r.cliente || '—'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{r.numero_contrato || r.contrato_id.slice(0, 8)}{r.convenio ? ` · ${r.convenio}` : ''}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge className={C_CT[r.status]}>{C_CT_LBL[r.status] || r.status}</StatusBadge></td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    <span className="text-green-700">{r.parcelas_pagas}</span> / <span>{r.parcelas_abertas}</span> / <span className={r.parcelas_atrasadas ? 'text-red-600 font-medium' : ''}>{r.parcelas_atrasadas}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">{brl(r.saldo_devedor)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">{dataBR(r.proximo_vencimento)}</td>
                  <td className={`px-4 py-3 text-right ${r.dias_atraso > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground/60'}`}>{r.dias_atraso > 0 ? `${r.dias_atraso}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }) {
  const color = tone === 'warn' ? 'text-red-600' : tone === 'ok' ? 'text-green-700' : 'text-foreground';
  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function Financeiro() {
  const [tab, setTab] = useTabParam('receb');
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-border overflow-x-auto overflow-y-hidden">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'receb' ? <RecebiveisTab />
        : tab === 'carteira' ? <CarteiraTab />
        : tab === 'expectativa' ? <Expectativa />
        : tab === 'previa' ? <PreviaCartao />
        : tab === 'folha' ? <ConciliacaoFolha />
        : tab === 'monitor' ? <MonitorCaptura />
        : tab === 'averbadoras' ? <Averbadoras />
        : <ConciliacaoTab />}
    </div>
  );
}
