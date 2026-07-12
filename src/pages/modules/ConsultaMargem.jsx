import React, { useState } from 'react';
import { clientesApi } from '@/lib/api/clientes';
import { matriculasApi, elegivelCartaoBeneficio } from '@/lib/api/matriculas';
import { produtosConvenioApi } from '@/lib/api/produtosConvenio';
import { propostasApi } from '@/lib/api/propostas';
import { auditoriaApi } from '@/lib/api/auditoria';
import { useAuth } from '@/lib/ConsigtecAuthContext';
import { toast } from 'sonner';
import { confirmar } from '@/lib/confirm';
import { brl, num, dataBR } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, CheckCircle2, XCircle, Calculator, FileUp } from 'lucide-react';

const soDigitos = (v) => (v || '').replace(/\D/g, '');

// Idade em anos a partir da data de nascimento (ISO). null se não informada.
function idadeDe(dataNascimento) {
  if (!dataNascimento) return null;
  const d = new Date(dataNascimento);
  if (isNaN(d)) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) anos--;
  return anos;
}

// Regras de elegibilidade do produto sobre uma matrícula (espelham as
// checagens da função SQL matricula_elegivel_cartao + limites do produto).
function checarElegibilidade(matricula, produto, idade) {
  const motivos = [];
  if (!elegivelCartaoBeneficio(matricula)) motivos.push('Vínculo sem margem apartada elegível (situação/convênio/margem).');
  if (produto) {
    if (produto.ativo === false) motivos.push('Produto inativo.');
    const margemProduto = margemDoProduto(matricula, produto);
    if (margemProduto <= 0) motivos.push('Margem disponível insuficiente para o produto.');
    if (idade != null) {
      if (produto.idade_min != null && idade < produto.idade_min) motivos.push(`Idade abaixo do mínimo do produto (${produto.idade_min} anos).`);
      if (produto.idade_max != null && idade > produto.idade_max) motivos.push(`Idade acima do máximo do produto (${produto.idade_max} anos).`);
    } else if (produto.idade_min != null || produto.idade_max != null) {
      motivos.push('Data de nascimento do tomador não informada (produto exige faixa etária).');
    }
  }
  return { elegivel: motivos.length === 0, motivos };
}

// Margem mensal que o produto pode consumir do vínculo:
// margem_disponivel × (margem_percentual do produto / 100), limitada à margem do vínculo.
function margemDoProduto(matricula, produto) {
  const disp = Number(matricula.margem_disponivel || 0);
  const pct = produto?.margem_percentual != null ? Number(produto.margem_percentual) : 100;
  return Math.max(0, Math.min(disp, disp * (pct / 100)));
}

export default function ConsultaMargem() {
  const { activeUnidade } = useAuth();
  const [cpf, setCpf] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [cliente, setCliente] = useState(null);
  const [erro, setErro] = useState('');
  const [matriculas, setMatriculas] = useState([]);

  const [matSel, setMatSel] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [prodSel, setProdSel] = useState(null);
  const [prazo, setPrazo] = useState('');
  const [valorDesejado, setValorDesejado] = useState('');

  const [sim, setSim] = useState(null);   // { margem, valorMaximo, prazo }
  const [calc, setCalc] = useState(null); // parcela p/ valor desejado
  const [gerando, setGerando] = useState(false);
  const [propostaMsg, setPropostaMsg] = useState('');

  const idade = idadeDe(cliente?.data_nascimento);

  const buscar = async (e) => {
    e?.preventDefault();
    setErro(''); setCliente(null); setMatriculas([]); resetSelecao();
    const limpo = soDigitos(cpf);
    if (limpo.length < 11) { setErro('Informe um CPF válido (11 dígitos).'); return; }
    setBuscando(true);
    try {
      const c = await clientesApi.getByCpf(limpo);
      if (!c) { setErro('Tomador não encontrado. Cadastre o cliente antes de consultar a margem.'); return; }
      setCliente(c);
      setMatriculas(await matriculasApi.list({ cliente_id: c.id }));
    } catch (err) {
      setErro(err.message || 'Falha ao buscar tomador.');
    } finally {
      setBuscando(false);
    }
  };

  const resetSelecao = () => { setMatSel(null); setProdutos([]); setProdSel(null); setPrazo(''); setValorDesejado(''); setSim(null); setCalc(null); setPropostaMsg(''); };

  const selecionarMatricula = async (m) => {
    setMatSel(m); setProdSel(null); setPrazo(''); setValorDesejado(''); setSim(null); setCalc(null);
    if (!m.convenio_id) { setProdutos([]); return; }
    const ps = await produtosConvenioApi.list({ convenio_id: m.convenio_id, ativo: true }).catch(() => []);
    setProdutos(ps);
  };

  const selecionarProduto = (id) => {
    const p = produtos.find((x) => x.id === id) || null;
    setProdSel(p);
    setPrazo(p?.prazo_max ? String(p.prazo_max) : '');
    setSim(null); setCalc(null);
  };

  const simular = async () => {
    if (!matSel || !prodSel) return;
    const margem = margemDoProduto(matSel, prodSel);
    const n = num(prazo) || prodSel.prazo_max;
    const taxa = prodSel.taxa_mensal;
    const vMax = await produtosConvenioApi.valorMaximo(margem, taxa, n).catch(() => 0);
    // Respeita o teto de valor do produto, se houver.
    const vMaxProd = prodSel.valor_max != null ? Math.min(Number(vMax), Number(prodSel.valor_max)) : Number(vMax);
    setSim({ margem, valorMaximo: vMaxProd, prazo: n, taxa });
    setCalc(null);
  };

  const calcularParcela = async () => {
    if (!prodSel) return;
    const v = num(valorDesejado);
    const n = num(prazo) || prodSel.prazo_max;
    if (!v || v <= 0) { setCalc({ erro: 'Informe o valor desejado.' }); return; }
    const parcela = await produtosConvenioApi.parcela(v, prodSel.taxa_mensal, n).catch(() => null);
    const margemProduto = margemDoProduto(matSel, prodSel);
    const acimaValor = prodSel.valor_max != null && v > Number(prodSel.valor_max);
    const acimaMargem = parcela != null && Number(parcela) > margemProduto + 0.005;
    setCalc({ valor: v, parcela, prazo: n, acimaValor, acimaMargem, margemProduto });
  };

  const gerarProposta = async (valor, parcela, n) => {
    if (!cliente || !matSel || !prodSel) return;
    if (!valor || valor <= 0) { toast.error('Simule um valor antes de gerar a proposta.'); return; }
    if (!(await confirmar({ title: 'Gerar proposta', description: `${brl(valor)} em ${n}x (${prodSel.nome || prodSel.produto})?`, confirmText: 'Gerar' }))) return;
    setGerando(true); setPropostaMsg('');
    try {
      const prop = await propostasApi.create({
        cliente_id: cliente.id, convenio_id: matSel.convenio_id || null, matricula_id: matSel.id,
        produto: prodSel.produto, valor_solicitado: valor, prazo: n, taxa_mensal: prodSel.taxa_mensal,
        valor_parcela: parcela, status: 'em_analise',
        franquia_id: activeUnidade?.id || cliente.franquia_id || null,
      });
      await auditoriaApi.log('gerar_proposta_consulta_margem', 'propostas', prop.id, { cliente: cliente.nome, produto: prodSel.produto, valor });
      // Reserva automática da margem apartada (desconta do vínculo).
      let reservaOk = true;
      try {
        await propostasApi.reservarMargem(prop.id);
        await auditoriaApi.log('reservar_margem_proposta', 'propostas', prop.id, { valor_parcela: parcela });
      } catch (e) {
        reservaOk = false;
      }
      if (reservaOk) toast.success(`Proposta criada e margem de ${brl(parcela)} reservada.`);
      else toast.warning('Proposta criada, mas a reserva de margem falhou — reserve manualmente em Propostas.');
      setPropostaMsg(reservaOk
        ? `Proposta criada e margem de ${brl(parcela)} reservada. Acompanhe em CRM → Propostas / Margem → Averbações.`
        : `Proposta criada (em análise), mas a reserva de margem falhou — reserve manualmente em Propostas.`);
      // Atualiza a margem exibida do vínculo selecionado.
      if (reservaOk) {
        const atualizadas = await matriculasApi.list({ cliente_id: cliente.id }).catch(() => matriculas);
        setMatriculas(atualizadas);
        const nova = atualizadas.find((x) => x.id === matSel.id);
        if (nova) setMatSel(nova);
        setSim(null); setCalc(null);
      }
    } catch (err) {
      setPropostaMsg(err.message || 'Falha ao gerar proposta.');
    } finally {
      setGerando(false);
    }
  };

  const eleg = matSel ? checarElegibilidade(matSel, prodSel, idade) : null;

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Consulta e simulação de margem apartada por tomador — base para geração de proposta.</p>

      {/* Busca por CPF */}
      <form onSubmit={buscar} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-end gap-3">
        <div className="space-y-1 flex-1 min-w-[220px]">
          <Label>CPF do tomador</Label>
          <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" />
        </div>
        <Button type="submit" disabled={buscando} className="gap-2"><Search className="w-4 h-4" /> {buscando ? 'Buscando…' : 'Consultar'}</Button>
      </form>
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {cliente && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800">{cliente.nome}</p>
              <p className="text-xs text-slate-500">CPF {cliente.cpf} {cliente.telefone ? `· ${cliente.telefone}` : ''} {idade != null ? `· ${idade} anos` : '· idade não informada'}</p>
            </div>
            <span className="text-xs text-slate-400">{matriculas.length} vínculo(s)</span>
          </div>
        </div>
      )}

      {/* Vínculos / matrículas */}
      {cliente && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {matriculas.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">Nenhum vínculo (matrícula) cadastrado para este tomador.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Convênio / Matrícula</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs hidden sm:table-cell">Situação</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Margem apartada</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 uppercase text-xs">Elegível</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500 uppercase text-xs">Ação</th>
                </tr>
              </thead>
              <tbody>
                {matriculas.map((m) => {
                  const ok = elegivelCartaoBeneficio(m);
                  return (
                    <tr key={m.id} className={`border-b border-slate-100 ${matSel?.id === m.id ? 'bg-primary/5' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{m.convenio?.nome || '—'}</p>
                        <p className="text-xs text-slate-500">#{m.matricula}{m.orgao ? ` · ${m.orgao}` : ''}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell capitalize">{m.situacao}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-slate-800">{brl(m.margem_disponivel)}</span>
                        <span className="block text-[10px] text-slate-400">de {brl(m.margem_bruta)}</span>
                        <span className="block text-[10px] text-slate-400">{m.margem_atualizada_em ? `base ${dataBR(m.margem_atualizada_em)}` : 'base não atualizada'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {ok
                          ? <span className="inline-flex items-center gap-1 text-green-700 text-xs"><CheckCircle2 className="w-3.5 h-3.5" /> Sim</span>
                          : <span className="inline-flex items-center gap-1 text-slate-400 text-xs"><XCircle className="w-3.5 h-3.5" /> Não</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant={matSel?.id === m.id ? 'default' : 'outline'} onClick={() => selecionarMatricula(m)}>Simular</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Simulador do produto sobre o vínculo selecionado */}
      {matSel && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            <p className="font-semibold text-slate-800">Simulação — {matSel.convenio?.nome} · #{matSel.matricula}</p>
          </div>

          {produtos.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum produto ativo parametrizado para este convênio. Configure em <b>Convênios → Produtos</b>.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Produto</Label>
                  <Select value={prodSel?.id || ''} onValueChange={selecionarProduto}>
                    <SelectTrigger><SelectValue placeholder="Selecionar produto" /></SelectTrigger>
                    <SelectContent>
                      {produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome || p.produto}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Prazo (parcelas)</Label>
                  <Input type="number" value={prazo} onChange={(e) => setPrazo(e.target.value)}
                    min={prodSel?.prazo_min || undefined} max={prodSel?.prazo_max || undefined}
                    placeholder={prodSel?.prazo_max ? String(prodSel.prazo_max) : ''} disabled={!prodSel} />
                  {prodSel && (prodSel.prazo_min || prodSel.prazo_max) && (
                    <p className="text-[10px] text-slate-400">Faixa {prodSel.prazo_min || 1}–{prodSel.prazo_max || '—'}x</p>
                  )}
                </div>
                <div className="flex items-end">
                  <Button onClick={simular} disabled={!prodSel} className="w-full">Calcular máximo</Button>
                </div>
              </div>

              {prodSel && (
                <p className="text-xs text-slate-500">
                  Taxa {prodSel.taxa_mensal != null ? `${prodSel.taxa_mensal}% a.m.` : '—'} ·
                  {' '}Consome {prodSel.margem_percentual != null ? `${prodSel.margem_percentual}%` : '100%'} da margem ·
                  {' '}Margem elegível do produto: <b className="text-slate-700">{brl(margemDoProduto(matSel, prodSel))}</b>
                  {prodSel.valor_max != null ? <> · Teto {brl(prodSel.valor_max)}</> : null}
                </p>
              )}

              {eleg && !eleg.elegivel && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  <p className="font-medium mb-1">Restrições de elegibilidade:</p>
                  <ul className="list-disc list-inside">{eleg.motivos.map((mo, i) => <li key={i}>{mo}</li>)}</ul>
                </div>
              )}

              {sim && (
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div><p className="text-[10px] uppercase text-slate-400">Margem usada</p><p className="font-semibold text-slate-800">{brl(sim.margem)}</p></div>
                    <div><p className="text-[10px] uppercase text-slate-400">Prazo</p><p className="font-semibold text-slate-800">{sim.prazo}x</p></div>
                    <div><p className="text-[10px] uppercase text-slate-400">Taxa</p><p className="font-semibold text-slate-800">{sim.taxa}% a.m.</p></div>
                    <div><p className="text-[10px] uppercase text-slate-400">Valor máx. financiável</p><p className="font-bold text-primary text-lg">{brl(sim.valorMaximo)}</p></div>
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" className="gap-1" disabled={gerando || !eleg?.elegivel || sim.valorMaximo <= 0} onClick={() => gerarProposta(sim.valorMaximo, sim.margem, sim.prazo)}>
                      <FileUp className="w-4 h-4" /> Gerar proposta com o máximo
                    </Button>
                  </div>
                </div>
              )}

              {/* Simulação inversa: valor desejado → parcela */}
              <div className="pt-2 border-t border-slate-100">
                <Label className="text-xs text-slate-500">Simular por valor desejado</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                  <div className="space-y-1">
                    <Input type="number" step="0.01" value={valorDesejado} onChange={(e) => setValorDesejado(e.target.value)} placeholder="Valor R$" disabled={!prodSel} />
                  </div>
                  <div className="flex items-end">
                    <Button variant="outline" onClick={calcularParcela} disabled={!prodSel} className="w-full">Calcular parcela</Button>
                  </div>
                  {calc && !calc.erro && (
                    <div className="flex flex-col justify-end text-sm">
                      <span className="text-slate-500 text-xs">Parcela ({calc.prazo}x)</span>
                      <span className={`font-semibold ${(calc.acimaMargem || calc.acimaValor) ? 'text-red-600' : 'text-slate-800'}`}>{brl(calc.parcela)}</span>
                    </div>
                  )}
                </div>
                {calc?.erro && <p className="text-xs text-red-600 mt-1">{calc.erro}</p>}
                {calc && !calc.erro && calc.acimaMargem && <p className="text-xs text-red-600 mt-1">Parcela acima da margem elegível ({brl(calc.margemProduto)}).</p>}
                {calc && !calc.erro && calc.acimaValor && <p className="text-xs text-red-600 mt-1">Valor acima do teto do produto ({brl(prodSel.valor_max)}).</p>}
                {calc && !calc.erro && !calc.acimaMargem && !calc.acimaValor && (
                  <div className="flex justify-end mt-2">
                    <Button size="sm" variant="outline" className="gap-1" disabled={gerando || !eleg?.elegivel} onClick={() => gerarProposta(calc.valor, calc.parcela, calc.prazo)}>
                      <FileUp className="w-4 h-4" /> Gerar proposta com este valor
                    </Button>
                  </div>
                )}
              </div>

              {propostaMsg && (
                <p className={`text-sm ${propostaMsg.startsWith('Proposta criada') ? 'text-green-700' : 'text-red-600'}`}>{propostaMsg}</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
