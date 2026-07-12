import { supabase } from '@/lib/supabaseClient';
import { parseCSV } from '@/lib/pixconsigImport';

// Normaliza número aceitando pt-BR (1.234,56) e formato com ponto (1234.56).
function normNum(raw) {
  const s = String(raw || '').trim();
  if (s === '') return '';
  return s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
}

// Importa/atualiza a BASE DE MARGEM de um convênio a partir do arquivo da
// averbadora (CSV). Colunas aceitas: cpf (obrig.), matricula, margem (obrig.),
// situacao, salario. Casa por CPF (+ matrícula) dentro do convênio.
export async function importarBaseMargemCSV(convenioId, texto) {
  const linhas = parseCSV(texto);
  if (linhas.length < 2) throw new Error('CSV vazio ou sem linhas de dados.');
  const header = linhas[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  const iCpf = idx('cpf');
  const iMat = idx('matricula');
  const iMargem = idx('margem') >= 0 ? idx('margem') : idx('margem_bruta');
  const iSit = idx('situacao');
  const iSal = idx('salario') >= 0 ? idx('salario') : idx('salario_bruto');
  if (iCpf < 0 || iMargem < 0) throw new Error('CSV precisa das colunas "cpf" e "margem".');

  const itens = [];
  let ignorados = 0;
  for (let r = 1; r < linhas.length; r++) {
    const cols = linhas[r];
    const cpf = (cols[iCpf] || '').replace(/\D/g, '');
    const margemRaw = normNum(cols[iMargem]);
    if (!cpf || margemRaw === '') { ignorados++; continue; }
    itens.push({
      cpf,
      matricula: iMat >= 0 ? String(cols[iMat] || '').trim() : '',
      margem: margemRaw,
      situacao: iSit >= 0 ? String(cols[iSit] || '').trim().toLowerCase() : '',
      salario: iSal >= 0 ? normNum(cols[iSal]) : '',
    });
  }
  if (itens.length === 0) throw new Error('Nenhuma linha válida (cpf + margem).');

  const { data, error } = await supabase.rpc('atualizar_margem_lote', { p_convenio: convenioId, p_itens: itens });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    total: itens.length,
    atualizados: row?.atualizados ?? 0,
    nao_encontrados: row?.nao_encontrados ?? 0,
    ignorados: (row?.ignorados ?? 0) + ignorados,
  };
}
