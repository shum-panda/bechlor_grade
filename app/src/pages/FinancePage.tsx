import type { Dispatch, SetStateAction } from "react";
import { RULES_2026 as rules } from "../domain/finance/rules";
import {
  JOB_LABELS,
  bafoegMax,
  bafoegSafeGross,
  calculate,
  marginalKeep,
  type IncomeSource,
  type JobType,
  type Profile,
} from "../domain/finance/scenario";
import type { AppState, Scenario } from "../storage";

const eur = (x: number) => `${Math.round(x).toLocaleString("de-DE")} €`;
const minus = (x: number) => (Math.round(x) > 0 ? `−${eur(x)}` : eur(0));
const newId = () => Math.random().toString(36).slice(2, 9);

interface Props {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
}

export function FinancePage({ state, setState }: Props) {
  const { profile, scenarios } = state.finance;

  const setProfile = (patch: Partial<Profile>) =>
    setState((s) => ({ ...s, finance: { ...s.finance, profile: { ...s.finance.profile, ...patch } } }));
  const setScenarios = (fn: (list: Scenario[]) => Scenario[]) =>
    setState((s) => ({ ...s, finance: { ...s.finance, scenarios: fn(s.finance.scenarios) } }));
  const updateScenario = (id: string, fn: (sc: Scenario) => Scenario) => setScenarios((list) => list.map((sc) => (sc.id === id ? fn(sc) : sc)));

  return (
    <div className="page">
      <section className="card">
        <h2>Deine Situation</h2>
        <div className="row">
          <label className="field">
            <span>Alter</span>
            <input type="number" min={16} max={60} value={profile.age} onChange={(e) => setProfile({ age: Number(e.target.value) })} />
          </label>
          <label className="field">
            <span>Wohnen</span>
            <select value={profile.housing} onChange={(e) => setProfile({ housing: e.target.value as Profile["housing"] })}>
              <option value="eigene">Eigene Wohnung / WG</option>
              <option value="eltern">Bei den Eltern</option>
            </select>
          </label>
          <label className="field">
            <span>BAföG laut Bescheid (€/Monat)</span>
            <input type="number" min={0} value={profile.bafoegBase} onChange={(e) => setProfile({ bafoegBase: Number(e.target.value) })} />
            <button className="link" onClick={() => setProfile({ bafoegBase: bafoegMax(rules, profile.housing, false) })}>
              Höchstsatz ({bafoegMax(rules, profile.housing, false)} €) einsetzen
            </button>
          </label>
          <label className="field">
            <span>Studium</span>
            <select value={profile.firstDegree ? "erst" : "zweit"} onChange={(e) => setProfile({ firstDegree: e.target.value === "erst" })}>
              <option value="erst">Erststudium (Bachelor)</option>
              <option value="zweit">Zweitstudium (Master nach Bachelor)</option>
            </select>
          </label>
          <label className="field">
            <span>Studienkosten (€/Jahr)</span>
            <input type="number" min={0} value={profile.studyCostsYear} onChange={(e) => setProfile({ studyCostsYear: Number(e.target.value) })} />
          </label>
        </div>
        <div className="row checks">
          <label><input type="checkbox" checked={profile.hasChildren} onChange={(e) => setProfile({ hasChildren: e.target.checked })} /> Ich habe Kinder</label>
          <label><input type="checkbox" checked={profile.churchTax} onChange={(e) => setProfile({ churchTax: e.target.checked })} /> Kirchensteuerpflichtig</label>
        </div>
        <p className="muted">
          BAföG: Trag den Betrag ein, den du ohne eigenes Einkommen bekommst. Ohne Krankenversicherungszuschlag, denn den rechnet die App selbst
          dazu, wenn deine Familienversicherung wegfällt.
        </p>
      </section>

      <div className="scenarios">
        {scenarios.map((sc) => (
          <ScenarioCard
            key={sc.id}
            scenario={sc}
            profile={profile}
            onChange={(fn) => updateScenario(sc.id, fn)}
            onDuplicate={() => setScenarios((list) => [...list, { ...sc, id: newId(), name: `${sc.name} (Kopie)`, sources: sc.sources.map((s) => ({ ...s, id: newId() })) }])}
            onRemove={scenarios.length > 1 ? () => setScenarios((list) => list.filter((x) => x.id !== sc.id)) : undefined}
          />
        ))}
      </div>
      <button className="secondary" onClick={() => setScenarios((list) => [...list, { id: newId(), name: `Szenario ${String.fromCharCode(65 + list.length)}`, sources: [] }])}>
        + Szenario vergleichen
      </button>

      <p className="muted small">
        Rechtsstand {rules.year}. Vereinfachte Jahresrechnung: Steuer wie nach Steuererklärung, BAföG-Anrechnung gemittelt über 12 Monate, Krankenkasse mit
        durchschnittlichem Zusatzbeitrag. Keine Steuer- oder BAföG-Beratung. Verbindlich ist dein Bescheid.
      </p>
    </div>
  );
}

function ScenarioCard({
  scenario,
  profile,
  onChange,
  onDuplicate,
  onRemove,
}: {
  scenario: Scenario;
  profile: Profile;
  onChange: (fn: (sc: Scenario) => Scenario) => void;
  onDuplicate: () => void;
  onRemove?: () => void;
}) {
  const r = calculate(rules, profile, scenario.sources);
  const setSource = (id: string, patch: Partial<IncomeSource>) =>
    onChange((sc) => ({ ...sc, sources: sc.sources.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  return (
    <section className="card scenario">
      <div className="scenario-head">
        <input className="title" value={scenario.name} onChange={(e) => onChange((sc) => ({ ...sc, name: e.target.value }))} />
        <button className="link" onClick={onDuplicate}>duplizieren</button>
        {onRemove && <button className="link" onClick={onRemove}>entfernen</button>}
      </div>

      {scenario.sources.map((s) => {
        const safe = bafoegSafeGross(rules, profile, scenario.sources, s.id);
        const keep = s.monthlyGross > 0 ? marginalKeep(rules, profile, scenario.sources, s.id) : undefined;
        const showHours = s.type !== "uebungsleiter" && s.type !== "ehrenamt";
        return (
          <div key={s.id} className="source">
            <select value={s.type} onChange={(e) => setSource(s.id, { type: e.target.value as JobType })}>
              {Object.entries(JOB_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <div className="row">
              <label className="field">
                <span>Brutto €/Monat</span>
                <input type="number" min={0} value={s.monthlyGross} onChange={(e) => setSource(s.id, { monthlyGross: Number(e.target.value) })} />
              </label>
              <label className="field">
                <span>Monate im Jahr</span>
                <input type="number" min={1} max={12} value={s.months} onChange={(e) => setSource(s.id, { months: Number(e.target.value) })} />
              </label>
              {showHours && (
                <label className="field">
                  <span>Std./Woche</span>
                  <input type="number" min={0} max={60} value={s.hoursPerWeek} onChange={(e) => setSource(s.id, { hoursPerWeek: Number(e.target.value) })} />
                </label>
              )}
            </div>
            <div className="row checks">
              {(s.type === "werkstudent" || s.type === "freiwilligesPraktikum") && (
                <label><input type="checkbox" checked={!!s.breakOnly} onChange={(e) => setSource(s.id, { breakOnly: e.target.checked })} /> nur in den Semesterferien</label>
              )}
              {s.type === "minijob" && (
                <label><input type="checkbox" checked={!!s.rvExempt} onChange={(e) => setSource(s.id, { rvExempt: e.target.checked })} /> von Rentenversicherung befreit</label>
              )}
              <button className="link" onClick={() => onChange((sc) => ({ ...sc, sources: sc.sources.filter((x) => x.id !== s.id) }))}>entfernen</button>
            </div>
            {(safe !== undefined || keep !== undefined) && (
              <p className="hint">
                {safe !== undefined && <>BAföG bleibt unverändert bis <strong>{eur(safe)}</strong> brutto/Monat. </>}
                {keep !== undefined && <>Von 100 € mehr brutto bleiben dir ca. <strong>{eur(keep * 100)}</strong>.</>}
              </p>
            )}
          </div>
        );
      })}
      <button
        className="secondary"
        onClick={() =>
          onChange((sc) => ({ ...sc, sources: [...sc.sources, { id: newId(), type: "werkstudent", monthlyGross: 600, months: 12, hoursPerWeek: 10 }] }))
        }
      >
        + Einkommen
      </button>

      <table className="result">
        <tbody>
          <tr><td>Brutto (Ø Monat)</td><td className="num">{eur(r.grossYear / 12)}</td></tr>
          <tr><td>Sozialabgaben</td><td className="num">{minus(r.svYear / 12)}</td></tr>
          <tr><td>Steuern</td><td className="num">{minus(r.taxYear / 12)}</td></tr>
          <tr><td>Netto</td><td className="num">{eur(r.netMonthly)}</td></tr>
          <tr><td>BAföG{r.bafoegLossMonthly > 0 ? ` (−${eur(r.bafoegLossMonthly)})` : ""}</td><td className="num">+{eur(r.bafoegMonthly)}</td></tr>
          <tr><td>Krankenversicherung {r.famVersichert ? "(familienversichert)" : ""}</td><td className="num">{minus(r.kvMonthly)}</td></tr>
          <tr className="total"><td>Verfügbar pro Monat</td><td className="num">{eur(r.availableMonthly)}</td></tr>
          {r.kindergeldMonthly > 0 && (
            <tr><td className="muted">+ Kindergeld (geht an deine Eltern)</td><td className="num muted">{eur(r.kindergeldMonthly)}</td></tr>
          )}
        </tbody>
      </table>

      {r.warnings.length > 0 && (
        <ul className="warnings">
          {r.warnings.map((w, i) => (
            <li key={i} className={w.level}>
              <strong>{w.title}</strong>
              <span>{w.text}</span>
              {w.source && <a href={w.source.url} target="_blank" rel="noreferrer">{w.source.label}</a>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
