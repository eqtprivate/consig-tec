import React, { useEffect, useState } from 'react';
import { matriculasApi, elegivelCartaoBeneficio } from '@/lib/api/matriculas';
import { oportunidadesApi } from '@/lib/api/crm';
import { propostasApi } from '@/lib/api/propostas';
import { contratosApi } from '@/lib/api/contratos';
import { brl, dataBR } from '@/lib/format';
import RegistroThreads from '@/components/RegistroThreads';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StatCard, StatusBadge, EmptyState } from '@/components/kit';
import { CreditCard, IdCard, Target, FileText, FileCheck2 } from 'lucide-react';

const TABS = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'vinculos', label: 'Vínculos' },
  { key: 'oportunidades', label: 'Oportunidades' },
  { key: 'propostas', label: 'Propostas' },
  { key: 'contratos', label: 'Contratos' },
  { key: 'chamados', label: 'Chamados' },
];
const P_STATUS = { rascunho: 'Rascunho', em_analise: 'Em análise', aprovada: 'Aprovada', reprovada: 'Reprovada', cancelada: 'Cancelada' };
const ETAPA = { qualificacao: 'Qualificação', simulacao: 'Simulação', proposta_enviada: 'Proposta enviada', em_formalizacao: 'Formalização', ganha: 'Ganha', perdida: 'Perdida' };
const C_STATUS = { ativo: 'Ativo', quitado: 'Quitado', cancelado: 'Cancelado', inadimplente: 'Inadimplente' };

export default function Tomador360({ cliente, onClose }) {
  const [tab, setTab] = useState('resumo');
  const [loading, setLoading] = useState(true);
  const [mats, setMats] = useState([]);
  const [oports, setOports] = useState([]);
  const [props, setProps] = useState([]);
  const [contrs, setContrs] = useState([]);

  useEffect(() => {
    if (!cliente) return;
    setLoading(true); setTab('resumo');
    Promise.all([
      matriculasApi.list({ cliente_id: cliente.id }).catch(() => []),
      oportunidadesApi.list({ cliente_id: cliente.id }).catch(() => []),
      propostasApi.list({ cliente_id: cliente.id }).catch(() => []),
      contratosApi.list({ cliente_id: cliente.id }).catch(() => []),
    ]).then(([m, o, p, c]) => { setMats(m); setOports(o); setProps(p); setContrs(c); setLoading(false); });
  }, [cliente]);

  if (!cliente) return null;
  const margemDisp = mats.filter((m) => m.ativo).reduce((s, m) => s + Number(m.margem_disponivel || 0), 0);
  const elegivel = mats.some(elegivelCartaoBeneficio);
  const contratosAtivos = contrs.filter((c) => c.status === 'ativo');
  const volume = contratosAtivos.reduce((s, c) => s + Number(c.valor_principal || 0), 0);

  return (
    <Dialog open={!!cliente} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cliente.nome}
            {elegivel && <StatusBadge className="gap-1 bg-green-50 text-green-700"><CreditCard className="w-3 h-3" /> Elegível</StatusBadge>}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-1">CPF {cliente.cpf || '—'} · {cliente.telefone || 'sem telefone'} · {cliente.email || 'sem e-mail'}</p>

        <div className="flex gap-1 border-b border-border overflow-x-auto overflow-y-hidden">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
              {t.label}{['vinculos', 'oportunidades', 'propostas', 'contratos'].includes(t.key) ? ` (${{ vinculos: mats.length, oportunidades: oports.length, propostas: props.length, contratos: contrs.length }[t.key]})` : ''}
            </button>
          ))}
        </div>

        {tab === 'chamados' && (
          <div className="max-h-96 overflow-y-auto">
            <RegistroThreads entidadeRef="clientes" registroId={cliente.id} categoriaPadrao="cadastro_tomador" titulo={cliente.nome} franquiaId={cliente.franquia_id} />
          </div>
        )}

        {tab !== 'chamados' && (loading ? <EmptyState title="Carregando…" /> : (
          <div className="max-h-96 overflow-y-auto">
            {tab === 'resumo' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Margem apartada" value={brl(margemDisp)} icon={CreditCard} />
                <StatCard label="Vínculos" value={mats.length} icon={IdCard} />
                <StatCard label="Oportunidades" value={oports.length} icon={Target} />
                <StatCard label="Propostas" value={props.length} icon={FileText} />
                <StatCard label="Contratos ativos" value={contratosAtivos.length} icon={FileCheck2} />
                <StatCard label="Volume ativo" value={brl(volume)} icon={FileCheck2} />
              </div>
            )}
            {tab === 'vinculos' && (
              <div className="space-y-2">
                {mats.length === 0 ? <EmptyState title="Sem vínculos." /> : mats.map((m) => (
                  <div key={m.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                    <div><p className="text-sm font-medium text-foreground">{m.convenio?.nome || m.orgao || 'Vínculo'} <span className="text-xs text-muted-foreground">#{m.matricula}</span></p><p className="text-xs text-muted-foreground">{m.situacao} · disp. {brl(m.margem_disponivel)}</p></div>
                    {elegivelCartaoBeneficio(m) && <StatusBadge className="bg-green-50 text-green-700">Elegível</StatusBadge>}
                  </div>
                ))}
              </div>
            )}
            {tab === 'oportunidades' && (
              <div className="space-y-2">
                {oports.length === 0 ? <EmptyState title="Sem oportunidades." /> : oports.map((o) => (
                  <div key={o.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                    <div><p className="text-sm font-medium text-foreground">{brl(o.valor_estimado)}</p><p className="text-xs text-muted-foreground">{dataBR(o.created_at)} · prob. {o.probabilidade}%</p></div>
                    <span className="text-xs text-muted-foreground">{ETAPA[o.etapa] || o.etapa}</span>
                  </div>
                ))}
              </div>
            )}
            {tab === 'propostas' && (
              <div className="space-y-2">
                {props.length === 0 ? <EmptyState title="Sem propostas." /> : props.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                    <div><p className="text-sm font-medium text-foreground">{brl(p.valor_solicitado)}</p><p className="text-xs text-muted-foreground">{p.convenio?.nome || '—'} · {dataBR(p.created_at)}</p></div>
                    <span className="text-xs text-muted-foreground">{P_STATUS[p.status] || p.status}</span>
                  </div>
                ))}
              </div>
            )}
            {tab === 'contratos' && (
              <div className="space-y-2">
                {contrs.length === 0 ? <EmptyState title="Sem contratos." /> : contrs.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
                    <div><p className="text-sm font-medium text-foreground">{c.numero_contrato || c.id.slice(0, 8)}</p><p className="text-xs text-muted-foreground">{brl(c.valor_principal)} · {c.prazo}x · {dataBR(c.data_assinatura)}</p></div>
                    <span className="text-xs text-muted-foreground">{C_STATUS[c.status] || c.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}
