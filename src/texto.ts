/** Normalização de texto. Separada porque a chave de idempotência depende dela. */

/**
 * Alguns PDFs trazem o separador de milhar como byte nulo: `R$ 8\u0000128,16`
 * no lugar de `R$ 8.128,16`. Sem limpar isso antes de converter, todo valor
 * acima de mil é lido errado — e o erro é silencioso, que é o pior tipo.
 */
export function aplicarSubstituicoes(
  texto: string,
  pares: readonly (readonly [string, string])[] | undefined,
): string {
  if (!pares) return texto;
  let fora = texto;
  for (const [de, para] of pares) fora = fora.split(de).join(para);
  return fora;
}

/**
 * Forma canônica usada na chave de idempotência: minúsculas, sem acento,
 * espaços colapsados. Sai SEMPRE do texto de origem do extrato, nunca da
 * contraparte identificada — senão melhorar o reconhecimento de lojas
 * mudaria a chave de lançamentos antigos e duplicaria o histórico inteiro.
 */
export function normalizarDescricao(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function casaAlguma(texto: string, padroes: readonly string[] | undefined): boolean {
  if (!padroes) return false;
  return padroes.some((p) => new RegExp(p, 'i').test(texto));
}
