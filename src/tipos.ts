/**
 * Tipos da engine. Nenhum import de plataforma: nada de DOM, navegador ou
 * framework. É essa regra que permite testar a lógica fora da interface e,
 * um dia, rodá-la em outro lugar.
 */

/** Valor monetário em centavos, com o sinal embutido. NUNCA ponto flutuante. */
export type Centavos = number;

/** Uma palavra do PDF com sua posição. É o que o leitor de PDF precisa entregar. */
export interface Palavra {
  readonly texto: string;
  /** Borda esquerda, em unidades da página. */
  readonly x0: number;
  /** Borda direita. */
  readonly x1: number;
  /** Distância do topo da página. Agrupa palavras em linha. */
  readonly topo: number;
}

export interface PaginaPdf {
  readonly numero: number;
  readonly largura: number;
  readonly palavras: readonly Palavra[];
}

/**
 * A fronteira com a plataforma. No navegador, implementado com pdf.js;
 * nos testes, com qualquer coisa que devolva palavras posicionadas.
 */
export interface LeitorPdf {
  ler(dados: Uint8Array): Promise<readonly PaginaPdf[]>;
}

export type ModeloSinal =
  /** Colunas separadas de crédito e débito. Bradesco. */
  | { readonly tipo: 'colunas'; readonly entrada: string; readonly saida: string }
  /** Sufixo (+) ou (-) depois do valor. Banco do Brasil. */
  | { readonly tipo: 'sufixo_parenteses' }
  /** Sinal de menos colado no fim do valor: 9,99-. Santander consolidado. */
  | { readonly tipo: 'sufixo_menos' }
  /** Valor já assinado: -R$ 264,80. Santander extrato de conta. */
  | { readonly tipo: 'valor_assinado' };

export interface Coluna {
  /** Palavra do cabeçalho que ancora esta coluna. */
  readonly ancora: string;
}

export interface Gabarito {
  readonly id: string;
  readonly banco: string;
  readonly documento: string;
  readonly versao: number;

  /** Trechos que precisam existir na primeira página para o gabarito servir. */
  readonly identificacao: readonly string[];

  /** Extração do cabeçalho do documento. Cada entrada é uma expressão regular. */
  readonly cabecalho?: Readonly<Record<string, string>>;

  readonly normalizacao?: {
    /** Pares [procurar, substituir] aplicados antes de converter número. */
    readonly substituir?: readonly (readonly [string, string])[];
  };

  readonly tabela: {
    /** Palavras da linha de cabeçalho, na ordem em que aparecem. */
    readonly ancoraCabecalho: readonly string[];
    readonly colValor?: string;
    readonly colDescricao: string;
    readonly colData: string;
    readonly sinal: ModeloSinal;
  };

  readonly registro?: {
    /** O Bradesco só escreve a data na primeira transação do dia. */
    readonly dataHerdada?: boolean;
    /** Prefixos do complemento que revelam a direção. REM: entra, DES: sai. */
    readonly direcaoPorPrefixo?: Readonly<Record<string, 'entrada' | 'saida'>>;
  };

  /** Linhas que não são transação: saldos, rodapés, propaganda. */
  readonly ignorar?: readonly string[];

  /**
   * Onde a tabela termina. SEM isto o parser segue lendo as seções
   * seguintes do documento — foi assim que R$ 50,00 de uma poupança
   * vazaram para dentro de uma conta corrente.
   */
  readonly fimTabela?: readonly string[];
}

export interface LancamentoBruto {
  readonly data: string;
  readonly historico: string;
  readonly complemento: string;
  readonly documento: string;
  readonly valor: Centavos;
  readonly pagina: number;
}

export interface Conferencia {
  readonly entradas: Centavos;
  readonly saidas: Centavos;
  readonly quantidade: number;
}
