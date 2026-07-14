import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { empresasApi, brandingApi } from '@/lib/api/tenant';
import { THEMES, applyBranding, hexToHsl } from '@/lib/branding';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader, Panel } from '@/components/kit';
import { Palette, Save, RotateCcw, Loader2, Check, Image as ImageIcon, LayoutDashboard, Upload, X } from 'lucide-react';

// Campo de logo: URL + upload de arquivo (Storage), com prévia e dimensões.
function LogoField({ valor, onChange, empresaId, variante, fundo, dica, rec }) {
  const [busy, setBusy] = useState(false);
  const [dims, setDims] = useState(null); // dimensões reais da imagem carregada
  const inputRef = useRef(null);
  const escuro = fundo === 'escuro';
  const recRatio = rec.w / rec.h;

  useEffect(() => { setDims(null); }, [valor]); // zera ao trocar a imagem

  const enviar = async (file) => {
    if (!file) return;
    if (!empresaId) { toast.error('Selecione a empresa antes de enviar.'); return; }
    setBusy(true);
    try {
      const url = await brandingApi.uploadLogo(empresaId, file, variante);
      onChange(url);
      toast.success('Logo enviada.');
    } catch (err) { toast.error(err.message || 'Falha no upload.'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  // Proporção fora do sugerido? (SVG não expõe pixel → não avisa)
  const proporcaoRuim = dims && dims.w && dims.h && Math.abs((dims.w / dims.h) / recRatio - 1) > 0.4;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">Tamanho sugerido: <b className="text-foreground">{rec.w}×{rec.h} px</b></span>
        {dims && (
          <span className={`text-[11px] ${proporcaoRuim ? 'text-amber-600' : 'text-muted-foreground'}`}>
            Enviada: {dims.w}×{dims.h} px
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Input value={valor} onChange={(e) => onChange(e.target.value)} placeholder="https://…/logo.png (ou envie um arquivo)" inputMode="url" className="flex-1" />
        <input ref={inputRef} type="file" accept="image/png,image/svg+xml,image/webp,image/jpeg" className="hidden" onChange={(e) => enviar(e.target.files?.[0])} />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy} className="gap-1.5 shrink-0">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Enviar
        </Button>
        {valor && (
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange('')} title="Remover" className="shrink-0"><X className="w-4 h-4" /></Button>
        )}
      </div>
      <div className="rounded-lg border border-border p-4 flex items-center justify-center h-16" style={{ background: escuro ? '#0F1B2D' : '#ffffff' }}>
        {valor.trim()
          ? <img src={valor.trim()} alt="Prévia" className="h-9 w-auto max-w-[220px] object-contain"
              onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          : <span className="text-xs text-slate-400 inline-flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /> sem logo</span>}
      </div>
      <p className="text-[11px] text-muted-foreground">{dica}</p>
      {proporcaoRuim && (
        <p className="text-[11px] text-amber-600">A proporção difere do sugerido (~{recRatio.toFixed(1)}:1) — a logo pode ficar cortada ou pequena.</p>
      )}
    </div>
  );
}

// Mini-prévia de um kit: sidebar (fundo) + página tingida + realce + botão.
function KitPreview({ kit }) {
  const p = hexToHsl(kit.primary) || { h: 215, s: 30 };
  const sSoft = Math.round(Math.max(14, Math.min(p.s, 42)) * 0.7);
  const pageBg = `hsl(${p.h} ${sSoft}% 97%)`;
  const cardBg = `hsl(${p.h} ${Math.round(sSoft * 0.6)}% 99%)`;
  return (
    <div className="flex items-stretch h-16 rounded-md overflow-hidden border border-border">
      <div className="w-8 flex flex-col items-center justify-center gap-1" style={{ background: kit.sidebar }}>
        <span className="w-3 h-3 rounded-sm" style={{ background: kit.accent }} />
        <span className="w-4 h-1 rounded-full" style={{ background: 'rgba(255,255,255,.35)' }} />
        <span className="w-4 h-1 rounded-full" style={{ background: 'rgba(255,255,255,.2)' }} />
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-1.5 p-1.5" style={{ background: pageBg }}>
        <div className="w-full h-4 rounded-sm border" style={{ background: cardBg, borderColor: `hsl(${p.h} ${sSoft}% 89%)` }} />
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded text-[9px] font-semibold text-white" style={{ background: kit.primary }}>Botão</span>
          <span className="text-[9px] font-medium" style={{ color: kit.primary }}>link</span>
        </div>
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

      <Panel title="Logomarca" subtitle="Envie um arquivo ou cole uma URL. Duas versões: para fundo claro e para a barra lateral (escura).">
        <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 mb-4">
          <p className="text-[11px] text-muted-foreground">
            <b className="text-foreground">Dimensões sugeridas:</b> logo horizontal ~<b>360×72&nbsp;px</b> (proporção ≈ 5:1, renderiza a 36&nbsp;px de altura) · símbolo/ícone ~<b>96×96&nbsp;px</b> ·
            fundo <b>transparente</b> · <b>PNG</b> ou <b>SVG</b> · até <b>1&nbsp;MB</b>.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Fundo claro (login, relatórios)</Label>
            <LogoField valor={logo} onChange={setLogo} empresaId={empresaAtual?.id} variante="claro" fundo="claro"
              rec={{ w: 360, h: 72 }} dica="Logo escura, para aparecer bem sobre fundo branco." />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Fundo escuro (barra lateral)</Label>
            <LogoField valor={logoDark} onChange={setLogoDark} empresaId={empresaAtual?.id} variante="escuro" fundo="escuro"
              rec={{ w: 360, h: 72 }} dica="Logo clara, para a sidebar escura. Em branco, usa a logo de fundo claro." />
          </div>
        </div>
      </Panel>

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
