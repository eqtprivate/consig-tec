import React, { useEffect, useRef, useState } from 'react';
import { threadsApi } from '@/lib/api/threads';
import { areasApi } from '@/lib/api/areas';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Send, MessagesSquare, ChevronDown } from 'lucide-react';

const STATUS = { aberto: 'Aberto', em_triagem: 'Em triagem', em_tratamento: 'Em tratamento', aguardando_informacao: 'Aguardando', aguardando_validacao: 'Validação', resolvido: 'Resolvido', reaberto: 'Reaberto', cancelado: 'Cancelado', encerrado: 'Encerrado' };
const ST_COR = { aberto: 'bg-amber-50 text-amber-700', em_triagem: 'bg-amber-50 text-amber-700', em_tratamento: 'bg-blue-50 text-blue-700', aguardando_informacao: 'bg-purple-50 text-purple-700', aguardando_validacao: 'bg-orange-50 text-orange-700', resolvido: 'bg-green-50 text-green-700', reaberto: 'bg-amber-50 text-amber-700', cancelado: 'bg-slate-100 text-slate-500', encerrado: 'bg-slate-100 text-slate-500' };
const CATS = { cadastro_tomador: 'Cadastro', vinculo_funcional: 'Vínculo', convenio_entidade: 'Convênio', averbacao: 'Averbação', ccb_formalizacao: 'CCB', recebivel_pmt: 'Recebível', comissoes: 'Comissões', cessao_fidc: 'Cessão', acesso_permissao: 'Acesso', lgpd_privacidade: 'LGPD', outro: 'Outro' };
const hora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

// Painel "Chamados & Pendências" de um registro. Ex.:
// <RegistroThreads entidadeRef="clientes" registroId={cliente.id} categoriaPadrao="cadastro_tomador" titulo="Tomador X" />
export default function RegistroThreads({ entidadeRef, registroId, categoriaPadrao = 'outro', titulo = '', franquiaId = null }) {
  const { perfil, activeUnidade } = useAuth();
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState([]);
  const [aberto, setAberto] = useState(null); // thread expandida
  const [msgs, setMsgs] = useState([]);
  const [texto, setTexto] = useState('');
  const [open, setOpen] = useState(false);
  const empty = { tipo: 'chamado', categoria: categoriaPadrao, titulo: '', descricao: '', area_id: '', prioridade: 'media', requer_validacao: false };
  const [form, setForm] = useState(empty);
  const fimRef = useRef(null);

  const load = async () => {
    if (!registroId) return;
    setLoading(true);
    setItens(await threadsApi.list({ entidade_ref: entidadeRef, registro_id: String(registroId) }).catch(() => []));
    setLoading(false);
  };
  useEffect(() => { load(); areasApi.list().then(setAreas).catch(() => {}); /* eslint-disable-next-line */ }, [entidadeRef, registroId]);

  const expandir = async (t) => {
    if (aberto?.id === t.id) { setAberto(null); return; }
    setAberto(t);
    setMsgs(await threadsApi.mensagens(t.id).catch(() => []));
    setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  };
  const enviar = async () => {
    if (!texto.trim() || !aberto) return;
    try {
      await threadsApi.enviarMensagem(aberto.id, texto.trim());
      setTexto('');
      setMsgs(await threadsApi.mensagens(aberto.id));
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
    } catch (err) { toast.error(err.message || 'Falha ao enviar.'); }
  };
  const criar = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) return toast.error('Informe o título.');
    if (!form.area_id) return toast.error('Selecione a área.');
    try {
      await threadsApi.abrir({ ...form, entidade_ref: entidadeRef, registro_id: registroId, franquia_id: franquiaId || activeUnidade?.id || null });
      toast.success('Chamado aberto.'); setOpen(false); setForm(empty); load();
    } catch (err) { toast.error(err.message || 'Falha ao abrir.'); }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><MessagesSquare className="w-4 h-4 text-primary" /> Chamados & Pendências</h3>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => { setForm({ ...empty, categoria: categoriaPadrao }); setOpen(true); }}><Plus className="w-4 h-4" /> Novo</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-10 rounded-lg bg-slate-100 animate-pulse" />)}</div>
      ) : itens.length === 0 ? (
        <p className="text-xs text-slate-400 py-3 text-center">Nenhum chamado para este registro.</p>
      ) : (
        <div className="space-y-1.5">
          {itens.map((t) => (
            <div key={t.id} className="border border-slate-100 rounded-lg">
              <button onClick={() => expandir(t)} className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-50 rounded-lg">
                <span className="min-w-0 text-left">
                  <span className="text-sm font-medium text-slate-800 truncate block">{t.titulo}</span>
                  <span className="text-[10px] text-slate-400">{CATS[t.categoria] || t.categoria} · {t.responsavel?.nome || 'não atribuído'} · {hora(t.updated_at)}</span>
                </span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${ST_COR[t.status]}`}>{STATUS[t.status]}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform ${aberto?.id === t.id ? 'rotate-180' : ''}`} />
                </span>
              </button>
              {aberto?.id === t.id && (
                <div className="px-3 pb-3">
                  <div className="max-h-52 overflow-y-auto space-y-2 py-2">
                    {msgs.length === 0 ? <p className="text-[11px] text-slate-400 text-center py-2">Sem mensagens.</p>
                    : msgs.map((m) => (
                      m.tipo === 'sistema' ? (
                        <p key={m.id} className="text-[10px] text-slate-400 text-center">⚙ {m.corpo} · {hora(m.created_at)}</p>
                      ) : (
                        <div key={m.id} className={`flex ${m.autor_id === perfil?.id ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-xs ${m.autor_id === perfil?.id ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-800'}`}>
                            {m.autor_id !== perfil?.id && <span className="block text-[9px] font-semibold opacity-70">{m.autor?.nome}</span>}
                            {m.deletado_em ? <span className="italic opacity-60">excluída</span> : <span className="whitespace-pre-wrap break-words">{m.corpo}</span>}
                          </div>
                        </div>
                      )
                    ))}
                    <div ref={fimRef} />
                  </div>
                  <div className="flex items-end gap-2">
                    <Textarea rows={1} value={texto} onChange={(e) => setTexto(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                      placeholder="Responder…" className="resize-none text-sm" />
                    <Button size="sm" onClick={enviar} disabled={!texto.trim()}><Send className="w-4 h-4" /></Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo chamado {titulo ? `— ${titulo}` : ''}</DialogTitle></DialogHeader>
          <form onSubmit={criar} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['baixa', 'media', 'alta', 'critica'].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Título</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea rows={2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Área</Label>
              <Select value={form.area_id} onValueChange={(v) => setForm({ ...form, area_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="rvr">Requer validação (dado crítico)</Label>
              <Switch id="rvr" checked={form.requer_validacao} onCheckedChange={(v) => setForm({ ...form, requer_validacao: v })} />
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
