import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { itemsToLines, type PositionedText } from "./textLines";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Extracts the text of a PDF as visual lines. Runs entirely in the browser. */
export async function pdfToLines(data: ArrayBuffer): Promise<string[]> {
  const doc = await pdfjs.getDocument({ data }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    lines.push(...itemsToLines(content.items.flatMap((i): PositionedText[] => ("str" in i ? [i] : []))));
  }
  return lines;
}
