import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { areasApi } from '@/lib/api/areas';
import { pendenciasApi } from '@/lib/api/pendencias';
import { AlertCircle, ArrowRight, Building2, Users } from 'lucide-react';

const AREA_ICONS = {
  convenios: '🏛️',
  'crm-vendas': '💬',
  averbacao: '📋',
  formalizacao: '📝',
  financeiro: '💰',
  comissoes: '💸',
  cobranca: '📞',
  'cessao-fidc': '🔄',
  juridico: '⚖️',
  suporte: '🛟',
  admin: '⚙️',
};

export default function Dashboard() {
  const { perfil, isAdmin, availableAreas, activeUnidade, vinculos } = useAuth();
  const [allAreas, setAllAreas] = useState([]);
  const [pendencias, setPendencias] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      areasApi.list().catch(() => []),
      pendenciasApi.list(activeUnidade ? { unidade_id: activeUnidade.id } : {}).catch(() => []),
    ]).then(([a, p]) => {
      setAllAreas(a);
      setPendencias(p);
      setLoading(false);
    });
  }, [activeUnidade]);

  const visibleAreas = allAreas.filter((a) =>
    isAdmin || availableAreas.some((va) => va.slug === a.slug)
  );

  const pendenciasAbertas = pendencias.filter((p) => p.status === 'aberta' || p.status === 'em_andamento');
  const pendenciasCriticas = pendencias.filter((p) => p.prioridade === 'critica');

  if (!vinculos || vinculos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Sem vínculos cadastrados</h2>
        <p className="text-sm text-slate-500">
          Seu usuário ainda não possui vínculos com unidades. Solicite ao administrador que cadastre seus vínculos para acessar o sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Olá, {perfil?.nome?.split(' ')[0] || 'usuário'}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {activeUnidade ? `${activeUnidade.nome}` : 'Selecione uma unidade'} • Visão geral da operação
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pendências abertas</span>
            <AlertCircle className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{loading ? '—' : pendenciasAbertas.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Prioridade crítica</span>
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-600">{loading ? '—' : pendenciasCriticas.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Áreas acessíveis</span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{visibleAreas.length}</p>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">Áreas do processo</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibleAreas.map((area) => (
            <Link
              key={area.id}
              to={`/area/${area.slug}`}
              className="group bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{AREA_ICONS[area.slug] || '📁'}</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{area.nome}</p>
                    <p className="text-xs text-slate-500">{area.descricao}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}