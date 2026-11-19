import { describe, expect, it } from 'vitest';
import { formatar, paraCentavos, valorDaLinha } from '../src/dinheiro.js';

describe('paraCentavos', () => {
  it('lê o formato brasileiro', () => {
    expect(paraCentavos('450,00')).toBe(45000);
    expect(paraCentavos('1.368,17')).toBe(136817);
    expect(paraCentavos('200.000,00')).toBe(20000000);
    expect(paraCentavos('0,73')).toBe(73);
  });

  it('entende os quatro modelos de sinal encontrados', () => {
    expect(paraCentavos('450,00 (+)')).toBe(45000);   // Banco do Brasil
    expect(paraCentavos('450,00 (-)')).toBe(-45000);  // Banco do Brasil
    expect(paraCentavos('9,99-')).toBe(-999);         // Santander consolidado
    expect(paraCentavos('-R$ 264,80')).toBe(-26480);  // Santander extrato
  });

  it('nunca produz ponto flutuante', () => {
    const soma = [paraCentavos('0,10'), paraCentavos('0,20')] as number[];
    expect(soma[0]! + soma[1]!).toBe(30); // 0.1 + 0.2 em float daria 0.30000000000000004
  });

  it('recusa o que não é número', () => {
    expect(paraCentavos('Saldo do dia')).toBeNull();
    expect(paraCentavos('')).toBeNull();
    expect(paraCentavos('12,345')).toBeNull();
  });
});

describe('formatar', () => {
  it('devolve o padrão brasileiro', () => {
    expect(formatar(136817)).toBe('1.368,17');
    expect(formatar(-26480)).toBe('−264,80');
    expect(formatar(0)).toBe('0,00');
  });
});

describe('valorDaLinha', () => {
  it('usa a coluna para decidir o sinal no modelo de colunas separadas', () => {
    const sinal = { tipo: 'colunas', entrada: 'Crédito', saida: 'Débito' } as const;
    expect(valorDaLinha({ 'Crédito': '200.000,00' }, sinal, undefined)).toBe(20000000);
    expect(valorDaLinha({ 'Débito': '17.000,00' }, sinal, undefined)).toBe(-1700000);
  });
});
