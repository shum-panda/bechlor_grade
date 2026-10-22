import type { Curriculum } from "./curriculum";

/**
 * Result of one module. `grade` is the German grade (1.0–5.0) or "pass" for
 * ungraded modules; undefined = not taken yet.
 */
export interface ModuleResult {
  grade?: number | "pass";
  /** Display name, e.g. the chosen elective's title. */
  title?: string;
  recognised?: boolean;
}

export type Results = Record<string, ModuleResult>;

export const FAILED = 5.0;

export function isPassed(r: ModuleResult | undefined): boolean {
  return r?.grade === "pass" || (typeof r?.grade === "number" && r.grade < FAILED);
}

export interface GradeSummary {
  /** Weighted average over graded modules, undefined if nothing graded yet. */
  average?: number;
  weightDone: number;
  weightTotal: number;
  passedCount: number;
  moduleCount: number;
  failedCount: number;
}

export function summarize(curriculum: Curriculum, results: Results): GradeSummary {
  let sum = 0;
  let weightDone = 0;
  let weightTotal = 0;
  let passedCount = 0;
  let failedCount = 0;
  for (const mod of curriculum.modules) {
    weightTotal += mod.weight;
    const r = results[mod.id];
    if (r?.grade === FAILED) failedCount++;
    if (!isPassed(r)) continue;
    passedCount++;
    if (typeof r!.grade === "number" && mod.weight > 0) {
      sum += r!.grade * mod.weight;
      weightDone += mod.weight;
    }
  }
  return {
    average: weightDone > 0 ? sum / weightDone : undefined,
    weightDone,
    weightTotal,
    passedCount,
    moduleCount: curriculum.modules.length,
    failedCount,
  };
}

export function finalGrade(curriculum: Curriculum, average: number, thesis: number, colloquium: number): number {
  const f = curriculum.finalGrade;
  return average * f.modules + thesis * f.thesis + colloquium * f.colloquium;
}

/**
 * Average needed in all still-open weighted modules to reach `targetAverage`.
 * Returns undefined when nothing is left to influence the result.
 */
export function requiredAverage(summary: GradeSummary, targetAverage: number): number | undefined {
  const remaining = summary.weightTotal - summary.weightDone;
  if (remaining <= 0) return undefined;
  const current = (summary.average ?? 0) * summary.weightDone;
  return (targetAverage * summary.weightTotal - current) / remaining;
}

/** German grades are cut (not rounded) after the first decimal. */
export function truncate1(x: number): number {
  return Math.floor(x * 10 + 1e-9) / 10;
}

export type EctsGrade = "A" | "B" | "C" | "D" | "E";

/**
 * Relative ECTS grade from the programme's grade distribution: A = best 10 %,
 * B = next 25 %, C = next 30 %, D = next 25 %, E = last 10 %.
 */
export function ectsGrade(distribution: Record<string, number>, grade: number): EctsGrade {
  const g = truncate1(grade);
  let cumulative = 0;
  for (const [key, pct] of Object.entries(distribution)) {
    if (Number(key) > g) break;
    cumulative += pct;
  }
  if (cumulative < 10) return "A";
  if (cumulative < 35) return "B";
  if (cumulative < 65) return "C";
  if (cumulative < 90) return "D";
  return "E";
}
