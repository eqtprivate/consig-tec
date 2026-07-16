import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { documentosAdminApi } from '@/lib/api/documentosAdmin';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/kit';
import { ShieldAlert, Lock, FileText, Pencil, Plus, Save, X, Loader2, Map, ShieldCheck, Lightbulb } from 'lucide-react';

const CAT = {
  roadmap: { label: 'Roadmap', icon: Map, cls: 'text-primary bg-primary/10' },
  seguranca: { label: 'Segurança', icon: ShieldCheck, cls: 'text-red-700 bg-red-50' },
  estrategia: { label: 'Estratégia', icon: Lightbulb, cls: 'text-amber-700 bg-amber-50' },
  briefing: { label: 'Briefing', icon: FileText, cls: 'text-slate-700 bg-slate-100' },
};

// Componentes de renderização do markdown (sem depender de plugin de tipografia).
const MD = {
  h1: (p) => <h1 className="text-lg font-bold text-foreground mt-4 mb-2" {...p} />,
  h2: (p) => <h2 className="text-base font-semibold text-foreground mt-4 mb-1.5 border-b border-border pb-1" {...p} />,
  h3: (p) => <h3 className="text-sm font-semibold text-foreground mt-3 mb-1" {...p} />,
  p: (p) => <p className="text-sm text-foreground/90 leading-relaxed my-1.5" {...p} />,
  ul: (p) => <ul className="list-disc pl-5 space-y-1 my-1.5 text-sm text-foreground/90" {...p} />,
  ol: (p) => <ol className="list-decimal pl-5 space-y-1 my-1.5 text-sm text-foreground/90" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  strong: (p) => <strong className="font-semibold text-foreground" {...p} />,
  a: (p) => <a className="text-primary hover:underline" target="_blank" rel="noreferrer" {...p} />,
  code: (p) => <code className="px-1 py-0.5 rounded bg-muted text-[12px] font-mono" {...p} />,
  blockquote: (p) => <blockquote className="border-l-4 border-amber-400 bg-amber-50/50 pl-3 py-1 my-2 text-xs text-amber-900" {...p} />,
  table: (p) => <div className="overflow-x-auto my-2"><table className="w-full text-xs border-collapse" {...p} /></div>,
  th: (p) => <th className="border border-border bg-muted px-2 py-1 text-left font-medium" {...p} />,
  td: (p) => <td className="border border-border px-2 py-1 align-top" {...p} />,
};

const VAZIO = { id: null, titulo: '', categoria: 'briefing', conteudo: '', confidencial: true };

export default function DocumentosSuperadmin() {
  const { isSuperadmin } = useAuth();
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [abrindo, setAbrindo] = useState(false);
  const [edit, setEdit] = useState(null);   // objeto em edição | null
  const [busy, setBusy] = useState(false);

  const load = async () => { setLoading(true); try { setLista(await documentosAdminApi.list()); } catch (e) { toast.error(e.message); } setLoading(false); };
  useEffect(() => { if (isSuperadmin) load(); }, [isSuperadmin]);

  const abrir = async (row) => {
    setEdit(null); setAbrindo(true); setSel({ ...row, conteudo: null });
    try { setSel(await documentosAdminApi.get(row.id)); } catch (e) { toast.error(e.message); setSel(null); }
    finally { setAbrindo(false); }
  };

  const novo = () => { setSel(null); setEdit({ ...VAZIO }); };
  const editar = () => sel && setEdit({ id: sel.id, titulo: sel.titulo, categoria: sel.categoria, conteudo: sel.conteudo, confidencial: sel.confidencial });

  const salvar = async () => {
    if (!edit.titulo.trim() || !edit.conteudo.trim()) { toast.error('Título e conteúdo são obrigatórios.'); return; }
    setBusy(true);
    try {
      const id = await documentosAdminApi.salvar(edit);
      toast.success('Documento salvo.');
      setEdit(null);
      await load();
      await abrir({ id });
    } catch (e) { toast.error(e.message || 'Falha ao salvar.'); }
    finally { setBusy(false); }
  };

  const cat = useMemo(() => CAT[sel?.categoria] || CAT.briefing, [sel]);

  if (!isSuperadmin) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-red-500 mx-auto" />
        <p className="text-sm font-semibold text-foreground">Acesso restrito</p>
        <p className="text-xs text-muted-foreground">Esta área é exclusiva do superadmin do projeto.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-3 flex items-center gap-2">
        <Lock className="w-4 h-4 text-red-600 shrink-0" />
        <p className="text-xs text-red-700 dark:text-red-300"><b>CONFIDENCIAL — acesso restrito ao superadmin.</b> Não compartilhe com usuários comuns, admins de cliente ou terceiros. Cada abertura é registrada em <code>logs_acesso</code>.</p>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold text-foreground flex items-center gap-2"><FileText className="w-4 h-4 text-primary" /> Documentos de Superadmin</p>
        <Button onClick={novo} variant="outline" className="gap-2"><Plus className="w-4 h-4" /> Novo documento</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Lista */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden self-start">
          {loading ? <EmptyState title="Carregando…" />
          : lista.length === 0 ? <EmptyState icon={FileText} title="Nenhum documento" />
          : (
            <ul className="divide-y divide-border">
              {lista.map((d) => {
                const c = CAT[d.categoria] || CAT.briefing;
                return (
                  <li key={d.id}>
                    <button onClick={() => abrir(d)} className={`w-full text-left px-3 py-2.5 hover:bg-muted/50 flex items-start gap-2 ${sel?.id === d.id ? 'bg-primary/5' : ''}`}>
                      <c.icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground truncate">{d.titulo}</span>
                        <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded ${c.cls}`}>{c.label}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Visualização / edição */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-4 min-h-[300px]">
          {edit ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{edit.id ? 'Editar documento' : 'Novo documento'}</p>
                <button onClick={() => setEdit(null)} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"><X className="w-3.5 h-3.5" /> cancelar</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2">
                <div className="space-y-1"><Label className="text-xs">Título</Label><Input value={edit.titulo} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label className="text-xs">Categoria</Label>
                  <select value={edit.categoria} onChange={(e) => setEdit({ ...edit, categoria: e.target.value })} className="h-9 w-full text-sm rounded-md border border-border bg-card px-2">
                    {Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Conteúdo (markdown)</Label>
                <Textarea rows={18} value={edit.conteudo} onChange={(e) => setEdit({ ...edit, conteudo: e.target.value })} className="font-mono text-xs" />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button onClick={salvar} disabled={busy} className="gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar</Button>
              </div>
            </div>
          ) : abrindo ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo (registrando acesso)…</div>
          ) : sel ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-bold text-foreground">{sel.titulo}</p>
                  <span className={`inline-flex items-center gap-1 mt-1 text-[10px] px-1.5 py-0.5 rounded ${cat.cls}`}><cat.icon className="w-3 h-3" /> {cat.label}{sel.confidencial ? ' · CONFIDENCIAL' : ''}</span>
                </div>
                <Button onClick={editar} variant="outline" size="sm" className="gap-1.5"><Pencil className="w-3.5 h-3.5" /> Editar</Button>
              </div>
              <div className="border-t border-border pt-2">
                {sel.conteudo == null ? <div className="text-sm text-muted-foreground">Carregando…</div>
                  : <ReactMarkdown components={MD}>{sel.conteudo}</ReactMarkdown>}
              </div>
            </div>
          ) : (
            <EmptyState icon={FileText} title="Selecione um documento" description="Abra um documento à esquerda ou crie um novo. A abertura fica registrada na trilha de acesso." />
          )}
        </div>
      </div>
    </div>
  );
}
