import { conveniosApi } from '@/lib/api/convenios';
import { entidadesApi } from '@/lib/api/entidades';
import { overlayApi } from '@/lib/api/overlay';

// Parser CSV simples com suporte a campos entre aspas.
export function parseCSV(text) {
  const rows = [];
  let i = 0, field = '', row = [], inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { pushField(); i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { pushField(); pushRow(); i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { pushField(); pushRow(); }
  return rows.filter((r) => r.some((x) => x !== ''));
}

// Importa o espelho de convênios da PixConsig a partir de um CSV
// (mesmo schema da API). Upsert por `pixconsig_convenio_id`.
export async function importarConveniosCSV(texto, nowIso) {
  const linhas = parseCSV(texto);
  if (linhas.length < 2) throw new Error('CSV vazio ou sem linhas de dados.');
  const header = linhas[0].map((h) => h.trim());
  const idx = (name) => header.indexOf(name);
  const now = nowIso || new Date().toISOString();
  const res = { total: 0, ok: 0, erros: [] };

  for (let r = 1; r < linhas.length; r++) {
    res.total++;
    const cols = linhas[r];
    const get = (name) => {
      const j = idx(name);
      const v = j >= 0 && cols[j] != null ? String(cols[j]).trim() : '';
      return v === '' ? null : v;
    };
    const numf = (name) => {
      const v = get(name);
      return v == null ? null : Number(String(v).replace(',', '.'));
    };
    try {
      const pix = get('pixconsig_convenio_id');
      if (!pix) throw new Error('sem pixconsig_convenio_id');

      const cnpj = get('cnpj'), nome = get('nome_oficial'), cidade = get('cidade'), uf = get('uf');
      const norma = [get('norma_tipo'), get('norma_numero')].filter(Boolean).join(' ') || null;

      const entPayload = {
        nome: nome || cidade || pix, cnpj, cidade, uf,
        norma_autorizadora: norma,
        sistema_averbacao: get('sistema_averbacao'),
        vigencia_inicio: get('vigencia_inicio'), vigencia_fim: get('vigencia_fim'),
        capag: get('capag_classificacao'),
        origem_dado: 'csv', ultima_sincronizacao: now, status_sync: 'ok',
      };
      let entidadeId = await entidadesApi.encontrar({ cnpj, nome, cidade, uf });
      if (entidadeId) await entidadesApi.update(entidadeId, entPayload);
      else entidadeId = (await entidadesApi.create(entPayload)).id;

      const convenio = {
        pixconsig_convenio_id: pix,
        nome: nome || cidade || pix,
        orgao: cidade,
        tipo: 'publico',
        entidade_id: entidadeId,
        tipo_margem: get('tipo_margem') || 'cartao',
        percentual_margem_apartada: numf('percentual_margem_apartada'),
        margem_consignavel: numf('percentual_margem_apartada'),
        prazo_maximo: numf('prazo_max'),
        taxa_mensal: numf('taxa'),
        spread: numf('spread'),
        capag: get('capag_classificacao'),
        arquivo_decreto_url: get('link_dom'),
        norma_autorizadora: norma,
        origem_dado: 'csv', ultima_sincronizacao: now, status_sync: 'ok',
        ativo: (get('status') || 'ativo') === 'ativo',
      };
      const conv = await conveniosApi.upsertByPixconsig(convenio);

      const comissao = numf('comissao_prefeitura'), spread = numf('spread');
      if (comissao != null || spread != null) {
        await overlayApi.upsert(conv.id, { comissao_prefeitura: comissao, spread });
      }
      res.ok++;
    } catch (e) {
      res.erros.push(`Linha ${r + 1}: ${e.message}`);
    }
  }
  return res;
}
