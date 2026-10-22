import { useEffect, useState } from "react";
import { GradesPage } from "./pages/GradesPage";
import { loadState, saveState, type AppState } from "./storage";

type Tab = "grades" | "finance" | "organisation";

const TABS: { id: Tab; label: string; ready: boolean }[] = [
  { id: "grades", label: "Noten", ready: true },
  { id: "finance", label: "Finanzen", ready: false },
  { id: "organisation", label: "Organisation", ready: false },
];

export function App() {
  const [tab, setTab] = useState<Tab>("grades");
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => saveState(state), [state]);

  return (
    <div className="shell">
      <header className="topbar">
        <strong className="brand">Studi-Planer</strong>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "tab active" : "tab"}
              disabled={!t.ready}
              onClick={() => setTab(t.id)}
              title={t.ready ? undefined : "Kommt bald"}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>{tab === "grades" && <GradesPage state={state} setState={setState} />}</main>
      <footer className="footer">
        Alle Daten bleiben lokal in deinem Browser. Ohne Gewähr – maßgeblich ist die Studien- und Prüfungsordnung.
      </footer>
    </div>
  );
}
