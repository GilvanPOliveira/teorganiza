import { describe, expect, it } from 'vitest';
import { bateComSaldo, bateComTotais, conferir } from '../src/conferencia.js';
import type { LancamentoBruto } from '../src/tipos.js';

const l = (valor: number): LancamentoBruto =>
  ({ data: '', valor, historico: '', complemento: '', documento: '', pagina: 1 });

describe('conferência', () => {
  it('reproduz os totais declarados pelo extrato do Santander', () => {
    // Cabeçalho do documento: Entradas 6.635,31 · Saídas 6.981,90
    const c = conferir([l(663531), l(-698190)]);
    expect(bateComTotais(c, 663531, 698190)).toBe(true);
  });

  it('fecha o encadeamento de saldo do Banco do Brasil', () => {
    // Saldo Anterior 0,73 · S A L D O 0,00
    const c = conferir([l(2343623), l(-2343696)]);
    expect(bateComSaldo(c, 73, 0)).toBe(true);
  });

  it('acusa quando sobra valor de outra seção do documento', () => {
    // O resgate de poupança de R$ 50,00 que vazou para a conta corrente.
    const c = conferir([l(2343623), l(-2343696), l(5000)]);
    expect(bateComSaldo(c, 73, 0)).toBe(false);
  });
});
