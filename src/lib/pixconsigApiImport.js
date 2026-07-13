import { supabase } from '@/lib/supabaseClient';
import { conveniosApi } from '@/lib/api/convenios';
import { entidadesApi } from '@/lib/api/entidades';

// Consome o payload v1 da API de Convênios PixConsig (produção) e sincroniza o
// espelho local. Idempotente. NÃO sobrescreve taxa/spread/comissão/prazos
// (propriedade do CONSIGTEC). REPROVADA ignorada por padrão.
//
// Contrato v1 (produção, 13/07/2026):
// - `produtos[]` é ARRAY (um item por produto); pode vir vazio (91% dos casos).
// - `produtos[].tipo_margem` é o enum CRU da PixConsig:
//     EMPRESTIMO_CONSIGNADO | CARTAO_BENEFICIO | CARTAO_CREDITO
// - `produtos[].percentual_margem` pode ser null mesmo com produto presente.
// - `margens: { decreto_cartao, disponivel }` no topo do convênio.
// A classificação apartada|principal|cartao é decisão comercial (CONSIGTEC).

const soDigitos = (v) => (v ? String(v).replace(/\D/g, '') : null);
const soData = (v) => (v ? String(v).slice(0, 10) : null);
// margem pode vir número, string ("35") ou vazia ("") — coage p/ número|null.
const numOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

// Enum PixConsig → tipo_margem interno (apartada|principal|cartao)
const MARGEM_MAP = { CARTAO_BENEFICIO: 'cartao', CARTAO_CREDITO: 'cartao', EMPRESTIMO_CONSIGNADO: 'principal' };
// Enum PixConsig → produto_consig interno
const PRODUTO_MAP = { CARTAO_BENEFICIO: 'cartao_beneficio', CARTAO_CREDITO: 'cartao_credito', EMPRESTIMO_CONSIGNADO: 'consignado' };
const up = (v) => String(v || '').toUpperCase();
const mapMargem = (t) => MARGEM_MAP[up(t)] || 'cartao';
const mapProduto = (t) => PRODUTO_MAP[up(t)] || 'cartao_beneficio';

export async function importarConveniosPixconsigJSON(texto, nowIso, opts = {}) {
  let parsed;
  try { parsed = typeof texto === 'string' ? JSON.parse(texto) : texto; }
  catch { throw new Error('JSON inválido.'); }
  const lista = Array.isArray(parsed) ? parsed : (parsed?.data || []);
  if (!Array.isArray(lista) || lista.length === 0) throw new Error('Payload sem itens em "data".');

  const now = nowIso || new Date().toISOString();
  const incluirReprovadas = !!opts.incluirReprovadas;
  const res = { total: 0, ok: 0, ignorados: 0, produtos: 0, erros: [] };

  for (const item of lista) {
    res.total++;
    try {
      const ent = item.entidade || {};
      const cred = item.credenciamento || {};
      const norma = item.norma_autorizadora || {};
      const capag = item.capag || {};
      const averb = item.averbacao || {};
      const margens = item.margens || {};
      const produtos = Array.isArray(item.produtos) ? item.produtos : [];
      // Produto "principal" do convênio: cartão benefício se houver, senão o 1º.
      const primary = produtos.find((p) => up(p.tipo_margem) === 'CARTAO_BENEFICIO') || produtos[0] || {};

      if (!item.id) throw new Error('item sem id (pixconsig_convenio_id)');
      if (!incluirReprovadas && up(cred.status_detalhado) === 'REPROVADA') { res.ignorados++; continue; }

      const cnpj = soDigitos(ent.cnpj);
      const nome = ent.nome_oficial || ent.cidade || item.id;
      const cidade = ent.cidade || null;
      const uf = ent.uf || null;

      const entPayload = {
        nome, cnpj, cidade, uf,
        codigo_ibge: ent.codigo_ibge || null,
        populacao: ent.populacao ?? null,
        servidores: ent.servidores ?? null,
        norma_autorizadora: norma.tipo || null,
        sistema_averbacao: averb.sistema || null,
        vigencia_inicio: soData(cred.vigencia_inicio),
        vigencia_fim: soData(cred.vigencia_fim),
        capag: capag.classificacao || null,
        contatos: Array.isArray(averb.contatos_operacionais) ? averb.contatos_operacionais : [],
        origem_dado: 'pixconsig', ultima_sincronizacao: now, status_sync: 'ok',
      };
      let entidadeId = await entidadesApi.encontrar({ cnpj, nome, cidade, uf });
      if (entidadeId) await entidadesApi.update(entidadeId, entPayload);
      else entidadeId = (await entidadesApi.create(entPayload)).id;

      const pctApartada = numOrNull(margens.decreto_cartao) ?? numOrNull(primary.percentual_margem);
      const convenio = {
        pixconsig_convenio_id: item.id,
        nome, orgao: cidade, tipo: 'publico', entidade_id: entidadeId,
        tipo_margem: mapMargem(primary.tipo_margem),
        percentual_margem_apartada: pctApartada,
        margem_consignavel: pctApartada,
        margem_disponivel: numOrNull(margens.disponivel),
        capag: capag.classificacao || null,
        arquivo_decreto_url: norma.arquivo_decreto_url || null,
        norma_autorizadora: norma.tipo || null,
        status_detalhado: cred.status_detalhado || null,
        decreto_enviado: cred.decreto_enviado ?? null,
        data_atribuicao: cred.data_atribuicao || null,
        origem_dado: 'pixconsig', ultima_sincronizacao: now, status_sync: 'ok',
        ativo: cred.status === 'ativo',
      };
      const conv = await conveniosApi.upsertByPixconsig(convenio);

      // Sincroniza os produtos SEM tocar taxa/prazo/valor (CONSIGTEC).
      for (const p of produtos) {
        const { error } = await supabase.from('produtos_convenio').upsert({
          convenio_id: conv.id, produto: mapProduto(p.tipo_margem),
          nome: p.nome || null, tipo_margem: mapMargem(p.tipo_margem),
          margem_percentual: numOrNull(p.percentual_margem), ativo: true,
        }, { onConflict: 'convenio_id,produto' });
        if (!error) res.produtos++;
      }
      res.ok++;
    } catch (e) {
      res.erros.push(`Item ${res.total} (${item?.id || '?'}): ${e.message}`);
    }
  }
  return res;
}
