/**
 * Conciliação de transferências entre contas do próprio usuário.
 *
 * Mover R$ 500 do Bradesco para o Santander aparece duas vezes no histórico:
 * uma saída lá e uma entrada cá. Somadas ingenuamente, viram R$ 500 de gasto
 * e R$ 500 de receita que nunca existiram.
 *
 * A correção NÃO é apagar nem alterar um dos dois lados. Os extratos são a
 * fonte da verdade e precisam continuar conferindo com o saldo que o banco
 * declara — é essa conferência que sustenta a confiança no produto. Então a
 * transferência é uma TERCEIRA entidade, que aponta para as duas pontas e
 * diz "estas duas linhas são o mesmo dinheiro". As visões de gasto descontam
 * o par; a conferência de saldo continua intacta.
 *
 * Nenhum pareamento aqui é certeza. Mesmo valor, contas diferentes e datas
 * próximas descrevem uma transferência — e descrevem igualmente bem uma
 * coincidência. Por isso cada transferência sai com confiança e motivo, para
 * que a tela de revisão possa mostrar o porquê e o usuário possa discordar.
 */
import type { Centavos, LancamentoBruto } from './tipos.js';
import { formatar } from './dinheiro.js';
import { normalizarDescricao } from './texto.js';

/** Um lançamento já ligado à sua conta e à sua chave de idempotência. */
export interface LancamentoIdentificado {
  readonly conta: string;
  readonly chave: string;
  readonly lancamento: LancamentoBruto;
}

export type Confianca = 'alta' | 'media' | 'baixa';

/**
 * A terceira entidade. Guarda CHAVES, não cópias: os dois lançamentos
 * seguem existindo nos seus extratos, intocados.
 */
export interface Transferencia {
  readonly chaveSaida: string;
  readonly chaveEntrada: string;
  readonly contaSaida: string;
  readonly contaEntrada: string;
  /** Sempre positivo: é o módulo do valor que mudou de lugar. */
  readonly valor: Centavos;
  readonly distanciaEmDias: number;
  readonly confianca: Confianca;
  /** Marcas encontradas nas descrições, em ordem estável. */
  readonly indicios: readonly string[];
  /** Frase legível para a tela de revisão. */
  readonly motivo: string;
}

export interface OpcoesConciliacao {
  /**
   * Distância máxima entre as duas pontas. O padrão é 72h porque TED e DOC
   * entre bancos diferentes cruzam fim de semana. ATENÇÃO: extrato não traz
   * hora, só data — então a janela é efetivamente contada em dias, e 72h
   * admite até 3 dias de diferença.
   */
  readonly janelaEmHoras?: number;
  /** Nome do titular. Se aparecer na descrição, é indício de mesma titularidade. */
  readonly titular?: string;
  /** Ano a assumir quando a data do extrato vem sem ano (`03/07`). */
  readonly anoBase?: number;
}

export interface ResultadoConciliacao {
  readonly transferencias: readonly Transferencia[];
  /**
   * Chaves cuja data não foi compreendida. Estes lançamentos ficam de fora
   * do pareamento de propósito: sem data não há como julgar a janela, e
   * adivinhar aqui produziria transferência falsa em silêncio.
   */
  readonly semData: readonly string[];
}

const MILISSEGUNDOS_POR_DIA = 86_400_000;

/** Marcas que valem como palavra inteira. 'doc' dentro de 'documento' não conta. */
const MARCAS_PALAVRA: readonly (readonly [string, string])[] = [
  ['pix', 'pix'],
  ['ted', 'ted'],
  ['doc', 'doc'],
  ['tev', 'tev'],
];

/** Marcas que valem como trecho, já na forma normalizada (sem acento, minúscula). */
const MARCAS_TRECHO: readonly (readonly [string, string])[] = [
  ['transf', 'transferencia'],
  ['aplicacao', 'aplicacao'],
  ['resgate', 'resgate'],
  ['fatura', 'fatura'],
  ['poupanca', 'poupanca'],
  ['entre contas', 'entre contas'],
  ['mesma titularidade', 'titularidade'],
];

/**
 * Converte a data do extrato em dias desde a época.
 *
 * Trabalha em dias inteiros, não em `Date`, para que fuso horário não tenha
 * como interferir: a data de um extrato é um dia do calendário, não um
 * instante. Devolve `null` em vez de chutar — é a diferença entre deixar um
 * lançamento de fora, que se vê, e inventar uma data, que não se vê.
 *
 * Aceita `AAAA-MM-DD`, `DD/MM/AAAA`, `DD/MM/AA` e `DD/MM` (este só com
 * `anoBase`). Separador pode ser `/`, `-` ou `.`.
 */
export function interpretarData(bruto: string, anoBase?: number): number | null {
  const t = bruto.trim();
  if (t === '') return null;

  let ano: number;
  let mes: number;
  let dia: number;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const completa = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  const curta = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/.exec(t);
  const semAno = /^(\d{1,2})[/.-](\d{1,2})$/.exec(t);

  if (iso) {
    ano = Number(iso[1]);
    mes = Number(iso[2]);
    dia = Number(iso[3]);
  } else if (completa) {
    dia = Number(completa[1]);
    mes = Number(completa[2]);
    ano = Number(completa[3]);
  } else if (curta) {
    dia = Number(curta[1]);
    mes = Number(curta[2]);
    // Extrato de banco é documento do presente. 1926 não está no escopo.
    ano = 2000 + Number(curta[3]);
  } else if (semAno) {
    if (anoBase === undefined) return null;
    dia = Number(semAno[1]);
    mes = Number(semAno[2]);
    ano = anoBase;
  } else {
    return null;
  }

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const ms = Date.UTC(ano, mes - 1, dia);
  const d = new Date(ms);
  // 31/02 viraria 03/03 em silêncio. Confere a volta.
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return null;
  }

  return Math.round(ms / MILISSEGUNDOS_POR_DIA);
}

/**
 * Procura marcas de transferência na descrição. Trabalha sobre a forma
 * normalizada, então acento e CAIXA ALTA do extrato não atrapalham.
 */
export function indiciosDe(l: LancamentoBruto, titular?: string): readonly string[] {
  const texto = normalizarDescricao(`${l.historico} ${l.complemento}`);
  const palavras = new Set(texto.split(' ').filter((p) => p !== ''));
  const achados = new Set<string>();

  for (const [marca, rotulo] of MARCAS_PALAVRA) {
    if (palavras.has(marca)) achados.add(rotulo);
  }
  for (const [marca, rotulo] of MARCAS_TRECHO) {
    if (texto.includes(marca)) achados.add(rotulo);
  }

  if (titular !== undefined) {
    const nome = normalizarDescricao(titular)
      .split(' ')
      .filter((p) => p.length >= 3);
    // Exige o nome inteiro, não um pedaço: 'silva' sozinho não diz nada.
    if (nome.length > 0 && nome.every((p) => palavras.has(p))) achados.add('titular');
  }

  return [...achados].sort();
}

function grauDeConfianca(
  indiciosSaida: readonly string[],
  indiciosEntrada: readonly string[],
  distanciaEmDias: number,
): Confianca {
  const ladosComIndicio = (indiciosSaida.length > 0 ? 1 : 0) + (indiciosEntrada.length > 0 ? 1 : 0);
  if (ladosComIndicio === 2 && distanciaEmDias <= 1) return 'alta';
  if (ladosComIndicio >= 1) return 'media';
  return 'baixa';
}

interface Candidato {
  readonly saida: LancamentoIdentificado;
  readonly entrada: LancamentoIdentificado;
  readonly distanciaEmDias: number;
  readonly indiciosSaida: readonly string[];
  readonly indiciosEntrada: readonly string[];
  readonly forca: number;
  readonly desempate: string;
}

/**
 * Pareia saídas com entradas espelhadas em outra conta.
 *
 * A escolha é gulosa, não ótima: percorre os candidatos do mais próximo no
 * tempo para o mais distante e vai fixando os pares. Um emparelhamento
 * ótimo global poderia, em casos raros, casar mais pares — mas seria muito
 * mais difícil de explicar na tela de revisão, e explicar é o que importa
 * aqui, já que o usuário precisa poder discordar de cada par.
 *
 * A ordem dos critérios é indício primeiro, tempo como desempate — e não o
 * contrário. Tempo primeiro parece natural e está errado: quando uma
 * transferência real de um dia para o outro disputa com uma coincidência de
 * mesmo valor no mesmo dia, o tempo vence e os dois pares saem cruzados, os
 * dois com confiança média, sem nada que a tela de revisão possa destacar.
 * Há um teste com esse caso exato.
 *
 * A ordenação é total e termina em chave, então o resultado não depende da
 * ordem em que os lançamentos chegaram.
 */
export function conciliar(
  lancamentos: readonly LancamentoIdentificado[],
  opcoes: OpcoesConciliacao = {},
): ResultadoConciliacao {
  const janelaEmDias = (opcoes.janelaEmHoras ?? 72) / 24;

  const semData: string[] = [];
  const comData: { readonly item: LancamentoIdentificado; readonly dia: number }[] = [];

  for (const item of lancamentos) {
    const dia = interpretarData(item.lancamento.data, opcoes.anoBase);
    if (dia === null) semData.push(item.chave);
    else comData.push({ item, dia });
  }

  const saidas = comData.filter((x) => x.item.lancamento.valor < 0);
  const entradas = comData.filter((x) => x.item.lancamento.valor > 0);

  const candidatos: Candidato[] = [];

  for (const s of saidas) {
    for (const e of entradas) {
      if (s.item.conta === e.item.conta) continue;
      if (-s.item.lancamento.valor !== e.item.lancamento.valor) continue;

      const distanciaEmDias = Math.abs(s.dia - e.dia);
      if (distanciaEmDias > janelaEmDias) continue;

      const indiciosSaida = indiciosDe(s.item.lancamento, opcoes.titular);
      const indiciosEntrada = indiciosDe(e.item.lancamento, opcoes.titular);

      candidatos.push({
        saida: s.item,
        entrada: e.item,
        distanciaEmDias,
        indiciosSaida,
        indiciosEntrada,
        forca: indiciosSaida.length + indiciosEntrada.length,
        desempate: `${s.item.chave}\u0000${e.item.chave}`,
      });
    }
  }

  candidatos.sort(
    (a, b) =>
      b.forca - a.forca ||
      a.distanciaEmDias - b.distanciaEmDias ||
      (a.desempate < b.desempate ? -1 : a.desempate > b.desempate ? 1 : 0),
  );

  const usadas = new Set<string>();
  const transferencias: Transferencia[] = [];

  for (const c of candidatos) {
    if (usadas.has(c.saida.chave) || usadas.has(c.entrada.chave)) continue;
    usadas.add(c.saida.chave);
    usadas.add(c.entrada.chave);

    const indicios = [...new Set([...c.indiciosSaida, ...c.indiciosEntrada])].sort();
    const valor = -c.saida.lancamento.valor;
    const confianca = grauDeConfianca(c.indiciosSaida, c.indiciosEntrada, c.distanciaEmDias);

    const dias =
      c.distanciaEmDias === 0
        ? 'no mesmo dia'
        : c.distanciaEmDias === 1
          ? 'com 1 dia de diferença'
          : `com ${c.distanciaEmDias} dias de diferença`;
    const marcas = indicios.length > 0 ? `indícios na descrição: ${indicios.join(', ')}` : 'sem indício na descrição — pode ser coincidência';

    transferencias.push({
      chaveSaida: c.saida.chave,
      chaveEntrada: c.entrada.chave,
      contaSaida: c.saida.conta,
      contaEntrada: c.entrada.conta,
      valor,
      distanciaEmDias: c.distanciaEmDias,
      confianca,
      indicios,
      motivo: `${formatar(valor)} saiu de ${c.saida.conta} e entrou em ${c.entrada.conta} ${dias}; ${marcas}`,
    });
  }

  return { transferencias, semData };
}

/**
 * Soma apenas o que não é transferência interna. É assim que a visão de
 * gastos deixa de contar dinheiro que só mudou de bolso.
 */
export function totaisSemTransferencias(
  lancamentos: readonly LancamentoIdentificado[],
  transferencias: readonly Transferencia[],
): { readonly entradas: Centavos; readonly saidas: Centavos } {
  const conciliadas = new Set<string>();
  for (const t of transferencias) {
    conciliadas.add(t.chaveSaida);
    conciliadas.add(t.chaveEntrada);
  }

  let entradas = 0;
  let saidas = 0;
  for (const { chave, lancamento } of lancamentos) {
    if (conciliadas.has(chave)) continue;
    if (lancamento.valor > 0) entradas += lancamento.valor;
    else saidas += -lancamento.valor;
  }
  return { entradas, saidas };
}
