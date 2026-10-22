import { normalizeName, type Curriculum } from "../curriculum";
import { FAILED, type Results } from "../grades";

// Parses the text of a HISinOne "Transcript of Records" (one string per
// visual line), e.g.
//   "Programming 1   SS22 - 01   1,7 *   P / 1   6   CM"

export interface TranscriptRow {
  section: string;
  /** Sub-heading within the programme, e.g. "Elective Modules". */
  group?: string;
  name: string;
  period: string;
  grade: number | "pass";
  recognised: boolean;
  status: string;
  attempt: number;
  ects: number;
  type: string;
}

const ROW =
  /^(.+?)\s+((?:SS|WS|SoSe|WiSe)\s?\d{2}(?:\/\d{2})?\s*-\s*\d{2})\s+(\d[,.]\d|Pass|bestanden|BE)\s*(\*)?\s+([A-Z]{1,2})\s*\/\s*(\d+)\s+(\d+(?:[,.]\d+)?)\s+(CM|EM|OM|PM|WPM|WM)\s*$/i;

const SECTION = /\((Bachelor|Master)\)/i;

export function parseTranscriptLines(lines: string[]): TranscriptRow[] {
  const rows: TranscriptRow[] = [];
  let section = "";
  let group: string | undefined;
  let pending: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const match = ROW.exec(line);
    if (!match) {
      pending.push(line);
      // Section headings may wrap over two lines and end with "(Bachelor)".
      if (SECTION.test(line)) {
        section = pending.slice(-2).join(" ");
        group = undefined;
        pending = [];
      }
      continue;
    }
    // A single line directly above a row is a sub-heading ("Elective Modules").
    // Page footers/headers produce several lines and are ignored.
    if (pending.length === 1) group = pending[0];
    pending = [];
    const [, name, period, gradeText, star, status, attempt, ects, type] = match;
    rows.push({
      section,
      group,
      name: name.trim(),
      period: period.replace(/\s+/g, " "),
      grade: /^\d/.test(gradeText) ? Number(gradeText.replace(",", ".")) : "pass",
      recognised: star === "*",
      status: status.toUpperCase(),
      attempt: Number(attempt),
      ects: Number(ects.replace(",", ".")),
      type: type.toUpperCase(),
    });
  }
  return rows;
}

export interface ImportResult {
  results: Results;
  thesis?: number;
  colloquium?: number;
  /** Rows of this programme that matched no module (electives, AWE, renamed modules). */
  unmatched: TranscriptRow[];
  /** Rows belonging to other programmes on the same transcript. */
  otherProgrammes: TranscriptRow[];
}

/**
 * Maps transcript rows onto the curriculum. `aliases` are user-made
 * assignments (normalized transcript name -> module id) from earlier imports.
 */
export function matchToCurriculum(
  curriculum: Curriculum,
  rows: TranscriptRow[],
  aliases: Record<string, string> = {},
): ImportResult {
  const byName = new Map<string, string>();
  for (const mod of curriculum.modules) {
    for (const alias of mod.aliases) byName.set(normalizeName(alias), mod.id);
  }
  const isAny = (names: string[], key: string) => names.some((n) => normalizeName(n) === key);
  const result: ImportResult = { results: {}, unmatched: [], otherProgrammes: [] };
  const { results } = result;
  const slotFor = new Map<string, string>(); // transcript name -> slot id, keeps retakes in one slot

  for (const row of rows) {
    if (!row.section.includes(curriculum.transcriptSection)) {
      result.otherProgrammes.push(row);
      continue;
    }
    const key = normalizeName(row.name);
    // "Project Study: HTW - Mobile Lab" -> also try "Project Study".
    const baseKey = normalizeName(row.name.split(":")[0]);
    if (typeof row.grade === "number" && row.grade < FAILED) {
      if (isAny(curriculum.thesisAliases, key)) {
        result.thesis = row.grade;
        continue;
      }
      if (isAny(curriculum.colloquiumAliases, key)) {
        result.colloquium = row.grade;
        continue;
      }
    }
    let id: string | undefined = aliases[key] ?? byName.get(key) ?? byName.get(baseKey) ?? slotFor.get(key);
    const slotKind = row.group ? curriculum.slotGroups[row.group] : undefined;
    if (!id && slotKind) {
      id = curriculum.modules.find((m) => m.kind === slotKind && !results[m.id] && !Object.values(aliases).includes(m.id))?.id;
      if (id) slotFor.set(key, id);
    }
    if (!id) {
      result.unmatched.push(row);
      continue;
    }
    // Later attempts override earlier ones, but never replace a pass by a fail.
    const prev = results[id];
    const prevPassed = prev && prev.grade !== FAILED;
    if (prevPassed && row.grade === FAILED) continue;
    results[id] = { grade: row.grade, recognised: row.recognised, title: row.name };
  }
  return result;
}
