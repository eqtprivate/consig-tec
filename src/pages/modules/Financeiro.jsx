import React, { useEffect, useState } from 'react';
import { contratosApi } from '@/lib/api/contratos';
import { parcelasApi } from '@/lib/api/parcelas';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { brl, dataBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wallet, CheckCircle2, ListPlus } from 'lucide-react';

const STATUS = { aberta: 'Aberta', paga: 'Paga', atrasada: 'Atrasada', renegociada: 'Renegociada' };
const CORES = {
  aberta: 'bg-slate-100 text-slate-600', paga: 'bg-green-50 text-green-700',
  atrasada: 'bg-red-50 text-red-700', renegociada: 'bg-amber-50 text-amber-700',
};

function addMeses(dateStr, n) {
  const base = dateStr ? new Date(dateStr) : new Date();
  const d = new Date(base);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

export default function Financeiro() {
  const { activeUnidade } = useAuth();
  const [contratos, setContratos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [parcelas, setParcelas] = useState([]);
  const [loadingP, setLoadingP] = useState(false);

  const load = async () => {
    setLoading(true);
    setContratos(await contratosApi.list(activeUnidade ? { franquia_id: activeUnidade.id } : {}).catch(() => []));
    setLoading(false);
  };
  useEffect(() => { load(); }, [activeUnidade]);

  const abrir = async (c) => {
    setSel(c);
    setLoadingP(true);
    setParcelas(await parcelasApi.listByContrato(c.id).catch(() => []));
    setLoadingP(false);
  };

  const recarregarParcelas = async () => {
    if (!sel) return;
    setParcelas(await parcelasApi.listByContrato(sel.id).catch(() => []));
  };

  const gerar = async () => {
    if (!sel?.prazo) return alert('Contrato sem prazo definido.');
    const valor = sel.valor_parcela || (sel.valor_total ? sel.valor_total / sel.prazo : 0);
    const base = sel.data_assinatura;
    const lote = Array.from({ length: sel.prazo }, (_, i) => ({
      contrato_id: sel.id, numero: i + 1, vencimento: addMeses(base, i + 1),
      valor: Number(valor.toFixed ? valor.toFixed(2) : valor), status: 'aberta',
    }));
    await parcelasApi.criarLote(lote);
    await auditoriaApi.log('gerar_parcelas', 'contratos', sel.id, { qtd: sel.prazo });
    recarregarParcelas();
  };

  const pagar = async (p) => {
    await parcelasApi.update(p.id, { status: 'paga', valor_pago: p.valor, data_pagamento: new Date().toISOString().slice(0, 10) });
    await auditoriaApi.log('pagar_parcela', 'parcelas', p.id, {});
    recarregarParcelas();
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Financeiro — contratos e parcelas (recebíveis)</p>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">Carregando...</div>
        ) : contratos.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">Nenhum contrato.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Nº</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Cliente</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Principal</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Prazo</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Parcelas</th>
              </tr>
            </thead>
            <tbody>
              {contratos.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => abrir(c)}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.numero_contrato || c.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.cliente?.nome || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-700 hidden sm:table-cell">{brl(c.valor_principal)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 hidden sm:table-cell">{c.prazo ? `${c.prazo}x` : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Wallet className="w-3.5 h-3.5" /> ver</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!sel} onOpenChange={(v) => !v && setSel(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Parcelas — {sel?.cliente?.nome} ({sel?.numero_contrato || sel?.id?.slice(0, 8)})</DialogTitle>
          </DialogHeader>
          {loadingP ? (
            <div className="p-8 text-center text-sm text-slate-400">Carregando...</div>
          ) : parcelas.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-sm text-slate-400">Nenhuma parcela gerada.</p>
              <Button onClick={gerar} className="gap-2"><ListPlus className="w-4 h-4" /> Gerar {sel?.prazo || 0} parcelas</Button>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="px-3 py-2">#</th><th className="px-3 py-2">Vencimento</th>
                    <th className="px-3 py-2 text-right">Valor</th><th className="px-3 py-2">Status</th><th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {parcelas.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-500">{p.numero}</td>
                      <td className="px-3 py-2 text-slate-700">{dataBR(p.vencimento)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{brl(p.valor)}</td>
                      <td className="px-3 py-2"><span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${CORES[p.status]}`}>{STATUS[p.status]}</span></td>
                      <td className="px-3 py-2 text-right">
                        {p.status !== 'paga' && (
                          <button title="Marcar paga" onClick={() => pagar(p)} className="p-1 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded"><CheckCircle2 className="w-4 h-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
