import { conveniosApi } from '@/lib/api/convenios';
import { entidadesApi } from '@/lib/api/entidades';

// Consome o payload v1 da API de Convênios PixConsig (formato { data: [...] }
// ou um array cru) e sincroniza o espelho local. Idempotente: upsert de
// entidade (por CNPJ/nome) + convênio (por pixconsig_convenio_id).
// NÃO toca em overlay_comercial_convenio nem em produtos_convenio: taxa/spread/
// comissão/prazos são propriedade do CONSIGTEC. REPROVADA é ignorada por padrão.
const soDigitos = (v) => (v ? String(v).replace(/\D/g, '') : null);
const soData = (v) => (v ? String(v).slice(0, 10) : null); // ISO → date

export async function importarConveniosPixconsigJSON(texto, nowIso, opts = {}) {
  let parsed;
  try { parsed = typeof texto === 'string' ? JSON.parse(texto) : texto; }
  catch { throw new Error('JSON inválido.'); }
  const lista = Array.isArray(parsed) ? parsed : (parsed?.data || []);
  if (!Array.isArray(lista) || lista.length === 0) throw new Error('Payload sem itens em "data".');

  const now = nowIso || new Date().toISOString();
  const incluirReprovadas = !!opts.incluirReprovadas;
  const res = { total: 0, ok: 0, ignorados: 0, erros: [] };

  for (const item of lista) {
    res.total++;
    try {
      const ent = item.entidade || {};
      const cred = item.credenciamento || {};
      const norma = item.norma_autorizadora || {};
      const capag = item.capag || {};
      const averb = item.averbacao || {};
      const prod = (item.produtos && item.produtos[0]) || {};

      if (!item.id) throw new Error('item sem id (pixconsig_convenio_id)');
      if (!incluirReprovadas && String(cred.status_detalhado || '').toUpperCase() === 'REPROVADA') {
        res.ignorados++; continue;
      }

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
        origem_dado: 'pixconsig', ultima_sincronizacao: now, status_sync: 'ok',
      };
      let entidadeId = await entidadesApi.encontrar({ cnpj, nome, cidade, uf });
      if (entidadeId) await entidadesApi.update(entidadeId, entPayload);
      else entidadeId = (await entidadesApi.create(entPayload)).id;

      const convenio = {
        pixconsig_convenio_id: item.id,
        nome, orgao: cidade, tipo: 'publico', entidade_id: entidadeId,
        tipo_margem: prod.tipo_margem || 'cartao',
        percentual_margem_apartada: prod.percentual_margem_apartada ?? null,
        margem_consignavel: prod.percentual_margem_apartada ?? null,
        margem_disponivel: prod.margem_disponivel ?? null,
        capag: capag.classificacao || null,
        arquivo_decreto_url: norma.arquivo_decreto_url || null,
        norma_autorizadora: norma.tipo || null,
        status_detalhado: cred.status_detalhado || null,
        decreto_enviado: cred.decreto_enviado ?? null,
        data_atribuicao: cred.data_atribuicao || null,
        origem_dado: 'pixconsig', ultima_sincronizacao: now, status_sync: 'ok',
        ativo: cred.status === 'ativo',
      };
      await conveniosApi.upsertByPixconsig(convenio);
      res.ok++;
    } catch (e) {
      res.erros.push(`Item ${res.total} (${item?.id || '?'}): ${e.message}`);
    }
  }
  return res;
}
