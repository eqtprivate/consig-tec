import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { empresasApi, brandingApi } from '@/lib/api/tenant';
import { THEMES, applyBranding } from '@/lib/branding';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader, Panel } from '@/components/kit';
import { Palette, Save, RotateCcw, Loader2, Check, Image as ImageIcon, LayoutDashboard } from 'lucide-react';

// Mini-prévia de um kit: sidebar (fundo) + realce + botão primário.
function KitPreview({ kit }) {
  return (
    <div className="flex items-stretch h-14 rounded-md overflow-hidden border border-border">
      <div className="w-8 flex flex-col items-center justify-center gap-1" style={{ background: kit.sidebar }}>
        <span className="w-3 h-3 rounded-sm" style={{ background: kit.accent }} />
        <span className="w-4 h-1 rounded-full" style={{ background: 'rgba(255,255,255,.35)' }} />
        <span className="w-4 h-1 rounded-full" style={{ background: 'rgba(255,255,255,.2)' }} />
      </div>
      <div className="flex-1 bg-card flex items-center justify-center gap-1.5">
        <span className="px-2 py-1 rounded text-[9px] font-semibold text-white" style={{ background: kit.primary }}>Botão</span>
        <span className="text-[9px] font-medium" style={{ color: kit.primary }}>link</span>
      </div>
    </div>
  );
}

export default function Personalizacao() {
  const { isAdmin, isSuperadmin, empresa, empresaView, reloadUserData } = useAuth();

  const [empresas, setEmpresas] = useState([]);
  const [alvoId, setAlvoId] = useState(isSuperadmin ? (empresaView || '') : (empresa?.id || ''));
  const [tema, setTema] = useState('');
  const [logo, setLogo] = useState('');       // fundo claro
  const [logoDark, setLogoDark] = useState(''); // fundo escuro (sidebar)
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSuperadmin) return;
    empresasApi.list().then((list) => {
      setEmpresas(list);
      if (!alvoId && list.length) setAlvoId(empresaView || list[0].id);
    }).catch(() => {});
  }, [isSuperadmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const empresaAtual = useMemo(() => {
    if (isSuperadmin) return empresas.find((e) => e.id === alvoId) || null;
    return empresa || null;
  }, [isSuperadmin, empresas, alvoId, empresa]);

  useEffect(() => {
    setTema(empresaAtual?.tema || '');
    setLogo(empresaAtual?.logo_url || '');
    setLogoDark(empresaAtual?.logo_url_dark || '');
  }, [empresaAtual?.id, empresaAtual?.tema, empresaAtual?.logo_url, empresaAtual?.logo_url_dark]);

  // Prévia ao vivo do kit; restaura o tema da própria empresa ao sair.
  useEffect(() => {
    applyBranding({ tema, cor_primaria: null });
    return () => applyBranding({ tema: empresa?.tema, cor_primaria: empresa?.cor_primaria });
  }, [tema]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    if (!empresaAtual?.id) { toast.error('Selecione uma empresa.'); return; }
    setSaving(true);
    try {
      await brandingApi.salvar({
        empresa_id: empresaAtual.id, tema: tema || null,
        logo_url: logo.trim() || null, logo_url_dark: logoDark.trim() || null,
      });
      setEmpresas((prev) => prev.map((e) => e.id === empresaAtual.id
        ? { ...e, tema: tema || null, logo_url: logo.trim() || null, logo_url_dark: logoDark.trim() || null } : e));
      await reloadUserData();
      toast.success('Personalização salva.');
    } catch (err) { toast.error(err.message || 'Falha ao salvar a personalização.'); }
    finally { setSaving(false); }
  };

  const restaurar = () => { setTema(''); setLogo(''); setLogoDark(''); };

  if (!isAdmin) {
    return <Panel className="text-center"><p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p></Panel>;
  }

  return (
    <div className="max-w-4xl space-y-5">
      <PageHeader title="Personalização" subtitle="Kit de cores e logomarca da empresa (white-label)" icon={Palette} />

      {isSuperadmin && (
        <Panel title="Empresa">
          <Select value={alvoId} onValueChange={setAlvoId}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
            <SelectContent>{empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
          </Select>
        </Panel>
      )}

      <Panel title="Kit de cores" subtitle="Define primária, barra lateral e realces de todo o layout">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {THEMES.map((kit) => {
            const sel = tema === kit.key;
            return (
              <button
                key={kit.key}
                type="button"
                onClick={() => setTema(kit.key)}
                className={`text-left rounded-xl border p-2.5 transition ${sel ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40'}`}
              >
                <KitPreview kit={kit} />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{kit.nome}</span>
                  {sel && <Check className="w-4 h-4 text-primary" />}
                </div>
              </button>
            );
          })}
        </div>
        {!tema && <p className="text-[11px] text-muted-foreground mt-3">Nenhum kit selecionado — o sistema usa o tema padrão CONSIGTEC.</p>}
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel title="Logomarca — fundo claro" subtitle="Usada em superfícies claras (login, relatórios)">
          <div className="space-y-3">
            <Input value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo-clara.png" inputMode="url" />
            <div className="rounded-lg border border-border p-4 bg-white flex items-center justify-center h-16">
              {logo.trim()
                ? <img src={logo.trim()} alt="Prévia (fundo claro)" className="h-9 w-auto max-w-[220px] object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                : <span className="text-xs text-slate-400 inline-flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /> sem logo</span>}
            </div>
          </div>
        </Panel>

        <Panel title="Logomarca — fundo escuro" subtitle="Usada na barra lateral (fundo escuro)">
          <div className="space-y-3">
            <Input value={logoDark} onChange={(e) => setLogoDark(e.target.value)} placeholder="https://…/logo-clara-sobre-escuro.png" inputMode="url" />
            <div className="rounded-lg border border-border p-4 flex items-center justify-center h-16" style={{ background: '#0F1B2D' }}>
              {(logoDark.trim() || logo.trim())
                ? <img src={logoDark.trim() || logo.trim()} alt="Prévia (fundo escuro)" className="h-9 w-auto max-w-[220px] object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                : <span className="text-xs text-slate-400 inline-flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /> usa a logo clara</span>}
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Prévia" subtitle="Elementos com o kit selecionado (a barra lateral já reflete ao vivo)">
        <div className="flex flex-wrap items-center gap-3">
          <Button className="gap-2"><LayoutDashboard className="w-4 h-4" /> Botão primário</Button>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">Etiqueta</span>
          <a className="text-sm text-primary underline underline-offset-2" href="#!" onClick={(e) => e.preventDefault()}>Link em destaque</a>
        </div>
      </Panel>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={restaurar} className="gap-2"><RotateCcw className="w-4 h-4" /> Restaurar padrão</Button>
        <Button onClick={salvar} disabled={saving || !empresaAtual?.id} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar personalização
        </Button>
      </div>
    </div>
  );
}
