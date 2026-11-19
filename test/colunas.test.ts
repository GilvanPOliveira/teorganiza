import { describe, expect, it } from 'vitest';
import { agruparEmLinhas, colunasDaLinha, derivarFaixas } from '../src/colunas.js';
import type { Palavra } from '../src/tipos.js';

const p = (texto: string, x0: number, x1: number, topo = 0): Palavra => ({ texto, x0, x1, topo });

/** Coordenadas reais do cabeçalho do extrato do Bradesco. */
const cabecalhoBradesco = [
  p('Data', 46.1, 61.2), p('Histórico', 110.6, 140.4), p('Docto.', 304.9, 326.4),
  p('Crédito', 385.0, 409.0), p('Débito', 451.7, 473.5), p('Saldo', 519.8, 538.0),
];
const ordem = ['Data', 'Histórico', 'Docto.', 'Crédito', 'Débito', 'Saldo'];

describe('mapeamento por coordenada', () => {
  it('separa crédito de débito, que o texto corrido não distingue', () => {
    const faixas = derivarFaixas(cabecalhoBradesco, ordem)!;
    expect(faixas).not.toBeNull();

    const credito = colunasDaLinha(
      [p('20/07/2026', 46, 95, 10), p('0253126', 303, 340, 10), p('200.000,00', 391, 436, 10), p('200.002,02', 515, 560, 10)],
      faixas,
    );
    expect(credito['Crédito']).toBe('200.000,00');
    expect(credito['Débito']).toBeUndefined();
    expect(credito['Saldo']).toBe('200.002,02');

    const debito = colunasDaLinha(
      [p('1351553', 303, 340, 20), p('17.000,00', 459, 500, 20), p('284.502,02', 515, 560, 20)],
      faixas,
    );
    expect(debito['Débito']).toBe('17.000,00');
    expect(debito['Crédito']).toBeUndefined();
  });

  it('distingue data de lançamento de data de compra pela coluna', () => {
    // Santander consolidado: a data em x≈34 é o lançamento, a em x≈65 é a compra.
    const faixas = derivarFaixas(
      [p('Data', 34, 54), p('Descrição', 65, 106), p('Documento', 307, 360), p('Movimento', 409, 462), p('Saldo', 508, 532)],
      ['Data', 'Descrição', 'Documento', 'Movimento', 'Saldo'],
    )!;
    const lancamento = colunasDaLinha([p('27/07', 34, 56, 10)], faixas);
    const compra = colunasDaLinha([p('26/07', 65, 87, 20), p('RESTAURANTE', 84, 135, 20)], faixas);
    expect(lancamento['Data']).toBe('27/07');
    expect(compra['Data']).toBeUndefined();
    expect(compra['Descrição']).toContain('26/07');
  });
});

describe('agruparEmLinhas', () => {
  it('junta palavras próximas na vertical e ordena pela horizontal', () => {
    const linhas = agruparEmLinhas([p('b', 50, 60, 10), p('a', 10, 20, 11), p('c', 10, 20, 40)]);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]!.map((w) => w.texto)).toEqual(['a', 'b']);
  });
});
