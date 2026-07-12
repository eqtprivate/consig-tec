import React, { useEffect, useState } from 'react';
import { leadsApi, campanhasApi, interacoesApi, oportunidadesApi, motivosPerdaApi, roteiroApi } from '@/lib/api/crm';
import { clientesApi } from '@/lib/api/clientes';
import { conveniosApi } from '@/lib/api/convenios';
import { usuariosApi } from '@/lib/api/usuarios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Phone, CalendarClock, CheckCircle2, Upload, MessageCircle, Shuffle, BookOpen } from 'lucide-react';

const RESULTADOS_PERDA = ['sem_interesse', 'nao_perturbe', 'numero_errado'];

const soDigitos = (s) => (s || '').replace(/\D/g, '');
const telHref = (t) => `tel:+55${soDigitos(t)}`;
const waHref = (t) => `https://wa.me/55${soDigitos(t)}`;

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
const emptyForm = { nome: '', telefone: '', email: '', cpf: '', origem: '', campanha_id: '', convenio_id: '', status: 'novo', valor_estimado: '', observacao: '' };
const num = (v) => (v === '' || v == null ? null : Number(v));
const PRIOR_ORDER = { alta: 0, media: 1, baixa: 2, sem_prioridade: 3 };
const PRIOR_LABEL = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const PRIOR_COR = { alta: 'bg-green-50 text-green-700', media: 'bg-amber-50 text-amber-700', baixa: 'bg-slate-100 text-slate-500' };
const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function Leads() {
  const { activeUnidade, perfil, isAdmin } = useAuth();
  const [leads, setLeads] = useState([]);
  const [campanhas, setCampanhas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // Atendimento (discagem)
  const [atender, setAtender] = useState(null);
  const [interacoes, setInteracoes] = useState([]);
  const emptyInt = { tipo: 'ligacao', resultado: 'atendeu', observacao: '', proximo_contato: '', motivo_perda_id: '' };
  const [intForm, setIntForm] = useState(emptyInt);
  const [savingInt, setSavingInt] = useState(false);
  const [motivos, setMotivos] = useState([]);
  const [roteiro, setRoteiro] = useState([]);
  const [showRoteiro, setShowRoteiro] = useState(false);

  // Operadores, convênios, filtro, importação e distribuição
  const [operadores, setOperadores] = useState([]);
  const [convenios, setConvenios] = useState([]);
  const [filtroResp, setFiltroResp] = useState('todos'); // todos | meus | <id>
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importCampanha, setImportCampanha] = useState('');
  const [importConvenio, setImportConvenio] = useState('');
  const [importing, setImporting] = useState(false);
  const [distribuindo, setDistribuindo] = useState(false);

  const load = async () => {
    setLoading(true);
    const f = activeUnidade ? { franquia_id: activeUnidade.id } : {};
    const [l, c, u, mp, rt, cv] = await Promise.all([
      leadsApi.list(f).catch(() => []),
      campanhasApi.list(f).catch(() => []),
      usuariosApi.list().catch(() => []),
      motivosPerdaApi.list().catch(() => []),
      roteiroApi.list().catch(() => []),
      conveniosApi.list().catch(() => []),
    ]);
    setLeads(l); setCampanhas(c); setConvenios(cv);
    setOperadores(u.filter((x) => x.ativo));
    setMotivos(mp); setRoteiro(rt);
    setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const nomeOperador = (id) => operadores.find((o) => o.id === id)?.nome || '—';

  // ---- Importar mailing (CSV) ----
  const importarCSV = async (e) => {
    e.preventDefault();
    const linhas = importText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (linhas.length === 0) return alert('Cole os dados do mailing.');
    // Detecta cabeçalho
    let header = null;
    const primeira = linhas[0].toLowerCase();
    if (/nome|telefone|cpf/.test(primeira)) header = linhas.shift().split(/[;,\t]/).map((h) => h.trim().toLowerCase());
    const col = (arr, nomes) => { const i = header ? header.findIndex((h) => nomes.includes(h)) : -1; return i; };
    const iNome = header ? col(header, ['nome']) : 0;
    const iTel = header ? col(header, ['telefone', 'fone', 'celular']) : 1;
    const iCpf = header ? col(header, ['cpf']) : 2;
    const iEmail = header ? col(header, ['email', 'e-mail']) : 3;
    const iOrig = header ? col(header, ['origem']) : 4;
    const registros = linhas.map((linha) => {
      const p = linha.split(/[;,\t]/).map((x) => x.trim());
      const nome = (iNome >= 0 ? p[iNome] : '') || '';
      if (!nome) return null;
      return {
        nome,
        telefone: iTel >= 0 ? p[iTel] || null : null,
        cpf: iCpf >= 0 ? p[iCpf] || null : null,
        email: iEmail >= 0 ? p[iEmail] || null : null,
        origem: (iOrig >= 0 ? p[iOrig] : null) || 'mailing',
        campanha_id: importCampanha || null,
        convenio_id: importConvenio || null,
        status: 'novo',
        franquia_id: activeUnidade?.id || null,
      };
    }).filter(Boolean);
    if (registros.length === 0) return alert('Nenhuma linha válida (é preciso ao menos o nome).');
    setImporting(true);
    try {
      await leadsApi.createMany(registros);
      await auditoriaApi.log('importar_mailing', 'leads', null, { qtd: registros.length });
      alert(`${registros.length} lead(s) importado(s).`);
      setImportOpen(false); setImportText(''); setImportCampanha(''); setImportConvenio(''); load();
    } catch (err) { alert(err.message || 'Falha na importação.'); }
    finally { setImporting(false); }
  };

  // ---- Distribuir leads não atribuídos (round-robin) ----
  const distribuir = async () => {
    const semDono = leads.filter((l) => !l.responsavel_id && !['convertido', 'perdido'].includes(l.status));
    if (semDono.length === 0) return alert('Não há leads sem operador para distribuir.');
    if (operadores.length === 0) return alert('Nenhum operador ativo.');
    if (!confirm(`Distribuir ${semDono.length} lead(s) entre ${operadores.length} operador(es)?`)) return;
    setDistribuindo(true);
    try {
      for (let i = 0; i < semDono.length; i++) {
        const op = operadores[i % operadores.length];
        await leadsApi.update(semDono[i].id, { responsavel_id: op.id });
      }
      await auditoriaApi.log('distribuir_leads', 'leads', null, { qtd: semDono.length });
      alert('Leads distribuídos.');
      load();
    } catch (err) { alert(err.message || 'Falha ao distribuir.'); }
    finally { setDistribuindo(false); }
  };

  // Fila de trabalho: ativos (não perdidos/convertidos) ordenados por urgência
  const agora = Date.now();
  const trabalhaveis = leads.filter((l) => !['convertido', 'perdido'].includes(l.status));
  const agendadosVencidos = trabalhaveis.filter((l) => l.proximo_contato && new Date(l.proximo_contato).getTime() <= agora).length;
  const novos = trabalhaveis.filter((l) => l.status === 'novo').length;

  const openCreate = () => { setEdit(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (l) => {
    setEdit(l);
    setForm({ nome: l.nome, telefone: l.telefone || '', email: l.email || '', cpf: l.cpf || '', origem: l.origem || '', campanha_id: l.campanha_id || '', convenio_id: l.convenio_id || '', status: l.status, valor_estimado: l.valor_estimado ?? '', observacao: l.observacao || '' });
    setOpen(true);
  };
  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { nome: form.nome, telefone: form.telefone || null, email: form.email || null, cpf: form.cpf || null, origem: form.origem || null, campanha_id: form.campanha_id || null, convenio_id: form.convenio_id || null, status: form.status, valor_estimado: num(form.valor_estimado), observacao: form.observacao || null };
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
      if (RESULTADOS_PERDA.includes(intForm.resultado) && intForm.motivo_perda_id) {
        await leadsApi.update(atender.id, { motivo_perda_id: intForm.motivo_perda_id }).catch(() => {});
      }
      await auditoriaApi.log('registrar_interacao', 'leads', atender.id, { resultado: intForm.resultado });
      setInteracoes(await interacoesApi.list({ lead_id: atender.id }).catch(() => []));
      setIntForm(emptyInt);
      load(); // atualiza tentativas/status/próximo contato do lead
    } catch (err) { alert(err.message || 'Falha ao registrar.'); }
    finally { setSavingInt(false); }
  };
  const qualificar = async () => {
    if (!confirm('Qualificar este lead? Isto cria/vincula o tomador e abre uma oportunidade.')) return;
    try {
      // 1) Tomador: reaproveita por CPF ou cria a partir do lead
      let clienteId = atender.cliente_id || null;
      let dedup = false;
      if (!clienteId && atender.cpf) {
        const existente = await clientesApi.getByCpf(atender.cpf).catch(() => null);
        if (existente) { clienteId = existente.id; dedup = true; }
      }
      if (!clienteId) {
        const novo = await clientesApi.create({
          nome: atender.nome, cpf: (atender.cpf || '').replace(/\D/g, '') || null,
          telefone: atender.telefone || null, email: atender.email || null,
          franquia_id: activeUnidade?.id || null,
        });
        clienteId = novo.id;
      }
      // 2) Vincula o lead ao tomador
      await leadsApi.update(atender.id, { cliente_id: clienteId });
      // 3) Registra qualificação (trigger move o lead p/ 'qualificado')
      await interacoesApi.create({ lead_id: atender.id, operador_id: perfil?.id || null, franquia_id: activeUnidade?.id || null, tipo: 'ligacao', resultado: 'qualificado', observacao: 'Lead qualificado' });
      // 4) Abre a oportunidade já com o tomador
      await oportunidadesApi.create({
        lead_id: atender.id, cliente_id: clienteId, convenio_id: atender.convenio_id || null,
        operador_id: perfil?.id || null, franquia_id: activeUnidade?.id || null,
        produto: 'cartao_beneficio', valor_estimado: atender.valor_estimado ?? null, etapa: 'qualificacao', probabilidade: 50,
      });
      await auditoriaApi.log('qualificar_lead', 'leads', atender.id, { cliente_id: clienteId, dedup });
      alert(dedup ? 'Tomador já existia (CPF) — vinculado. Oportunidade criada.' : 'Tomador criado e oportunidade aberta.');
      setAtender(null); load();
    } catch (err) { alert(err.message || 'Falha ao qualificar.'); }
  };

  const funil = ORDER.map((s) => ({ status: s, n: leads.filter((l) => l.status === s).length }));
  const max = Math.max(1, ...funil.map((f) => f.n));
  const prioridadeLead = (l) => PRIOR_ORDER[l.convenio?.prioridade_comercial] ?? 3;
  const leadsView = leads
    .filter((l) => filtroResp === 'todos' ? true : filtroResp === 'meus' ? l.responsavel_id === perfil?.id : l.responsavel_id === filtroResp)
    .sort((a, b) => {
      const pa = prioridadeLead(a), pb = prioridadeLead(b);
      if (pa !== pb) return pa - pb; // município prioritário primeiro
      const ta = a.proximo_contato ? new Date(a.proximo_contato).getTime() : Infinity;
      const tb = b.proximo_contato ? new Date(b.proximo_contato).getTime() : Infinity;
      return ta - tb; // depois por retorno agendado (mais urgente antes)
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-500">Leads e discagem — fila de trabalho do call center</p>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filtroResp} onValueChange={setFiltroResp}>
            <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os leads</SelectItem>
              <SelectItem value="meus">Meus leads</SelectItem>
              {operadores.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          {isAdmin && <Button variant="outline" onClick={distribuir} disabled={distribuindo} className="gap-2"><Shuffle className="w-4 h-4" /> Distribuir</Button>}
          {isAdmin && <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2"><Upload className="w-4 h-4" /> Importar</Button>}
          <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo lead</Button>
        </div>
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
        : leadsView.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Nenhum lead.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Telefone</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden xl:table-cell">Operador</th>
              <th className="text-center px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Tent.</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Próx. contato</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ações</th>
            </tr></thead>
            <tbody>
              {leadsView.map((l) => {
                const vencido = l.proximo_contato && new Date(l.proximo_contato).getTime() <= agora;
                return (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <span className="inline-flex items-center gap-2">
                        {l.nome}
                        {PRIOR_LABEL[l.convenio?.prioridade_comercial] && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${PRIOR_COR[l.convenio.prioridade_comercial]}`} title={`Município ${PRIOR_LABEL[l.convenio.prioridade_comercial]} — ${l.convenio.nome}`}>{PRIOR_LABEL[l.convenio.prioridade_comercial]}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {l.telefone ? (
                        <span className="inline-flex items-center gap-2">
                          <a href={telHref(l.telefone)} className="text-slate-600 hover:text-primary">{l.telefone}</a>
                          <a href={waHref(l.telefone)} target="_blank" rel="noreferrer" title="WhatsApp" className="text-green-600 hover:text-green-700"><MessageCircle className="w-3.5 h-3.5" /></a>
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden xl:table-cell text-xs">{l.responsavel_id ? nomeOperador(l.responsavel_id) : <span className="text-slate-300">não atribuído</span>}</td>
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
            <div className="space-y-2">
              <Label>Convênio / Município</Label>
              <Select value={form.convenio_id} onValueChange={(v) => setForm({ ...form, convenio_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}{PRIOR_LABEL[c.prioridade_comercial] ? ` · ${PRIOR_LABEL[c.prioridade_comercial]}` : ''}</SelectItem>)}</SelectContent>
              </Select>
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
          <div className="flex items-center gap-3 text-sm text-slate-600 -mt-1 flex-wrap">
            {atender?.telefone ? (
              <span className="inline-flex items-center gap-2">
                <a href={telHref(atender.telefone)} className="inline-flex items-center gap-1 text-primary font-medium"><Phone className="w-3.5 h-3.5" /> {atender.telefone}</a>
                <a href={waHref(atender.telefone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-green-600"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>
              </span>
            ) : <span className="text-slate-400">sem telefone</span>}
            {atender?.cpf && <span className="text-slate-400">CPF {atender.cpf}</span>}
            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CHIP[atender?.status]}`}>{STATUS[atender?.status]}</span>
          </div>

          {/* Roteiro de atendimento */}
          {roteiro.length > 0 && (
            <div className="border border-slate-200 rounded-lg">
              <button type="button" onClick={() => setShowRoteiro((v) => !v)} className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700">
                <span className="inline-flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Roteiro de atendimento</span>
                <span className="text-xs text-slate-400">{showRoteiro ? 'ocultar' : 'mostrar'}</span>
              </button>
              {showRoteiro && (
                <div className="px-3 pb-3 space-y-2 max-h-40 overflow-y-auto">
                  {roteiro.map((r) => (
                    <div key={r.id} className="text-xs">
                      <span className="uppercase text-[10px] text-slate-400 tracking-wide">{r.categoria}</span>
                      <p className="text-slate-700 font-medium">{r.titulo}</p>
                      <p className="text-slate-500">{(r.conteudo || '').replace('{NOME}', atender?.nome || '').replace('{VALOR}', atender?.valor_estimado ? brl(atender.valor_estimado) : '—').replace('{PARCELA}', '—')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
            {RESULTADOS_PERDA.includes(intForm.resultado) && (
              <div className="space-y-1.5">
                <Label>Motivo da perda</Label>
                <Select value={intForm.motivo_perda_id} onValueChange={(v) => setIntForm({ ...intForm, motivo_perda_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{motivos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
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

      {/* Importar mailing (CSV) */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Importar mailing</DialogTitle></DialogHeader>
          <form onSubmit={importarCSV} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Campanha (opcional)</Label>
                <Select value={importCampanha} onValueChange={setImportCampanha}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{campanhas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Convênio/Município (opcional)</Label>
                <Select value={importConvenio} onValueChange={setImportConvenio}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{convenios.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dados (CSV — colunas: nome, telefone, cpf, email, origem)</Label>
              <Textarea rows={8} value={importText} onChange={(e) => setImportText(e.target.value)}
                placeholder={'nome;telefone;cpf;email;origem\nMaria Silva;11999998888;12345678900;maria@x.com;mailing\nJoão Souza;11988887777;;;lista fria'} />
              <p className="text-xs text-slate-400">Aceita separador vírgula, ponto-e-vírgula ou tab. A 1ª linha pode ser cabeçalho. Só o nome é obrigatório.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={importing} className="gap-2"><Upload className="w-4 h-4" /> {importing ? 'Importando…' : 'Importar'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
