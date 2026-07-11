import React, { useEffect, useState } from 'react';
import { contratosApi } from '@/lib/api/contratos';
import { parcelasApi } from '@/lib/api/parcelas';
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
import { Wallet, CheckCircle2, ListPlus, Plus } from 'lucide-react';

const TABS = [{ key: 'receb', label: 'Recebíveis' }, { key: 'concil', label: 'Conciliação (repasse)' }];
const STATUS = { aberta: 'Aberta', paga: 'Paga', atrasada: 'Atrasada', renegociada: 'Renegociada' };
const CORES = {
  aberta: 'bg-slate-100 text-slate-600', paga: 'bg-green-50 text-green-700',
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
    if (!sel?.prazo) return alert('Contrato sem prazo definido.');
    setGerando(true);
    try {
      const n = await parcelasApi.gerarCronograma(sel.id); // motor PMT no banco
      await auditoriaApi.log('gerar_cronograma_pmt', 'contratos', sel.id, { parcelas: n });
      if (n === 0) alert('Este contrato já possui cronograma.');
      recarregar();
    } catch (err) {
      alert(err.message || 'Falha ao gerar cronograma.');
    } finally { setGerando(false); }
  };

  const pagar = async (p) => {
    await parcelasApi.update(p.id, { status: 'paga', valor_pago: p.valor, data_pagamento: new Date().toISOString().slice(0, 10) });
    await auditoriaApi.log('pagar_parcela', 'parcelas', p.id, {});
    recarregar();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Contratos e parcelas — cronograma pela tabela Price (motor de PMT)</p>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : contratos.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhum contrato.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Nº</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Cliente</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Principal</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Taxa a.m.</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Prazo</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Parcelas</th>
            </tr></thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => abrir(c)}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.numero_contrato || c.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.cliente?.nome || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700 hidden sm:table-cell">{brl(c.valor_principal)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden md:table-cell">{c.taxa_mensal != null ? `${c.taxa_mensal}%` : '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden sm:table-cell">{c.prazo ? `${c.prazo}x` : '—'}</td>
                  <td className="px-4 py-3 text-right"><span className="inline-flex items-center gap-1 text-xs text-slate-500"><Wallet className="w-3.5 h-3.5" /> ver</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!sel} onOpenChange={(v) => !v && setSel(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Parcelas — {sel?.cliente?.nome} ({sel?.numero_contrato || sel?.id?.slice(0, 8)})</DialogTitle></DialogHeader>
          {loadingP ? <div className="p-8 text-center text-sm text-slate-400">Carregando...</div>
          : parcelas.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm text-slate-400">Nenhuma parcela gerada.</p>
              <p className="text-xs text-slate-400">Cronograma pela tabela Price ({sel?.taxa_mensal != null ? `${sel.taxa_mensal}% a.m.` : 'sem juros'} · {sel?.prazo || 0}x)</p>
              <Button onClick={gerar} disabled={gerando} className="gap-2"><ListPlus className="w-4 h-4" /> {gerando ? 'Gerando…' : `Gerar ${sel?.prazo || 0} parcelas (PMT)`}</Button>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto -mx-2">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-3 py-2">#</th><th className="px-3 py-2">Vencimento</th>
                  <th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th>
                </tr></thead>
                <tbody>
                  {parcelas.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-500">{p.numero}</td>
                      <td className="px-3 py-2 text-slate-700">{dataBR(p.vencimento)}</td>
                      <td className="px-3 py-2 text-right text-slate-700 num">{brl(p.valor)}</td>
                      <td className="px-3 py-2"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CORES[p.status]}`}>{STATUS[p.status]}</span></td>
                      <td className="px-3 py-2 text-right">
                        {p.status !== 'paga' && <button title="Marcar paga" onClick={() => pagar(p)} className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"><CheckCircle2 className="w-4 h-4" /></button>}
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
    if (!form.competencia) return alert('Informe a competência (AAAA-MM).');
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
    } catch (err) { alert(err.message || 'Falha ao salvar repasse.'); }
  };

  const diff = (r) => (r.valor_recebido != null && r.valor_previsto != null) ? Number(r.valor_recebido) - Number(r.valor_previsto) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Conciliação de repasse/folha — previsto × recebido (CNAB444)</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo repasse</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : itens.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhum repasse registrado.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Competência</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Convênio</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Previsto</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Recebido</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Δ</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((r) => {
                const d = diff(r);
                return (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{r.competencia}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{r.convenio?.nome || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-700 num">{brl(r.valor_previsto)}</td>
                    <td className="px-4 py-3 text-right text-slate-700 num">{brl(r.valor_recebido)}</td>
                    <td className={`px-4 py-3 text-right num hidden sm:table-cell ${d != null && d < 0 ? 'text-red-600' : 'text-slate-500'}`}>{d != null ? brl(d) : '—'}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${R_CORES[r.status]}`}>{R_STATUS[r.status]}</span></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><CheckCircle2 className="w-4 h-4" /></button></td>
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
            <p className="text-xs text-slate-400">Status é calculado automaticamente: recebido = previsto → conciliado; diferente → divergente.</p>
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
export default function Financeiro() {
  const [tab, setTab] = useState('receb');
  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'receb' ? <RecebiveisTab /> : <ConciliacaoTab />}
    </div>
  );
}
