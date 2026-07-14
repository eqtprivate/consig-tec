import React, { useEffect, useMemo, useState } from 'react';
import { leadsApi, interacoesApi, tarefasApi, oportunidadesApi } from '@/lib/api/crm';
import { usuariosApi } from '@/lib/api/usuarios';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirm';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader, EmptyState } from '@/components/kit';
import { Phone, MessageCircle, CalendarClock, CheckCircle2, Plus, Pencil, Trash2, ListTodo, Loader2 } from 'lucide-react';

const TIPO = { ligacao: 'Ligação', whatsapp: 'WhatsApp', email: 'E-mail', sms: 'SMS', retorno: 'Retorno' };
const RESULTADO = { atendeu: 'Atendeu', nao_atendeu: 'Não atendeu', caixa_postal: 'Caixa postal', sem_interesse: 'Sem interesse', agendar_retorno: 'Agendar retorno', qualificado: 'Qualificado', nao_perturbe: 'Não perturbe' };
const TAREFA_TIPO = { follow_up: 'Follow-up', ligacao: 'Ligação', whatsapp: 'WhatsApp', reuniao: 'Reunião', outro: 'Outro' };
const PRIOR = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
const PRIOR_DOT = { alta: 'bg-red-500', media: 'bg-amber-500', baixa: 'bg-slate-400' };
const soDigitos = (s) => (s || '').replace(/\D/g, '');
const telHref = (t) => `tel:+55${soDigitos(t)}`;
const waHref = (t) => `https://wa.me/55${soDigitos(t)}`;
const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

const emptyTask = { titulo: '', tipo: 'follow_up', prioridade: 'media', vencimento: '', responsavel_id: '', vinculo: 'nenhum', lead_id: '', oportunidade_id: '', descricao: '' };

export default function Agenda() {
  const { perfil, isAdmin } = useAuth();
  const meId = perfil?.id;
  const [tarefas, setTarefas] = useState([]);
  const [leads, setLeads] = useState([]);
  const [oportunidades, setOportunidades] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [escopo, setEscopo] = useState('meus'); // meus | todos

  // follow-up de lead (registrar interação) — fluxo existente
  const [sel, setSel] = useState(null);
  const emptyReg = { tipo: 'ligacao', resultado: 'atendeu', observacao: '', proximo_contato: '' };
  const [reg, setReg] = useState(emptyReg);
  const [savingReg, setSavingReg] = useState(false);

  // tarefa (criar/editar)
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskEdit, setTaskEdit] = useState(null);
  const [task, setTask] = useState(emptyTask);
  const [savingTask, setSavingTask] = useState(false);

  const load = async () => {
    setLoading(true);
    const [tf, ld, op, us] = await Promise.all([
      tarefasApi.list({ status: 'aberta' }).catch(() => []),
      leadsApi.list().catch(() => []),
      oportunidadesApi.list().catch(() => []),
      isAdmin ? usuariosApi.list().catch(() => []) : Promise.resolve([]),
    ]);
    setTarefas(tf); setLeads(ld); setOportunidades(op); setUsuarios(us); setLoading(false);
  };
  useEffect(() => { load(); }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Itens unificados (tarefas + follow-ups de lead) ----
  const items = useMemo(() => {
    const doEscopo = (rid) => (escopo === 'todos' ? true : rid === meId);
    const tItens = tarefas.filter((t) => doEscopo(t.responsavel_id)).map((t) => ({
      kind: 'tarefa', id: t.id, ts: t.vencimento ? new Date(t.vencimento).getTime() : Number.MAX_SAFE_INTEGER, t,
    }));
    const lItens = leads.filter((l) => l.proximo_contato && !['convertido', 'perdido'].includes(l.status) && doEscopo(l.responsavel_id))
      .map((l) => ({ kind: 'lead', id: `lead:${l.id}`, ts: new Date(l.proximo_contato).getTime(), l }));
    return [...tItens, ...lItens].sort((a, b) => a.ts - b.ts);
  }, [tarefas, leads, escopo, meId]);

  const inicioHoje = new Date(new Date().toDateString()).getTime();
  const fimHoje = inicioHoje + 86400000 - 1;
  const atrasados = items.filter((i) => i.ts < inicioHoje);
  const hoje = items.filter((i) => i.ts >= inicioHoje && i.ts <= fimHoje);
  const proximos = items.filter((i) => i.ts > fimHoje);

  // ---- Follow-up de lead ----
  const registrar = async (e) => {
    e.preventDefault();
    setSavingReg(true);
    try {
      await interacoesApi.create({
        lead_id: sel.id, operador_id: meId || null,
        tipo: reg.tipo, resultado: reg.resultado, observacao: reg.observacao || null,
        proximo_contato: reg.proximo_contato ? new Date(reg.proximo_contato).toISOString() : null,
      });
      await auditoriaApi.log('agenda_registro', 'leads', sel.id, { resultado: reg.resultado });
      setSel(null); setReg(emptyReg); load();
    } catch (err) { toast.error(err.message || 'Falha ao registrar.'); }
    finally { setSavingReg(false); }
  };

  // ---- Tarefas ----
  const abrirNova = () => { setTaskEdit(null); setTask({ ...emptyTask, responsavel_id: meId || '' }); setTaskOpen(true); };
  const abrirEdit = (t) => {
    setTaskEdit(t);
    setTask({
      titulo: t.titulo, tipo: t.tipo || 'follow_up', prioridade: t.prioridade || 'media',
      vencimento: toLocalInput(t.vencimento), responsavel_id: t.responsavel_id || meId || '',
      vinculo: t.oportunidade_id ? 'oportunidade' : (t.lead_id ? 'lead' : 'nenhum'),
      lead_id: t.lead_id || '', oportunidade_id: t.oportunidade_id || '', descricao: t.descricao || '',
    });
    setTaskOpen(true);
  };
  const salvarTask = async (e) => {
    e.preventDefault();
    if (!task.titulo.trim()) { toast.error('Informe o título.'); return; }
    setSavingTask(true);
    try {
      const payload = {
        titulo: task.titulo.trim(), tipo: task.tipo, prioridade: task.prioridade,
        vencimento: task.vencimento ? new Date(task.vencimento).toISOString() : null,
        responsavel_id: (isAdmin ? task.responsavel_id : meId) || meId || null,
        lead_id: task.vinculo === 'lead' ? (task.lead_id || null) : null,
        oportunidade_id: task.vinculo === 'oportunidade' ? (task.oportunidade_id || null) : null,
        descricao: task.descricao || null,
      };
      if (taskEdit) { await tarefasApi.update(taskEdit.id, payload); }
      else { await tarefasApi.create({ ...payload, criado_por: meId || null }); }
      await auditoriaApi.log(taskEdit ? 'editar_tarefa' : 'criar_tarefa', 'tarefas', taskEdit?.id || null, { titulo: payload.titulo });
      setTaskOpen(false); load();
    } catch (err) { toast.error(err.message || 'Falha ao salvar a tarefa.'); }
    finally { setSavingTask(false); }
  };
  const concluir = async (t) => {
    try { await tarefasApi.concluir(t.id); await auditoriaApi.log('concluir_tarefa', 'tarefas', t.id, {}); load(); }
    catch (err) { toast.error(err.message || 'Falha ao concluir.'); }
  };
  const remover = async (t) => {
    if (!(await confirmar({ title: 'Remover tarefa', description: `Remover "${t.titulo}"?`, destructive: true, confirmText: 'Remover' }))) return;
    try { await tarefasApi.remove(t.id); load(); } catch (err) { toast.error(err.message); }
  };

  const TarefaRow = ({ t }) => {
    const tel = t.lead?.telefone || t.cliente?.telefone;
    const vinc = t.lead?.nome || t.cliente?.nome || (t.oportunidade_id ? 'Oportunidade' : null);
    return (
      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border hover:bg-muted/50">
        <div className="min-w-0 flex items-start gap-2">
          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${PRIOR_DOT[t.prioridade] || 'bg-slate-400'}`} title={PRIOR[t.prioridade]} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{t.titulo}</p>
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5 flex-wrap">
              <CalendarClock className="w-3 h-3" /> {fmtDT(t.vencimento)}
              <span className="text-muted-foreground/60">· {TAREFA_TIPO[t.tipo] || t.tipo}</span>
              {vinc && <span className="text-primary">· {vinc}</span>}
              {escopo === 'todos' && t.responsavel?.nome && <span className="text-muted-foreground/60">· {t.responsavel.nome}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {tel && <a href={telHref(tel)} title="Ligar" className="p-1.5 text-primary hover:bg-muted/50 rounded"><Phone className="w-4 h-4" /></a>}
          {tel && <a href={waHref(tel)} target="_blank" rel="noreferrer" title="WhatsApp" className="p-1.5 text-green-600 hover:bg-green-50 rounded"><MessageCircle className="w-4 h-4" /></a>}
          <button onClick={() => concluir(t)} title="Concluir" className="p-1.5 text-green-600 hover:bg-green-50 rounded"><CheckCircle2 className="w-4 h-4" /></button>
          <button onClick={() => abrirEdit(t)} title="Editar" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => remover(t)} title="Remover" className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    );
  };

  const LeadRow = ({ l }) => (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border hover:bg-muted/50">
      <div className="min-w-0 flex items-start gap-2">
        <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 bg-blue-400" title="Retorno de lead" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{l.nome} <span className="text-[10px] text-muted-foreground">· lead</span></p>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {fmtDT(l.proximo_contato)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {l.telefone && <a href={telHref(l.telefone)} title="Ligar" className="p-1.5 text-primary hover:bg-muted/50 rounded"><Phone className="w-4 h-4" /></a>}
        {l.telefone && <a href={waHref(l.telefone)} target="_blank" rel="noreferrer" title="WhatsApp" className="p-1.5 text-green-600 hover:bg-green-50 rounded"><MessageCircle className="w-4 h-4" /></a>}
        <Button size="sm" variant="outline" onClick={() => { setSel(l); setReg(emptyReg); }}>Registrar</Button>
      </div>
    </div>
  );

  const Grupo = ({ titulo, itens, cor }) => (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide ${cor}`}>{titulo} · {itens.length}</div>
      {itens.length === 0 ? <p className="px-4 py-3 text-sm text-muted-foreground">Nada aqui.</p>
        : itens.map((i) => (i.kind === 'tarefa' ? <TarefaRow key={i.id} t={i.t} /> : <LeadRow key={i.id} l={i.l} />))}
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Agenda"
        subtitle="Tarefas, follow-ups e retornos agendados"
        actions={(
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Select value={escopo} onValueChange={setEscopo}>
                <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="meus">Minha agenda</SelectItem><SelectItem value="todos">Toda a equipe</SelectItem></SelectContent>
              </Select>
            )}
            <Button onClick={abrirNova} className="gap-2"><Plus className="w-4 h-4" /> Nova tarefa</Button>
          </div>
        )}
      />

      {loading ? <EmptyState icon={Loader2} title="Carregando…" /> : (
        <div className="space-y-3">
          <Grupo titulo="Atrasados" itens={atrasados} cor="text-red-600 bg-red-50" />
          <Grupo titulo="Hoje" itens={hoje} cor="text-amber-700 bg-amber-50" />
          <Grupo titulo="Próximos" itens={proximos} cor="text-muted-foreground bg-muted" />
        </div>
      )}

      {/* Criar/editar tarefa */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ListTodo className="w-4 h-4 text-primary" /> {taskEdit ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle></DialogHeader>
          <form onSubmit={salvarTask} className="space-y-3">
            <div className="space-y-1.5"><Label>Título</Label><Input value={task.titulo} onChange={(e) => setTask({ ...task, titulo: e.target.value })} required /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={task.tipo} onValueChange={(v) => setTask({ ...task, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TAREFA_TIPO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Prioridade</Label>
                <Select value={task.prioridade} onValueChange={(v) => setTask({ ...task, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIOR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Vencimento</Label><Input type="datetime-local" value={task.vencimento} onChange={(e) => setTask({ ...task, vencimento: e.target.value })} /></div>
            </div>
            {isAdmin && (
              <div className="space-y-1.5">
                <Label>Responsável</Label>
                <Select value={task.responsavel_id} onValueChange={(v) => setTask({ ...task, responsavel_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{usuarios.filter((u) => u.ativo).map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Vincular a</Label>
                <Select value={task.vinculo} onValueChange={(v) => setTask({ ...task, vinculo: v, lead_id: '', oportunidade_id: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum">Nada</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="oportunidade">Oportunidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {task.vinculo === 'lead' && (
                <div className="space-y-1.5">
                  <Label>Lead</Label>
                  <Select value={task.lead_id} onValueChange={(v) => setTask({ ...task, lead_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{leads.slice(0, 200).map((l) => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {task.vinculo === 'oportunidade' && (
                <div className="space-y-1.5">
                  <Label>Oportunidade</Label>
                  <Select value={task.oportunidade_id} onValueChange={(v) => setTask({ ...task, oportunidade_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>{oportunidades.slice(0, 200).map((o) => <SelectItem key={o.id} value={o.id}>{o.cliente?.nome || o.lead?.nome || o.id.slice(0, 8)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={task.descricao} onChange={(e) => setTask({ ...task, descricao: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTaskOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={savingTask}>{savingTask ? 'Salvando…' : (taskEdit ? 'Salvar' : 'Criar tarefa')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Registrar follow-up de lead (fluxo existente) */}
      <Dialog open={!!sel} onOpenChange={(v) => !v && setSel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> {sel?.nome}</DialogTitle></DialogHeader>
          {sel?.telefone && (
            <div className="flex items-center gap-3 text-sm -mt-1">
              <a href={telHref(sel.telefone)} className="inline-flex items-center gap-1 text-primary font-medium"><Phone className="w-3.5 h-3.5" /> {sel.telefone}</a>
              <a href={waHref(sel.telefone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-green-600"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>
            </div>
          )}
          <form onSubmit={registrar} className="space-y-3 border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={reg.tipo} onValueChange={(v) => setReg({ ...reg, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TIPO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Resultado</Label>
                <Select value={reg.resultado} onValueChange={(v) => setReg({ ...reg, resultado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(RESULTADO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Textarea rows={2} value={reg.observacao} onChange={(e) => setReg({ ...reg, observacao: e.target.value })} placeholder="Observação" />
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5"><Label>Reagendar</Label><Input type="datetime-local" value={reg.proximo_contato} onChange={(e) => setReg({ ...reg, proximo_contato: e.target.value })} /></div>
              <Button type="submit" disabled={savingReg} className="gap-2"><CheckCircle2 className="w-4 h-4" /> {savingReg ? 'Salvando…' : 'Registrar'}</Button>
            </div>
          </form>
          <DialogFooter><Button variant="outline" onClick={() => setSel(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
