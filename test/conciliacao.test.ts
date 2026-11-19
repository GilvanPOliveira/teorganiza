import { describe, expect, it } from 'vitest';
import {
  conciliar,
  indiciosDe,
  interpretarData,
  totaisSemTransferencias,
  type LancamentoIdentificado,
} from '../src/conciliacao.js';
import type { LancamentoBruto } from '../src/tipos.js';

const li = (
  conta: string,
  chave: string,
  data: string,
  valor: number,
  historico: string,
  complemento = '',
): LancamentoIdentificado => ({
  conta,
  chave,
  lancamento: { data, valor, historico, complemento, documento: '', pagina: 1 },
});

const lb = (historico: string, complemento = ''): LancamentoBruto => ({
  data: '2026-07-03',
  valor: -100,
  historico,
  complemento,
  documento: '',
  pagina: 1,
});

describe('interpretar a data do extrato', () => {
  it('entende os formatos que os bancos escrevem', () => {
    const esperado = interpretarData('2026-07-03');
    expect(esperado).not.toBeNull();
    expect(interpretarData('03/07/2026')).toBe(esperado);
    expect(interpretarData('3/7/2026')).toBe(esperado);
    expect(interpretarData('03/07/26')).toBe(esperado);
    expect(interpretarData('03.07.2026')).toBe(esperado);
    expect(interpretarData('03-07-2026')).toBe(esperado);
  });

  it('recusa data impossível em vez de rolar para o mês seguinte', () => {
    // 31/02 viraria 03/03 num `new Date` ingênuo.
    expect(interpretarData('31/02/2026')).toBeNull();
    expect(interpretarData('32/01/2026')).toBeNull();
    expect(interpretarData('03/13/2026')).toBeNull();
  });

  it('recusa data sem ano quando não há ano base', () => {
    expect(interpretarData('03/07')).toBeNull();
    expect(interpretarData('03/07', 2026)).toBe(interpretarData('2026-07-03'));
  });

  it('recusa lixo em vez de inventar', () => {
    expect(interpretarData('')).toBeNull();
    expect(interpretarData('03 JUL')).toBeNull();
    expect(interpretarData('saldo anterior')).toBeNull();
  });
});

describe('indícios na descrição', () => {
  it('não confunde pedaço de palavra com marca', () => {
    // 'doc' dentro de 'documento' não é DOC bancário.
    expect(indiciosDe(lb('DOCUMENTO DE COBRANCA'))).not.toContain('doc');
    expect(indiciosDe(lb('DOC ENVIADO'))).toContain('doc');
  });

  it('lê igual com acento, sem acento e em caixa alta', () => {
    expect(indiciosDe(lb('TRANSFERÊNCIA ENVIADA'))).toEqual(indiciosDe(lb('transferencia enviada')));
    expect(indiciosDe(lb('TRANSFERÊNCIA ENVIADA'))).toContain('transferencia');
  });

  it('procura também no complemento', () => {
    expect(indiciosDe(lb('LANCAMENTO', 'REM: PIX RECEBIDO'))).toContain('pix');
  });

  it('só aceita o titular com o nome inteiro', () => {
    const l = lb('PIX ENVIADO GILVAN OLIVEIRA');
    expect(indiciosDe(l, 'Gilvan Oliveira')).toContain('titular');
    // Sobrenome comum sozinho não prova titularidade.
    expect(indiciosDe(lb('PIX ENVIADO MARIA SILVA'), 'Gilvan Oliveira')).not.toContain('titular');
  });

  it('não vê indício onde não há', () => {
    expect(indiciosDe(lb('SUPERMERCADO BOM PRECO'))).toHaveLength(0);
  });
});

describe('conciliação: o que NÃO pode parear', () => {
  it('não pareia dois lançamentos da mesma conta', () => {
    const { transferencias } = conciliar([
      li('ct_bb', 'k1', '2026-07-03', -50000, 'PIX ENVIADO'),
      li('ct_bb', 'k2', '2026-07-03', 50000, 'PIX RECEBIDO'),
    ]);
    expect(transferencias).toHaveLength(0);
  });

  it('não pareia dois débitos', () => {
    const { transferencias } = conciliar([
      li('ct_bb', 'k1', '2026-07-03', -5000, 'COMPRA CARTAO'),
      li('ct_santander', 'k2', '2026-07-03', -5000, 'COMPRA CARTAO'),
    ]);
    expect(transferencias).toHaveLength(0);
  });

  it('não pareia dois créditos', () => {
    const { transferencias } = conciliar([
      li('ct_bb', 'k1', '2026-07-03', 5000, 'DEPOSITO'),
      li('ct_santander', 'k2', '2026-07-03', 5000, 'DEPOSITO'),
    ]);
    expect(transferencias).toHaveLength(0);
  });

  it('não pareia valores diferentes, mesmo por um centavo', () => {
    const { transferencias } = conciliar([
      li('ct_bb', 'k1', '2026-07-03', -50000, 'PIX ENVIADO'),
      li('ct_santander', 'k2', '2026-07-03', 50001, 'PIX RECEBIDO'),
    ]);
    expect(transferencias).toHaveLength(0);
  });

  it('não pareia fora da janela', () => {
    const fora = conciliar([
      li('ct_bb', 'k1', '2026-07-03', -50000, 'PIX ENVIADO'),
      li('ct_santander', 'k2', '2026-07-07', 50000, 'PIX RECEBIDO'),
    ]);
    expect(fora.transferencias).toHaveLength(0);

    // Na borda dos 72h (3 dias) ainda pareia.
    const dentro = conciliar([
      li('ct_bb', 'k1', '2026-07-03', -50000, 'PIX ENVIADO'),
      li('ct_santander', 'k2', '2026-07-06', 50000, 'PIX RECEBIDO'),
    ]);
    expect(dentro.transferencias).toHaveLength(1);
  });

  it('respeita uma janela mais apertada', () => {
    const entrada = [
      li('ct_bb', 'k1', '2026-07-03', -50000, 'PIX ENVIADO'),
      li('ct_santander', 'k2', '2026-07-05', 50000, 'PIX RECEBIDO'),
    ];
    expect(conciliar(entrada).transferencias).toHaveLength(1);
    expect(conciliar(entrada, { janelaEmHoras: 24 }).transferencias).toHaveLength(0);
  });

  it('deixa de fora, e avisa, o lançamento cuja data não entendeu', () => {
    const { transferencias, semData } = conciliar([
      li('ct_bb', 'k1', '03 JUL', -50000, 'PIX ENVIADO'),
      li('ct_santander', 'k2', '2026-07-03', 50000, 'PIX RECEBIDO'),
    ]);
    expect(transferencias).toHaveLength(0);
    expect(semData).toEqual(['k1']);
  });
});

describe('conciliação: o que deve parear', () => {
  it('pareia a transferência entre dois bancos, cada um com seu formato de data', () => {
    const { transferencias } = conciliar([
      li('ct_bradesco', 'k1', '03/07/2026', -50000, 'TRANSFERENCIA ENVIADA'),
      li('ct_santander', 'k2', '2026-07-03', 50000, 'TED RECEBIDA'),
    ]);
    expect(transferencias).toHaveLength(1);
    const t = transferencias[0]!;
    expect(t.chaveSaida).toBe('k1');
    expect(t.chaveEntrada).toBe('k2');
    expect(t.valor).toBe(50000);
    expect(t.confianca).toBe('alta');
    expect(t.indicios).toContain('transferencia');
    expect(t.indicios).toContain('ted');
  });

  it('trata o pagamento de fatura como transferência, não como gasto', () => {
    const lancamentos = [
      li('ct_bb', 'k1', '2026-07-10', -80000, 'PAGAMENTO FATURA CARTAO'),
      li('cartao_bb', 'k2', '2026-07-10', 80000, 'PAGAMENTO RECEBIDO'),
      li('cartao_bb', 'k3', '2026-07-02', -80000, 'RESTAURANTE'),
    ];
    const { transferencias } = conciliar(lancamentos);
    expect(transferencias).toHaveLength(1);
    expect(transferencias[0]!.indicios).toContain('fatura');

    // O gasto real continua contando; o pagamento da fatura, não.
    const totais = totaisSemTransferencias(lancamentos, transferencias);
    expect(totais.saidas).toBe(80000);
    expect(totais.entradas).toBe(0);
  });

  it('não apaga nem altera nenhum dos dois lados', () => {
    const lancamentos = [
      li('ct_bb', 'k1', '2026-07-03', -50000, 'PIX ENVIADO'),
      li('ct_santander', 'k2', '2026-07-03', 50000, 'PIX RECEBIDO'),
    ];
    const copia = JSON.parse(JSON.stringify(lancamentos));
    const { transferencias } = conciliar(lancamentos);
    expect(transferencias).toHaveLength(1);
    expect(lancamentos).toEqual(copia);
  });
});

describe('conciliação: ambiguidade', () => {
  const muitosCandidatos = [
    li('ct_bb', 'kS1', '2026-07-03', -50000, 'PIX ENVIADO'),
    li('ct_bb', 'kS2', '2026-07-04', -50000, 'PIX ENVIADO'),
    li('ct_santander', 'kE1', '2026-07-03', 50000, 'PIX RECEBIDO'),
    li('ct_santander', 'kE2', '2026-07-05', 50000, 'PIX RECEBIDO'),
  ];

  it('nunca usa o mesmo lançamento em duas transferências', () => {
    const { transferencias } = conciliar(muitosCandidatos);
    const usadas = transferencias.flatMap((t) => [t.chaveSaida, t.chaveEntrada]);
    expect(new Set(usadas).size).toBe(usadas.length);
  });

  it('prefere o par mais próximo no tempo', () => {
    const { transferencias } = conciliar(muitosCandidatos);
    const par = transferencias.find((t) => t.chaveSaida === 'kS1');
    expect(par?.chaveEntrada).toBe('kE1');
    expect(par?.distanciaEmDias).toBe(0);
  });

  it('não depende da ordem em que os lançamentos chegaram', () => {
    const referencia = conciliar(muitosCandidatos).transferencias;
    const invertido = conciliar([...muitosCandidatos].reverse()).transferencias;
    expect(invertido).toEqual(referencia);

    // E qualquer rotação da lista também.
    for (let i = 1; i < muitosCandidatos.length; i += 1) {
      const rodado = [...muitosCandidatos.slice(i), ...muitosCandidatos.slice(0, i)];
      expect(conciliar(rodado).transferencias).toEqual(referencia);
    }
  });

  /**
   * O caso que decidiu a ordem dos critérios.
   *
   * Uma transferência real — PIX nas duas pontas, 1 dia de distância —
   * disputa com uma coincidência de mesmo valor no mesmo dia. Ordenar por
   * tempo primeiro faz o tempo vencer, e os pares saem CRUZADOS: a saída do
   * Pix casa com o depósito e a compra casa com a entrada do Pix. Pior: os
   * dois saem como 'media', então a tela de revisão não destaca o erro.
   *
   * Indício primeiro acerta os dois, e joga a coincidência para 'baixa', que
   * é onde ela tem que aparecer para o usuário poder discordar.
   *
   * O tempo continua a valer como desempate quando o indício empata — é o
   * teste logo abaixo que fixa isso.
   */
  it('casa indício com indício quando o tempo contradiz o indício', () => {
    const { transferencias } = conciliar([
      li('ct_a', 'S_compra', '2026-07-03', -50000, 'SUPERMERCADO'),
      li('ct_b', 'E_deposito', '2026-07-03', 50000, 'DEPOSITO'),
      li('ct_a', 'S_pix', '2026-07-03', -50000, 'PIX ENVIADO'),
      li('ct_b', 'E_pix', '2026-07-04', 50000, 'PIX RECEBIDO'),
    ]);

    const pares = transferencias.map((t) => [t.chaveSaida, t.chaveEntrada]);
    expect(pares).toEqual([
      ['S_pix', 'E_pix'],
      ['S_compra', 'E_deposito'],
    ]);

    // E a coincidência precisa sair sinalizada, não como par confiante.
    const coincidencia = transferencias.find((t) => t.chaveSaida === 'S_compra');
    expect(coincidencia?.confianca).toBe('baixa');
  });

  it('desempata distância igual pelo indício mais forte', () => {
    const { transferencias } = conciliar([
      li('ct_bb', 'kS', '2026-07-03', -50000, 'PIX ENVIADO'),
      li('ct_a', 'kE_sem', '2026-07-03', 50000, 'CREDITO'),
      li('ct_b', 'kE_com', '2026-07-03', 50000, 'PIX RECEBIDO'),
    ]);
    expect(transferencias).toHaveLength(1);
    expect(transferencias[0]!.chaveEntrada).toBe('kE_com');
  });
});

describe('conciliação: confiança', () => {
  it('marca como baixa a coincidência sem indício nenhum', () => {
    // Mesmo valor, contas diferentes, mesmo dia — e nada a ver uma com a outra.
    const { transferencias } = conciliar([
      li('ct_bb', 'k1', '2026-07-03', -5000, 'SUPERMERCADO BOM PRECO'),
      li('ct_santander', 'k2', '2026-07-03', 5000, 'DEPOSITO EM DINHEIRO'),
    ]);
    expect(transferencias).toHaveLength(1);
    expect(transferencias[0]!.confianca).toBe('baixa');
    expect(transferencias[0]!.indicios).toHaveLength(0);
    expect(transferencias[0]!.motivo).toContain('coincidência');
  });

  it('marca como média quando só um lado tem indício', () => {
    const { transferencias } = conciliar([
      li('ct_bb', 'k1', '2026-07-03', -50000, 'PIX ENVIADO'),
      li('ct_santander', 'k2', '2026-07-03', 50000, 'CREDITO EM CONTA'),
    ]);
    expect(transferencias[0]!.confianca).toBe('media');
  });

  it('nunca dá confiança alta sem indício nos dois lados', () => {
    const todos = conciliar([
      li('ct_bb', 'k1', '2026-07-03', -5000, 'SUPERMERCADO'),
      li('ct_santander', 'k2', '2026-07-03', 5000, 'DEPOSITO'),
      li('ct_bb', 'k3', '2026-07-03', -70000, 'PIX ENVIADO'),
      li('ct_santander', 'k4', '2026-07-03', 70000, 'CREDITO'),
      li('ct_bb', 'k5', '2026-07-03', -90000, 'TED ENVIADA'),
      li('ct_santander', 'k6', '2026-07-03', 90000, 'TED RECEBIDA'),
    ]).transferencias;

    for (const t of todos) {
      if (t.confianca === 'alta') {
        expect(t.indicios.length).toBeGreaterThan(0);
      }
    }
    expect(todos.filter((t) => t.confianca === 'alta')).toHaveLength(1);
    expect(todos.filter((t) => t.confianca === 'baixa')).toHaveLength(1);
  });

  it('rebaixa a confiança quando as pontas estão longe no tempo', () => {
    const { transferencias } = conciliar([
      li('ct_bb', 'k1', '2026-07-03', -50000, 'PIX ENVIADO'),
      li('ct_santander', 'k2', '2026-07-06', 50000, 'PIX RECEBIDO'),
    ]);
    // Indício dos dois lados, mas 3 dias de distância: não é certeza.
    expect(transferencias[0]!.confianca).toBe('media');
  });
});

describe('totais sem transferência interna', () => {
  it('desconta o par e preserva o resto', () => {
    const lancamentos = [
      li('ct_bb', 'k1', '2026-07-03', -50000, 'PIX ENVIADO'),
      li('ct_santander', 'k2', '2026-07-03', 50000, 'PIX RECEBIDO'),
      li('ct_bb', 'k3', '2026-07-04', -12345, 'PADARIA'),
      li('ct_bb', 'k4', '2026-07-05', 300000, 'SALARIO'),
    ];
    const { transferencias } = conciliar(lancamentos);
    expect(transferencias).toHaveLength(1);

    const totais = totaisSemTransferencias(lancamentos, transferencias);
    expect(totais.saidas).toBe(12345);
    expect(totais.entradas).toBe(300000);
  });

  it('sem transferência nenhuma, bate com a soma crua', () => {
    const lancamentos = [
      li('ct_bb', 'k1', '2026-07-03', -12345, 'PADARIA'),
      li('ct_bb', 'k2', '2026-07-05', 300000, 'SALARIO'),
    ];
    const totais = totaisSemTransferencias(lancamentos, []);
    expect(totais.saidas).toBe(12345);
    expect(totais.entradas).toBe(300000);
  });
});
