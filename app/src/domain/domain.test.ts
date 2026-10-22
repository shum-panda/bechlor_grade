import { describe, expect, it } from "vitest";
import { HTW_AI_2021, HTW_AI_DISTRIBUTION_WS2324 } from "./curriculum";
import { ectsGrade, finalGrade, requiredAverage, summarize, truncate1 } from "./grades";
import { matchToCurriculum, parseTranscriptLines } from "./transcript/parseTranscript";

const TRANSCRIPT = [
  "Grades awarded for the programme/s named below:  Semester - Exam Period  German Grade  Status/ Attempt  ECTS Credits  CM/EM",
  "Building Energy and Building Information Technology with Orientation",
  "Year (Bachelor)",
  "Mathematics 1.1  SS21 - 01  1,7  P / 1  5  CM",
  "Careers Orientation Practical Project 1  SS21 - 02  Pass  P / 1  5  EM",
  "Project Management  SS21 - 01  1,0  P / 1  4  CM",
  "Applied Computer Science (Bachelor)",
  "Technical and Logical Foundations of Computer Science  SS22 - 01  1,3  P / 1  5  CM",
  "Programming 1  SS22 - 01  1,7 *  P / 1  6  CM",
  "Programming 2  SS22 - 01  1,0  P / 1  6  CM",
  "Programming 3  WS22/23 - 01  2,0  P / 1  6  CM",
  "Algorithms and Data Structures  SS24 - 01  1,3  P / 1  5  CM",
  "Mathematics 2  SS22 - 02  1,3  P / 1  5  CM",
  "Data Protection and Security  SS24 - 01  1,0 *  P / 1  5  CM",
  "Quantum Computing  SS24 - 01  1,7  P / 1  5  EM",
  "Mr Example Student · Page 1",
];

describe("transcript parser", () => {
  const rows = parseTranscriptLines(TRANSCRIPT);

  it("parses every module row", () => {
    expect(rows).toHaveLength(11);
    expect(rows[1]).toMatchObject({ name: "Careers Orientation Practical Project 1", grade: "pass", type: "EM" });
    expect(rows[4]).toMatchObject({ name: "Programming 1", grade: 1.7, recognised: true, ects: 6, period: "SS22 - 01" });
    expect(rows[6]).toMatchObject({ period: "WS22/23 - 01", grade: 2.0 });
  });

  it("assigns rows to their programme section", () => {
    expect(rows[0].section).toContain("Building Energy");
    expect(rows[3].section).toContain("Applied Computer Science");
  });

  it("matches only the AI programme and reports unknown modules", () => {
    const { results, unmatched, otherProgrammes } = matchToCurriculum(HTW_AI_2021, rows);
    expect(otherProgrammes).toHaveLength(3);
    expect(results.pm).toBeUndefined();
    expect(results.tgi?.grade).toBe(1.3);
    expect(results.datenschutz).toMatchObject({ grade: 1.0, recognised: true });
    expect(unmatched.map((r) => r.name)).toEqual(["Quantum Computing"]);
  });

  it("uses user-made assignments for electives", () => {
    const { results, unmatched } = matchToCurriculum(HTW_AI_2021, rows, { quantumcomputing: "wp2" });
    expect(unmatched).toHaveLength(0);
    expect(results.wp2).toMatchObject({ grade: 1.7, title: "Quantum Computing" });
  });

  it("reads thesis, colloquium and fills elective/AWE slots from sub-headings (page 2 layout)", () => {
    const page2 = parseTranscriptLines([
      "Applied Computer Science (Bachelor)",
      "Mr Example Student · Page  1  of  2",
      "Possible grades:  1,0; 1,3; 1,7; 2,0; 2,3; 2,7; 3,0; 3,3; 3,7; 4,0; Pass;  *)  recognised exam grade",
      "Introduction to Scientific Work  WS21/22 - 02  1,0  *  P / 1  5  CM",
      "Mobile Operating Systems and Networks  SS24 - 01  1,3  P / 1  5  CM",
      "Specialist Internship  SS24 - 02  Pass  P / 1  15  CM",
      "Project Study: HTW - Mobile Lab  WS23/24 - 02  1,0  P / 1  5  CM",
      "Bachelor Thesis  SS25 - 01  1,0  P / 1  12  CM",
      "Thesis Seminar and Oral Degree Examination  WS25/26 - 01  1,3  P / 1  3  CM",
      "Elective Modules",
      "Front-End Development  WS23/24 - 01  1,0  P / 1  5  EM",
      "Quantum Computing Fundamentals  WS23/24 - 01  1,3  P / 1  5  EM",
      "Specialised Elective Modules",
      "Interdisciplinary Careers Orientation  SS21 - 01  1,0  P / 1  2  EM",
      "Supplementary Modules",
      "Orientation Know-How in the Financial Sector  SS22 - 01  1,7  *  P / 1  2  EM",
      "Foreign Language/s",
      "English, Intermediate Level 3/Technical (CEFR B2.2)  WS23/24 - 01  1,3  P / 1  4  CM",
    ]);
    expect(page2).toHaveLength(11);
    expect(page2[0].group).toBeUndefined();
    const { results, thesis, colloquium, unmatched } = matchToCurriculum(HTW_AI_2021, page2);
    expect(thesis).toBe(1.0);
    expect(colloquium).toBe(1.3);
    expect(results.wissarb).toMatchObject({ grade: 1.0, recognised: true });
    expect(results.mobilebs?.grade).toBe(1.3);
    expect(results.praktikum?.grade).toBe("pass");
    expect(results.projektstudium?.grade).toBe(1.0);
    expect(results.wp1?.title).toBe("Front-End Development");
    expect(results.wp2?.title).toBe("Quantum Computing Fundamentals");
    expect(results.awe1?.title).toBe("Orientation Know-How in the Financial Sector");
    expect(results.englisch2?.grade).toBe(1.3);
    expect(results.fwp1?.title).toBe("Interdisciplinary Careers Orientation");
    expect(unmatched).toHaveLength(0);
  });

  it("keeps a passed attempt over a later failed one", () => {
    const { results } = matchToCurriculum(HTW_AI_2021, [
      ...parseTranscriptLines(["Applied Computer Science (Bachelor)", "Programming 2  SS22 - 01  2,3  P / 2  6  CM"]),
      ...parseTranscriptLines(["Applied Computer Science (Bachelor)", "Programming 2  SS21 - 01  5,0  F / 1  6  CM"]),
    ]);
    expect(results.prog2?.grade).toBe(2.3);
  });
});

describe("grade calculation (same rules as the Excel)", () => {
  it("weights graded modules and ignores weight-0, open and failed ones", () => {
    const s = summarize(HTW_AI_2021, {
      mathe1: { grade: 2.0 }, // weight 0
      mathe2: { grade: 3.3 }, // 5
      prog2: { grade: 3.0 }, // 6
      englisch2: { grade: 1.0 }, // 4
      ads: { grade: 5.0 }, // failed
      wissarb: { grade: "pass" },
    });
    expect(s.average).toBeCloseTo((3.3 * 5 + 3 * 6 + 1 * 4) / 15);
    expect(s.weightDone).toBe(15);
    expect(s.passedCount).toBe(5);
    expect(s.failedCount).toBe(1);
    expect(s.moduleCount).toBe(33);
  });

  it("computes the final grade as 75/15/10", () => {
    expect(finalGrade(HTW_AI_2021, 2.0, 1.0, 1.0)).toBeCloseTo(1.75);
  });

  it("computes the average still needed in open modules", () => {
    const s = { average: 2.0, weightDone: 50, weightTotal: 150, passedCount: 0, moduleCount: 33, failedCount: 0 };
    expect(requiredAverage(s, 1.5)).toBeCloseTo(1.25);
  });

  it("truncates instead of rounding", () => {
    expect(truncate1(1.79)).toBe(1.7);
    expect(truncate1(2.0)).toBe(2.0);
  });

  it("derives the ECTS grade from the distribution like the Excel", () => {
    expect(ectsGrade(HTW_AI_DISTRIBUTION_WS2324, 1.3)).toBe("A"); // 5.08 % cumulative
    expect(ectsGrade(HTW_AI_DISTRIBUTION_WS2324, 1.7)).toBe("B"); // 26.53 %
    expect(ectsGrade(HTW_AI_DISTRIBUTION_WS2324, 1.79)).toBe("B");
    expect(ectsGrade(HTW_AI_DISTRIBUTION_WS2324, 2.1)).toBe("C");
    expect(ectsGrade(HTW_AI_DISTRIBUTION_WS2324, 2.5)).toBe("D"); // 89.78 %
    expect(ectsGrade(HTW_AI_DISTRIBUTION_WS2324, 2.6)).toBe("E"); // 91.47 %
  });
});
