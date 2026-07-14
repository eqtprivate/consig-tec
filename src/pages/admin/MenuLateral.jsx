import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { empresasApi, menuApi } from '@/lib/api/tenant';
import { areasApi } from '@/lib/api/areas';
import { buildCanonical, applyMenuConfig } from '@/lib/menuModel';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader, Panel } from '@/components/kit';
import { PanelLeft, Save, RotateCcw, Loader2, ChevronUp, ChevronDown, ChevronRight, Eye, EyeOff, LayoutDashboard, AlertCircle } from 'lucide-react';

const FIXO_ICON = { LayoutDashboard, AlertCircle };

// converte a lista canônica + config em estado editável
function montar(areas, config) {
  return applyMenuConfig(buildCanonical(areas), config).map((g) => ({
    key: g.key, nome: g.nome, tipo: g.tipo, emoji: g.emoji, icon: g.icon, oculto: !!g.oculto,
    paginas: (g.paginas || []).map((p) => ({ key: p.key, label: p.label, oculto: !!p.oculto })),
  }));
}
function mover(arr, i, dir) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const c = [...arr];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

export default function MenuLateral() {
  const { isAdmin, isSuperadmin, empresa, empresaView, reloadUserData } = useAuth();
  const [empresas, setEmpresas] = useState([]);
  const [alvoId, setAlvoId] = useState(isSuperadmin ? (empresaView || '') : (empresa?.id || ''));
  const [areas, setAreas] = useState([]);
  const [grupos, setGrupos] = useState([]);
  const [expand, setExpand] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { areasApi.list().then(setAreas).catch(() => setAreas([])); }, []);
  useEffect(() => {
    if (!isSuperadmin) return;
    empresasApi.list().then((list) => { setEmpresas(list); if (!alvoId && list.length) setAlvoId(empresaView || list[0].id); }).catch(() => {});
  }, [isSuperadmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const empresaAtual = useMemo(() => (isSuperadmin ? empresas.find((e) => e.id === alvoId) : empresa) || null, [isSuperadmin, empresas, alvoId, empresa]);

  // (re)monta o estado quando muda a empresa alvo ou as áreas carregam
  useEffect(() => {
    if (!areas.length) return;
    setGrupos(montar(areas, empresaAtual?.menu_config || null));
  }, [areas, empresaAtual?.id, empresaAtual?.menu_config]);

  const moverGrupo = (i, dir) => setGrupos((g) => mover(g, i, dir));
  const toggleGrupo = (i) => setGrupos((g) => g.map((x, k) => (k === i ? { ...x, oculto: !x.oculto } : x)));
  const moverPagina = (gi, pi, dir) => setGrupos((g) => g.map((x, k) => (k === gi ? { ...x, paginas: mover(x.paginas, pi, dir) } : x)));
  const togglePagina = (gi, pi) => setGrupos((g) => g.map((x, k) => (k === gi ? { ...x, paginas: x.paginas.map((p, j) => (j === pi ? { ...p, oculto: !p.oculto } : p)) } : x)));

  const serializar = () => ({
    grupos: grupos.map((g) => ({ key: g.key, oculto: g.oculto })),
    paginas: Object.fromEntries(grupos.filter((g) => g.paginas.length).map((g) => [g.key, g.paginas.map((p) => ({ key: p.key, oculto: p.oculto }))])),
  });

  const salvar = async () => {
    if (!empresaAtual?.id) { toast.error('Selecione a empresa.'); return; }
    setSaving(true);
    try {
      const config = serializar();
      await menuApi.salvar({ empresa_id: empresaAtual.id, config });
      setEmpresas((prev) => prev.map((e) => (e.id === empresaAtual.id ? { ...e, menu_config: config } : e)));
      await reloadUserData(); // atualiza o menu ao vivo
      toast.success('Menu salvo.');
    } catch (err) { toast.error(err.message || 'Falha ao salvar o menu.'); }
    finally { setSaving(false); }
  };

  const restaurar = async () => {
    setSaving(true);
    try {
      await menuApi.salvar({ empresa_id: empresaAtual.id, config: null });
      setEmpresas((prev) => prev.map((e) => (e.id === empresaAtual.id ? { ...e, menu_config: null } : e)));
      setGrupos(montar(areas, null));
      await reloadUserData();
      toast.success('Menu restaurado ao padrão.');
    } catch (err) { toast.error(err.message || 'Falha ao restaurar.'); }
    finally { setSaving(false); }
  };

  if (!isAdmin) {
    return <Panel className="text-center"><p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p></Panel>;
  }

  const Arrow = ({ dir, onClick, disabled }) => (
    <button type="button" onClick={onClick} disabled={disabled} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent">
      {dir < 0 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
  );
  const OlhoBtn = ({ oculto, onClick }) => (
    <button type="button" onClick={onClick} title={oculto ? 'Mostrar' : 'Ocultar'} className={`p-1.5 rounded hover:bg-muted ${oculto ? 'text-muted-foreground' : 'text-foreground'}`}>
      {oculto ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Menu lateral" subtitle="Reordene os grupos e páginas e escolha o que aparece (por empresa)." icon={PanelLeft} />

      {isSuperadmin && (
        <Panel title="Empresa">
          <Select value={alvoId} onValueChange={setAlvoId}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
            <SelectContent>{empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
          </Select>
        </Panel>
      )}

      <Panel bodyClassName="space-y-2">
        {grupos.length === 0 ? <p className="text-sm text-muted-foreground">Carregando…</p> : grupos.map((g, gi) => {
          const Icon = g.tipo === 'fixo' ? (FIXO_ICON[g.icon] || LayoutDashboard) : null;
          const temPaginas = g.paginas.length > 0;
          const aberto = !!expand[g.key];
          return (
            <div key={g.key} className={`rounded-lg border ${g.oculto ? 'border-dashed border-border bg-muted/30' : 'border-border'}`}>
              <div className="flex items-center gap-1.5 px-2 py-2">
                <div className="flex flex-col">
                  <Arrow dir={-1} onClick={() => moverGrupo(gi, -1)} disabled={gi === 0} />
                  <Arrow dir={1} onClick={() => moverGrupo(gi, 1)} disabled={gi === grupos.length - 1} />
                </div>
                {temPaginas ? (
                  <button type="button" onClick={() => setExpand((e) => ({ ...e, [g.key]: !aberto }))} className="p-1 text-muted-foreground hover:text-foreground">
                    <ChevronRight className={`w-4 h-4 transition-transform ${aberto ? 'rotate-90' : ''}`} />
                  </button>
                ) : <span className="w-6" />}
                <span className="w-6 text-center">{g.tipo === 'fixo' ? <Icon className="w-4 h-4 inline text-muted-foreground" /> : <span aria-hidden>{g.emoji}</span>}</span>
                <span className={`flex-1 text-sm font-medium ${g.oculto ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{g.nome}</span>
                {temPaginas && <span className="text-[11px] text-muted-foreground mr-1">{g.paginas.filter((p) => !p.oculto).length}/{g.paginas.length} págs</span>}
                <OlhoBtn oculto={g.oculto} onClick={() => toggleGrupo(gi)} />
              </div>

              {temPaginas && aberto && (
                <div className="border-t border-border px-2 py-1.5 ml-8 space-y-0.5">
                  {g.paginas.map((p, pi) => (
                    <div key={p.key} className="flex items-center gap-1.5 py-0.5">
                      <div className="flex flex-col">
                        <Arrow dir={-1} onClick={() => moverPagina(gi, pi, -1)} disabled={pi === 0} />
                        <Arrow dir={1} onClick={() => moverPagina(gi, pi, 1)} disabled={pi === g.paginas.length - 1} />
                      </div>
                      <span className={`flex-1 text-xs ${p.oculto ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{p.label}</span>
                      <OlhoBtn oculto={p.oculto} onClick={() => togglePagina(gi, pi)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </Panel>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">Itens ocultos não aparecem no menu (o acesso por plano/papel continua valendo).</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={restaurar} disabled={saving || !empresaAtual?.id} className="gap-2"><RotateCcw className="w-4 h-4" /> Restaurar padrão</Button>
          <Button onClick={salvar} disabled={saving || !empresaAtual?.id} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar menu
          </Button>
        </div>
      </div>
    </div>
  );
}
