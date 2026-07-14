import React, { useEffect, useState } from 'react';
import { notificacoesApi } from '@/lib/api/notificacoes';
import { auditoriaApi } from '@/lib/api/auditoria';
import { dataBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader, StatusBadge, EmptyState } from '@/components/kit';
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
      <PageHeader
        title="Notificações"
        subtitle="Fila de e-mails (motor Resend) e disparo"
        actions={<>
          <Button variant="outline" onClick={processar} disabled={processando} className="gap-2"><RefreshCw className={`w-4 h-4 ${processando ? 'animate-spin' : ''}`} /> Processar fila</Button>
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova</Button>
        </>}
      />

      {info && <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm">{info}</div>}

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? <EmptyState title="Carregando..." />
        : itens.length === 0 ? <EmptyState title="Fila vazia." />
        : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Evento</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">Assunto</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden lg:table-cell">Destinatários</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">Criada</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
            </tr></thead>
            <tbody>
              {itens.map((n) => {
                const dest = Array.isArray(n.destinatarios) ? n.destinatarios : [];
                return (
                  <tr key={n.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium text-foreground">{n.evento}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{n.assunto || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">{dest.join(', ') || '—'}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{dataBR(n.created_at)}</td>
                    <td className="px-4 py-3"><StatusBadge className={CORES[n.status_envio] || 'bg-muted text-muted-foreground'}>{n.status_envio}</StatusBadge></td>
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
