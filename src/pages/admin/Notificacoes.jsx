import React, { useEffect, useState } from 'react';
import { notificacoesApi } from '@/lib/api/notificacoes';
import { auditoriaApi } from '@/lib/api/auditoria';
import { dataBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Send, RefreshCw } from 'lucide-react';

const CORES = { pendente: 'bg-amber-50 text-amber-700', enviado: 'bg-green-50 text-green-700', erro: 'bg-red-50 text-red-700' };

export default function Notificacoes() {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ evento: '', assunto: '', corpo: '', destinatarios: '' });
  const [info, setInfo] = useState(null);

  const load = async () => { setLoading(true); setItens(await notificacoesApi.list().catch(() => [])); setLoading(false); };
  useEffect(() => { load(); }, []);

  const processar = async () => {
    setProcessando(true); setInfo(null);
    try {
      const n = await notificacoesApi.dispatchDb();
      await auditoriaApi.log('processar_notificacoes', 'notificacoes', null, { enviados: n });
      setInfo(n > 0 ? `${n} notificação(ões) enviada(s) via Resend.` : 'Nenhuma pendente (ou Vault sem resend_api_key).');
      load();
    } catch (err) { setInfo(err.message); }
    finally { setProcessando(false); }
  };

  const criar = async (e) => {
    e.preventDefault();
    const dest = form.destinatarios.split(',').map((s) => s.trim()).filter(Boolean);
    try {
      await notificacoesApi.enqueue({ evento: form.evento || 'manual', assunto: form.assunto || null, corpo: form.corpo || null, destinatarios: dest, canal: 'email' });
      await auditoriaApi.log('enfileirar_notificacao', 'notificacoes', null, { evento: form.evento });
      setOpen(false); setForm({ evento: '', assunto: '', corpo: '', destinatarios: '' }); load();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notificações</h1>
          <p className="text-sm text-slate-500 mt-1">Fila de e-mails (motor Resend) e disparo</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={processar} disabled={processando} className="gap-2"><RefreshCw className={`w-4 h-4 ${processando ? 'animate-spin' : ''}`} /> Processar fila</Button>
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova</Button>
        </div>
      </div>

      {info && <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm">{info}</div>}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        : itens.length === 0 ? <div className="p-12 text-center text-sm text-slate-400">Fila vazia.</div>
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Evento</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden md:table-cell">Assunto</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden lg:table-cell">Destinatários</th>
              <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Criada</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Status</th>
            </tr></thead>
            <tbody>
              {itens.map((n) => {
                const dest = Array.isArray(n.destinatarios) ? n.destinatarios : [];
                return (
                  <tr key={n.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{n.evento}</td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{n.assunto || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell text-xs">{dest.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-600 hidden sm:table-cell">{dataBR(n.created_at)}</td>
                    <td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CORES[n.status_envio] || 'bg-slate-100 text-slate-500'}`}>{n.status_envio}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova notificação</DialogTitle></DialogHeader>
          <form onSubmit={criar} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Evento</Label><Input value={form.evento} onChange={(e) => setForm({ ...form, evento: e.target.value })} placeholder="ex: pendencia_sla" /></div>
              <div className="space-y-2"><Label>Assunto</Label><Input value={form.assunto} onChange={(e) => setForm({ ...form, assunto: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Destinatários (e-mails, vírgula)</Label><Input value={form.destinatarios} onChange={(e) => setForm({ ...form, destinatarios: e.target.value })} placeholder="a@x.com, b@y.com" /></div>
            <div className="space-y-2"><Label>Corpo (HTML)</Label><Textarea rows={4} value={form.corpo} onChange={(e) => setForm({ ...form, corpo: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="gap-2"><Send className="w-4 h-4" /> Enfileirar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
