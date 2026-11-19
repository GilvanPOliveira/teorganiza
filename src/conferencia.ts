/**
 * Confere o somatório contra o saldo que o próprio extrato declara.
 * É a mesma conferência que a tela de revisão mostra ao usuário, e o que
 * torna seguro descartar o arquivo depois da confirmação.
 */
import type { Centavos, Conferencia, LancamentoBruto } from './tipos.js';

export function conferir(lancamentos: readonly LancamentoBruto[]): Conferencia {
  let entradas = 0;
  let saidas = 0;
  for (const l of lancamentos) {
    if (l.valor > 0) entradas += l.valor;
    else saidas += -l.valor;
  }
  return { entradas, saidas, quantidade: lancamentos.length };
}

/** Confere pelo encadeamento de saldos: inicial + entradas − saídas = final. */
export function bateComSaldo(
  c: Conferencia,
  saldoInicial: Centavos,
  saldoFinal: Centavos,
): boolean {
  return saldoInicial + c.entradas - c.saidas === saldoFinal;
}

/** Confere contra os totais que o extrato declara diretamente. */
export function bateComTotais(
  c: Conferencia,
  entradas: Centavos,
  saidas: Centavos,
): boolean {
  return c.entradas === entradas && c.saidas === saidas;
}
