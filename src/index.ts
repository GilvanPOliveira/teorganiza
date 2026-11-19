export * from './tipos.js';
export { paraCentavos, formatar, valorDaLinha } from './dinheiro.js';
export { normalizarDescricao, aplicarSubstituicoes, casaAlguma } from './texto.js';
export { agruparEmLinhas, colunasDaLinha, derivarFaixas, colunaDe } from './colunas.js';
export { mapearLinhas, montarRegistros } from './registros.js';
export { conferir, bateComSaldo, bateComTotais } from './conferencia.js';
export { segmentarEmPalavras, type Fragmento } from './segmentar.js';
export { chaveDe, comChaves, apenasNovos } from './idempotencia.js';
export {
  conciliar,
  totaisSemTransferencias,
  interpretarData,
  indiciosDe,
  type LancamentoIdentificado,
  type Transferencia,
  type Confianca,
  type OpcoesConciliacao,
  type ResultadoConciliacao,
} from './conciliacao.js';

import type { Gabarito, LancamentoBruto, PaginaPdf } from './tipos.js';
import { mapearLinhas, montarRegistros } from './registros.js';

/** Lê um documento já extraído em palavras posicionadas, segundo um gabarito. */
export function lerExtrato(
  paginas: readonly PaginaPdf[],
  gabarito: Gabarito,
): readonly LancamentoBruto[] {
  const { linhas } = mapearLinhas(paginas, gabarito);
  return montarRegistros(linhas, gabarito);
}

/** Escolhe o gabarito cujo conjunto de marcas aparece na primeira página. */
export function escolherGabarito(
  paginas: readonly PaginaPdf[],
  gabaritos: readonly Gabarito[],
): Gabarito | null {
  const primeira = paginas[0];
  if (!primeira) return null;
  const texto = primeira.palavras.map((p) => p.texto).join(' ');
  return gabaritos.find((g) => g.identificacao.every((m) => texto.includes(m))) ?? null;
}
