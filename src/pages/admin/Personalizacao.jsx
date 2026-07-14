import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { empresasApi, brandingApi } from '@/lib/api/tenant';
import { applyBrandColor } from '@/lib/branding';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader, Panel } from '@/components/kit';
import { Palette, Save, RotateCcw, Loader2, Image as ImageIcon } from 'lucide-react';

const SUGESTOES = ['#2E4053', '#1E40AF', '#0F766E', '#7C3AED', '#B91C1C', '#C2410C', '#047857', '#0369A1'];

export default function Personalizacao() {
  const { isAdmin, isSuperadmin, empresa, empresaView, reloadUserData } = useAuth();

  const [empresas, setEmpresas] = useState([]);
  const [alvo, setAlvo] = useState(isSuperadmin ? (empresaView || '') : (empresa?.id || ''));
  const [cor, setCor] = useState('');
  const [logo, setLogo] = useState('');
  const [saving, setSaving] = useState(false);

  // Superadmin escolhe a empresa; admin fica na própria.
  useEffect(() => {
    if (!isSuperadmin) return;
    empresasApi.list().then((list) => {
      setEmpresas(list);
      if (!alvo && list.length) setAlvo(empresaView || list[0].id);
    }).catch(() => {});
  }, [isSuperadmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const empresaAtual = useMemo(() => {
    if (isSuperadmin) return empresas.find((e) => e.id === alvo) || null;
    return empresa || null;
  }, [isSuperadmin, empresas, alvo, empresa]);

  // Carrega os valores atuais da empresa selecionada.
  useEffect(() => {
    setCor(empresaAtual?.cor_primaria || '');
    setLogo(empresaAtual?.logo_url || '');
  }, [empresaAtual?.id, empresaAtual?.cor_primaria, empresaAtual?.logo_url]);

  // Pré-visualização ao vivo da cor; restaura ao sair.
  useEffect(() => {
    applyBrandColor(cor || null);
    return () => applyBrandColor(empresa?.cor_primaria || null);
  }, [cor]); // eslint-disable-line react-hooks/exhaustive-deps

  const hexOk = !cor || /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(cor.trim());

  const salvar = async () => {
    if (!empresaAtual?.id) { toast.error('Selecione uma empresa.'); return; }
    if (!hexOk) { toast.error('Cor inválida (use hexadecimal, ex.: #2E4053).'); return; }
    setSaving(true);
    try {
      const corNorm = cor ? (cor.trim().startsWith('#') ? cor.trim() : `#${cor.trim()}`) : null;
      await brandingApi.salvar({ empresa_id: empresaAtual.id, cor_primaria: corNorm, logo_url: logo.trim() || null });
      // Atualiza a empresa em foco na lista (superadmin) e o contexto do usuário.
      setEmpresas((prev) => prev.map((e) => e.id === empresaAtual.id ? { ...e, cor_primaria: corNorm, logo_url: logo.trim() || null } : e));
      await reloadUserData();
      toast.success('Personalização salva.');
    } catch (err) { toast.error(err.message || 'Falha ao salvar a personalização.'); }
    finally { setSaving(false); }
  };

  const limpar = () => { setCor(''); setLogo(''); };

  if (!isAdmin) {
    return <Panel className="text-center"><p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p></Panel>;
  }

  const corPreview = cor ? (cor.startsWith('#') ? cor : `#${cor}`) : '#2E4053';

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Personalização" subtitle="Cores e logomarca da empresa (white-label)" icon={Palette} />

      {isSuperadmin && (
        <Panel title="Empresa">
          <Select value={alvo} onValueChange={setAlvo}>
            <SelectTrigger className="max-w-sm"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
            <SelectContent>{empresas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
          </Select>
        </Panel>
      )}

      <Panel title="Cor primária" subtitle="Aplicada a botões, destaques e à barra lateral">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(corPreview) ? corPreview : '#2E4053'}
            onChange={(e) => setCor(e.target.value)}
            className="w-12 h-11 rounded-lg border border-border bg-transparent cursor-pointer p-1"
            aria-label="Selecionar cor"
          />
          <div className="space-y-1.5">
            <Label htmlFor="hex" className="text-[11px] text-muted-foreground">Hexadecimal</Label>
            <Input id="hex" value={cor} onChange={(e) => setCor(e.target.value)} placeholder="#2E4053" className={`w-40 font-mono ${hexOk ? '' : 'border-destructive'}`} />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {SUGESTOES.map((c) => (
              <button key={c} type="button" onClick={() => setCor(c)} title={c}
                className="w-6 h-6 rounded-md border border-border" style={{ background: c }} />
            ))}
          </div>
        </div>
        {!hexOk && <p className="text-[11px] text-destructive mt-2">Formato inválido. Use #RRGGBB.</p>}
      </Panel>

      <Panel title="Logomarca" subtitle="URL de uma imagem (PNG/SVG com fundo transparente recomendada)">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="logo">URL do logo</Label>
            <Input id="logo" value={logo} onChange={(e) => setLogo(e.target.value)} placeholder="https://…/logo.png" inputMode="url" />
          </div>
          <div className="rounded-lg border border-border p-4 bg-muted/40 flex items-center gap-4">
            <span className="text-[11px] text-muted-foreground shrink-0">Prévia:</span>
            <div className="h-10 flex items-center">
              {logo.trim()
                ? <img src={logo.trim()} alt="Prévia do logo" className="h-9 w-auto max-w-[200px] object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                : <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><ImageIcon className="w-4 h-4" /> sem logo (usa o padrão CONSIGTEC)</span>}
            </div>
          </div>
        </div>
      </Panel>

      {/* Prévia de componentes com a cor aplicada */}
      <Panel title="Prévia" subtitle="Como os elementos ficam com a cor escolhida">
        <div className="flex flex-wrap items-center gap-3">
          <Button className="gap-2"><Save className="w-4 h-4" /> Botão primário</Button>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">Etiqueta</span>
          <a className="text-sm text-primary underline underline-offset-2" href="#!" onClick={(e) => e.preventDefault()}>Link em destaque</a>
        </div>
      </Panel>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={limpar} className="gap-2"><RotateCcw className="w-4 h-4" /> Limpar</Button>
        <Button onClick={salvar} disabled={saving || !empresaAtual?.id || !hexOk} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar personalização
        </Button>
      </div>
    </div>
  );
}
