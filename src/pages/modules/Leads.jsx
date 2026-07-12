import React, { useEffect, useState } from 'react';
import { leadsApi, campanhasApi, interacoesApi, oportunidadesApi } from '@/lib/api/crm';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Phone, CalendarClock, CheckCircle2 } from 'lucide-react';

const STATUS = { novo: 'Novo', contatado: 'Contatado', qualificado: 'Qualificado', convertido: 'Convertido', perdido: 'Perdido' };
const ORDER = ['novo', 'contatado', 'qualificado', 'convertido', 'perdido'];
const CHIP = {
  novo: 'bg-slate-100 text-slate-600', contatado: 'bg-blue-50 text-blue-700', qualificado: 'bg-amber-50 text-amber-700',
  convertido: 'bg-green-50 text-green-700', perdido: 'bg-red-50 text-red-700',
};
const TIPO = { ligacao: 'Ligação', whatsapp: 'WhatsApp', email: 'E-mail', sms: 'SMS', nota: 'Nota', retorno: 'Retorno' };
const RESULTADO = {
  atendeu: 'Atendeu', nao_atendeu: 'Não atendeu', caixa_postal: 'Caixa postal', numero_errado: 'Número errado',
  sem_interesse: 'Sem interesse', agendar_retorno: 'Agendar retorno', qualificado: 'Qualificado', nao_perturbe: 'Não perturbe',
};
const emptyForm = { nome: '', telefone: '', email: '', cpf: '', origem: '', campanha_id: '', status: 'novo', valor_estimado: '', observacao: '' };
const num = (v) => (v === '' || v == null ? null : Number(v));
const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function Leads() {
  const { activeUnidade, perfil } = useAuth();
  const [leads, setLeads] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // Atendimento (discagem)
  const [atender, setAtender] = useState(null);
  const [interacoes, setInteracoes] = useState([]);
  const emptyInt = { tipo: 'ligacao', resultado: 'atendeu', observacao: '', proximo_contato: '' };
  const [intForm, setIntForm] = useState(emptyInt);
  const [savingInt, setSavingInt] = useState(false);

  const load = async () => {
    setLoading(true);
    const f = activeUnidade ? { franquia_id: activeUnidade.id } : {};
    const [l, c] = await Promise.all([leadsApi.list(f).catch(() => []), campanhasApi.list(f).catch(() => [])]);
    setLeads(l); setCampanhas(c); setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  // Fila de trabalho: ativos (não perdidos/convertidos) ordenados por urgência
  const agora = Date.now();
  const trabalhaveis = leads.filter((l) => !['convertido', 'perdido'].includes(l.status));
  const agendadosVencidos = trabalhaveis.filter((l) => l.proximo_contato && new Date(l.proximo_contato).getTime() <= agora).length;
  const novos = trabalhaveis.filter((l) => l.status === 'novo').length;

  const openCreate = () => { setEdit(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (l) => {
    setEdit(l);
    setForm({ nome: l.nome, telefone: l.telefone || '', email: l.email || '', cpf: l.cpf || '', origem: l.origem || '', campanha_id: l.campanha_id || '', status: l.status, valor_estimado: l.valor_estimado ?? '', observacao: l.observacao || '' });
    setOpen(true);
  };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { nome: form.nome, telefone: form.telefone || null, email: form.email || null, cpf: form.cpf || null, origem: form.origem || null, campanha_id: form.campanha_id || null, status: form.status, valor_estimado: num(form.valor_estimado), observacao: form.observacao || null };
    try {
      if (edit) { await leadsApi.update(edit.id, payload); await auditoriaApi.log('editar_lead', 'leads', edit.id, {}); }
      else { await leadsApi.create({ ...payload, franquia_id: activeUnidade?.id || null }); await auditoriaApi.log('criar_lead', 'leads', null, {}); }
      setOpen(false); load();
    } catch (err) { alert(err.message || 'Falha ao salvar lead.'); }
  };

  // ---- Atendimento ----
  const abrirAtender = async (l) => {
    setAtender(l); setIntForm(emptyInt);
    setInteracoes(await interacoesApi.list({ lead_id: l.id }).catch(() => []));
  };
  const registrarInteracao = async (e) => {
    e.preventDefault();
    setSavingInt(true);
    try {
      await interacoesApi.create({
        lead_id: atender.id, operador_id: perfil?.id || null, franquia_id: activeUnidade?.id || null,
        tipo: intForm.tipo, resultado: intForm.resultado, observacao: intForm.observacao || null,
        proximo_contato: intForm.proximo_contato ? new Date(intForm.proximo_contato).toISOString() : null,
      });
      await auditoriaApi.log('registrar_interacao', 'leads', atender.id, { resultado: intForm.resultado });
      setInteracoes(await interacoesApi.list({ lead_id: atender.id }).catch(() => []));
      setIntForm(emptyInt);
      load(); // atualiza tentativas/status/próximo contato do lead
    } catch (err) { alert(err.message || 'Falha ao registrar.'); }
    finally { setSavingInt(false); }
  };
  const qualificar = async () => {
    if (!confirm('Qualificar este lead e criar uma oportunidade?')) return;
    try {
      // registra a qualificação e cria a oportunidade
      await interacoesApi.create({ lead_id: atender.id, operador_id: perfil?.id || null, franquia_id: activeUnidade?.id || null, tipo: 'ligacao', resultado: 'qualificado', observacao: 'Lead qualificado' });
      await oportunidadesApi.create({
        lead_id: atender.id, operador_id: perfil?.id || null, franquia_id: activeUnidade?.id || null,
        produto: 'cartao_beneficio', valor_estimado: atender.valor_estimado ?? null, etapa: 'qualificacao', probabilidade: 50,
      });
      await auditoriaApi.log('qualificar_lead', 'leads', atender.id, {});
      alert('Oportunidade criada. Acompanhe na aba Oportunidades.');
      setAtender(null); load();
    } catch (err) { alert(err.message || 'Falha ao qualificar.'); }
  };

  const funil = ORDER.map((s) => ({ status: s, n: leads.filter((l) => l.status === s).length }));
  const max = Math.max(1, ...funil.map((f) => f.n));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Leads e discagem — fila de trabalho do call center</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo lead</Button>
      </div>

      {/* Resumo da fila + funil */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-3 gap-2 text-center">
          <div><p className="text-2xl font-bold text-slate-900 num">{novos}</p><p className="text-[11px] text-slate-500 uppercase">Novos</p></div>
          <div><p className="text-2xl font-bold text-amber-600 num">{agendadosVencidos}</p><p className="text-[11px] text-slate-500 uppercase">Retornos vencidos</p></div>
          <div><p className="text-2xl font-bold text-slate-900 num">{trabalhaveis.length}</p><p className="text-[11px] text-slate-500 uppercase">Na fila</p></div>
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <div className="grid grid-cols-5 gap-2">
            {funil.map((f) => (
              <div key={f.status} className="text-center">
                <div className="h-12 flex items-end justify-center">
                  <div className="w-full bar-brand rounded-t" style={{ height: `${(f.n / max) * 100}%`, minHeight: f.n ? 6 : 0 }} />
                </div>
                <p className="text-sm font-bold text-slate-800 num mt-1">{f.n}</p>
                <p className="text-[10px] text-slate-500 uppercase">{STATUS[f.status]}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : leads.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhum lead.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Telefone</th>
              <th className="text-center px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Tent.</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Próx. contato</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {leads.map((l) => {
                const vencido = l.proximo_contato && new Date(l.proximo_contato).getTime() <= agora;
                return (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{l.nome}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{l.telefone || '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-500 hidden sm:table-cell num">{l.tentativas || 0}</td>
                    <td className={`px-4 py-3 hidden lg:table-cell text-xs ${vencido ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                      {l.proximo_contato ? <span className="inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {fmtDT(l.proximo_contato)}</span> : '—'}
                    </td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CHIP[l.status]}`}>{STATUS[l.status]}</span></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {!['convertido', 'perdido'].includes(l.status) && (
                        <button onClick={() => abrirAtender(l)} title="Atender / discar" className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded"><Phone className="w-4 h-4" /></button>
                      )}
                      <button onClick={() => openEdit(l)} title="Editar" className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"><Pencil className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialog lead */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{edit ? 'Editar lead' : 'Novo lead'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Campanha</Label>
                <Select value={form.campanha_id} onValueChange={(v) => setForm({ ...form, campanha_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{campanhas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Origem</Label><Input value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} placeholder="mailing, indicação..." /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">{edit ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog atendimento */}
      <Dialog open={!!atender} onOpenChange={(v) => !v && setAtender(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> {atender?.nome}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-4 text-sm text-slate-600 -mt-1">
            <span>{atender?.telefone || 'sem telefone'}</span>
            {atender?.cpf && <span className="text-slate-400">CPF {atender.cpf}</span>}
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CHIP[atender?.status]}`}>{STATUS[atender?.status]}</span>
          </div>

          {/* Timeline */}
          <div className="space-y-2 max-h-40 overflow-y-auto border-t border-slate-100 pt-3">
            {interacoes.length === 0 ? <p className="text-sm text-slate-400">Nenhuma interação ainda.</p>
            : interacoes.map((i) => (
              <div key={i.id} className="text-xs border-l-2 border-slate-200 pl-3 py-0.5">
                <span className="font-medium text-slate-700">{TIPO[i.tipo]}</span>
                <span className="text-slate-400"> · {i.resultado ? RESULTADO[i.resultado] : '—'} · {fmtDT(i.created_at)} · {i.operador?.nome || ''}</span>
                {i.observacao && <p className="text-slate-500">{i.observacao}</p>}
                {i.proximo_contato && <p className="text-amber-600">↳ retorno {fmtDT(i.proximo_contato)}</p>}
              </div>
            ))}
          </div>

          {/* Registrar contato */}
          <form onSubmit={registrarInteracao} className="border-t border-slate-100 pt-3 space-y-3">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Registrar contato</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={intForm.tipo} onValueChange={(v) => setIntForm({ ...intForm, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TIPO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Resultado</Label>
                <Select value={intForm.resultado} onValueChange={(v) => setIntForm({ ...intForm, resultado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(RESULTADO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Textarea rows={2} value={intForm.observacao} onChange={(e) => setIntForm({ ...intForm, observacao: e.target.value })} placeholder="Observação do contato" />
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5">
                <Label>Agendar retorno</Label>
                <Input type="datetime-local" value={intForm.proximo_contato} onChange={(e) => setIntForm({ ...intForm, proximo_contato: e.target.value })} />
              </div>
              <Button type="submit" disabled={savingInt} className="gap-2"><CheckCircle2 className="w-4 h-4" /> {savingInt ? 'Salvando…' : 'Registrar'}</Button>
            </div>
          </form>

          <DialogFooter className="justify-between sm:justify-between">
            <Button type="button" variant="outline" onClick={qualificar} className="text-green-700">Qualificar → Oportunidade</Button>
            <Button type="button" variant="outline" onClick={() => setAtender(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
