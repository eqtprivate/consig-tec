import React, { useEffect, useState } from 'react';
import { leadsApi, interacoesApi } from '@/lib/api/crm';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Phone, MessageCircle, CalendarClock, CheckCircle2 } from 'lucide-react';

const TIPO = { ligacao: 'Ligação', whatsapp: 'WhatsApp', email: 'E-mail', sms: 'SMS', retorno: 'Retorno' };
const RESULTADO = { atendeu: 'Atendeu', nao_atendeu: 'Não atendeu', caixa_postal: 'Caixa postal', sem_interesse: 'Sem interesse', agendar_retorno: 'Agendar retorno', qualificado: 'Qualificado', nao_perturbe: 'Não perturbe' };
const soDigitos = (s) => (s || '').replace(/\D/g, '');
const telHref = (t) => `tel:+55${soDigitos(t)}`;
const waHref = (t) => `https://wa.me/55${soDigitos(t)}`;
const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

export default function Agenda() {
  const { activeUnidade, perfil, isAdmin } = useAuth();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [escopo, setEscopo] = useState('meus'); // meus | todos
  const [sel, setSel] = useState(null);
  const empty = { tipo: 'ligacao', resultado: 'atendeu', observacao: '', proximo_contato: '' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLeads(await leadsApi.list(activeUnidade ? { franquia_id: activeUnidade.id } : {}).catch(() => []));
    setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const registrar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await interacoesApi.create({
        lead_id: sel.id, operador_id: perfil?.id || null, franquia_id: activeUnidade?.id || null,
        tipo: form.tipo, resultado: form.resultado, observacao: form.observacao || null,
        proximo_contato: form.proximo_contato ? new Date(form.proximo_contato).toISOString() : null,
      });
      await auditoriaApi.log('agenda_registro', 'leads', sel.id, { resultado: form.resultado });
      setSel(null); setForm(empty); load();
    } catch (err) { alert(err.message || 'Falha ao registrar.'); }
    finally { setSaving(false); }
  };

  const inicioHoje = new Date(new Date().toDateString()).getTime();
  const fimHoje = inicioHoje + 86400000 - 1;
  const ts = (l) => new Date(l.proximo_contato).getTime();
  const ordenar = (arr) => arr.sort((a, b) => ts(a) - ts(b));
  const base = leads.filter((l) =>
    l.proximo_contato && !['convertido', 'perdido'].includes(l.status) &&
    (escopo === 'todos' ? true : l.responsavel_id === perfil?.id)
  );
  const atrasados = ordenar(base.filter((l) => ts(l) < inicioHoje));
  const hoje = ordenar(base.filter((l) => ts(l) >= inicioHoje && ts(l) <= fimHoje));
  const proximos = ordenar(base.filter((l) => ts(l) > fimHoje));

  const Grupo = ({ titulo, itens, cor }) => (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wide ${cor}`}>{titulo} · {itens.length}</div>
      {itens.length === 0 ? <p className="px-4 py-3 text-sm text-slate-400">Nada aqui.</p> : itens.map((l) => (
        <div key={l.id} className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 hover:bg-slate-50">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{l.nome}</p>
            <p className="text-xs text-slate-400 inline-flex items-center gap-1"><CalendarClock className="w-3 h-3" /> {fmtDT(l.proximo_contato)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {l.telefone && <a href={telHref(l.telefone)} title="Ligar" className="p-1.5 text-primary hover:bg-slate-100 rounded"><Phone className="w-4 h-4" /></a>}
            {l.telefone && <a href={waHref(l.telefone)} target="_blank" rel="noreferrer" title="WhatsApp" className="p-1.5 text-green-600 hover:bg-green-50 rounded"><MessageCircle className="w-4 h-4" /></a>}
            <Button size="sm" variant="outline" onClick={() => { setSel(l); setForm(empty); }}>Registrar</Button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Agenda — retornos agendados</p>
        {isAdmin && (
          <Select value={escopo} onValueChange={setEscopo}>
            <SelectTrigger className="h-9 w-40 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="meus">Minha agenda</SelectItem><SelectItem value="todos">Toda a equipe</SelectItem></SelectContent>
          </Select>
        )}
      </div>

      {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div> : (
        <div className="space-y-3">
          <Grupo titulo="Atrasados" itens={atrasados} cor="text-red-600 bg-red-50" />
          <Grupo titulo="Hoje" itens={hoje} cor="text-amber-700 bg-amber-50" />
          <Grupo titulo="Próximos" itens={proximos} cor="text-slate-600 bg-slate-50" />
        </div>
      )}

      <Dialog open={!!sel} onOpenChange={(v) => !v && setSel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> {sel?.nome}</DialogTitle></DialogHeader>
          {sel?.telefone && (
            <div className="flex items-center gap-3 text-sm -mt-1">
              <a href={telHref(sel.telefone)} className="inline-flex items-center gap-1 text-primary font-medium"><Phone className="w-3.5 h-3.5" /> {sel.telefone}</a>
              <a href={waHref(sel.telefone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-green-600"><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</a>
            </div>
          )}
          <form onSubmit={registrar} className="space-y-3 border-t border-slate-100 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TIPO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Resultado</Label>
                <Select value={form.resultado} onValueChange={(v) => setForm({ ...form, resultado: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(RESULTADO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} placeholder="Observação" />
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1.5"><Label>Reagendar</Label><Input type="datetime-local" value={form.proximo_contato} onChange={(e) => setForm({ ...form, proximo_contato: e.target.value })} /></div>
              <Button type="submit" disabled={saving} className="gap-2"><CheckCircle2 className="w-4 h-4" /> {saving ? 'Salvando…' : 'Registrar'}</Button>
            </div>
          </form>
          <DialogFooter><Button variant="outline" onClick={() => setSel(null)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
