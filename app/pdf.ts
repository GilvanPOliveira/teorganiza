/**
 * Adaptador de PDF: a única parte que conhece o navegador.
 *
 * A engine recebe palavras posicionadas e não sabe de onde vieram. Aqui o
 * pdf.js preenche esse contrato. Trocar de biblioteca, ou rodar no servidor
 * um dia, não toca em nenhuma linha da engine.
 */
import * as pdfjs from 'pdfjs-dist';
import type { LeitorPdf, PaginaPdf } from '../src/tipos.js';
import { segmentarEmPalavras, type Fragmento } from '../src/segmentar.js';

// O worker é empacotado junto: nenhuma requisição de rede, nenhum CDN.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export const leitorNavegador: LeitorPdf = {
  async ler(dados: Uint8Array): Promise<readonly PaginaPdf[]> {
    const doc = await pdfjs.getDocument({ data: dados }).promise;
    const paginas: PaginaPdf[] = [];

    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      const conteudo = await pagina.getTextContent();
      const visao = pagina.getViewport({ scale: 1 });

      // O pdf.js devolve fragmentos arbitrários: ora pedaços de letra, ora
      // blocos maiores que a palavra. A engine espera palavras, então a
      // reconstrução acontece aqui, antes de ela ver qualquer coisa.
      const fragmentos: Fragmento[] = [];
      for (const item of conteudo.items) {
        if (!('str' in item) || item.str === '') continue;

        // transform = [a, b, c, d, e, f]; e é x, f é y medido de baixo.
        const x0 = item.transform[4] as number;
        const y = item.transform[5] as number;
        fragmentos.push({
          texto: item.str,
          x0,
          x1: x0 + (item.width as number),
          topo: visao.height - y,
        });
      }
      paginas.push({
        numero: n,
        largura: visao.width,
        palavras: segmentarEmPalavras(fragmentos),
      });
    }

    await doc.destroy();
    return paginas;
  },
};
