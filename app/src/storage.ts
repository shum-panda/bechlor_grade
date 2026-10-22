import type { Results } from "./domain/grades";

// Local-first: everything stays in this browser. Swappable for sync later.

export interface AppState {
  results: Results;
  thesis?: number;
  colloquium?: number;
  targetFinal?: number;
  /** normalized transcript name -> module id (user assignments). */
  aliases: Record<string, string>;
}

const KEY = "studi-planer:v1";

export const emptyState: AppState = { results: {}, aliases: {} };

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...emptyState, ...JSON.parse(raw) } : emptyState;
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
