/**
 * A chave que impede que reenviar o mesmo extrato duplique tudo.
 *
 * Seis partes: conta, data, valor, descrição normalizada, documento e um
 * ordinal. O ordinal resolve dois Pix idênticos no mesmo dia; o documento,
 * presente em três dos quatro bancos analisados, quase garante unicidade.
 *
 * Onde ela é frágil: se o banco reescrever a descrição entre um extrato e
 * outro, a chave muda e o lançamento duplica. A defesa não é refinar a
 * chave — é, diante de mesma conta, mesma data e mesmo valor com chave
 * diferente, PERGUNTAR na tela de revisão em vez de decidir sozinho.
 */
import type { LancamentoBruto } from './tipos.js';
import { normalizarDescricao } from './texto.js';

export function chaveDe(
  conta: string,
  l: Pick<LancamentoBruto, 'data' | 'valor' | 'historico' | 'documento'>,
  ordinal: number,
): string {
  return [
    conta,
    l.data,
    String(l.valor),
    normalizarDescricao(l.historico),
    l.documento,
    String(ordinal),
  ].join('|');
}

/** Calcula o ordinal de cada lançamento dentro do seu grupo de iguais. */
export function comChaves(
  conta: string,
  lancamentos: readonly LancamentoBruto[],
): readonly { readonly lancamento: LancamentoBruto; readonly chave: string }[] {
  const vistos = new Map<string, number>();
  return lancamentos.map((lancamento) => {
    const base = chaveDe(conta, lancamento, 0).slice(0, -2);
    const n = vistos.get(base) ?? 0;
    vistos.set(base, n + 1);
    return { lancamento, chave: chaveDe(conta, lancamento, n) };
  });
}

/** Mantém só o que ainda não existe no arquivo. */
export function apenasNovos<T extends { readonly chave: string }>(
  candidatos: readonly T[],
  chavesExistentes: ReadonlySet<string>,
): readonly T[] {
  return candidatos.filter((c) => !chavesExistentes.has(c.chave));
}
