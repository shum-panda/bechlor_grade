import { describe, expect, it } from "vitest";
import { RULES_2026 as R } from "./rules";
import { bafoegSafeGross, calculate, kvdsMonthly, type IncomeSource, type Profile } from "./scenario";

const profile: Profile = { age: 24, housing: "eigene", bafoegBase: 0, churchTax: false, hasChildren: false, firstDegree: true, studyCostsYear: 0 };
const job = (type: IncomeSource["type"], monthlyGross: number, months = 12, hoursPerWeek = 20): IncomeSource => ({
  id: type,
  type,
  monthlyGross,
  months,
  hoursPerWeek,
});
const titles = (r: ReturnType<typeof calculate>) => r.warnings.map((w) => w.title);

describe("income tax 2026 (§ 32a EStG)", () => {
  it("follows the tariff zones", () => {
    expect(R.tax.incomeTax(12348)).toBe(0);
    expect(R.tax.incomeTax(17799)).toBe(1034);
    expect(R.tax.incomeTax(20000)).toBe(1570);
  });
});

describe("BAföG allowance", () => {
  it("matches the minijob limit as § 23 Abs. 6 intends", () => {
    const r = calculate(R, { ...profile, age: 22, bafoegBase: 500 }, [job("minijob", 603)]);
    expect(r.bafoegMonthly).toBe(500);
    expect(r.famVersichert).toBe(true);
  });
});

describe("Werkstudent 1000 €/month, 20 h", () => {
  it("pays only reduced pension insurance and loses family insurance", () => {
    const r = calculate(R, profile, [job("werkstudent", 1000)]);
    // Übergangsbereich: 2000/1397 × (1000 − 603) × 9,3 % = 52,86 €/Monat
    expect(r.svYear).toBeCloseTo(634.3, 0);
    expect(r.taxYear).toBe(0);
    expect(r.kvMonthly).toBeCloseTo(kvdsMonthly(R, profile));
    expect(r.kvMonthly).toBeCloseTo(148.09, 1);
    expect(r.availableMonthly).toBeCloseTo(799.05, 1);
    expect(titles(r)).toContain("Familienversicherung endet");
  });

  it("reduces BAföG above the allowance but adds the KV/PV supplement", () => {
    const r = calculate(R, { ...profile, bafoegBase: 500 }, [job("werkstudent", 1000)]);
    // (12000 − 1230) × (1 − 22,3 %) / 12 − 389 = 308,36
    expect(r.bafoegMonthly).toBeCloseTo(500 + 137 - 308.36, 1);
    expect(titles(r)).toContain("Dein BAföG wird gekürzt");
  });

  it("loses the Werkstudent privilege above 20 h in the semester", () => {
    const r = calculate(R, profile, [job("werkstudent", 1000, 12, 25)]);
    expect(titles(r)).toContain("Werkstudentenprivileg verloren");
    expect(r.kvMonthly).toBe(0); // insured through the job instead
  });

  it("allows more hours in the lecture-free period", () => {
    const r = calculate(R, profile, [{ ...job("werkstudent", 1000, 2, 40), breakOnly: true }]);
    expect(titles(r)).not.toContain("Werkstudentenprivileg verloren");
  });
});

describe("Pflichtpraktikum", () => {
  it("is free of social insurance but counted in full against BAföG", () => {
    const r = calculate(R, { ...profile, age: 22, bafoegBase: 500 }, [job("pflichtpraktikum", 1000, 6, 40)]);
    expect(r.svYear).toBe(0);
    expect(r.famVersichert).toBe(true);
    // (6000 − 1230) × (1 − 16,5 %) / 12 = 331,91 – no allowance
    expect(r.bafoegMonthly).toBeCloseTo(168.09, 1);
    expect(titles(r)).toContain("Praktikumsvergütung wird voll aufs BAföG angerechnet");
  });

  it("costs more BAföG than the same pay as Werkstudent", () => {
    const p = { ...profile, age: 22, bafoegBase: 500 };
    const praktikum = calculate(R, p, [job("pflichtpraktikum", 1000, 6, 20)]);
    const werkstudent = calculate(R, p, [job("werkstudent", 1000, 6, 20)]);
    expect(werkstudent.bafoegMonthly).toBeGreaterThan(praktikum.bafoegMonthly);
  });
});

describe("Härtefreibetrag (§ 23 Abs. 5 BAföG)", () => {
  const p = { ...profile, bafoegBase: 500 };

  it("adds up to 390 €/month to the allowance for special costs", () => {
    const r = calculate(R, { ...p, specialCostsYear: 2400 }, [job("werkstudent", 1000)]);
    // 697,36 − 389 − 200 = 108,36
    expect(r.haertefreibetragMonthly).toBe(200);
    expect(r.bafoegMonthly).toBeCloseTo(637 - 108.36, 1);
    expect(titles(r)).toContain("Härtefreibetrag beantragen");
  });

  it("uses only what is needed and is capped at 390 €/month", () => {
    const r = calculate(R, { ...p, specialCostsYear: 12000 }, [job("werkstudent", 1000)]);
    expect(r.haertefreibetragMonthly).toBeCloseTo(697.36 - 389, 1);
    expect(r.bafoegMonthly).toBe(637);
    const big = calculate(R, { ...p, specialCostsYear: 12000 }, [job("werkstudent", 1500)]);
    expect(big.haertefreibetragMonthly).toBe(390);
  });

  it("raises the BAföG-safe gross", () => {
    const sources = [job("werkstudent", 0)];
    const without = bafoegSafeGross(R, { ...p, age: 22 }, sources, "werkstudent")!;
    const withCosts = bafoegSafeGross(R, { ...p, age: 22, specialCostsYear: 4680 }, sources, "werkstudent")!;
    expect(withCosts).toBeGreaterThan(without + 300);
  });

  it("does not apply to the full offset of Pflichtpraktikum pay", () => {
    const r = calculate(R, { ...p, age: 22, specialCostsYear: 4680 }, [job("pflichtpraktikum", 1000, 6, 40)]);
    expect(r.haertefreibetragMonthly).toBe(0);
    expect(r.bafoegMonthly).toBeCloseTo(168.09, 1);
  });
});

describe("Übungsleiter / Ehrenamt", () => {
  it("is tax-free and not counted for BAföG up to the pauschale", () => {
    const r = calculate(R, { ...profile, bafoegBase: 500 }, [job("uebungsleiter", 275), job("ehrenamt", 80)]);
    expect(r.taxYear).toBe(0);
    expect(r.svYear).toBe(0);
    expect(r.bafoegMonthly).toBe(500);
    expect(r.availableMonthly).toBeCloseTo(500 + 355);
  });

  it("warns when the pauschale is exceeded", () => {
    const r = calculate(R, profile, [job("uebungsleiter", 300)]);
    expect(titles(r)).toContain("Pauschale überschritten");
  });
});

describe("study costs", () => {
  it("creates a loss carry-forward only in a second degree", () => {
    const master = calculate(R, { ...profile, firstDegree: false, studyCostsYear: 4000 }, []);
    expect(master.lossCarryForward).toBe(4000);
    const bachelor = calculate(R, { ...profile, studyCostsYear: 4000 }, []);
    expect(bachelor.lossCarryForward).toBe(0);
  });
});

describe("optimizer", () => {
  it("finds the highest gross that keeps BAföG unchanged", () => {
    const p = { ...profile, age: 22, bafoegBase: 500 };
    const sources = [job("werkstudent", 0)];
    const safe = bafoegSafeGross(R, p, sources, "werkstudent")!;
    expect(safe).toBeGreaterThan(500);
    const at = (g: number) => calculate(R, p, [job("werkstudent", g)]);
    expect(at(safe).bafoegLossMonthly).toBeLessThanOrEqual(0.5);
    expect(at(safe + 20).bafoegLossMonthly).toBeGreaterThan(0.5);
  });
});
