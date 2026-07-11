import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { areasApi } from '@/lib/api/areas';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { Construction } from 'lucide-react';
import Convenios from '@/pages/modules/Convenios';
import CrmVendas from '@/pages/modules/CrmVendas';
import Averbacoes from '@/pages/modules/Averbacoes';
import Formalizacao from '@/pages/modules/Formalizacao';
import Financeiro from '@/pages/modules/Financeiro';
import Comissoes from '@/pages/modules/Comissoes';
import Cessao from '@/pages/modules/Cessao';
import Cobranca from '@/pages/modules/Cobranca';
import Chamados from '@/pages/modules/Chamados';
import Juridico from '@/pages/modules/Juridico';

// Módulos indexados pelo código da área.
const MODULES = {
  convenios: Convenios,
  crm: CrmVendas,
  formalizacao: Formalizacao,
  averbacao: Averbacoes,
  financeiro: Financeiro,
  comissoes: Comissoes,
  cessao_fidc: Cessao,
  cobranca: Cobranca,
  suporte: Chamados,
  juridico: Juridico,
};

export default function AreaPage() {
  const { codigo } = useParams();
  const { hasAreaAccess } = useAuth();
  const [area, setArea] = useState(null);

  useEffect(() => {
    areasApi.list().then((areas) => {
      setArea(areas.find((a) => a.codigo === codigo));
    });
  }, [codigo]);

  if (!area) return null;

  if (!hasAreaAccess(area.codigo)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Acesso negado</h2>
        <p className="text-sm text-slate-500">Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }

  const Module = MODULES[area.codigo];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{area.nome}</h1>
        <p className="text-sm text-slate-500 mt-1">{area.descricao}</p>
      </div>

      {Module ? (
        <Module />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Construction className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-2">Módulo em desenvolvimento</h2>
          <p className="text-sm text-slate-500 max-w-md">
            Este módulo será implementado nas próximas etapas do CONSIGTEC. A fundação do sistema está ativa — navegação, autenticação e controle de acesso por área já estão operacionais.
          </p>
        </div>
      )}
    </div>
  );
}