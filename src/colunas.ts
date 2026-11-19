/**
 * Mapeamento de palavras para colunas, por posição horizontal.
 *
 * Ler o PDF como texto corrido não basta. No Bradesco, crédito e débito são
 * colunas distintas e a linha de texto não diz em qual o valor estava —
 * `17.000,00` poderia ser entrada ou saída. A informação está na posição.
 *
 * As faixas são ancoradas no cabeçalho encontrado no PRÓPRIO documento,
 * nunca em coordenadas fixas: se o banco mexer no layout, o gabarito
 * continua valendo.
 */
import type { Palavra } from './tipos.js';

export type Faixas = ReadonlyMap<string, readonly [number, number]>;

const centro = (p: Palavra): number => (p.x0 + p.x1) / 2;

/**
 * Deriva as faixas a partir da linha de cabeçalho. A fronteira entre duas
 * colunas é o ponto médio entre os centros das suas âncoras — isso acomoda
 * tanto coluna alinhada à esquerda quanto número alinhado à direita, que
 * frequentemente começa antes da âncora e termina depois dela.
 */
export function derivarFaixas(
  cabecalho: readonly Palavra[],
  ordem: readonly string[],
): Faixas | null {
  const centros = new Map<string, number>();
  for (const nome of ordem) {
    const achada = cabecalho.find((p) => p.texto === nome);
    if (achada) centros.set(nome, centro(achada));
  }
  const nomes = ordem.filter((n) => centros.has(n));
  if (nomes.length < 2) return null;

  const faixas = new Map<string, readonly [number, number]>();
  for (let i = 0; i < nomes.length; i++) {
    const nome = nomes[i]!;
    const aqui = centros.get(nome)!;
    const antes = i === 0 ? null : centros.get(nomes[i - 1]!)!;
    const depois = i === nomes.length - 1 ? null : centros.get(nomes[i + 1]!)!;
    faixas.set(nome, [
      antes === null ? Number.NEGATIVE_INFINITY : (antes + aqui) / 2,
      depois === null ? Number.POSITIVE_INFINITY : (aqui + depois) / 2,
    ]);
  }
  return faixas;
}

export function colunaDe(p: Palavra, faixas: Faixas): string | null {
  const c = centro(p);
  for (const [nome, [lo, hi]] of faixas) if (c >= lo && c < hi) return nome;
  return null;
}

/**
 * Agrupa as palavras da página em linhas, tolerando pequena variação vertical.
 *
 * Arredondar `topo / tolerância` em baldes parece servir e não serve: duas
 * palavras da MESMA linha, a 10 e a 11 unidades do topo, caem em baldes
 * diferentes quando a fronteira passa entre elas. O agrupamento é feito por
 * varredura ordenada, comparando cada palavra com o início do grupo atual.
 */
export function agruparEmLinhas(
  palavras: readonly Palavra[],
  tolerancia = 3,
): readonly (readonly Palavra[])[] {
  if (palavras.length === 0) return [];

  const ordenadas = [...palavras].sort((a, b) => a.topo - b.topo);
  const linhas: Palavra[][] = [];
  let atual: Palavra[] = [];
  let referencia = Number.NaN;

  for (const p of ordenadas) {
    if (atual.length === 0 || Math.abs(p.topo - referencia) <= tolerancia) {
      if (atual.length === 0) referencia = p.topo;
      atual.push(p);
    } else {
      linhas.push(atual);
      atual = [p];
      referencia = p.topo;
    }
  }
  if (atual.length > 0) linhas.push(atual);

  return linhas.map((ps) => ps.sort((a, b) => a.x0 - b.x0));
}

/** Junta as palavras de uma linha por coluna, preservando a ordem. */
export function colunasDaLinha(
  linha: readonly Palavra[],
  faixas: Faixas,
): Record<string, string> {
  const fora: Record<string, string[]> = {};
  for (const p of linha) {
    const col = colunaDe(p, faixas);
    if (col === null) continue;
    (fora[col] ??= []).push(p.texto);
  }
  const resultado: Record<string, string> = {};
  for (const [col, partes] of Object.entries(fora)) resultado[col] = partes.join(' ');
  return resultado;
}
