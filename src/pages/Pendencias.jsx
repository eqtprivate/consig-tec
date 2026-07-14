import React, { useEffect, useState, useMemo } from 'react';
import { pendenciasApi } from '@/lib/api/pendencias';
import { areasApi } from '@/lib/api/areas';
import { usuariosApi } from '@/lib/api/usuarios';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { auditoriaApi } from '@/lib/api/auditoria';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { PageHeader, Panel, StatusBadge, EmptyState } from '@/components/kit';
import { Plus, Filter, Clock, AlertTriangle, Inbox } from 'lucide-react';

const PRIORIDADE_LABELS = { baixa: 'Baixa', media: 'Média', alta: 'Alta', critica: 'Crítica' };
const STATUS_LABELS = { aberta: 'Aberta', em_andamento: 'Em andamento', aguardando_terceiro: 'Aguardando terceiro', vencida: 'Vencida', resolvida: 'Resolvida', cancelada: 'Cancelada' };
const PRIORIDADE_CORES = { baixa: 'bg-muted text-muted-foreground', media: 'bg-blue-50 text-blue-700', alta: 'bg-amber-50 text-amber-700', critica: 'bg-red-50 text-red-700' };
const STATUS_CORES = { aberta: 'bg-muted text-muted-foreground', em_andamento: 'bg-blue-50 text-blue-700', aguardando_terceiro: 'bg-amber-50 text-amber-700', vencida: 'bg-red-50 text-red-700', resolvida: 'bg-green-50 text-green-700', cancelada: 'bg-muted text-muted-foreground/70' };

function formatSLA(data) {
  if (!data) return '—';
  const diff = new Date(data) - new Date();
  const horas = Math.floor(diff / 3600000);
  const dias = Math.floor(horas / 24);
  if (dias > 0) return `${dias}d ${horas % 24}h`;
  if (horas >= 0) return `${horas}h`;
  return `Atrasada ${Math.abs(horas)}h`;
}

export default function Pendencias() {
  const { activeUnidade } = useAuth();
  const [pendencias, setPendencias] = useState([]);
  const [areas, setAreas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ area_id: '', responsavel_id: '', prioridade: '', status: '' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ titulo: '', descricao: '', area_id: '', prioridade: 'media', status: 'aberta', sla_data: '' });

  const load = async () => {
    setLoading(true);
    const f = { ...filters };
    if (activeUnidade) f.franquia_id = activeUnidade.id;
    const [p, a, u] = await Promise.all([
      pendenciasApi.list(f).catch(() => []),
      areasApi.list().catch(() => []),
      usuariosApi.list().catch(() => []),
    ]);
    setPendencias(p);
    setAreas(a);
    setUsuarios(u);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeUnidade, filters]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.area_id) {
      alert('Selecione uma área para a pendência.');
      return;
    }
    await pendenciasApi.create({
      titulo: form.titulo,
      descricao: form.descricao || null,
      area_id: form.area_id,
      franquia_id: activeUnidade?.id || null,
      responsavel_id: form.responsavel_id || null,
      prioridade: form.prioridade,
      status: form.status,
      prazo_sla: form.sla_data || null,
    });
    await auditoriaApi.log('criar_pendencia', 'pendencias', null, { titulo: form.titulo });
    setDialogOpen(false);
    setForm({ titulo: '', descricao: '', area_id: '', prioridade: 'media', status: 'aberta', sla_data: '' });
    load();
  };

  const sorted = useMemo(() => {
    return [...pendencias].sort((a, b) => {
      const prio = { critica: 0, alta: 1, media: 2, baixa: 3 };
      return (prio[a.prioridade] ?? 5) - (prio[b.prioridade] ?? 5);
    });
  }, [pendencias]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Central de Pendências"
        subtitle={activeUnidade?.nome || 'Todas as unidades'}
        actions={(
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nova pendência
          </Button>
        )}
      />

      <Panel>
        <div className="flex items-center gap-2 mb-3 text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Filtros</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select value={filters.area_id} onValueChange={(v) => setFilters({ ...filters, area_id: v === 'all' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="Área" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as áreas</SelectItem>
              {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.responsavel_id} onValueChange={(v) => setFilters({ ...filters, responsavel_id: v === 'all' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.prioridade} onValueChange={(v) => setFilters({ ...filters, prioridade: v === 'all' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(PRIORIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v === 'all' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Panel>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <EmptyState title="Carregando…" />
        ) : sorted.length === 0 ? (
          <EmptyState icon={Inbox} title="Nenhuma pendência encontrada" description="Ajuste os filtros ou crie uma nova pendência para acompanhar aqui." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Título</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden md:table-cell">Área</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden lg:table-cell">Responsável</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Prioridade</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground uppercase text-xs hidden sm:table-cell">SLA</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => {
                const slaOverdue = p.prazo_sla && new Date(p.prazo_sla) < new Date() && p.status !== 'resolvida';
                return (
                  <tr key={p.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{p.titulo}</p>
                      {p.descricao && <p className="text-xs text-muted-foreground truncate max-w-xs">{p.descricao}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.area?.nome || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{p.responsavel?.nome || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge className={PRIORIDADE_CORES[p.prioridade]}>{PRIORIDADE_LABELS[p.prioridade]}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge className={STATUS_CORES[p.status]}>{STATUS_LABELS[p.status]}</StatusBadge>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1 text-xs ${slaOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                        {slaOverdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {formatSLA(p.prazo_sla)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova pendência</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Área</Label>
                <Select value={form.area_id} onValueChange={(v) => setForm({ ...form, area_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {areas.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={form.responsavel_id} onValueChange={(v) => setForm({ ...form, responsavel_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>SLA</Label>
                <Input type="datetime-local" value={form.sla_data} onChange={(e) => setForm({ ...form, sla_data: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Criar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
