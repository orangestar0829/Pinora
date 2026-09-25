# Foundation validation — 2026-09-25

- npm install: successful, 252 packages. Host npm policy blocked esbuild postinstall, but platform package build succeeded. No approval bypass performed.
- npm run typecheck: PASS.
- npm run lint: PASS after replacing the control-character URL regex with explicit character-code validation. The early adapter commit preceded that lint correction; final foundation includes correction.
- npm test: PASS, 4 files / 9 tests (URL, tree paths/system/read-only/cycles/search, migration/idempotence/corruption/update ordering, SVG/image limits).
- npm run build: PASS, Vite 6.4.3, placeholder bundle builds and manifest/assets emitted.
- Browser extension loading / browser CRUD / screenshots: NOT tested in this batch, root owns next-stage acceptance.
- Unit runner explicitly includes src/**/*.test.ts only; Playwright does not run under npm test.
