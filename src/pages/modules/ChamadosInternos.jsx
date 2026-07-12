import React, { useEffect, useRef, useState } from 'react';
import { chamadosInternosApi } from '@/lib/api/chamadosInternos';
import { usuariosApi } from '@/lib/api/usuarios';
import { areasApi } from '@/lib/api/areas';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Send, MessagesSquare } from 'lucide-react';

const TIPO = { solicitacao: 'Solicitação', duvida: 'Dúvida', erro_operacional: 'Erro operacional', aprovacao: 'Aprovação', outro: 'Outro' };
const STATUS = { aberto: 'Aberto', em_andamento: 'Em andamento', aguardando: 'Aguardando', resolvido: 'Resolvido', fechado: 'Fechado' };
const ST_COR = { aberto: 'bg-amber-50 text-amber-700', em_andamento: 'bg-blue-50 text-blue-700', aguardando: 'bg-purple-50 text-purple-700', resolvido: 'bg-green-50 text-green-700', fechado: 'bg-slate-100 text-slate-500' };
const PRIOR = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
const PR_COR = { baixa: 'text-slate-400', media: 'text-slate-500', alta: 'text-amber-600', critica: 'text-red-600' };

const hora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export default function ChamadosInternos() {
  const { perfil, activeUnidade } = useAuth();
  const [itens, setItens] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('abertos');
  const [sel, setSel] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [open, setOpen] = useState(false);
  const emptyForm = { titulo: '', descricao: '', tipo: 'solicitacao', prioridade: 'media', destino_area_id: '', responsavel_id: '' };
  const [form, setForm] = useState(emptyForm);
  const fimRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const [c, u, a] = await Promise.all([
      chamadosInternosApi.list().catch(() => []),
      usuariosApi.list().catch(() => []),
      areasApi.list().catch(() => []),
    ]);
    setItens(c); setUsuarios(u); setAreas(a); setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const abrir = async (c) => {
    setSel(c);
    setMsgs(await chamadosInternosApi.mensagens(c.id).catch(() => []));
    setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const enviar = async () => {
    if (!texto.trim() || !sel) return;
    setEnviando(true);
    try {
      await chamadosInternosApi.enviarMensagem(sel.id, texto.trim());
      setTexto('');
      setMsgs(await chamadosInternosApi.mensagens(sel.id));
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (err) { alert(err.message || 'Falha ao enviar.'); }
    finally { setEnviando(false); }
  };

  const mudarStatus = async (status) => {
    const patch = { status, ...(status === 'resolvido' ? { resolvido_em: new Date().toISOString() } : {}) };
    const upd = await chamadosInternosApi.update(sel.id, patch);
    await auditoriaApi.log('status_chamado_interno', 'chamados_internos', sel.id, { status });
    setSel(upd); load();
  };
  const atribuir = async (responsavel_id) => {
    const upd = await chamadosInternosApi.update(sel.id, { responsavel_id: responsavel_id || null });
    await auditoriaApi.log('atribuir_chamado_interno', 'chamados_internos', sel.id, { responsavel_id });
    setSel(upd); load();
  };

  const criar = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) return alert('Informe o título.');
    try {
      const novo = await chamadosInternosApi.create({
        titulo: form.titulo, descricao: form.descricao || null, tipo: form.tipo, prioridade: form.prioridade,
        destino_area_id: form.destino_area_id || null, responsavel_id: form.responsavel_id || null,
        franquia_id: activeUnidade?.id || null,
      });
      await auditoriaApi.log('abrir_chamado_interno', 'chamados_internos', novo.id, { titulo: form.titulo });
      setOpen(false); setForm(emptyForm); await load(); abrir(novo);
    } catch (err) { alert(err.message || 'Falha ao abrir chamado.'); }
  };

  const view = itens.filter((c) =>
    filtro === 'todos' ? true
    : filtro === 'meus' ? c.solicitante_id === perfil?.id
    : filtro === 'atribuidos' ? c.responsavel_id === perfil?.id
    : !['resolvido', 'fechado'].includes(c.status)   // abertos
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-500">Chamados internos — solicitações e chat entre equipes</p>
        <div className="flex gap-2">
          <div className="w-40">
            <Select value={filtro} onValueChange={setFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="abertos">Abertos</SelectItem>
                <SelectItem value="atribuidos">Atribuídos a mim</SelectItem>
                <SelectItem value="meus">Abertos por mim</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => { setForm(emptyForm); setOpen(true); }} className="gap-2"><Plus className="w-4 h-4" /> Novo chamado</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden lg:max-h-[70vh] lg:overflow-y-auto">
          {loading ? <div className="p-8 text-center text-sm text-slate-400">Carregando...</div>
          : view.length === 0 ? <div className="p-8 text-center text-sm text-slate-400">Nenhum chamado.</div>
          : view.map((c) => (
            <button key={c.id} onClick={() => abrir(c)} className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 ${sel?.id === c.id ? 'bg-primary/5' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-800 truncate">{c.titulo}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${ST_COR[c.status]}`}>{STATUS[c.status]}</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                <span className={PR_COR[c.prioridade]}>● {PRIOR[c.prioridade]}</span>
                {' · '}{TIPO[c.tipo]}{c.area ? ` · ${c.area.nome}` : ''}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {c.solicitante?.nome || '—'}{c.responsavel ? ` → ${c.responsavel.nome}` : ' · não atribuído'} · {hora(c.updated_at)}
              </p>
            </button>
          ))}
        </div>

        {/* Detalhe + chat */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 flex flex-col lg:max-h-[70vh]">
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
                      Aberto por {sel.solicitante?.nome || '—'} · {hora(sel.created_at)}{sel.area ? ` · destino ${sel.area.nome}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <div className="w-40">
                    <Select value={sel.status} onValueChange={mudarStatus}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="w-52">
                    <Select value={sel.responsavel_id || 'none'} onValueChange={(v) => atribuir(v === 'none' ? '' : v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Atribuir a…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não atribuído</SelectItem>
                        {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className={`text-[11px] font-medium ${PR_COR[sel.prioridade]}`}>● {PRIOR[sel.prioridade]}</span>
                </div>
              </div>

              {/* Thread */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[240px]">
                {msgs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Sem mensagens ainda. Inicie a conversa.</p>
                ) : msgs.map((m) => {
                  const meu = m.autor_id === perfil?.id;
                  return (
                    <div key={m.id} className={`flex ${meu ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${meu ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-800'}`}>
                        {!meu && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.autor?.nome || 'Usuário'}</p>}
                        <p className="text-sm whitespace-pre-wrap break-words">{m.corpo}</p>
                        <p className={`text-[9px] mt-0.5 ${meu ? 'text-primary-foreground/70' : 'text-slate-400'}`}>{hora(m.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={fimRef} />
              </div>

              {/* Reply */}
              <div className="p-3 border-t border-slate-200 flex items-end gap-2">
                <Textarea
                  rows={1} value={texto} onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                  placeholder="Escreva uma mensagem…  (Enter envia, Shift+Enter quebra linha)" className="resize-none"
                />
                <Button onClick={enviar} disabled={enviando || !texto.trim()} className="shrink-0 gap-1"><Send className="w-4 h-4" /></Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Novo chamado */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo chamado interno</DialogTitle></DialogHeader>
          <form onSubmit={criar} className="space-y-4">
            <div className="space-y-2"><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TIPO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
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
                <Label>Área de destino</Label>
                <Select value={form.destino_area_id || 'none'} onValueChange={(v) => setForm({ ...form, destino_area_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Atribuir a</Label>
                <Select value={form.responsavel_id || 'none'} onValueChange={(v) => setForm({ ...form, responsavel_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">Abrir chamado</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
