# Changelog

## 4.0.0

Complete restructuring into a maintainable static project.

- English is now the default language; Polish replaces the previous second language, German is kept (languages: en, de, pl). All UI text, validation messages, PDF report text and demo data are translated.
- New structure: `index.html` + `css/` + `js/` (ES modules) instead of a single 100 KB HTML file with in-browser Babel and CDN scripts. No CDN dependencies remain; pdfmake 0.2.7 is vendored.
- Removed unused modules (`config/`, `database/`, `utils/`), the legacy single-file versions and the old backup page.
- New domain layer (discrepancy calculation, session workflow, CSV, validation, permissions) with unit tests.
- Counting sessions with approve / recount workflow, camera scanning where supported, dashboard charts, audit log, CSV import/export, PDF report, dark mode, installable offline PWA with a relative service-worker scope, seeded demo data with reset.
