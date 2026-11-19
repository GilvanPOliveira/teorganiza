/**
 * Teste de integração: o caminho inteiro, do PDF ao total, pelo mesmo
 * pdf.js que o navegador usa.
 *
 * Confere o somatório contra o número que CADA DOCUMENTO declara de si
 * mesmo — saldo inicial e final, ou a linha de totais — nunca contra um
 * valor escrito à mão aqui.
 *
 * Os arquivos ficam em fixtures/, que não é versionada: extrato de banco
 * não entra em repositório. Sem eles, estes testes são pulados.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { escolherGabarito, lerExtrato } from '../src/index.js';
import { conferir } from '../src/conferencia.js';
import { segmentarEmPalavras, type Fragmento } from '../src/segmentar.js';
import type { Gabarito, PaginaPdf } from '../src/tipos.js';

const CASOS = 'test/casos.local.json';

interface Caso {
  readonly arquivo: string;
  readonly gabarito: string;
  readonly saldo?: readonly [number, number];
  readonly totais?: readonly [number, number];
}

const nomes = [
  'bb-conta-corrente',
  'santander-extrato-conta',
  'santander-consolidado',
  'bradesco-celular',
] as const;

const gabaritos: readonly Gabarito[] = nomes.map(
  (n) => JSON.parse(readFileSync(`gabaritos/${n}.json`, 'utf8')) as Gabarito,
);

async function lerPdf(caminho: string): Promise<readonly PaginaPdf[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(caminho)) }).promise;
  const paginas: PaginaPdf[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const conteudo = await pagina.getTextContent();
    const visao = pagina.getViewport({ scale: 1 });
    const fragmentos: Fragmento[] = [];
    for (const item of conteudo.items) {
      if (!('str' in item) || item.str === '') continue;
      const x0 = item.transform[4] as number;
      const y = item.transform[5] as number;
      fragmentos.push({ texto: item.str, x0, x1: x0 + (item.width as number), topo: visao.height - y });
    }
    paginas.push({ numero: n, largura: visao.width, palavras: segmentarEmPalavras(fragmentos) });
  }
  await doc.destroy();
  return paginas;
}

const casos: readonly Caso[] = existsSync(CASOS)
  ? (JSON.parse(readFileSync(CASOS, 'utf8')) as Caso[])
  : [];

describe.skipIf(casos.length === 0)('extratos reais', () => {
  for (const caso of casos) {
    it(`${caso.gabarito}: o somatório bate com o que o documento declara`, async () => {
      const paginas = await lerPdf(`fixtures/${caso.arquivo}`);

      const escolhido = escolherGabarito(paginas, gabaritos);
      expect(escolhido?.id, 'gabarito reconhecido').toBe(caso.gabarito);

      const c = conferir(lerExtrato(paginas, escolhido!));
      expect(c.quantidade, 'encontrou lançamentos').toBeGreaterThan(0);

      if (caso.totais) {
        expect([c.entradas, c.saidas]).toEqual([caso.totais[0], caso.totais[1]]);
      }
      if (caso.saldo) {
        expect(caso.saldo[0] + c.entradas - c.saidas).toBe(caso.saldo[1]);
      }
    }, 60_000);
  }
});
