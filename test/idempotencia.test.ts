import { describe, expect, it } from 'vitest';
import { apenasNovos, comChaves } from '../src/idempotencia.js';
import type { LancamentoBruto } from '../src/tipos.js';

const l = (data: string, valor: number, historico: string, documento = ''): LancamentoBruto =>
  ({ data, valor, historico, documento, complemento: '', pagina: 1 });

describe('chave de idempotência', () => {
  it('reconhece o mesmo lançamento vindo de outro extrato', () => {
    const julho = comChaves('ct_bb', [l('2026-07-03', -45000, 'Pix - Enviado', '70301')]);
    const sobreposto = comChaves('ct_bb', [l('2026-07-03', -45000, 'Pix - Enviado', '70301')]);
    expect(sobreposto[0]!.chave).toBe(julho[0]!.chave);

    const existentes = new Set(julho.map((x) => x.chave));
    expect(apenasNovos(sobreposto, existentes)).toHaveLength(0);
  });

  it('distingue dois Pix idênticos no mesmo dia pelo ordinal', () => {
    const chaves = comChaves('ct_bb', [
      l('2026-07-03', -50000, 'Pix - Enviado'),
      l('2026-07-03', -50000, 'Pix - Enviado'),
    ]);
    expect(chaves[0]!.chave).not.toBe(chaves[1]!.chave);
    expect(apenasNovos(chaves, new Set())).toHaveLength(2);
  });

  it('ignora acento e caixa na descrição de origem', () => {
    const a = comChaves('ct', [l('2026-07-03', -100, 'COMPRA CARTÃO DÉBITO')]);
    const b = comChaves('ct', [l('2026-07-03', -100, 'compra cartao debito')]);
    expect(a[0]!.chave).toBe(b[0]!.chave);
  });

  it('separa a mesma transação em contas diferentes', () => {
    const a = comChaves('ct_bb', [l('2026-07-03', -40000, 'Transferência')]);
    const b = comChaves('ct_santander', [l('2026-07-03', -40000, 'Transferência')]);
    expect(a[0]!.chave).not.toBe(b[0]!.chave);
  });
});
