// Curriculum data per Studienordnung. Weights are taken from the original
// Excel tool ("Beachlor AI Note 3.0.xlsx"); weight 0 = must be passed but does
// not count towards the final grade.

export type ModuleKind = "compulsory" | "elective" | "specialised" | "awe";

export interface ModuleDef {
  id: string;
  name: string;
  weight: number;
  kind: ModuleKind;
  /** Names under which the module may appear on a transcript (DE + EN). */
  aliases: string[];
}

export interface Curriculum {
  id: string;
  name: string;
  /** Section heading on the transcript that belongs to this programme. */
  transcriptSection: string;
  modules: ModuleDef[];
  finalGrade: { modules: number; thesis: number; colloquium: number };
  thesisAliases: string[];
  colloquiumAliases: string[];
  /** Transcript sub-headings whose rows fill the free slots of a module kind. */
  slotGroups: Record<string, ModuleKind>;
}

const m = (id: string, name: string, weight: number, aliases: string[] = [], kind: ModuleKind = "compulsory"): ModuleDef => ({
  id,
  name,
  weight,
  kind,
  aliases: [name, ...aliases],
});

export const HTW_AI_2021: Curriculum = {
  id: "htw-ai-2021",
  name: "Angewandte Informatik (B.Sc.), HTW Berlin – Studienordnung 2021",
  transcriptSection: "Applied Computer Science",
  finalGrade: { modules: 0.75, thesis: 0.15, colloquium: 0.1 },
  thesisAliases: ["Bachelorarbeit", "Bachelor Thesis"],
  colloquiumAliases: ["Kolloquium", "Thesis Seminar and Oral Degree Examination", "Abschlussprüfung"],
  slotGroups: {
    "Elective Modules": "elective",
    "Wahlpflichtmodule": "elective",
    "Specialised Elective Modules": "specialised",
    "Supplementary Modules": "awe",
    "Allgemeinwissenschaftliche Ergänzungsmodule": "awe",
  },
  modules: [
    m("mathe1", "Mathematik 1", 0, ["Mathematics 1"]),
    m("mathe2", "Mathematik 2", 5, ["Mathematics 2"]),
    m("englisch1", "Englisch 1", 0, ["English 1", "English, Intermediate Level 2/Technical (CEFR B2.1)"]),
    m("englisch2", "Englisch 2", 4, ["English 2", "English, Intermediate Level 3/Technical (CEFR B2.2)"]),
    m("prog1", "Programmieren 1", 0, ["Programming 1"]),
    m("prog2", "Programmieren 2", 6, ["Programming 2"]),
    m("prog3", "Programmieren 3", 6, ["Programming 3"]),
    m("tgi", "Technische und Logische Grundlagen der Informatik", 0, ["TGI", "Technical and Logical Foundations of Computer Science"]),
    m("pgi", "Praktische Grundlagen der Informatik", 0, ["PGI", "Foundations of Practical Computer Science"]),
    m("wissarb", "Wissenschaftliches Arbeiten", 0, ["Introduction to Scientific Work", "Scientific Working"]),
    m("se1", "Software Engineering 1", 5, ["Software Engineering"]),
    m("se2", "Software Engineering 2", 5),
    m("bsnetze", "Betriebssysteme und Netzwerke", 5, ["Operating Systems and Networks"]),
    m("datenschutz", "Datenschutz und Datensicherheit", 5, ["Datenschutz", "Data Protection and Security"]),
    m("ethik", "Computer- und Maschinenethik", 5, ["Computer and Machine Ethics"]),
    m("projektstudium", "Projektstudium", 5, ["Project Study", "Project Studies"]),
    m("mobilebs", "Mobile Betriebssysteme", 5, ["Mobile Betriebssysteme und Netzwerke", "Mobile Operating Systems and Networks", "Mobile Operating Systems"]),
    m("datascience", "Einführung in Data Science", 5, ["Introduction to Data Science"]),
    m("pm", "Projektmanagement", 5, ["Project Management"]),
    m("db", "Datenbanken", 5, ["Database Systems", "Databases"]),
    m("webapp", "Web Application Development", 5),
    m("formsprachen", "Formale Sprachen", 5, ["Formal Languages"]),
    m("vs", "Verteilte Systeme", 5, ["Distributed Systems"]),
    m("ads", "Algorithmen und Datenstrukturen", 5, ["Algorithms and Data Structures"]),
    m("praktikum", "Berufspraktikum", 0, ["Specialist Internship", "Fachpraktikum"]),
    m("wp1", "Wahlpflichtfach 1", 5, [], "elective"),
    m("wp2", "Wahlpflichtfach 2", 5, [], "elective"),
    m("wp3", "Wahlpflichtfach 3", 5, [], "elective"),
    m("wp4", "Wahlpflichtfach 4", 5, [], "elective"),
    m("wp5", "Wahlpflichtfach 5", 5, [], "elective"),
    m("fwp1", "Fachübergreifendes Wahlmodul", 2, [], "specialised"),
    m("awe1", "AWE 1", 2, [], "awe"),
    m("awe2", "AWE 2", 2, [], "awe"),
  ],
};

/** Grade distribution of the programme (WS 2023/24, 177 graduates), in percent per final grade. */
export const HTW_AI_DISTRIBUTION_WS2324: Record<string, number> = {
  "1.0": 0, "1.1": 0.56, "1.2": 1.13, "1.3": 3.39, "1.4": 5.08, "1.5": 5.08, "1.6": 5.08,
  "1.7": 6.21, "1.8": 10.17, "1.9": 5.08, "2.0": 8.47, "2.1": 9.6, "2.2": 8.47, "2.3": 7.34,
  "2.4": 6.78, "2.5": 7.34, "2.6": 1.69, "2.7": 4.52, "2.8": 1.13, "2.9": 2.26, "3.0": 0,
  "3.1": 0.56, "3.2": 0, "3.3": 0, "3.4": 0, "3.5": 0, "3.6": 0, "3.7": 0, "3.8": 0, "3.9": 0, "4.0": 0,
};

export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}
