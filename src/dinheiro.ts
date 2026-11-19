/**
 * Dinheiro é inteiro em centavos, com o sinal embutido. Um débito de
 * R$ 264,80 é -26480. Nunca `number` com decimal: somar centavos em ponto
 * flutuante acumula erro e, mais cedo ou mais tarde, o total do extrato
 * deixa de bater com o saldo declarado — justamente a conferência que
 * sustenta a confiança no produto.
 */
import type { Centavos, ModeloSinal } from './tipos.js';

/** Converte um texto de valor brasileiro em centavos. `null` se não for número. */
export function paraCentavos(bruto: string): Centavos | null {
  let t = bruto.replace(/R\$/g, '').replace(/\s| /g, '').trim();
  if (t === '') return null;

  let negativo = false;

  // Sufixo entre parênteses: 450,00 (+) ou 450,00 (-)
  if (t.endsWith('(-)')) { negativo = true; t = t.slice(0, -3); }
  else if (t.endsWith('(+)')) { t = t.slice(0, -3); }

  // Sinal de menos colado no fim: 9,99-
  if (t.endsWith('-')) { negativo = true; t = t.slice(0, -1); }
  // Ou na frente: -264,80
  if (t.startsWith('-')) { negativo = true; t = t.slice(1); }
  else if (t.startsWith('+')) { t = t.slice(1); }

  if (!/^[\d.,]+$/.test(t)) return null;

  // Separador de milhar é ponto, decimal é vírgula.
  const semMilhar = t.replace(/\./g, '');
  const partes = semMilhar.split(',');
  if (partes.length > 2) return null;

  const inteiros = partes[0] ?? '';
  const decimais = partes[1] ?? '';
  if (inteiros === '' || !/^\d+$/.test(inteiros)) return null;
  if (decimais !== '' && !/^\d{1,2}$/.test(decimais)) return null;

  const centavos = Number(inteiros) * 100 + Number(decimais.padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(centavos)) return null;

  return negativo ? -centavos : centavos;
}

/** Formata centavos no padrão brasileiro, sem símbolo de moeda. */
export function formatar(v: Centavos): string {
  const neg = v < 0;
  const abs = Math.abs(v);
  const reais = Math.trunc(abs / 100);
  const cent = String(abs % 100).padStart(2, '0');
  const comMilhar = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '−' : ''}${comMilhar},${cent}`;
}

/**
 * Aplica o modelo de sinal do gabarito às colunas de uma linha.
 * Quatro documentos reais produziram quatro modelos diferentes, nenhum repetido.
 */
export function valorDaLinha(
  colunas: Readonly<Record<string, string>>,
  sinal: ModeloSinal,
  colValor: string | undefined,
): Centavos | null {
  if (sinal.tipo === 'colunas') {
    const entrada = paraCentavos(colunas[sinal.entrada] ?? '');
    if (entrada !== null) return Math.abs(entrada);
    const saida = paraCentavos(colunas[sinal.saida] ?? '');
    if (saida !== null) return -Math.abs(saida);
    return null;
  }
  if (colValor === undefined) return null;
  return paraCentavos(colunas[colValor] ?? '');
}
