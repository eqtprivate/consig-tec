import React, { useEffect, useRef, useState } from 'react';
import { threadsApi } from '@/lib/api/threads';
import { usuariosApi } from '@/lib/api/usuarios';
import { areasApi } from '@/lib/api/areas';
import { conveniosApi } from '@/lib/api/convenios';
import { clientesApi } from '@/lib/api/clientes';
import { propostasApi } from '@/lib/api/propostas';
import { contratosApi } from '@/lib/api/contratos';
import { ccbsApi } from '@/lib/api/ccbs';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Send, MessagesSquare, Paperclip, ShieldCheck, AlertTriangle, X, UserPlus, Clock } from 'lucide-react';

const TIPO = { chamado: 'Chamado', pendencia: 'Pendência' };
const STATUS = {
  aberto: 'Aberto', em_triagem: 'Em triagem', em_tratamento: 'Em tratamento',
  aguardando_informacao: 'Aguardando info', aguardando_validacao: 'Aguardando validação',
  resolvido: 'Resolvido', reaberto: 'Reaberto', cancelado: 'Cancelado', encerrado: 'Encerrado',
};
const ST_COR = {
  aberto: 'bg-amber-50 text-amber-700', em_triagem: 'bg-amber-50 text-amber-700',
  em_tratamento: 'bg-blue-50 text-blue-700', aguardando_informacao: 'bg-purple-50 text-purple-700',
  aguardando_validacao: 'bg-orange-50 text-orange-700', resolvido: 'bg-green-50 text-green-700',
  reaberto: 'bg-amber-50 text-amber-700', cancelado: 'bg-slate-100 text-slate-500', encerrado: 'bg-slate-100 text-slate-500',
};
const PRIOR = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
const PR_COR = { baixa: 'text-slate-400', media: 'text-slate-500', alta: 'text-amber-600', critica: 'text-red-600' };
const CATEGORIA = {
  cadastro_tomador: 'Cadastro tomador', vinculo_funcional: 'Vínculo funcional', convenio_entidade: 'Convênio/Entidade',
  averbacao: 'Averbação', ccb_formalizacao: 'CCB/Formalização', recebivel_pmt: 'Recebível/PMT',
  comissoes: 'Comissões', cessao_fidc: 'Cessão/FIDC', acesso_permissao: 'Acesso/Permissão',
  lgpd_privacidade: 'LGPD/Privacidade', outro: 'Outro',
};
// Entidades ancoráveis → carregador + rótulo do registro
const ANCORAS = {
  convenios: { label: 'Convênio', load: () => conveniosApi.list(), rotulo: (r) => r.nome },
  clientes: { label: 'Tomador', load: () => clientesApi.list(), rotulo: (r) => `${r.nome}${r.cpf ? ` · ${r.cpf}` : ''}` },
  propostas: { label: 'Proposta', load: () => propostasApi.list(), rotulo: (r) => `${r.cliente?.nome || 'Proposta'} · ${r.valor_solicitado ?? ''}` },
  contratos: { label: 'Contrato', load: () => contratosApi.list(), rotulo: (r) => `${r.numero_contrato || r.id.slice(0, 8)} · ${r.cliente?.nome || ''}` },
  ccbs: { label: 'CCB', load: () => ccbsApi.list(), rotulo: (r) => r.numero || r.id.slice(0, 8) },
};

const hora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const atrasada = (t) => t.prazo_sla && new Date(t.prazo_sla) < new Date() && !['resolvido', 'encerrado', 'cancelado'].includes(t.status);

export default function ChamadosInternos() {
  const { perfil, activeUnidade } = useAuth();
  const [itens, setItens] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [escopo, setEscopo] = useState('abertos');

  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [validacoes, setValidacoes] = useState([]);
  const [texto, setTexto] = useState('');
  const [mencoes, setMencoes] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef(null);

  const [open, setOpen] = useState(false);
  const emptyForm = { tipo: 'chamado', categoria: 'outro', titulo: '', descricao: '', entidade_ref: '', registro_id: '', area_id: '', prioridade: 'media', responsavel_id: '', requer_validacao: false, prazo_sla: '' };
  const [form, setForm] = useState(emptyForm);
  const [ancoraOpts, setAncoraOpts] = useState([]);

  const load = async () => {
    setLoading(true);
    const [t, u, a] = await Promise.all([
      threadsApi.list().catch(() => []),
      usuariosApi.list().catch(() => []),
      areasApi.list().catch(() => []),
    ]);
    setItens(t); setUsuarios(u); setAreas(a); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const abrir = async (t) => {
    setSel(t);
    const [m, v] = await Promise.all([threadsApi.mensagens(t.id).catch(() => []), threadsApi.validacoes(t.id).catch(() => [])]);
    setMsgs(m); setValidacoes(v);
    setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  };
  const recarregarThread = async (t = sel) => {
    if (!t) return;
    const [novo, m, v] = await Promise.all([threadsApi.get(t.id), threadsApi.mensagens(t.id), threadsApi.validacoes(t.id)]);
    setSel(novo); setMsgs(m); setValidacoes(v); load();
  };

  const enviar = async () => {
    if (!texto.trim() || !sel) return;
    setEnviando(true);
    try {
      await threadsApi.enviarMensagem(sel.id, texto.trim(), mencoes);
      setTexto(''); setMencoes([]);
      setMsgs(await threadsApi.mensagens(sel.id));
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    } catch (err) { toast.error(err.message || 'Falha ao enviar.'); }
    finally { setEnviando(false); }
  };

  const patch = async (updates) => {
    try { await threadsApi.update(sel.id, updates); await recarregarThread(); }
    catch (err) { toast.error(err.message || 'Falha ao atualizar.'); await recarregarThread(); }
  };
  const validar = async (aprovado) => {
    const obs = prompt(aprovado ? 'Observação da validação (opcional):' : 'Motivo da reprovação:');
    if (obs === null) return;
    await threadsApi.validar(sel.id, aprovado, obs);
    await recarregarThread();
  };
  const softDelete = async (m) => {
    const motivo = prompt('Motivo da exclusão (a mensagem original é preservada):');
    if (motivo === null) return;
    await threadsApi.softDeleteMensagem(m.id, motivo);
    setMsgs(await threadsApi.mensagens(sel.id));
  };

  const onEntidade = async (ref) => {
    setForm((f) => ({ ...f, entidade_ref: ref, registro_id: '' }));
    setAncoraOpts(ref && ANCORAS[ref] ? await ANCORAS[ref].load().catch(() => []) : []);
  };
  const criar = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) return toast.error('Informe o título.');
    if (!form.entidade_ref || !form.registro_id) return toast.error('Ancore a um registro (entidade + registro).');
    if (!form.area_id) return toast.error('Selecione a área.');
    try {
      const novo = await threadsApi.abrir({
        ...form, franquia_id: activeUnidade?.id || null,
        prazo_sla: form.prazo_sla ? new Date(form.prazo_sla).toISOString() : null,
      });
      setOpen(false); setForm(emptyForm); setAncoraOpts([]); await load(); abrir(novo);
    } catch (err) { toast.error(err.message || 'Falha ao abrir chamado.'); }
  };

  const view = itens.filter((t) =>
    escopo === 'todos' ? true
    : escopo === 'minhas' ? t.solicitante_id === perfil?.id
    : escopo === 'atribuidas' ? t.responsavel_id === perfil?.id
    : escopo === 'atrasadas' ? atrasada(t)
    : !['resolvido', 'encerrado', 'cancelado'].includes(t.status));

  const podeValidar = sel && sel.requer_validacao && !validacoes.some((v) => v.aprovado);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-500">Chamados & pendências ancorados a registros — colaboração auditável</p>
        <div className="flex gap-2">
          <div className="w-40">
            <Select value={escopo} onValueChange={setEscopo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="abertos">Abertos</SelectItem>
                <SelectItem value="atribuidas">Atribuídos a mim</SelectItem>
                <SelectItem value="minhas">Abertos por mim</SelectItem>
                <SelectItem value="atrasadas">Atrasados (SLA)</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => { setForm(emptyForm); setAncoraOpts([]); setOpen(true); }} className="gap-2"><Plus className="w-4 h-4" /> Novo</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Caixa de entrada */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden lg:max-h-[72vh] lg:overflow-y-auto">
          {loading ? <div className="p-3 space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-slate-100 animate-pulse" />)}</div>
          : view.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">Nenhum item.</div>
          : view.map((t) => (
            <button key={t.id} onClick={() => abrir(t)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${sel?.id === t.id ? 'bg-primary/5' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 truncate">{t.titulo}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${ST_COR[t.status]}`}>{STATUS[t.status]}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                <span className={PR_COR[t.prioridade]}>● {PRIOR[t.prioridade]}</span>
                {' · '}{TIPO[t.tipo]}{t.categoria ? ` · ${CATEGORIA[t.categoria]}` : ''}
                {atrasada(t) && <span className="text-red-600 font-medium pulse-crit"> · SLA vencido</span>}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                🔗 {ANCORAS[t.entidade_ref]?.label || t.entidade_ref} · {t.responsavel?.nome || 'não atribuído'} · {hora(t.updated_at)}
              </p>
            </button>
          ))}
        </div>

        {/* Thread */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 flex flex-col lg:max-h-[72vh]">
          {!sel ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12">
              <MessagesSquare className="w-8 h-8 mb-2" />
              <p className="text-sm">Selecione um chamado para ver a conversa.</p>
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{sel.titulo}</p>
                    {sel.descricao && <p className="text-xs text-slate-500 mt-0.5">{sel.descricao}</p>}
                    <p className="text-[11px] text-slate-400 mt-1">
                      🔗 {ANCORAS[sel.entidade_ref]?.label || sel.entidade_ref} <span className="font-mono">{String(sel.registro_id).slice(0, 8)}</span>
                      {' · '}aberto por {sel.solicitante?.nome || '—'} · {hora(sel.aberto_em)}
                      {sel.area ? ` · ${sel.area.nome}` : ''}
                    </p>
                  </div>
                  {sel.requer_validacao && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 flex items-center gap-1 shrink-0"><ShieldCheck className="w-3 h-3" /> Requer validação</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <div className="w-44">
                    <Select value={sel.status} onValueChange={(v) => patch({ status: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="w-48">
                    <Select value={sel.responsavel_id || 'none'} onValueChange={(v) => patch({ responsavel_id: v === 'none' ? null : v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Atribuir…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não atribuído</SelectItem>
                        {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32">
                    <Select value={sel.prioridade} onValueChange={(v) => patch({ prioridade: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(PRIOR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {sel.prazo_sla && (
                    <span className={`text-[11px] flex items-center gap-1 ${atrasada(sel) ? 'text-red-600' : 'text-slate-400'}`}><Clock className="w-3 h-3" /> {hora(sel.prazo_sla)}</span>
                  )}
                  {podeValidar && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => validar(true)}><ShieldCheck className="w-3.5 h-3.5" /> Validar</Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1 text-red-600" onClick={() => validar(false)}><AlertTriangle className="w-3.5 h-3.5" /> Reprovar</Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline unificada */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[240px]">
                {msgs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Sem mensagens. Inicie a conversa.</p>
                ) : msgs.map((m) => {
                  if (m.tipo === 'sistema') {
                    return (
                      <div key={m.id} className="flex justify-center">
                        <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-3 py-1">⚙ {m.corpo} · {hora(m.created_at)}</span>
                      </div>
                    );
                  }
                  const meu = m.autor_id === perfil?.id;
                  return (
                    <div key={m.id} className={`flex ${meu ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${meu ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-800'}`}>
                        {!meu && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.autor?.nome || 'Usuário'}</p>}
                        {m.deletado_em ? (
                          <p className="text-sm italic opacity-60">mensagem excluída — {m.motivo_delecao || 'sem motivo'}</p>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words">{m.corpo}</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[9px] ${meu ? 'text-primary-foreground/70' : 'text-slate-400'}`}>{hora(m.created_at)}</span>
                          {meu && !m.deletado_em && <button onClick={() => softDelete(m)} className="text-[9px] underline opacity-70 hover:opacity-100">excluir</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={fimRef} />
              </div>

              {/* Reply + menções */}
              <div className="p-3 border-t border-slate-200 space-y-2">
                {mencoes.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {mencoes.map((id) => {
                      const u = usuarios.find((x) => x.id === id);
                      return <span key={id} className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 flex items-center gap-1">@{u?.nome || '—'} <button onClick={() => setMencoes((s) => s.filter((x) => x !== id))}><X className="w-2.5 h-2.5" /></button></span>;
                    })}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <div className="w-40">
                    <Select value="" onValueChange={(v) => setMencoes((s) => (s.includes(v) ? s : [...s, v]))}>
                      <SelectTrigger className="h-9 text-xs"><span className="flex items-center gap-1 text-slate-500"><UserPlus className="w-3.5 h-3.5" /> Mencionar</span></SelectTrigger>
                      <SelectContent>{usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    rows={1} value={texto} onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                    placeholder="Mensagem…  (Enter envia)" className="resize-none flex-1"
                  />
                  <Button onClick={enviar} disabled={enviando || !texto.trim()} className="shrink-0 gap-1"><Send className="w-4 h-4" /></Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Novo — âncora obrigatória */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo chamado / pendência</DialogTitle></DialogHeader>
          <form onSubmit={criar} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TIPO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORIA).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pt-1">Âncora (obrigatória)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Registro de</Label>
                <Select value={form.entidade_ref} onValueChange={onEntidade}>
                  <SelectTrigger><SelectValue placeholder="Entidade" /></SelectTrigger>
                  <SelectContent>{Object.entries(ANCORAS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Registro</Label>
                <Select value={form.registro_id} onValueChange={(v) => setForm({ ...form, registro_id: v })} disabled={!form.entidade_ref}>
                  <SelectTrigger><SelectValue placeholder={form.entidade_ref ? 'Selecionar' : '—'} /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {ancoraOpts.map((r) => <SelectItem key={r.id} value={r.id}>{ANCORAS[form.entidade_ref].rotulo(r)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Área</Label>
                <Select value={form.area_id} onValueChange={(v) => setForm({ ...form, area_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIOR).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={form.responsavel_id || 'none'} onValueChange={(v) => setForm({ ...form, responsavel_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Prazo SLA</Label><Input type="datetime-local" value={form.prazo_sla} onChange={(e) => setForm({ ...form, prazo_sla: e.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="rv">Requer validação (dado crítico)</Label>
              <Switch id="rv" checked={form.requer_validacao} onCheckedChange={(v) => setForm({ ...form, requer_validacao: v })} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">Abrir</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
