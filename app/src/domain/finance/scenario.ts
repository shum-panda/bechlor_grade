import type { LegalSource, Rules } from "./rules";

// Simplified yearly model of a student's income: social insurance, income
// tax (as assessed via tax return), BAföG offset and health insurance.
// It is an orientation aid, not tax or BAföG advice.

export type JobType =
  | "minijob"
  | "werkstudent"
  | "pflichtpraktikum"
  | "freiwilligesPraktikum"
  | "regulaer"
  | "uebungsleiter"
  | "ehrenamt";

export const JOB_LABELS: Record<JobType, string> = {
  minijob: "Minijob",
  werkstudent: "Werkstudentenjob",
  pflichtpraktikum: "Pflichtpraktikum (laut Studienordnung)",
  freiwilligesPraktikum: "Freiwilliges Praktikum",
  regulaer: "Normale Beschäftigung",
  uebungsleiter: "Übungsleiter/Trainer (nebenberuflich)",
  ehrenamt: "Ehrenamt (nebenberuflich)",
};

export interface IncomeSource {
  id: string;
  type: JobType;
  monthlyGross: number;
  months: number;
  hoursPerWeek: number;
  /** Only during the lecture-free period (Werkstudent 20-h rule does not apply). */
  breakOnly?: boolean;
  /** Minijob: exempt from pension insurance on request. */
  rvExempt?: boolean;
}

export interface Profile {
  age: number;
  housing: "eltern" | "eigene";
  /** BAföG per month according to the notice, without own income. 0 = no BAföG. */
  bafoegBase: number;
  churchTax: boolean;
  hasChildren: boolean;
  /** Bachelor = first degree; Master after a Bachelor = second degree. */
  firstDegree: boolean;
  /** Tuition and other study costs per year (fees, laptop, books, travel). */
  studyCostsYear: number;
  /**
   * Part of the study costs not covered by the BAföG Bedarfssatz (e.g. tuition
   * at a private university) – basis for the Härtefreibetrag.
   */
  specialCostsYear?: number;
}

export interface Warning {
  level: "danger" | "warn" | "info";
  title: string;
  text: string;
  source?: LegalSource;
}

export interface ScenarioResult {
  grossYear: number;
  svYear: number;
  taxYear: number;
  netYear: number;
  /** Monthly averages over 12 months. */
  netMonthly: number;
  bafoegMonthly: number;
  bafoegLossMonthly: number;
  /** Extra allowance from § 23 Abs. 5 BAföG that is actually used. */
  haertefreibetragMonthly: number;
  kvMonthly: number;
  availableMonthly: number;
  kindergeldMonthly: number;
  famVersichert: boolean;
  zvE: number;
  lossCarryForward: number;
  warnings: Warning[];
}

/** How a source is treated in social insurance after applying the thresholds. */
type SvClass = "minijob" | "rvOnly" | "free" | "full" | "taxFree";

function svClass(rules: Rules, s: IncomeSource): SvClass {
  if (s.type === "uebungsleiter" || s.type === "ehrenamt") return "taxFree";
  if (s.type === "pflichtpraktikum") return "free";
  if (s.monthlyGross <= rules.sv.minijobLimit) return "minijob";
  if (s.type === "minijob") return "full"; // over the limit: no longer a minijob
  if (s.type === "regulaer") return "full";
  if (!s.breakOnly && s.hoursPerWeek > rules.sv.werkstudentMaxHours) return "full";
  return "rvOnly";
}

/** Employee contribution base in the Übergangsbereich (§ 20 Abs. 2a SGB IV). */
function midijobBase(rules: Rules, gross: number): number {
  const { minijobLimit: g, midijobUpper: o } = rules.sv;
  if (gross > o) return gross;
  return (o / (o - g)) * (gross - g);
}

function employeeSv(rules: Rules, s: IncomeSource, cls: SvClass, profile: Profile): { total: number; rv: number; kvpv: number } {
  const m = s.monthlyGross;
  const sv = rules.sv;
  if (cls === "minijob") {
    const rv = s.rvExempt ? 0 : m * sv.minijobRvEmployee;
    return { total: rv, rv, kvpv: 0 };
  }
  if (cls === "rvOnly") {
    const rv = midijobBase(rules, m) * (sv.rv / 2);
    return { total: rv, rv, kvpv: 0 };
  }
  if (cls === "full") {
    const base = midijobBase(rules, m);
    const rv = base * (sv.rv / 2);
    const av = base * (sv.av / 2);
    const childless = !profile.hasChildren && profile.age >= 23 ? sv.pvChildless : 0;
    const kvpv = base * ((sv.kv + sv.kvZusatzAvg) / 2 + sv.pv / 2 + childless);
    return { total: rv + av + kvpv, rv, kvpv };
  }
  return { total: 0, rv: 0, kvpv: 0 };
}

export function kvdsMonthly(rules: Rules, profile: Profile): number {
  const sv = rules.sv;
  const childless = !profile.hasChildren && profile.age >= 23 ? sv.pvChildless : 0;
  // Students pay 7/10 of the general rate plus the full average Zusatzbeitrag.
  return sv.kvdsBase * (sv.kv * 0.7 + sv.kvZusatzAvg + sv.pv + childless);
}

export function bafoegMax(rules: Rules, housing: Profile["housing"], ownKv: boolean): number {
  const b = rules.bafoeg;
  return b.grundbedarf + (housing === "eigene" ? b.wohnenEigene : b.wohnenEltern) + (ownKv ? b.kvZuschlag + b.pvZuschlag : 0);
}

export function calculate(rules: Rules, profile: Profile, sources: IncomeSource[]): ScenarioResult {
  const warnings: Warning[] = [];
  const src = rules.sources;

  let grossYear = 0;
  let svYear = 0;
  let deductibleSv = 0;
  let arbeitslohn = 0; // taxable wages (excl. minijob and tax-free pauschalen)
  let bafoegRegularGross = 0; // counted with allowance
  let bafoegVerguetungGross = 0; // § 23 Abs. 3: counted in full
  let uebungsleiter = 0;
  let ehrenamt = 0;
  let anyRvPflichtig = false;
  let anyNonRvEmployee = false;
  let hasFullSv = false;
  let onlyMinijob = sources.length > 0;

  for (const s of sources) {
    if (s.monthlyGross <= 0 || s.months <= 0) continue;
    const cls = svClass(rules, s);
    const gross = s.monthlyGross * s.months;
    const sv = employeeSv(rules, s, cls, profile);
    grossYear += gross;
    svYear += sv.total * s.months;
    deductibleSv += (sv.rv + sv.kvpv) * s.months;

    if (cls === "taxFree") {
      if (s.type === "uebungsleiter") uebungsleiter += gross;
      else ehrenamt += gross;
      continue;
    }
    if (cls !== "minijob") onlyMinijob = false;
    if (cls === "full") hasFullSv = true;
    if (cls === "minijob" ? !s.rvExempt : cls !== "free") anyRvPflichtig = true;
    if (cls === "free") anyNonRvEmployee = true;
    if (cls !== "minijob") arbeitslohn += gross;
    if (s.type === "pflichtpraktikum") bafoegVerguetungGross += gross;
    else bafoegRegularGross += gross;

    // --- source-specific warnings ---
    if (s.type === "minijob" && s.monthlyGross > rules.sv.minijobLimit) {
      warnings.push({
        level: "danger",
        title: "Kein Minijob mehr",
        text: `Über ${rules.sv.minijobLimit} € im Monat ist es kein Minijob mehr. Es fallen Sozialabgaben an, und der Lohn wird normal versteuert.`,
        source: src.minijob,
      });
    }
    if ((s.type === "werkstudent" || s.type === "freiwilligesPraktikum") && cls === "full") {
      warnings.push({
        level: "danger",
        title: "Werkstudentenprivileg verloren",
        text: `Mehr als ${rules.sv.werkstudentMaxHours} Std./Woche in der Vorlesungszeit: Du zahlst volle Sozialabgaben (Kranken-, Pflege- und Arbeitslosenversicherung) und giltst sozialversicherungsrechtlich nicht mehr als Student.`,
        source: src.sgb5_6,
      });
    }
    if (s.type === "werkstudent" && cls === "minijob") {
      warnings.push({
        level: "info",
        title: "Wird als Minijob behandelt",
        text: `Bis ${rules.sv.minijobLimit} €/Monat gilt auch ein Werkstudentenjob als Minijob.`,
        source: src.minijob,
      });
    }
    if (s.type === "pflichtpraktikum" && profile.bafoegBase > 0) {
      warnings.push({
        level: "danger",
        title: "Praktikumsvergütung wird voll aufs BAföG angerechnet",
        text: "Die Vergütung aus einem Pflichtpraktikum zählt als Ausbildungsvergütung. Dafür gibt es keinen Freibetrag, jeder Euro (nach Pauschalen) kürzt dein BAföG. Ein Werkstudentenjob oder Minijob hat dagegen 389 €/Monat Freibetrag.",
        source: src.bafoeg23,
      });
    }
  }

  // --- tax-free pauschalen; excess is taxed like wages ---
  const ulExcess = Math.max(0, uebungsleiter - rules.tax.uebungsleiterPauschale);
  const eaExcess = Math.max(0, ehrenamt - rules.tax.ehrenamtsPauschale);
  if (ulExcess > 0 || eaExcess > 0) {
    warnings.push({
      level: "warn",
      title: "Pauschale überschritten",
      text: `Übungsleiter bis ${rules.tax.uebungsleiterPauschale} €/Jahr und Ehrenamt bis ${rules.tax.ehrenamtsPauschale} €/Jahr sind steuer- und abgabenfrei. Der Rest (${Math.round(ulExcess + eaExcess)} €) wird versteuert und beim BAföG angerechnet.`,
      source: src.estg3,
    });
  }
  arbeitslohn += ulExcess + eaExcess;
  bafoegRegularGross += ulExcess + eaExcess;
  if (uebungsleiter + ehrenamt > 0 && profile.bafoegBase > 0) {
    warnings.push({
      level: "info",
      title: "Übungsleiter-/Ehrenamtspauschale und BAföG",
      text: "Steuerfreie Einnahmen nach § 3 Nr. 26/26a EStG sind keine „positiven Einkünfte“ im Sinne von § 21 BAföG und werden hier nicht angerechnet. Lass dir das vom BAföG-Amt bestätigen.",
      source: src.bafoeg21,
    });
  }

  // --- health insurance ---
  const minijobGross = sources.filter((s) => svClass(rules, s) === "minijob").reduce((a, s) => a + s.monthlyGross * s.months, 0);
  const einkuenfteMonthly = Math.max(0, arbeitslohn + minijobGross - rules.tax.arbeitnehmerPauschbetrag) / 12;
  const famLimit = onlyMinijob ? rules.sv.minijobLimit : rules.sv.famVersicherungLimit;
  const famIncome = onlyMinijob ? minijobGross / 12 : einkuenfteMonthly;
  const ageOk = profile.age < rules.sv.famVersicherungMaxAge;
  const famVersichert = ageOk && !hasFullSv && famIncome <= famLimit;
  const kvMonthly = famVersichert || hasFullSv ? 0 : kvdsMonthly(rules, profile);
  if (ageOk && !famVersichert && !hasFullSv) {
    warnings.push({
      level: "warn",
      title: "Familienversicherung endet",
      text: `Mit ${Math.round(famIncome)} €/Monat liegst du über der Grenze von ${famLimit} €. Du musst dich selbst studentisch versichern (ca. ${Math.round(kvMonthly)} €/Monat).` +
        (profile.bafoegBase > 0 ? ` Mit BAföG bekommst du dafür ${rules.bafoeg.kvZuschlag + rules.bafoeg.pvZuschlag} € Zuschlag – beim Amt melden!` : ""),
      source: src.sgb5_10,
    });
  }

  // --- income tax (assessment via tax return) ---
  let werbungskosten = arbeitslohn > 0 ? rules.tax.arbeitnehmerPauschbetrag : 0;
  if (!profile.firstDegree) werbungskosten = Math.max(werbungskosten, profile.studyCostsYear);
  const einkuenfte = arbeitslohn - werbungskosten;
  const lossCarryForward = einkuenfte < 0 ? -einkuenfte : 0;
  const ownKvYear = kvMonthly * 12;
  const sonderausgaben =
    rules.tax.sonderausgabenPauschbetrag + deductibleSv + ownKvYear + (profile.firstDegree ? Math.min(rules.tax.erststudiumMax, profile.studyCostsYear) : 0);
  const zvE = Math.max(0, einkuenfte - sonderausgaben);
  const incomeTax = rules.tax.incomeTax(zvE);
  const taxYear = incomeTax * (1 + (profile.churchTax ? rules.tax.churchTaxRate : 0));

  if (arbeitslohn > 0 && taxYear === 0 && arbeitslohn / 12 > 1100) {
    warnings.push({
      level: "info",
      title: "Steuererklärung lohnt sich",
      text: "Bei deinem Monatslohn wird wahrscheinlich Lohnsteuer einbehalten, obwohl übers Jahr gerechnet keine Steuer anfällt. Mit einer Steuererklärung bekommst du sie zurück.",
      source: src.estg32a,
    });
  }
  if (profile.studyCostsYear > 0) {
    warnings.push(
      profile.firstDegree
        ? {
            level: "info",
            title: "Studienkosten im Erststudium",
            text: `Kosten des Erststudiums sind nur als Sonderausgaben bis ${rules.tax.erststudiumMax} €/Jahr absetzbar und wirken nur, wenn du im selben Jahr steuerpflichtiges Einkommen hast. Ein Verlustvortrag ist nicht möglich.`,
            source: src.estg10,
          }
        : {
            level: "info",
            title: "Studienkosten im Zweitstudium (Master)",
            text: "Kosten eines Zweitstudiums sind unbegrenzt als Werbungskosten absetzbar. Auch ohne Einkommen lohnt sich die Steuererklärung, denn Verluste werden vorgetragen und senken später deine Steuer im ersten Job" +
              (lossCarryForward > 0 ? ` (dieses Jahr ca. ${Math.round(lossCarryForward)} € Verlustvortrag).` : "."),
            source: src.estg9,
          },
    );
  }

  // --- BAföG offset (§§ 21–23 BAföG), averaged over a 12-month Bewilligungszeitraum ---
  const bafoegGross = bafoegRegularGross + bafoegVerguetungGross;
  const wk = Math.min(rules.tax.arbeitnehmerPauschbetrag, bafoegGross);
  const bafoegEinkuenfte = bafoegGross - wk;
  const p = anyRvPflichtig ? rules.bafoeg.pauschaleRvPflichtig : anyNonRvEmployee ? rules.bafoeg.pauschaleNichtRv : rules.bafoeg.pauschaleSonstige;
  const pauschale = Math.min(p.rate * bafoegEinkuenfte, p.cap);
  const anrechenbar = Math.max(0, bafoegEinkuenfte - pauschale - taxYear) / 12;
  const verguetungShare = bafoegGross > 0 ? bafoegVerguetungGross / bafoegGross : 0;
  const regular = anrechenbar * (1 - verguetungShare);
  // Härtefreibetrag: only for income counted with allowances (Abs. 5 deviates from Abs. 1, not from the full offset in Abs. 3).
  const haerteMax = Math.min(rules.bafoeg.haertefreibetragMax, (profile.specialCostsYear ?? 0) / 12);
  const haertefreibetragMonthly = Math.min(haerteMax, Math.max(0, regular - rules.bafoeg.freibetragSelbst));
  const anrechnung =
    Math.max(0, regular - rules.bafoeg.freibetragSelbst - haertefreibetragMonthly) + anrechenbar * verguetungShare;

  const kvAdd = profile.bafoegBase > 0 && ageOk && !famVersichert && !hasFullSv ? rules.bafoeg.kvZuschlag + rules.bafoeg.pvZuschlag : 0;
  let bafoegMonthly = Math.max(0, profile.bafoegBase + kvAdd - anrechnung);
  if (bafoegMonthly < rules.bafoeg.minPayout) bafoegMonthly = 0;
  const bafoegLossMonthly = Math.max(0, profile.bafoegBase + kvAdd - bafoegMonthly);

  if (profile.bafoegBase > 0 && profile.bafoegBase + kvAdd - bafoegMonthly > 0 && !sources.some((s) => s.type === "pflichtpraktikum")) {
    warnings.push({
      level: "warn",
      title: "Dein BAföG wird gekürzt",
      text: `Dein anrechenbares Einkommen liegt über dem Freibetrag von ${rules.bafoeg.freibetragSelbst} €/Monat. Dein BAföG sinkt um ca. ${Math.round(profile.bafoegBase + kvAdd - bafoegMonthly)} €/Monat.`,
      source: src.bafoeg23,
    });
  }

  if (profile.bafoegBase > 0 && haerteMax > 0) {
    warnings.push(
      haertefreibetragMonthly > 0
        ? {
            level: "warn",
            title: "Härtefreibetrag beantragen",
            text: `Deine besonderen Ausbildungskosten können zusätzlich ${Math.round(haertefreibetragMonthly)} €/Monat deines Einkommens anrechnungsfrei stellen (max. ${rules.bafoeg.haertefreibetragMax} €). Das gibt es nur auf Antrag vor Ende des Bewilligungszeitraums, mit Kostennachweisen. Das Amt entscheidet nach Ermessen und kann auf ein zumutbares Studiendarlehen verweisen.`,
            source: rules.sources.bafoeg23_5,
          }
        : {
            level: "info",
            title: "Härtefreibetrag möglich",
            text: `Mit deinen besonderen Ausbildungskosten könntest du bis zu ${Math.round(haerteMax)} €/Monat zusätzlich verdienen, ohne dass dein BAföG sinkt (Antrag nach § 23 Abs. 5 nötig).`,
            source: rules.sources.bafoeg23_5,
          },
    );
  }

  const kindergeldMonthly = profile.age < rules.kindergeldMaxAge ? rules.kindergeld : 0;
  const netYear = grossYear - svYear - taxYear;
  const netMonthly = netYear / 12;

  return {
    grossYear,
    svYear,
    taxYear,
    netYear,
    netMonthly,
    bafoegMonthly,
    bafoegLossMonthly,
    haertefreibetragMonthly,
    kvMonthly,
    availableMonthly: netMonthly + bafoegMonthly - kvMonthly,
    kindergeldMonthly,
    famVersichert,
    zvE,
    lossCarryForward,
    warnings,
  };
}

/**
 * Highest monthly gross of one source at which BAföG is not reduced, keeping
 * all other sources fixed. Undefined if there is no BAföG to protect.
 */
export function bafoegSafeGross(rules: Rules, profile: Profile, sources: IncomeSource[], sourceId: string): number | undefined {
  if (profile.bafoegBase <= 0) return undefined;
  const at = (gross: number) => calculate(rules, profile, sources.map((s) => (s.id === sourceId ? { ...s, monthlyGross: gross } : s)));
  const reference = at(0);
  if (reference.bafoegLossMonthly > 0.5) return 0;
  let lo = 0;
  let hi = 6000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid).bafoegLossMonthly - reference.bafoegLossMonthly <= 0.5) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}

/** Of 100 € additional gross on a source, how much remains available per month. */
export function marginalKeep(rules: Rules, profile: Profile, sources: IncomeSource[], sourceId: string): number {
  const now = calculate(rules, profile, sources).availableMonthly;
  const more = calculate(rules, profile, sources.map((s) => (s.id === sourceId ? { ...s, monthlyGross: s.monthlyGross + 100 } : s))).availableMonthly;
  const months = sources.find((s) => s.id === sourceId)?.months ?? 12;
  // 100 € more per working month = 100 × months / 12 per average month.
  return (more - now) / ((100 * months) / 12);
}
