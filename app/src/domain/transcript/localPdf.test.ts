// Runs the full import against a real transcript on your machine; skipped
// unless TRANSCRIPT_PDF is set. The PDF itself never goes into the repo.
//   TRANSCRIPT_PDF=/path/to/transcript.pdf npx vitest run localPdf
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HTW_AI_2021 } from "../curriculum";
import { matchToCurriculum, parseTranscriptLines } from "./parseTranscript";
import { itemsToLines, type PositionedText } from "./textLines";

const path = process.env.TRANSCRIPT_PDF;

describe.skipIf(!path)("local transcript PDF", () => {
  it("imports all module rows", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(path!)) }).promise;
    const lines: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent();
      lines.push(...itemsToLines(content.items as PositionedText[]));
    }
    const rows = parseTranscriptLines(lines);
    const imported = matchToCurriculum(HTW_AI_2021, rows);
    console.log({
      rows: rows.length,
      matched: Object.keys(imported.results),
      thesis: imported.thesis,
      colloquium: imported.colloquium,
      unmatched: imported.unmatched.map((r) => `${r.group} | ${r.name}`),
    });
    expect(rows.length).toBeGreaterThan(0);
  });
});
