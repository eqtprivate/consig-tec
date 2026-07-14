import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { areasApi } from '@/lib/api/areas';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { PageHeader, Panel, EmptyState } from '@/components/kit';
import { Construction } from 'lucide-react';
import ConveniosArea from '@/pages/modules/ConveniosArea';
import CrmVendas from '@/pages/modules/CrmVendas';
import MargemAverbacao from '@/pages/modules/MargemAverbacao';
import Formalizacao from '@/pages/modules/Formalizacao';
import Financeiro from '@/pages/modules/Financeiro';
import Comissoes from '@/pages/modules/Comissoes';
import Cessao from '@/pages/modules/Cessao';
import Cobranca from '@/pages/modules/Cobranca';
import Suporte from '@/pages/modules/Suporte';
import Juridico from '@/pages/modules/Juridico';
import AdminHub from '@/pages/modules/AdminHub';

// Módulos indexados pelo código da área.
const MODULES = {
  convenios: ConveniosArea,
  crm: CrmVendas,
  formalizacao: Formalizacao,
  averbacao: MargemAverbacao,
  financeiro: Financeiro,
  comissoes: Comissoes,
  cessao_fidc: Cessao,
  cobranca: Cobranca,
  suporte: Suporte,
  juridico: Juridico,
  admin: AdminHub,
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
        <h2 className="text-lg font-semibold text-foreground mb-2">Acesso negado</h2>
        <p className="text-sm text-muted-foreground">Você não tem permissão para acessar esta área.</p>
      </div>
    );
  }

  const Module = MODULES[area.codigo];

  return (
    <div className="space-y-6">
      <PageHeader title={area.nome} subtitle={area.descricao} />

      {Module ? (
        <Module />
      ) : (
        <Panel>
          <EmptyState
            icon={Construction}
            title="Módulo em desenvolvimento"
            description="Este módulo será implementado nas próximas etapas do CONSIGTEC. A fundação do sistema está ativa — navegação, autenticação e controle de acesso por área já estão operacionais."
          />
        </Panel>
      )}
    </div>
  );
}