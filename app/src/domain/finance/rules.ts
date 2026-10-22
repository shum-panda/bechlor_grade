// Legal values for one calendar year. Everything that changes yearly lives
// here, never in the calculation code. Update by adding RULES_2027 etc.

export interface LegalSource {
  label: string;
  url: string;
}

export interface Rules {
  year: number;
  tax: {
    grundfreibetrag: number;
    /** Einkommensteuer for a given zu versteuerndes Einkommen (§ 32a EStG). */
    incomeTax: (zvE: number) => number;
    arbeitnehmerPauschbetrag: number;
    sonderausgabenPauschbetrag: number;
    /** § 10 Abs. 1 Nr. 7 EStG – costs of a first degree, no loss carry-forward. */
    erststudiumMax: number;
    churchTaxRate: number;
    uebungsleiterPauschale: number;
    ehrenamtsPauschale: number;
  };
  sv: {
    minijobLimit: number;
    /** Upper end of the Übergangsbereich (Midijob). */
    midijobUpper: number;
    rv: number;
    av: number;
    kv: number;
    kvZusatzAvg: number;
    pv: number;
    pvChildless: number;
    minijobRvEmployee: number;
    werkstudentMaxHours: number;
    famVersicherungLimit: number;
    famVersicherungMaxAge: number;
    /** Base for the student health insurance contribution (BAföG-Bedarf). */
    kvdsBase: number;
  };
  bafoeg: {
    grundbedarf: number;
    wohnenEltern: number;
    wohnenEigene: number;
    kvZuschlag: number;
    pvZuschlag: number;
    /** § 23 Abs. 1 Nr. 1 BAföG – allowance on own income per month. */
    freibetragSelbst: number;
    /** § 21 Abs. 2 BAföG – Sozialpauschalen. */
    pauschaleRvPflichtig: { rate: number; cap: number };
    pauschaleNichtRv: { rate: number; cap: number };
    pauschaleSonstige: { rate: number; cap: number };
    minPayout: number;
  };
  kindergeld: number;
  kindergeldMaxAge: number;
  sources: Record<string, LegalSource>;
}

function incomeTax2026(zvE: number): number {
  const x = Math.floor(Math.max(0, zvE));
  if (x <= 12348) return 0;
  if (x <= 17799) {
    const y = (x - 12348) / 10000;
    return Math.floor((914.51 * y + 1400) * y);
  }
  if (x <= 69878) {
    const z = (x - 17799) / 10000;
    return Math.floor((173.1 * z + 2397) * z + 1034.87);
  }
  if (x <= 277825) return Math.floor(0.42 * x - 11135.63);
  return Math.floor(0.45 * x - 19470.38);
}

export const RULES_2026: Rules = {
  year: 2026,
  tax: {
    grundfreibetrag: 12348,
    incomeTax: incomeTax2026,
    arbeitnehmerPauschbetrag: 1230,
    sonderausgabenPauschbetrag: 36,
    erststudiumMax: 6000,
    churchTaxRate: 0.09,
    uebungsleiterPauschale: 3300,
    ehrenamtsPauschale: 960,
  },
  sv: {
    minijobLimit: 603,
    midijobUpper: 2000,
    rv: 0.186,
    av: 0.026,
    kv: 0.146,
    kvZusatzAvg: 0.029,
    pv: 0.036,
    pvChildless: 0.006,
    minijobRvEmployee: 0.036,
    werkstudentMaxHours: 20,
    famVersicherungLimit: 565,
    famVersicherungMaxAge: 25,
    kvdsBase: 855,
  },
  bafoeg: {
    grundbedarf: 475,
    wohnenEltern: 59,
    wohnenEigene: 380,
    kvZuschlag: 102,
    pvZuschlag: 35,
    // (603 − 1230/12) × (1 − 22,3 %) = 388,9 → aufgerundet, § 23 Abs. 6 BAföG
    freibetragSelbst: 389,
    pauschaleRvPflichtig: { rate: 0.223, cap: 17200 },
    pauschaleNichtRv: { rate: 0.165, cap: 10200 },
    pauschaleSonstige: { rate: 0.388, cap: 29500 },
    minPayout: 10,
  },
  kindergeld: 259,
  kindergeldMaxAge: 25,
  sources: {
    bafoeg21: { label: "§ 21 BAföG (Einkommensbegriff, Sozialpauschalen)", url: "https://www.gesetze-im-internet.de/baf_g/__21.html" },
    bafoeg23: { label: "§ 23 BAföG (Freibeträge, Vollanrechnung Ausbildungsvergütung)", url: "https://www.gesetze-im-internet.de/baf_g/__23.html" },
    bafoeg13: { label: "§ 13 BAföG (Bedarfssätze)", url: "https://www.gesetze-im-internet.de/baf_g/__13.html" },
    estg32a: { label: "§ 32a EStG (Einkommensteuertarif)", url: "https://www.gesetze-im-internet.de/estg/__32a.html" },
    estg3: { label: "§ 3 Nr. 26/26a EStG (Übungsleiter-/Ehrenamtspauschale)", url: "https://www.gesetze-im-internet.de/estg/__3.html" },
    estg10: { label: "§ 10 Abs. 1 Nr. 7 EStG (Erststudium als Sonderausgaben)", url: "https://www.gesetze-im-internet.de/estg/__10.html" },
    estg9: { label: "§ 9 Abs. 6 EStG (Zweitstudium als Werbungskosten)", url: "https://www.gesetze-im-internet.de/estg/__9.html" },
    estg32: { label: "§ 32 Abs. 4 EStG (Kindergeld für Kinder in Ausbildung)", url: "https://www.gesetze-im-internet.de/estg/__32.html" },
    sgb5_6: { label: "§ 6 Abs. 1 Nr. 3 SGB V (Werkstudentenprivileg)", url: "https://www.gesetze-im-internet.de/sgb_5/__6.html" },
    sgb5_10: { label: "§ 10 SGB V (Familienversicherung)", url: "https://www.gesetze-im-internet.de/sgb_5/__10.html" },
    sgb4_20: { label: "§ 20 Abs. 2 SGB IV (Übergangsbereich)", url: "https://www.gesetze-im-internet.de/sgb_4/__20.html" },
    minijob: { label: "Minijob-Zentrale", url: "https://www.minijob-zentrale.de" },
  },
};
