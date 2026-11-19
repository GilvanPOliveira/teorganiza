import { describe, expect, it } from 'vitest';
import { segmentarEmPalavras, type Fragmento } from '../src/segmentar.js';

const f = (texto: string, x0: number, x1: number, topo = 0): Fragmento => ({ texto, x0, x1, topo });
const textos = (fs: readonly Fragmento[]) => segmentarEmPalavras(fs).map((p) => p.texto);

describe('segmentarEmPalavras', () => {
  it('junta pedaços de letra numa palavra só', () => {
    // Como o pdf.js devolve o cabeçalho do Santander: "A","gên","c","i","a"
    expect(
      textos([f('A', 40, 47), f('gên', 47, 65), f('c', 65, 70), f('i', 70, 73), f('a', 73, 78), f(':', 78, 81)]),
    ).toEqual(['Agência:']);
  });

  it('separa palavras quando o vão é de um espaço', () => {
    expect(textos([f('Dep', 265, 283), f('dinheiro', 286, 322), f('ATM', 324, 346)]))
      .toEqual(['Dep', 'dinheiro', 'ATM']);
  });

  it('quebra um bloco maior que a palavra', () => {
    // Como o pdf.js devolve o cabeçalho do Bradesco: "Crédito (R$)" num item só
    expect(textos([f('Crédito (R$)', 385, 426)])).toEqual(['Crédito', '(R$)']);
  });

  it('preserva a posição ao quebrar, para o mapeamento de coluna funcionar', () => {
    const [credito] = segmentarEmPalavras([f('Crédito (R$)', 385, 426)]);
    expect(credito!.x0).toBeCloseTo(385, 0);
    expect(credito!.x1).toBeLessThan(426);
  });

  it('mantém o byte nulo que alguns PDFs usam como separador de milhar', () => {
    // Santander: "8\u0000128,16" precisa chegar inteiro para a normalização limpar
    expect(textos([f('8', 515, 521), f('\u0000', 521, 524), f('128,16', 524, 545)]))
      .toEqual(['8\u0000128,16']);
  });

  it('não devolve nada para entrada vazia', () => {
    expect(segmentarEmPalavras([])).toEqual([]);
    expect(segmentarEmPalavras([f('   ', 0, 10)])).toEqual([]);
  });
});
