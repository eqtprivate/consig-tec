import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { conveniosApi } from '@/lib/api/convenios';
import ConvenioPicker from '@/components/ConvenioPicker';
import { leadFontesApi, PAPEIS_FONTE, TIPOS_FONTE, MODOS_FONTE, CAMPOS_CANONICOS } from '@/lib/api/leadFontes';
import { decretosApi } from '@/lib/api/decretos';
import { brl } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, RefreshCw, UploadCloud, Link2, Loader2, Download, Play, ScanLine } from 'lucide-react';

const inputSel = 'h-8 text-sm rounded-md border border-border bg-card px-2';
const badge = 'text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground';

// Editor simples de de-para: linhas coluna_origem -> campo_canonico.
function DeParaEditor({ linhas, setLinhas }) {
  const set = (i, k, v) => setLinhas(linhas.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const add = () => setLinhas([...linhas, { origem: '', campo: '' }]);
  const del = (i) => setLinhas(linhas.filter((_, j) => j !== i));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">De-para de colunas (origem → campo do sistema)</span>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1" onClick={add}><Plus className="w-3 h-3" /> coluna</Button>
      </div>
      {linhas.length === 0 && <p className="text-[11px] text-muted-foreground">Sem mapeamento — adicione as colunas da planilha/arquivo que alimentam cada campo.</p>}
      {linhas.map((l, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={l.origem} onChange={(e) => set(i, 'origem', e.target.value)} placeholder="coluna na origem (ex.: NOME_SERVIDOR)" className="h-8 text-sm flex-1" />
          <span className="text-muted-foreground">→</span>
          <select value={l.campo} onChange={(e) => set(i, 'campo', e.target.value)} className={`${inputSel} min-w-[160px]`}>
            <option value="">(ignorar)</option>
            {CAMPOS_CANONICOS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="button" onClick={() => del(i)} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
        </div>
      ))}
    </div>
  );
}

const novaFonteVazia = () => ({
  rotulo: '', papel: 'folha_remuneracao', tipo: 'upload', modo: 'origem',
  file: null, url_template: '', metodo: 'GET', formato: 'csv', separador: ',',
  deparaRows: [],
});

export default function OriginacaoLeads() {
  const { brand } = useAuth();
  const empresaId = brand?.empresa_id || null;

  const [convenios, setConvenios] = useState([]);
  const [convenioId, setConvenioId] = useState('');
  const [fontes, setFontes] = useState([]);
  const [consolidacoes, setConsolidacoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nova, setNova] = useState(null);        // form de nova fonte (null = fechado)
  const [salvando, setSalvando] = useState(false);
  const [competencia, setCompetencia] = useState('');
  const [consolidando, setConsolidando] = useState(false);
  const [roteando, setRoteando] = useState(null);
  const [lgpd, setLgpd] = useState(null);
  const [lgpdForm, setLgpdForm] = useState({ base_legal: '', finalidade: '', ativo: true });
  const [dim, setDim] = useState(null);
  const [harText, setHarText] = useState('');
  const [propostas, setPropostas] = useState([]);

  const convSel = useMemo(() => convenios.find((c) => c.id === convenioId) || null, [convenios, convenioId]);

  useEffect(() => { conveniosApi.list().then(setConvenios).catch(() => setConvenios([])); }, []);

  const carregar = async (cid) => {
    if (!cid) { setFontes([]); setConsolidacoes([]); setLgpd(null); return; }
    setLoading(true);
    try {
      const [f, c, l] = await Promise.all([leadFontesApi.listFontes(cid), leadFontesApi.listConsolidacoes(cid), leadFontesApi.getLgpd(cid)]);
      setFontes(f); setConsolidacoes(c); setLgpd(l);
      setLgpdForm(l ? { base_legal: l.base_legal || '', finalidade: l.finalidade || '', ativo: !!l.ativo } : { base_legal: '', finalidade: '', ativo: true });
      leadFontesApi.dimensionamento(cid).then(setDim).catch(() => setDim(null));
    } catch (e) { toast.error(e.message || 'Falha ao carregar fontes.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { carregar(convenioId); /* eslint-disable-next-line */ }, [convenioId]);

  const salvarFonte = async () => {
    if (!empresaId) { toast.error('Empresa não identificada.'); return; }
    if (!convenioId) { toast.error('Selecione um convênio.'); return; }
    if (!nova.rotulo.trim()) { toast.error('Dê um rótulo à fonte.'); return; }
    if (nova.tipo === 'upload' && !nova.file) { toast.error('Selecione a planilha para enviar.'); return; }
    if (nova.tipo !== 'upload' && !nova.url_template.trim()) { toast.error('Informe a URL/endpoint da fonte.'); return; }
    setSalvando(true);
    try {
      let arquivo = { path: null, nome: null };
      if (nova.tipo === 'upload') arquivo = await leadFontesApi.uploadPlanilha({ empresaId, convenioId, file: nova.file });
      const de_para = Object.fromEntries(nova.deparaRows.filter((r) => r.origem && r.campo).map((r) => [r.origem.trim(), r.campo]));
      await leadFontesApi.createFonte({
        empresa_id: empresaId, convenio_id: convenioId,
        rotulo: nova.rotulo.trim(), papel: nova.papel, tipo: nova.tipo, modo: nova.modo,
        arquivo_storage_path: arquivo.path, arquivo_nome: arquivo.nome,
        url_template: nova.tipo === 'upload' ? null : nova.url_template.trim(),
        metodo: nova.metodo || 'GET', formato: nova.formato || null, separador: nova.separador || ',',
        de_para,
      });
      toast.success('Fonte adicionada.');
      setNova(null);
      carregar(convenioId);
    } catch (e) { toast.error(e.message || 'Falha ao salvar a fonte.'); }
    finally { setSalvando(false); }
  };

  const removerFonte = async (id) => {
    if (!confirm('Remover esta fonte?')) return;
    try { await leadFontesApi.removeFonte(id); carregar(convenioId); }
    catch (e) { toast.error(e.message || 'Falha ao remover.'); }
  };

  // Fonte 'decreto' → entrega o PDF ao leitor de decretos (ingerir_decreto), que na
  // aprovação aplica as regras ao convênio. Reusa toda a esteira de Decretos IA.
  const rotearDecreto = async (f) => {
    setRoteando(f.id);
    try {
      const url = f.tipo === 'upload' ? await leadFontesApi.arquivoUrl(f.arquivo_storage_path) : f.url_template;
      if (!url) throw new Error('Fonte sem arquivo/URL.');
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Não consegui baixar o arquivo do decreto.');
      const blob = await resp.blob();
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
      await decretosApi.ingerir(b64, f.arquivo_nome || `${f.rotulo || 'decreto'}.pdf`);
      toast.success('Decreto enviado ao leitor (Convênios ▸ Decretos IA) para leitura e conferência.');
    } catch (e) { toast.error(e.message || 'Falha ao rotear. Se for link externo (CORS), baixe e suba como upload.'); }
    finally { setRoteando(null); }
  };

  const salvarLgpd = async () => {
    if (!empresaId || !convenioId) return;
    if (!lgpdForm.base_legal || !lgpdForm.finalidade.trim()) { toast.error('Informe a base legal e a finalidade.'); return; }
    try {
      await leadFontesApi.saveLgpd({ empresa_id: empresaId, convenio_id: convenioId, base_legal: lgpdForm.base_legal, finalidade: lgpdForm.finalidade.trim(), ativo: lgpdForm.ativo });
      toast.success('Base legal (LGPD) registrada.');
      carregar(convenioId);
    } catch (e) { toast.error(e.message || 'Falha ao salvar a base legal.'); }
  };

  const temEnriquecimento = fontes.some((f) => f.modo === 'enriquecimento' && f.ativo);

  // Assistente de descoberta: reconhece recursos de exportação num HAR (ou lista de
  // URLs) e propõe fontes (url_template/endpoint_api) para o operador salvar.
  const analisarHar = () => {
    const txt = harText.trim();
    if (!txt) { setPropostas([]); return; }
    const ehExport = (url, mime = '') => {
      const u = url.toLowerCase();
      if (/\.(js|css|png|jpe?g|gif|svg|woff2?|ttf|ico|map)(\?|$)/.test(u)) return false;
      return /\.(csv|xlsx?|json)(\?|$)/.test(u)
        || /export|download|relatorio|planilha|servidor|folha|remunerac|transparenc/.test(u)
        || /csv|excel|spreadsheet|officedocument|application\/json/.test(mime.toLowerCase());
    };
    const fmt = (url) => { const u = url.toLowerCase(); if (/\.xlsx?(\?|$)/.test(u)) return 'xlsx'; if (/\.json(\?|$)/.test(u)) return 'json'; return 'csv'; };
    const placeholders = (url) => url
      .replace(/([?&](?:ano|year)=)\d{4}/gi, '$1{ano}')
      .replace(/([?&](?:mes|month)=)\d{1,2}\b/gi, '$1{mes}')
      .replace(/([?&]compet\w*=)[\d-]+/gi, '$1{competencia}');
    const cands = [];
    try {
      const j = JSON.parse(txt);
      for (const e of (j?.log?.entries || [])) {
        const url = e?.request?.url; if (!url) continue;
        const mime = e?.response?.content?.mimeType || '';
        if (!ehExport(url, mime)) continue;
        const metodo = (e.request.method || 'GET').toUpperCase();
        cands.push({ url: placeholders(url), metodo, formato: fmt(url), tipo: metodo === 'POST' ? 'endpoint_api' : 'url_template' });
      }
    } catch {
      for (const line of txt.split(/\n+/)) {
        const url = line.trim(); if (!/^https?:\/\//i.test(url) || !ehExport(url)) continue;
        cands.push({ url: placeholders(url), metodo: 'GET', formato: fmt(url), tipo: 'url_template' });
      }
    }
    const seen = new Set();
    const uniq = cands.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true)));
    setPropostas(uniq.map((c, i) => ({ ...c, rotulo: `Recurso ${i + 1} (${c.formato})`, sel: true })));
    if (!uniq.length) toast.error('Nenhum recurso de exportação reconhecido no conteúdo colado.');
  };

  const adicionarPropostas = async () => {
    const sel = propostas.filter((p) => p.sel);
    if (!sel.length || !empresaId || !convenioId) return;
    try {
      for (const p of sel) {
        await leadFontesApi.createFonte({
          empresa_id: empresaId, convenio_id: convenioId,
          rotulo: p.rotulo || 'Recurso', papel: 'outro', tipo: p.tipo, modo: 'origem',
          url_template: p.url, metodo: p.metodo, formato: p.formato, separador: ',', de_para: {},
        });
      }
      toast.success(`${sel.length} fonte(s) adicionada(s). Agora ajuste o de-para de cada uma.`);
      setPropostas([]); setHarText('');
      carregar(convenioId);
    } catch (e) { toast.error(e.message || 'Falha ao adicionar as fontes.'); }
  };

  const baixar = async (path) => {
    const url = await leadFontesApi.arquivoUrl(path);
    if (url) window.open(url, '_blank'); else toast.error('Arquivo indisponível.');
  };

  const consolidar = async () => {
    if (!convenioId) return;
    if (!fontes.some((f) => f.ativo)) { toast.error('Cadastre ao menos uma fonte ativa.'); return; }
    setConsolidando(true);
    try {
      const r = await leadFontesApi.consolidar(convenioId, competencia.trim() || null);
      if (r?.error) throw new Error(r.error);
      toast.success(r?.status === 'concluida'
        ? `Consolidação: ${r.total_leads} leads gerados, ${r.total_enriquecidos || 0} enriquecidos (${r.total_unicos} únicos de ${r.total_linhas} linhas).`
        : 'Consolidação disparada.');
      carregar(convenioId);
    } catch (e) { toast.error(e.message || 'Falha ao consolidar (o motor consolidar_leads pode ainda não estar publicado).'); }
    finally { setConsolidando(false); }
  };

  return (
    <div className="space-y-4">
      {/* Seletor de convênio */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Convênio:</span>
        <ConvenioPicker convenios={convenios} value={convenioId} onChange={setConvenioId} allowCreate={false} placeholder="Selecionar convênio…" />
        {convSel && <span className="text-xs text-muted-foreground">{convSel.orgao || ''}{convSel.cidade ? ` · ${convSel.cidade}` : ''}</span>}
      </div>

      {!convenioId ? (
        <div className="rounded border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Selecione um convênio para gerenciar as fontes de leads (planilhas e links de bases públicas autorizadas).
        </div>
      ) : (
        <>
          {/* Base legal (LGPD) para enriquecimento */}
          <div className="rounded border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Base legal (LGPD) para enriquecimento</h3>
              {lgpd?.ativo
                ? <span className="text-[11px] text-green-600">ativa</span>
                : <span className="text-[11px] text-amber-600">não registrada</span>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <select value={lgpdForm.base_legal} onChange={(e) => setLgpdForm({ ...lgpdForm, base_legal: e.target.value })} className={`${inputSel} w-full`}>
                <option value="">Base legal…</option>
                <option value="legitimo_interesse">Legítimo interesse</option>
                <option value="consentimento">Consentimento</option>
                <option value="execucao_contrato">Execução de contrato</option>
                <option value="obrigacao_legal">Obrigação legal</option>
              </select>
              <Input value={lgpdForm.finalidade} onChange={(e) => setLgpdForm({ ...lgpdForm, finalidade: e.target.value })} placeholder="Finalidade do tratamento" className="h-8 text-sm" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={lgpdForm.ativo} onChange={(e) => setLgpdForm({ ...lgpdForm, ativo: e.target.checked })} /> ativa</label>
              <Button size="sm" className="h-7" onClick={salvarLgpd}>Salvar base legal</Button>
              <span className="text-[10px] text-muted-foreground">Enriquecimento só roda com base legal ativa. Fontes “origem” não dependem disso.</span>
            </div>
            {temEnriquecimento && !lgpd?.ativo && (
              <p className="text-[11px] text-amber-600">⚠ Há fonte(s) de enriquecimento, mas sem base legal ativa — elas serão ignoradas na consolidação.</p>
            )}
          </div>

          {/* Fontes */}
          <div className="rounded border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <h3 className="text-sm font-semibold">Fontes de dados do convênio</h3>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => carregar(convenioId)}><RefreshCw className="w-3 h-3" /> atualizar</Button>
                <Button size="sm" className="h-7 gap-1" onClick={() => setNova(novaFonteVazia())}><Plus className="w-3.5 h-3.5" /> Nova fonte</Button>
              </div>
            </div>

            {/* Form de nova fonte */}
            {nova && (
              <div className="border-b border-border p-4 space-y-3 bg-muted/30">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Rótulo</label>
                    <Input value={nova.rotulo} onChange={(e) => setNova({ ...nova, rotulo: e.target.value })} placeholder="ex.: Folha remuneração 03/2024" className="h-8 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Papel</label>
                      <select value={nova.papel} onChange={(e) => setNova({ ...nova, papel: e.target.value })} className={`${inputSel} w-full`}>
                        {PAPEIS_FONTE.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Tipo</label>
                      <select value={nova.tipo} onChange={(e) => setNova({ ...nova, tipo: e.target.value })} className={`${inputSel} w-full`}>
                        {TIPOS_FONTE.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground">Modo desta fonte</label>
                  <select value={nova.modo} onChange={(e) => setNova({ ...nova, modo: e.target.value })} className={`${inputSel} w-full`}>
                    {MODOS_FONTE.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{nova.modo === 'enriquecimento' ? 'Atualiza contato/valor de leads já existentes; não cria novos.' : 'Cria novos leads a partir desta base.'}</p>
                </div>

                {nova.tipo === 'upload' ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-muted-foreground flex items-center gap-1"><UploadCloud className="w-3 h-3" /> Planilha/arquivo</label>
                      <input type="file" accept=".csv,.tsv,.xlsx,.xls,.json,.pdf" onChange={(e) => setNova({ ...nova, file: e.target.files?.[0] || null })} className="block w-full text-sm mt-1" />
                    </div>
                    <div className="flex gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground">Formato</label>
                        <select value={nova.formato} onChange={(e) => setNova({ ...nova, formato: e.target.value })} className={`${inputSel} w-full`}>
                          {['csv', 'xlsx', 'json'].map((f) => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      {nova.formato === 'csv' && (
                        <div className="w-24">
                          <label className="text-xs text-muted-foreground">Separador</label>
                          <Input value={nova.separador} onChange={(e) => setNova({ ...nova, separador: e.target.value })} className="h-8 text-sm" />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><Link2 className="w-3 h-3" /> URL / endpoint (use {'{ano}'} {'{mes}'} {'{competencia}'} como coringas)</label>
                    <Input value={nova.url_template} onChange={(e) => setNova({ ...nova, url_template: e.target.value })} placeholder="https://portal.exemplo.gov.br/export?ano={ano}&mes={mes}" className="h-8 text-sm" />
                  </div>
                )}

                {nova.papel !== 'decreto' && <DeParaEditor linhas={nova.deparaRows} setLinhas={(l) => setNova({ ...nova, deparaRows: l })} />}

                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={salvarFonte} disabled={salvando} className="gap-1">{salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Salvar fonte</Button>
                  <Button size="sm" variant="ghost" onClick={() => setNova(null)}>Cancelar</Button>
                </div>
              </div>
            )}

            {/* Lista de fontes */}
            <div className="divide-y divide-border">
              {loading && <div className="p-4 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> carregando…</div>}
              {!loading && fontes.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma fonte cadastrada ainda.</div>}
              {fontes.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 px-4 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{f.rotulo}</span>
                      <span className={badge}>{(PAPEIS_FONTE.find((p) => p.v === f.papel) || {}).label || f.papel}</span>
                      <span className={badge}>{(TIPOS_FONTE.find((t) => t.v === f.tipo) || {}).label || f.tipo}</span>
                      {f.modo === 'enriquecimento' && <span className={badge}>enriquecimento</span>}
                      {!f.ativo && <span className={badge}>inativa</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {f.tipo === 'upload' ? (f.arquivo_nome || '—') : (f.url_template || '—')}
                      {f.linhas ? ` · ${f.linhas} linhas` : ''}{f.ultimo_status ? ` · ${f.ultimo_status}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {f.papel === 'decreto' && (
                      <button type="button" onClick={() => rotearDecreto(f)} disabled={roteando === f.id} className="text-muted-foreground hover:text-primary" title="Enviar ao leitor de decretos">
                        {roteando === f.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                      </button>
                    )}
                    {f.tipo === 'upload' && f.arquivo_storage_path && (
                      <button type="button" onClick={() => baixar(f.arquivo_storage_path)} className="text-muted-foreground hover:text-primary" title="Baixar"><Download className="w-4 h-4" /></button>
                    )}
                    <button type="button" onClick={() => removerFonte(f.id)} className="text-muted-foreground hover:text-red-600" title="Remover"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assistente de descoberta (HAR / URLs) */}
          <div className="rounded border border-border bg-card p-3 space-y-2">
            <h3 className="text-sm font-semibold">Assistente de descoberta (HAR / URLs)</h3>
            <p className="text-[11px] text-muted-foreground">Cole o <b>HAR</b> do portal (DevTools ▸ Network ▸ “Save all as HAR”) ou uma <b>lista de URLs</b> de exportação (uma por linha). O assistente reconhece os recursos de folha e pré-preenche as fontes (você confere e salva).</p>
            <textarea value={harText} onChange={(e) => setHarText(e.target.value)} rows={4} placeholder="Cole o HAR (JSON) ou as URLs…" className="w-full text-xs rounded border border-border bg-card p-2 font-mono" />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7" onClick={analisarHar}>Analisar</Button>
              {propostas.length > 0 && <Button size="sm" className="h-7" onClick={adicionarPropostas}>Adicionar {propostas.filter((p) => p.sel).length} fonte(s)</Button>}
            </div>
            {propostas.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={p.sel} onChange={(e) => setPropostas(propostas.map((x, j) => (j === i ? { ...x, sel: e.target.checked } : x)))} />
                <span className={badge}>{p.tipo}</span><span className={badge}>{p.formato}</span>
                <Input value={p.rotulo} onChange={(e) => setPropostas(propostas.map((x, j) => (j === i ? { ...x, rotulo: e.target.value } : x)))} className="h-7 text-xs w-40" />
                <span className="truncate text-muted-foreground flex-1" title={p.url}>{p.url}</span>
              </div>
            ))}
          </div>

          {/* Dimensionamento da base capturada */}
          {dim && dim.servidores > 0 && (
            <div className="rounded border border-border bg-card p-3">
              <h3 className="text-sm font-semibold mb-2">Dimensionamento da base capturada</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  ['Servidores', dim.servidores ?? 0],
                  ['Órgãos', dim.orgaos ?? 0],
                  ['Massa bruta', brl(dim.massa_bruta)],
                  ['Massa líquida', brl(dim.massa_liquida)],
                  ['Ticket médio', brl(dim.ticket_medio_bruto)],
                  ['Capac. margem estim.', brl(dim.capacidade_margem_estimada)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded border border-border p-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{l}</div>
                    <div className="text-sm font-semibold">{v}</div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Base capturada (folha) deduplicada por pessoa, leitura mais recente. Capacidade de margem estimada (30% quando não calculada).</p>
            </div>
          )}

          {/* Consolidação → leads */}
          <div className="rounded border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
              <h3 className="text-sm font-semibold">Consolidar → gerar leads</h3>
              <div className="flex items-center gap-2">
                <Input value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="Competência (AAAA-MM, opcional)" className="h-8 text-sm w-56" />
                <Button size="sm" className="h-8 gap-1" onClick={consolidar} disabled={consolidando}>{consolidando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Consolidar</Button>
              </div>
            </div>
            <p className="px-4 pt-2 text-[11px] text-muted-foreground">
              Concatena as fontes ativas, normaliza pelo de-para, deduplica (CPF → nome → matrícula → órgão/cidade) e gera/atualiza os leads deste convênio.
            </p>
            <div className="divide-y divide-border">
              {consolidacoes.length === 0 && <div className="p-4 text-sm text-muted-foreground">Nenhuma consolidação ainda.</div>}
              {consolidacoes.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={badge}>{c.status}</span>
                    <span className="text-muted-foreground">{c.competencia || 'sem competência'}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {c.total_leads} leads · {c.total_enriquecidos || 0} enriq. · {c.total_unicos} únicos · {c.total_linhas} linhas · {new Date(c.created_at).toLocaleString('pt-BR')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
