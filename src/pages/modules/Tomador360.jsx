import React, { useEffect, useState } from 'react';
import { matriculasApi, elegivelCartaoBeneficio } from '@/lib/api/matriculas';
import { oportunidadesApi } from '@/lib/api/crm';
import { propostasApi } from '@/lib/api/propostas';
import { contratosApi } from '@/lib/api/contratos';
import { brl, dataBR } from '@/lib/format';
import RegistroThreads from '@/components/RegistroThreads';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

  const kpi = (label, valor, Icon) => (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="flex items-center justify-between"><span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span><Icon className="w-3.5 h-3.5 text-slate-400" /></div>
      <p className="text-lg font-bold text-slate-900 num mt-1">{valor}</p>
    </div>
  );

  return (
    <Dialog open={!!cliente} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {cliente.nome}
            {elegivel && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 inline-flex items-center gap-1"><CreditCard className="w-3 h-3" /> Elegível</span>}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-slate-500 -mt-1">CPF {cliente.cpf || '—'} · {cliente.telefone || 'sem telefone'} · {cliente.email || 'sem e-mail'}</p>

        <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.label}{['vinculos', 'oportunidades', 'propostas', 'contratos'].includes(t.key) ? ` (${{ vinculos: mats.length, oportunidades: oports.length, propostas: props.length, contratos: contrs.length }[t.key]})` : ''}
            </button>
          ))}
        </div>

        {tab === 'chamados' && (
          <div className="max-h-96 overflow-y-auto">
            <RegistroThreads entidadeRef="clientes" registroId={cliente.id} categoriaPadrao="cadastro_tomador" titulo={cliente.nome} franquiaId={cliente.franquia_id} />
          </div>
        )}

        {tab !== 'chamados' && (loading ? <div className="p-8 text-center text-sm text-slate-400">Carregando…</div> : (
          <div className="max-h-96 overflow-y-auto">
            {tab === 'resumo' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {kpi('Margem apartada', brl(margemDisp), CreditCard)}
                {kpi('Vínculos', mats.length, IdCard)}
                {kpi('Oportunidades', oports.length, Target)}
                {kpi('Propostas', props.length, FileText)}
                {kpi('Contratos ativos', contratosAtivos.length, FileCheck2)}
                {kpi('Volume ativo', brl(volume), FileCheck2)}
              </div>
            )}
            {tab === 'vinculos' && (
              <div className="space-y-2">
                {mats.length === 0 ? <p className="text-sm text-slate-400">Sem vínculos.</p> : mats.map((m) => (
                  <div key={m.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                    <div><p className="text-sm font-medium text-slate-800">{m.convenio?.nome || m.orgao || 'Vínculo'} <span className="text-xs text-slate-400">#{m.matricula}</span></p><p className="text-xs text-slate-400">{m.situacao} · disp. {brl(m.margem_disponivel)}</p></div>
                    {elegivelCartaoBeneficio(m) && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700">Elegível</span>}
                  </div>
                ))}
              </div>
            )}
            {tab === 'oportunidades' && (
              <div className="space-y-2">
                {oports.length === 0 ? <p className="text-sm text-slate-400">Sem oportunidades.</p> : oports.map((o) => (
                  <div key={o.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                    <div><p className="text-sm font-medium text-slate-800">{brl(o.valor_estimado)}</p><p className="text-xs text-slate-400">{dataBR(o.created_at)} · prob. {o.probabilidade}%</p></div>
                    <span className="text-xs text-slate-500">{ETAPA[o.etapa] || o.etapa}</span>
                  </div>
                ))}
              </div>
            )}
            {tab === 'propostas' && (
              <div className="space-y-2">
                {props.length === 0 ? <p className="text-sm text-slate-400">Sem propostas.</p> : props.map((p) => (
                  <div key={p.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                    <div><p className="text-sm font-medium text-slate-800">{brl(p.valor_solicitado)}</p><p className="text-xs text-slate-400">{p.convenio?.nome || '—'} · {dataBR(p.created_at)}</p></div>
                    <span className="text-xs text-slate-500">{P_STATUS[p.status] || p.status}</span>
                  </div>
                ))}
              </div>
            )}
            {tab === 'contratos' && (
              <div className="space-y-2">
                {contrs.length === 0 ? <p className="text-sm text-slate-400">Sem contratos.</p> : contrs.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2">
                    <div><p className="text-sm font-medium text-slate-800">{c.numero_contrato || c.id.slice(0, 8)}</p><p className="text-xs text-slate-400">{brl(c.valor_principal)} · {c.prazo}x · {dataBR(c.data_assinatura)}</p></div>
                    <span className="text-xs text-slate-500">{C_STATUS[c.status] || c.status}</span>
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
