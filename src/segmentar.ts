/**
 * Segmentação de fragmentos de texto em palavras posicionadas.
 *
 * Extratores de PDF não concordam sobre o que é uma palavra. O mesmo
 * documento pode sair quebrado em pedaços de letra — "A", "gên", "c", "i",
 * "a" — ou colado em blocos maiores, como "Crédito (R$)" num item só. A
 * engine precisa de palavras, e é aqui que elas são reconstruídas.
 *
  * Lógica pura: nenhuma dependência de biblioteca de PDF.
 */
import type { Palavra } from './tipos.js';
import { agruparEmLinhas } from './colunas.js';

/** Um pedaço de texto como o extrator entregou, com posição. */
export interface Fragmento {
  readonly texto: string;
  readonly x0: number;
  readonly x1: number;
  readonly topo: number;
}

const larguraPorLetra = (f: Fragmento): number =>
  f.texto.length > 0 ? (f.x1 - f.x0) / f.texto.length : 0;

/** Quebra um fragmento que já contém espaços, estimando a posição de cada parte. */
function dividirPorEspaco(f: Fragmento): Fragmento[] {
  if (!/\s/.test(f.texto)) return f.texto === '' ? [] : [f];

  const largura = larguraPorLetra(f);
  const fora: Fragmento[] = [];
  let posicao = 0;

  for (const parte of f.texto.split(/(\s+)/)) {
    if (parte === '') continue;
    if (!/^\s+$/.test(parte)) {
      fora.push({
        texto: parte,
        x0: f.x0 + posicao * largura,
        x1: f.x0 + (posicao + parte.length) * largura,
        topo: f.topo,
      });
    }
    posicao += parte.length;
  }
  return fora;
}

/**
 * Junta fragmentos vizinhos numa linha quando o vão entre eles é menor que
 * um espaço. O limiar sai da própria largura de letra do fragmento, então
 * funciona em qualquer corpo de fonte sem número mágico por documento.
 *
 * A fração é pequena de propósito: fragmentos da mesma palavra vêm
 * encostados, com vão perto de zero, enquanto palavras vizinhas guardam
 * uma folga visível. Valores mais frouxos chegaram a colar "dinheiro" e
 * "ATM" numa palavra só.
 */
export function segmentarEmPalavras(
  fragmentos: readonly Fragmento[],
  fracaoDeEspaco = 0.22,
): readonly Palavra[] {
  const partes = fragmentos.flatMap(dividirPorEspaco);
  if (partes.length === 0) return [];

  const palavras: Palavra[] = [];

  for (const linha of agruparEmLinhas(partes as readonly Palavra[])) {
    let atual: { texto: string; x0: number; x1: number; topo: number } | null = null;

    for (const parte of linha) {
      if (atual === null) {
        atual = { texto: parte.texto, x0: parte.x0, x1: parte.x1, topo: parte.topo };
        continue;
      }
      const vao = parte.x0 - atual.x1;
      const referencia = Math.max(larguraPorLetra(parte), larguraPorLetra(atual), 1);
      if (vao <= referencia * fracaoDeEspaco) {
        atual.texto += parte.texto;
        atual.x1 = Math.max(atual.x1, parte.x1);
      } else {
        palavras.push({ ...atual });
        atual = { texto: parte.texto, x0: parte.x0, x1: parte.x1, topo: parte.topo };
      }
    }
    if (atual !== null) palavras.push({ ...atual });
  }
  return palavras;
}
