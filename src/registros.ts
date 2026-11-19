/**
 * Montagem dos registros a partir das linhas.
 *
 * Uma transação é um BLOCO de linhas, nunca uma linha. Os quatro extratos
 * analisados discordam em quase tudo e concordam nisto: modalidade acima do
 * valor, contraparte abaixo.
 *
 *   Dep dinheiro ATM                              <- modalidade
 *   03/07/2026 70099 484470099201341 450,00 (+)   <- a linha âncora
 *   03/07 20:13 SOP-PAULISTA                      <- contraparte
 */
import type { Gabarito, LancamentoBruto, PaginaPdf } from './tipos.js';
import { valorDaLinha } from './dinheiro.js';
import { agruparEmLinhas, colunasDaLinha, derivarFaixas, type Faixas } from './colunas.js';
import { aplicarSubstituicoes, casaAlguma } from './texto.js';

interface LinhaMapeada {
  readonly colunas: Readonly<Record<string, string>>;
  readonly texto: string;
  readonly pagina: number;
}

function ehCabecalho(texto: string, ordem: readonly string[]): boolean {
  return ordem.slice(0, 3).every((h) => texto.includes(h));
}

export function mapearLinhas(
  paginas: readonly PaginaPdf[],
  g: Gabarito,
): { linhas: readonly LinhaMapeada[]; faixas: Faixas | null } {
  const ordem = g.tabela.ancoraCabecalho;
  const subs = g.normalizacao?.substituir;
  let faixas: Faixas | null = null;
  let ativo = false;
  const linhas: LinhaMapeada[] = [];

  for (const pagina of paginas) {
    for (const linha of agruparEmLinhas(pagina.palavras)) {
      const texto = aplicarSubstituicoes(linha.map((p) => p.texto).join(' '), subs);

      if (ehCabecalho(texto, ordem)) {
        faixas ??= derivarFaixas(linha, ordem);
        ativo = true;
        continue;
      }
      if (!ativo || faixas === null) continue;

      // A tabela tem começo E fim declarados. Sem a fronteira de saída o
      // parser continua lendo as seções seguintes do documento.
      if (casaAlguma(texto, g.fimTabela)) { ativo = false; continue; }

      const cruas = colunasDaLinha(linha, faixas);
      const colunas: Record<string, string> = {};
      for (const [k, v] of Object.entries(cruas)) colunas[k] = aplicarSubstituicoes(v, subs);

      linhas.push({ colunas, texto, pagina: pagina.numero });
    }
  }
  return { linhas, faixas };
}

export function montarRegistros(
  linhas: readonly LinhaMapeada[],
  g: Gabarito,
): readonly LancamentoBruto[] {
  const { colValor, colDescricao, colData, sinal } = g.tabela;
  const herdaData = g.registro?.dataHerdada ?? false;
  const valorDe = (c: Readonly<Record<string, string>>) => valorDaLinha(c, sinal, colValor);

  const fora: LancamentoBruto[] = [];
  let ultimaData = '';

  for (let i = 0; i < linhas.length; i++) {
    const atual = linhas[i]!;
    const valor = valorDe(atual.colunas);
    if (valor === null) continue;

    const descricaoPropria = (atual.colunas[colDescricao] ?? '').trim();
    if (casaAlguma(descricaoPropria, g.ignorar) || casaAlguma(atual.texto, g.ignorar)) continue;

    let historico = descricaoPropria;
    if (historico === '') {
      for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
        const anterior = linhas[j]!;
        const texto = (anterior.colunas[colDescricao] ?? '').trim();
        if (valorDe(anterior.colunas) === null && texto !== '') { historico = texto; break; }
      }
    }

    let complemento = '';
    const seguinte = linhas[i + 1];
    if (seguinte) {
      const texto = (seguinte.colunas[colDescricao] ?? '').trim();
      if (valorDe(seguinte.colunas) === null && texto !== '') complemento = texto;
    }

    const dataPropria = (atual.colunas[colData] ?? '').trim();
    if (dataPropria !== '') ultimaData = dataPropria;
    const data = dataPropria !== '' ? dataPropria : herdaData ? ultimaData : '';

    fora.push({
      data,
      historico,
      complemento,
      documento: (atual.colunas['Documento'] ?? atual.colunas['Docto.'] ?? '').trim(),
      valor,
      pagina: atual.pagina,
    });
  }
  return fora;
}
