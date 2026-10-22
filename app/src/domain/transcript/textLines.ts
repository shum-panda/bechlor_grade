export interface PositionedText {
  str: string;
  transform: number[];
}

/**
 * Groups the text items of one PDF page into visual lines: items with (almost)
 * the same y position, sorted left to right, top to bottom.
 */
export function itemsToLines(items: PositionedText[]): string[] {
  const rows: { y: number; items: { x: number; text: string }[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    // Cells of one table row can differ by a point or two vertically.
    let row = rows.find((r) => Math.abs(r.y - y) < 3);
    if (!row) rows.push((row = { y, items: [] }));
    row.items.push({ x, text: item.str });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((r) => r.items.sort((a, b) => a.x - b.x).map((i) => i.text).join("  "));
}
