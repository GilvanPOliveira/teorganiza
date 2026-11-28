import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// The worker ships with the app: no network, no CDN.
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/**
 * A PDF's text as printed lines, read in the browser. Pieces of text that
 * sit on the same baseline are one line, left to right; a wide gap
 * between pieces becomes a few spaces, as columns on the page.
 * A scanned report (an image) has no text, and comes back empty.
 */
export async function pdfLines(data: ArrayBuffer): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  const out: string[] = []
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      const rows = new Map<number, { x: number; end: number; text: string }[]>()
      for (const item of content.items) {
        if (!('str' in item) || !item.str.trim()) continue
        const x = item.transform[4] as number
        const y = Math.round((item.transform[5] as number) / 2) * 2
        const row = rows.get(y) ?? []
        row.push({ x, end: x + (item.width as number), text: item.str })
        rows.set(y, row)
      }
      for (const y of [...rows.keys()].sort((a, b) => b - a)) {
        const pieces = rows.get(y)!.sort((a, b) => a.x - b.x)
        let line = ''
        let end = -Infinity
        for (const piece of pieces) {
          const gap = piece.x - end
          line += line ? (gap > 12 ? '   ' : gap > 1.5 ? ' ' : '') : ''
          line += piece.text
          end = piece.end
        }
        out.push(line)
      }
    }
  } finally {
    await doc.destroy()
  }
  return out
}
