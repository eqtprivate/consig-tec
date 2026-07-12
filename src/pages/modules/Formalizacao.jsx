import React, { useEffect, useState } from 'react';
import { useTabParam } from '@/lib/useTabParam';
import { formalizacoesApi } from '@/lib/api/formalizacoes';
import { ccbsApi } from '@/lib/api/ccbs';
import { propostasApi } from '@/lib/api/propostas';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl, dataBR, num } from '@/lib/format';
import Contratos from '@/pages/modules/Contratos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, ShieldCheck, ShieldAlert, ShieldQuestion, FileCheck2 } from 'lucide-react';

const TABS = [
  { key: 'form', label: 'Formalização & Antifraude' },
  { key: 'ccb', label: 'CCB' },
  { key: 'contratos', label: 'Contratos' },
];

/* ------------------------------ Formalização ------------------------------ */
const F_STATUS = { iniciada: 'Iniciada', em_analise: 'Em análise', aprovada: 'Aprovada', reprovada: 'Reprovada', concluida: 'Concluída', cancelada: 'Cancelada' };
const F_CORES = {
  iniciada: 'bg-slate-100 text-slate-600', em_analise: 'bg-amber-50 text-amber-700', aprovada: 'bg-green-50 text-green-700',
  reprovada: 'bg-red-50 text-red-700', concluida: 'bg-green-50 text-green-700', cancelada: 'bg-slate-100 text-slate-400',
};
const AF_ICON = { aprovado: ShieldCheck, reprovado: ShieldAlert, revisao: ShieldQuestion };
const AF_COR = { aprovado: 'text-green-600', reprovado: 'text-red-600', revisao: 'text-amber-600' };
const emptyF = {
  proposta_id: '', selfie_ok: false, prova_vida_ok: false, documentos_ok: false, aceite_termo: false,
  canal_envio: 'whatsapp', link_formalizacao: '', status: 'iniciada', observacao: '',
  af_resultado: '', af_score: '', af_motivo: '',
};

function FormalizacaoTab() {
  const { activeUnidade } = useAuth();
  const [itens, setItens] = useState([]);
  const [propostas, setPropostas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyF);

  const load = async () => {
    setLoading(true);
    const f = activeUnidade ? { franquia_id: activeUnidade.id } : {};
    const [a, p] = await Promise.all([
      formalizacoesApi.list().catch(() => []),
      propostasApi.list(f).catch(() => []),
    ]);
    setItens(a); setPropostas(p); setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const openCreate = () => { setEdit(null); setForm(emptyF); setOpen(true); };
  const openEdit = (a) => {
    setEdit(a);
    setForm({
      proposta_id: a.proposta_id || '', selfie_ok: a.selfie_ok, prova_vida_ok: a.prova_vida_ok,
      documentos_ok: a.documentos_ok, aceite_termo: a.aceite_termo, canal_envio: a.canal_envio || 'whatsapp',
      link_formalizacao: a.link_formalizacao || '', status: a.status, observacao: a.observacao || '',
      af_resultado: '', af_score: '', af_motivo: '',
    });
    setOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.proposta_id) return alert('Selecione a proposta.');
    const payload = {
      proposta_id: form.proposta_id, selfie_ok: form.selfie_ok, prova_vida_ok: form.prova_vida_ok,
      documentos_ok: form.documentos_ok, aceite_termo: form.aceite_termo,
      aceite_em: form.aceite_termo ? new Date().toISOString() : null,
      canal_envio: form.canal_envio || null, link_formalizacao: form.link_formalizacao || null,
      status: form.status, observacao: form.observacao || null,
    };
    let reg;
    if (edit) {
      reg = await formalizacoesApi.update(edit.id, payload);
      await auditoriaApi.log('editar_formalizacao', 'formalizacoes', edit.id, { status: form.status });
    } else {
      reg = await formalizacoesApi.create(payload);
      await auditoriaApi.log('criar_formalizacao', 'formalizacoes', null, {});
    }
    if (form.af_resultado) {
      await formalizacoesApi.registrarAntifraude({
        formalizacao_id: reg.id, proposta_id: form.proposta_id, provider: 'UY3',
        resultado: form.af_resultado, score: num(form.af_score), motivo: form.af_motivo || null,
      });
      await auditoriaApi.log('registrar_antifraude', 'formalizacoes', reg.id, { resultado: form.af_resultado });
    }
    setOpen(false); load();
  };

  const ultimaAf = (a) => (a.antifraude || []).slice().sort((x, y) => (y.created_at > x.created_at ? 1 : -1))[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Selfie / prova de vida / aceite e resultado antifraude (registro UY3)</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova formalização</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : itens.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhuma formalização.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Cliente</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Checklist</th>
              <th className="text-center px-4 py-3 font-medium text-slate-500 uppercase text-xs">Antifraude</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((a) => {
                const af = ultimaAf(a);
                const AfIcon = af ? AF_ICON[af.resultado] : null;
                const ck = [a.selfie_ok, a.prova_vida_ok, a.documentos_ok, a.aceite_termo].filter(Boolean).length;
                return (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{a.proposta?.cliente?.nome || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">{ck}/4 itens</td>
                    <td className="px-4 py-3 text-center">
                      {AfIcon ? <span className={`inline-flex items-center gap-1 text-xs ${AF_COR[af.resultado]}`}><AfIcon className="w-3.5 h-3.5" /> {af.resultado}</span> : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${F_CORES[a.status]}`}>{F_STATUS[a.status]}</span></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => openEdit(a)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar formalização' : 'Nova formalização'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Proposta</Label>
              <Select value={form.proposta_id} onValueChange={(v) => setForm({ ...form, proposta_id: v })} disabled={!!edit}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{propostas.map((p) => <SelectItem key={p.id} value={p.id}>{(p.cliente?.nome || 'Cliente')} — {brl(p.valor_solicitado)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[['selfie_ok', 'Selfie'], ['prova_vida_ok', 'Prova de vida'], ['documentos_ok', 'Documentos'], ['aceite_termo', 'Aceite do termo']].map(([k, lbl]) => (
                <div key={k} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <Label htmlFor={k} className="cursor-pointer text-sm">{lbl}</Label>
                  <Switch id={k} checked={form[k]} onCheckedChange={(v) => setForm({ ...form, [k]: v })} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Canal de envio</Label><Input value={form.canal_envio} onChange={(e) => setForm({ ...form, canal_envio: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(F_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Link de formalização</Label><Input value={form.link_formalizacao} onChange={(e) => setForm({ ...form, link_formalizacao: e.target.value })} placeholder="link enviado ao cliente" /></div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-3">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Registrar antifraude (UY3) — opcional</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Resultado</Label>
                  <Select value={form.af_resultado} onValueChange={(v) => setForm({ ...form, af_resultado: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                      <SelectItem value="reprovado">Reprovado</SelectItem>
                      <SelectItem value="revisao">Revisão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Score</Label><Input type="number" step="0.01" value={form.af_score} onChange={(e) => setForm({ ...form, af_score: e.target.value })} /></div>
              </div>
              {form.af_resultado && <Input value={form.af_motivo} onChange={(e) => setForm({ ...form, af_motivo: e.target.value })} placeholder="motivo / observação" />}
            </div>

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

/* ------------------------------ CCB ------------------------------ */
const C_STATUS = { emitida: 'Emitida', enviada_assinatura: 'Enviada p/ assinatura', assinada: 'Assinada', cancelada: 'Cancelada', liquidada: 'Liquidada' };
const C_CORES = {
  emitida: 'bg-blue-50 text-blue-700', enviada_assinatura: 'bg-amber-50 text-amber-700', assinada: 'bg-green-50 text-green-700',
  cancelada: 'bg-slate-100 text-slate-400', liquidada: 'bg-violet-50 text-violet-700',
};
const emptyC = {
  proposta_id: '', numero: '', valor_principal: '', valor_total: '', taxa_mensal: '', prazo: '',
  status: 'emitida', link_assinatura: '', documento_hash: '', emitida_em: '', assinada_em: '',
};

function CcbTab() {
  const { activeUnidade } = useAuth();
  const [itens, setItens] = useState([]);
  const [propostas, setPropostas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyC);
  const [prontidao, setProntidao] = useState(null);

  const load = async () => {
    setLoading(true);
    const f = activeUnidade ? { franquia_id: activeUnidade.id } : {};
    const [a, p] = await Promise.all([
      ccbsApi.list().catch(() => []),
      propostasApi.list(f).catch(() => []),
    ]);
    setItens(a); setPropostas(p); setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const checarProntidao = async (propostaId) => {
    if (!propostaId) { setProntidao(null); return; }
    setProntidao(await propostasApi.prontaParaContrato(propostaId).catch(() => null));
  };

  const openCreate = () => { setEdit(null); setForm(emptyC); setProntidao(null); setOpen(true); };
  const openEdit = (a) => {
    setEdit(a);
    setForm({
      proposta_id: a.proposta_id || '', numero: a.numero || '', valor_principal: a.valor_principal ?? '',
      valor_total: a.valor_total ?? '', taxa_mensal: a.taxa_mensal ?? '', prazo: a.prazo ?? '',
      status: a.status, link_assinatura: a.link_assinatura || '', documento_hash: a.documento_hash || '',
      emitida_em: a.emitida_em ? a.emitida_em.slice(0, 10) : '', assinada_em: a.assinada_em ? a.assinada_em.slice(0, 10) : '',
    });
    setProntidao(null);
    if (a.proposta_id && !a.contrato_id) checarProntidao(a.proposta_id);
    setOpen(true);
  };

  const onSelProposta = (v) => {
    const p = propostas.find((x) => x.id === v);
    setForm((f) => ({
      ...f, proposta_id: v,
      valor_principal: f.valor_principal || (p?.valor_solicitado ?? ''),
      taxa_mensal: f.taxa_mensal || (p?.taxa_mensal ?? ''),
      prazo: f.prazo || (p?.prazo ?? ''),
    }));
    checarProntidao(v);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.proposta_id) return alert('Selecione a proposta.');
    if (form.status === 'assinada' && prontidao && !prontidao.pronta) {
      return alert('Esteira incompleta — não é possível assinar/gerar contrato:\n\n• ' + prontidao.motivos.join('\n• '));
    }
    const payload = {
      proposta_id: form.proposta_id, numero: form.numero || null,
      valor_principal: num(form.valor_principal), valor_total: num(form.valor_total),
      taxa_mensal: num(form.taxa_mensal), prazo: num(form.prazo), status: form.status,
      link_assinatura: form.link_assinatura || null, documento_hash: form.documento_hash || null,
      emitida_em: form.emitida_em || null, assinada_em: form.assinada_em || null,
    };
    if (edit) {
      await ccbsApi.update(edit.id, payload);
      await auditoriaApi.log('editar_ccb', 'ccbs', edit.id, { numero: form.numero, status: form.status });
    } else {
      await ccbsApi.create(payload);
      await auditoriaApi.log('emitir_ccb', 'ccbs', null, { numero: form.numero });
    }
    setOpen(false); load();
  };

  const [gerando, setGerando] = useState(null);
  const gerarContrato = async (a) => {
    if (!confirm(`Gerar contrato a partir da CCB ${a.numero || ''}?`)) return;
    setGerando(a.id);
    try {
      const ct = await ccbsApi.gerarContrato(a.id);
      await auditoriaApi.log('gerar_contrato_ccb', 'contratos', ct?.id || null, { ccb: a.id, numero: ct?.numero_contrato });
      alert(`Contrato ${ct?.numero_contrato || ''} gerado com cronograma. Veja na aba Contratos.`);
      load();
    } catch (err) {
      alert(err.message || 'Falha ao gerar contrato.');
    } finally {
      setGerando(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Cédulas de Crédito Bancário (emissão UY3, assinatura Clicksign)</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nova CCB</Button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : itens.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhuma CCB.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Número</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Cliente</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Principal</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Emissão</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {itens.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{a.numero || a.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-slate-700 hidden md:table-cell">{a.proposta?.cliente?.nome || a.contrato?.cliente?.nome || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700 num">{brl(a.valor_principal)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden lg:table-cell">{dataBR(a.emitida_em)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${C_CORES[a.status]}`}>{C_STATUS[a.status]}</span>
                    {a.contrato?.numero_contrato && <span className="block text-[10px] text-green-700 mt-0.5">→ {a.contrato.numero_contrato}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {a.status === 'assinada' && !a.contrato_id && (
                        <button onClick={() => gerarContrato(a)} disabled={gerando === a.id} title="Gerar contrato" className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded"><FileCheck2 className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => openEdit(a)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar CCB' : 'Nova CCB'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Proposta</Label>
                <Select value={form.proposta_id} onValueChange={onSelProposta} disabled={!!edit}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{propostas.map((p) => <SelectItem key={p.id} value={p.id}>{(p.cliente?.nome || 'Cliente')} — {brl(p.valor_solicitado)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Número da CCB</Label><Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
            </div>
            {form.proposta_id && prontidao && (
              prontidao.pronta ? (
                <div className="rounded-lg bg-green-50 border border-green-200 p-2.5 text-xs text-green-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" /> Esteira completa — pronta para assinar e gerar contrato.
                </div>
              ) : (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
                  <p className="font-medium mb-1 flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" /> Pendências antes de assinar:</p>
                  <ul className="list-disc list-inside">{prontidao.motivos.map((m, i) => <li key={i}>{m}</li>)}</ul>
                </div>
              )
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Principal</Label><Input type="number" step="0.01" value={form.valor_principal} onChange={(e) => setForm({ ...form, valor_principal: e.target.value })} /></div>
              <div className="space-y-2"><Label>Total</Label><Input type="number" step="0.01" value={form.valor_total} onChange={(e) => setForm({ ...form, valor_total: e.target.value })} /></div>
              <div className="space-y-2"><Label>Prazo (x)</Label><Input type="number" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Taxa a.m. %</Label><Input type="number" step="0.0001" value={form.taxa_mensal} onChange={(e) => setForm({ ...form, taxa_mensal: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(C_STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
                {form.status === 'assinada' && (
                  <p className="text-[11px] text-green-700">Ao salvar, o contrato será gerado automaticamente (nº, parcela e cronograma Price).</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Emitida em</Label><Input type="date" value={form.emitida_em} onChange={(e) => setForm({ ...form, emitida_em: e.target.value })} /></div>
              <div className="space-y-2"><Label>Assinada em</Label><Input type="date" value={form.assinada_em} onChange={(e) => setForm({ ...form, assinada_em: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Link de assinatura (Clicksign)</Label><Input value={form.link_assinatura} onChange={(e) => setForm({ ...form, link_assinatura: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">{edit ? 'Salvar' : 'Emitir'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------ Wrapper ------------------------------ */
export default function Formalizacao() {
  const [tab, setTab] = useTabParam('form');
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
      {tab === 'form' ? <FormalizacaoTab /> : tab === 'ccb' ? <CcbTab /> : <Contratos />}
    </div>
  );
}
