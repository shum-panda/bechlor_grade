import type { IncomeSource, Profile } from "./domain/finance/scenario";
import type { Results } from "./domain/grades";

// Local-first: everything stays in this browser. Swappable for sync later.

export interface Scenario {
  id: string;
  name: string;
  sources: IncomeSource[];
}

export interface AppState {
  results: Results;
  thesis?: number;
  colloquium?: number;
  targetFinal?: number;
  /** normalized transcript name -> module id (user assignments). */
  aliases: Record<string, string>;
  finance: { profile: Profile; scenarios: Scenario[] };
}

const KEY = "studi-planer:v1";

export const emptyState: AppState = {
  results: {},
  aliases: {},
  finance: {
    profile: { age: 22, housing: "eigene", bafoegBase: 0, churchTax: false, hasChildren: false, firstDegree: true, studyCostsYear: 0 },
    scenarios: [
      { id: "a", name: "Werkstudent", sources: [{ id: "a1", type: "werkstudent", monthlyGross: 1000, months: 12, hoursPerWeek: 20 }] },
      { id: "b", name: "Pflichtpraktikum", sources: [{ id: "b1", type: "pflichtpraktikum", monthlyGross: 1000, months: 6, hoursPerWeek: 40 }] },
    ],
  },
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState;
    const saved = JSON.parse(raw);
    return { ...emptyState, ...saved, finance: { ...emptyState.finance, ...saved.finance } };
  } catch {
    return emptyState;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode etc.) – app still works for this session.
  }
}
