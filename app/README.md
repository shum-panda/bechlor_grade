# Studi-Planer (Web-App)

Web-Version des Excel-Notenrechners für Angewandte Informatik (HTW Berlin, Studienordnung 2021),
erweitert um Transcript-Import. Finanzen und Organisation folgen.

```bash
npm install
npm run dev     # http://localhost:5173
npm test
```

- `src/domain/curriculum.ts` – Module, Gewichtungen, Notenverteilung (aus dem Excel übernommen)
- `src/domain/grades.ts` – Schnitt, Endnote (75/15/10), benötigter Schnitt, ECTS-Grade
- `src/domain/transcript/` – PDF-Text-Extraktion (pdf.js, nur im Browser) und Parser für das HISinOne-Transcript

Alle Daten bleiben lokal im Browser (localStorage).
