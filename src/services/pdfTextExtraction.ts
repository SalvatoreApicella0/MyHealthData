import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfTextExtraction {
  text: string
  pages: number
}

/**
 * Extracts text already embedded in a PDF locally in the browser.
 * Scanned/image-only PDFs intentionally return an empty string: they need an
 * OCR engine, while silently sending the document to a remote service would
 * violate the local-first vault contract.
 */
export async function extractPdfText(file: Blob, maxPages = 12): Promise<PdfTextExtraction> {
  const loadingTask = pdfjsLib.getDocument({ data: await file.arrayBuffer() })
  const document = await loadingTask.promise
  try {
    const pages: string[] = []
    const limit = Math.min(document.numPages, maxPages)
    for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (pageText) pages.push(pageText)
    }
    return { text: pages.join('\n\n'), pages: limit }
  } finally {
    await document.destroy()
  }
}
