import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { UploadCloud, FileText, Loader2, ScanLine, CheckCircle2 } from 'lucide-react';

// Área de upload reutilizável (CCB e decretos): arrastar-e-soltar ou clicar,
// valida PDF/tamanho e mostra o progresso em fases — lendo o arquivo → enviando
// (bytes) → lendo com IA. `onFile(file)` dispara o fluxo do pai; o pai controla
// os estados busy/readPct/uploadPct e o nome do arquivo.
export default function PdfUpload({ onFile, busy = false, readPct = 0, uploadPct = 0, tipo = 'documento', fileName = '' }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const pick = (file) => {
    if (!file) return;
    const ok = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!ok) { toast.error('Envie um arquivo PDF.'); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error('Arquivo muito grande (máx. 25 MB).'); return; }
    onFile(file);
  };

  if (busy) {
    const fase = readPct < 100 ? 'leitura' : uploadPct < 100 ? 'upload' : 'ia';
    const pct = fase === 'leitura' ? readPct : fase === 'upload' ? uploadPct : 100;
    const passos = [
      { k: 'leitura', label: 'Lendo o arquivo', done: readPct >= 100 },
      { k: 'upload', label: 'Enviando', done: uploadPct >= 100 && readPct >= 100 },
      { k: 'ia', label: 'Lendo com IA', done: false },
    ];
    const msg = fase === 'leitura' ? `Lendo o arquivo… ${readPct}%`
      : fase === 'upload' ? `Enviando… ${uploadPct}%`
      : 'Enviado. Lendo com inteligência artificial…';
    return (
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-foreground">
          {fase === 'ia' ? <ScanLine className="w-4 h-4 text-primary animate-pulse shrink-0" /> : <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />}
          <span className="min-w-0 truncate"><b>{msg}</b>{fileName ? <span className="text-muted-foreground"> · {fileName}</span> : null}</span>
        </div>
        <Progress value={pct} className="h-2" />
        <div className="flex items-center gap-3 flex-wrap">
          {passos.map((p) => (
            <span key={p.k} className={`text-[11px] inline-flex items-center gap-1 ${p.k === fase ? 'text-primary font-medium' : p.done ? 'text-green-600' : 'text-muted-foreground'}`}>
              {p.done ? <CheckCircle2 className="w-3 h-3" /> : p.k === fase ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="w-3 h-3 inline-block rounded-full border border-current/40" />}
              {p.label}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Não feche a página. PDFs longos podem levar até ~40 segundos na leitura por IA.</p>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
      role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
      className={`rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors outline-none ${drag ? 'border-primary bg-primary/10' : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-primary/5 focus-visible:border-primary'}`}
    >
      <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      <UploadCloud className={`w-8 h-8 mx-auto mb-2 ${drag ? 'text-primary' : 'text-muted-foreground'}`} />
      <p className="text-sm font-medium text-foreground">Arraste o {tipo} (PDF) aqui ou <span className="text-primary">clique para selecionar</span></p>
      <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1"><FileText className="w-3 h-3" /> Somente PDF · até 25 MB · a leitura é uma sugestão conferida por humano</p>
    </div>
  );
}
