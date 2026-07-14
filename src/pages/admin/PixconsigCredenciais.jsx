import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { empresasApi, pixCredApi } from '@/lib/api/tenant';
import { pixconsigApi } from '@/lib/api/pixconsig';
import { auditoriaApi } from '@/lib/api/auditoria';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader, Panel, StatusBadge, EmptyState } from '@/components/kit';
import { KeyRound, Save, RefreshCw, Pencil, Clock, CheckCircle2, XCircle, Loader2, ShieldAlert } from 'lucide-react';

const INTERVALOS = [1, 2, 3, 4, 6, 8, 12, 24];
const h2 = (h) => String(h).padStart(2, '0') + ':00';
const dataHoraBR = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

const FORM_VAZIO = { base_url: '', api_key: '', sync_token: '', ativo: true, intervalo_horas: 4, hora_inicio: 9, hora_fim: 17 };

export default function PixconsigCredenciais() {
  const { isSuperadmin } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [status, setStatus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [alvo, setAlvo] = useState(null); // { id, nome }
  const [form, setForm] = useState(FORM_VAZIO);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(null); // empresa_id em sync

  const load = async () => {
    setLoading(true);
    try {
      const [emps, st] = await Promise.all([empresasApi.list(), pixCredApi.status().catch(() => [])]);
      setEmpresas(emps || []);
      setStatus(st || []);
    } catch (err) { toast.error(err.message || 'Falha ao carregar.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (isSuperadmin) load(); }, [isSuperadmin]);

  // Junta a lista de empresas (tenants) com o status das credenciais existentes.
  const linhas = useMemo(() => {
    const byId = new Map((status || []).map((s) => [s.empresa_id, s]));
    return (empresas || []).map((e) => ({ empresa: e, cred: byId.get(e.id) || null }));
  }, [empresas, status]);

  const abrirEditor = async (empresa) => {
    setAlvo({ id: empresa.id, nome: empresa.nome });
    // Puxa a linha atual (janela/ativo/base_url). api_key/sync_token nunca são
    // pré-preenchidos — em branco = manter o valor atual.
    let row = null;
    try { row = await pixCredApi.get(empresa.id); } catch { /* pode não existir ainda */ }
    setForm({
      base_url: row?.base_url || '',
      api_key: '', sync_token: '',
      ativo: row?.ativo ?? true,
      intervalo_horas: row?.intervalo_horas ?? 4,
      hora_inicio: row?.hora_inicio ?? 9,
      hora_fim: row?.hora_fim ?? 17,
    });
    setOpen(true);
  };

  const salvar = async () => {
    if (form.hora_fim < form.hora_inicio) { toast.error('A hora final deve ser maior ou igual à inicial.'); return; }
    setSaving(true);
    try {
      await pixCredApi.save(alvo.id, {
        base_url: form.base_url.trim() || null,
        api_key: form.api_key,        // save() ignora string vazia (mantém)
        sync_token: form.sync_token,  // idem
        ativo: form.ativo,
        intervalo_horas: form.intervalo_horas,
        hora_inicio: form.hora_inicio,
        hora_fim: form.hora_fim,
      });
      await auditoriaApi.log('salvar_credenciais_pixconsig', 'empresas', alvo.id, { ativo: form.ativo });
      toast.success(`Credenciais de ${alvo.nome} salvas.`);
      setOpen(false);
      load();
    } catch (err) { toast.error(err.message || 'Falha ao salvar as credenciais.'); }
    finally { setSaving(false); }
  };

  const sincronizar = async (empresa) => {
    setSyncing(empresa.id);
    try {
      const r = await pixconsigApi.sync({ empresa_id: empresa.id });
      await auditoriaApi.log('sync_pixconsig_manual', 'convenios', null, { empresa_id: empresa.id, ok: r.ok, total: r.total });
      if (r.configurado === false) toast.warning(`${empresa.nome}: credenciais PixConsig ainda não configuradas.`);
      else toast.success(`${empresa.nome}: ${r.ok}/${r.total} convênios (${r.paginas} pág.).`);
      load();
    } catch (err) { toast.error(err.message || 'Falha na sincronização.'); }
    finally { setSyncing(null); }
  };

  if (!isSuperadmin) {
    return (
      <Panel className="text-center">
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Área restrita ao superadministrador da CONSIGTEC.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Credenciais PixConsig por empresa"
        subtitle="Cada cliente tem sua própria conta PixConsig (base URL + x-api-key). O sync grava os convênios na empresa correspondente."
        icon={KeyRound}
      />

      <Panel bodyClassName="overflow-x-auto">
        {loading ? <EmptyState title="Carregando…" />
        : linhas.length === 0 ? <EmptyState title="Nenhuma empresa cadastrada." />
        : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">Empresa</th>
                <th className="py-2 pr-3 font-medium">Base URL</th>
                <th className="py-2 pr-3 font-medium">API key</th>
                <th className="py-2 pr-3 font-medium">Sync</th>
                <th className="py-2 pr-3 font-medium">Última sincronização</th>
                <th className="py-2 pr-0 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ empresa, cred }) => (
                <tr key={empresa.id} className="border-b border-border last:border-0">
                  <td className="py-2.5 pr-3 font-medium text-foreground">{empresa.nome}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground max-w-[220px] truncate" title={cred?.base_url || ''}>{cred?.base_url || '—'}</td>
                  <td className="py-2.5 pr-3">
                    {cred?.tem_key
                      ? <StatusBadge tone="success"><CheckCircle2 className="w-3 h-3 mr-1" /> configurada</StatusBadge>
                      : <StatusBadge tone="neutral"><XCircle className="w-3 h-3 mr-1" /> ausente</StatusBadge>}
                  </td>
                  <td className="py-2.5 pr-3">
                    {cred?.ativo === false
                      ? <StatusBadge tone="warning">pausado</StatusBadge>
                      : cred ? <StatusBadge tone="info">ativo</StatusBadge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{dataHoraBR(cred?.ultima_sincronizacao)}</td>
                  <td className="py-2.5 pr-0">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => sincronizar(empresa)} disabled={syncing === empresa.id || !cred?.tem_key} title={cred?.tem_key ? 'Sincronizar agora' : 'Configure a API key primeiro'}>
                        <RefreshCw className={`w-3.5 h-3.5 ${syncing === empresa.id ? 'animate-spin' : ''}`} /> Sincronizar
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => abrirEditor(empresa)}>
                        <Pencil className="w-3.5 h-3.5" /> Editar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary" /> Credenciais — {alvo?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="base">Base URL da API PixConsig</Label>
              <Input id="base" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://api.pixconsig.com.br/v1" />
              <p className="text-[11px] text-muted-foreground">Em branco, a empresa-raiz usa o secret global do backend.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="key">x-api-key</Label>
                <Input id="key" type="password" autoComplete="off" value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="•••• (manter atual)" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tok">Token do cron (opcional)</Label>
                <Input id="tok" type="password" autoComplete="off" value={form.sync_token} onChange={(e) => setForm({ ...form, sync_token: e.target.value })} placeholder="•••• (manter atual)" />
              </div>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Sincronização automática desta empresa</p>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{form.ativo ? 'Ativa' : 'Pausada'}</span>
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">A cada</Label>
                  <Select value={String(form.intervalo_horas)} onValueChange={(v) => setForm({ ...form, intervalo_horas: Number(v) })} disabled={!form.ativo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{INTERVALOS.map((h) => <SelectItem key={h} value={String(h)}>{h === 24 ? '24h' : `${h}h`}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Das (BRT)</Label>
                  <Select value={String(form.hora_inicio)} onValueChange={(v) => setForm({ ...form, hora_inicio: Number(v) })} disabled={!form.ativo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 24 }, (_, h) => <SelectItem key={h} value={String(h)}>{h2(h)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Até (BRT)</Label>
                  <Select value={String(form.hora_fim)} onValueChange={(v) => setForm({ ...form, hora_fim: Number(v) })} disabled={!form.ativo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 24 }, (_, h) => <SelectItem key={h} value={String(h)}>{h2(h)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">O cron global percorre as empresas ativas e respeita esta janela por empresa.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
