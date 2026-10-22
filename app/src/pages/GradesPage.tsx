import { useState, type Dispatch, type SetStateAction } from "react";
import { HTW_AI_2021, HTW_AI_DISTRIBUTION_WS2324, normalizeName } from "../domain/curriculum";
import { ectsGrade, finalGrade, isPassed, requiredAverage, summarize, truncate1, type ModuleResult } from "../domain/grades";
import { matchToCurriculum, parseTranscriptLines, type TranscriptRow } from "../domain/transcript/parseTranscript";
import type { AppState } from "../storage";

const curriculum = HTW_AI_2021;
const GRADES = [1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0, 5.0];

const fmt = (x: number | undefined, digits = 2) => (x === undefined ? "–" : x.toFixed(digits).replace(".", ","));

interface Props {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
}

export function GradesPage({ state, setState }: Props) {
  const [unmatched, setUnmatched] = useState<TranscriptRow[]>([]);
  const [importInfo, setImportInfo] = useState<string>();
  const [importing, setImporting] = useState(false);

  const summary = summarize(curriculum, state.results);
  const hasFinal = summary.average !== undefined && state.thesis !== undefined && state.colloquium !== undefined;
  const final = hasFinal ? finalGrade(curriculum, summary.average!, state.thesis!, state.colloquium!) : undefined;

  const f = curriculum.finalGrade;
  const targetAverage =
    state.targetFinal !== undefined && state.thesis !== undefined && state.colloquium !== undefined
      ? (state.targetFinal - state.thesis * f.thesis - state.colloquium * f.colloquium) / f.modules
      : undefined;
  const needed = targetAverage !== undefined ? requiredAverage(summary, targetAverage) : undefined;

  const setResult = (id: string, patch: Partial<ModuleResult>) =>
    setState((s) => ({ ...s, results: { ...s.results, [id]: { ...s.results[id], ...patch } } }));

  async function onImport(file: File) {
    setImporting(true);
    setImportInfo(undefined);
    try {
      const { pdfToLines } = await import("../domain/transcript/pdfText");
      const rows = parseTranscriptLines(await pdfToLines(await file.arrayBuffer()));
      const imported = matchToCurriculum(curriculum, rows, state.aliases);
      setState((s) => ({
        ...s,
        results: { ...s.results, ...imported.results },
        thesis: imported.thesis ?? s.thesis,
        colloquium: imported.colloquium ?? s.colloquium,
      }));
      setUnmatched(imported.unmatched);
      setImportInfo(
        rows.length === 0
          ? "Keine Modulzeilen erkannt. Ist das ein Transcript of Records aus HISinOne?"
          : `${Object.keys(imported.results).length} Module übernommen` +
              (imported.thesis !== undefined ? ", Bachelorarbeit" : "") +
              (imported.colloquium !== undefined ? ", Kolloquium" : "") +
              (imported.otherProgrammes.length ? `, ${imported.otherProgrammes.length} aus anderen Studiengängen ignoriert` : "") +
              (imported.unmatched.length ? `, ${imported.unmatched.length} bitte zuordnen` : "") +
              ".",
      );
    } catch (e) {
      setImportInfo(`Import fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
  }

  function assign(row: TranscriptRow, moduleId: string) {
    setUnmatched((u) => u.filter((r) => r !== row));
    if (!moduleId) return;
    setState((s) => ({
      ...s,
      aliases: { ...s.aliases, [normalizeName(row.name)]: moduleId },
      results: { ...s.results, [moduleId]: { grade: row.grade, recognised: row.recognised, title: row.name } },
    }));
  }

  const openSlots = curriculum.modules.filter((m) => m.kind !== "compulsory" && !isPassed(state.results[m.id]));

  return (
    <div className="page">
      <section className="stats">
        <Stat label="Aktueller Schnitt" value={fmt(summary.average)} hint={summary.average ? `Zeugnis: ${fmt(truncate1(summary.average), 1)}` : "noch keine Noten"} />
        <Stat label="Bestanden" value={`${summary.passedCount} / ${summary.moduleCount}`} hint={`${summary.weightDone} von ${summary.weightTotal} Gewichtungspunkten`} />
        <Stat label="Endnote" value={fmt(final)} hint={final ? `Zeugnis: ${fmt(truncate1(final), 1)}` : "BA + Kolloquium eintragen"} />
        <Stat
          label="ECTS-Grade"
          value={final ?? summary.average ? ectsGrade(HTW_AI_DISTRIBUTION_WS2324, (final ?? summary.average)!) : "–"}
          hint="Verteilung WS 23/24"
        />
      </section>

      <section className="card">
        <h2>Transcript importieren</h2>
        <p className="muted">
          Lade dein „Transcript of Records“ (PDF aus HISinOne) hoch. Die Datei wird nur in deinem Browser gelesen.
        </p>
        <input type="file" accept="application/pdf" disabled={importing} onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        {importing && <p className="muted">Wird gelesen …</p>}
        {importInfo && <p>{importInfo}</p>}
        {unmatched.length > 0 && (
          <table className="assign">
            <tbody>
              {unmatched.map((row, i) => (
                <tr key={i}>
                  <td>
                    {row.name} <span className="muted">({fmt(row.grade === "pass" ? undefined : row.grade, 1)}, {row.type})</span>
                  </td>
                  <td>
                    <select defaultValue="" onChange={(e) => assign(row, e.target.value)}>
                      <option value="" disabled>Zuordnen …</option>
                      {openSlots.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                      <optgroup label="Pflichtmodule">
                        {curriculum.modules.filter((m) => m.kind === "compulsory").map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </optgroup>
                    </select>
                    <button className="link" onClick={() => assign(row, "")}>ignorieren</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Abschluss & Ziel</h2>
        <div className="row">
          <GradeField label="Bachelorarbeit (15 %)" value={state.thesis} onChange={(v) => setState((s) => ({ ...s, thesis: v }))} />
          <GradeField label="Kolloquium (10 %)" value={state.colloquium} onChange={(v) => setState((s) => ({ ...s, colloquium: v }))} />
          <GradeField label="Ziel-Endnote" value={state.targetFinal} step onChange={(v) => setState((s) => ({ ...s, targetFinal: v }))} />
        </div>
        <p className="muted">
          {targetAverage === undefined
            ? "Trage BA, Kolloquium (ggf. geschätzt) und eine Ziel-Endnote ein, um zu sehen, welchen Schnitt du in den offenen Modulen brauchst."
            : needed === undefined
              ? "Alle gewichteten Module sind abgeschlossen."
              : needed < 1
                ? `Nicht mehr erreichbar – selbst mit 1,0 in allen offenen Modulen.`
                : needed > 4
                  ? `Sicher erreicht – du brauchst in den offenen Modulen nur noch bestehen.`
                  : `Du brauchst im Schnitt ${fmt(needed)} in den offenen Modulen (Modulschnitt-Ziel ${fmt(targetAverage)}).`}
        </p>
      </section>

      <section className="card">
        <h2>Module</h2>
        <div className="table-wrap">
          <table className="modules">
            <thead>
              <tr>
                <th>Modul</th>
                <th className="num">Gewicht</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {curriculum.modules.map((m) => {
                const r = state.results[m.id];
                const status = r?.grade === 5 ? "failed" : isPassed(r) ? "passed" : "";
                return (
                  <tr key={m.id} className={status}>
                    <td>
                      {m.kind === "compulsory" ? (
                        m.name
                      ) : (
                        <input
                          className="title"
                          placeholder={m.name}
                          value={r?.title ?? ""}
                          onChange={(e) => setResult(m.id, { title: e.target.value })}
                        />
                      )}
                      {r?.recognised && <span className="badge" title="Anerkannte Leistung">anerkannt</span>}
                    </td>
                    <td className="num">{m.weight || <span className="muted" title="Muss bestanden werden, zählt nicht zur Note">0</span>}</td>
                    <td>
                      <select
                        value={r?.grade === undefined ? "" : String(r.grade)}
                        onChange={(e) => {
                          const v = e.target.value;
                          setResult(m.id, { grade: v === "" ? undefined : v === "pass" ? "pass" : Number(v) });
                        }}
                      >
                        <option value="">offen</option>
                        {GRADES.map((g) => (
                          <option key={g} value={g}>{fmt(g, 1)}</option>
                        ))}
                        <option value="pass">bestanden</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

function GradeField({ label, value, onChange, step }: { label: string; value?: number; onChange: (v?: number) => void; step?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      {step ? (
        <input
          type="number"
          min={1}
          max={4}
          step={0.1}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      ) : (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}>
          <option value="">–</option>
          {GRADES.slice(0, -1).map((g) => (
            <option key={g} value={g}>{fmt(g, 1)}</option>
          ))}
        </select>
      )}
    </label>
  );
}
