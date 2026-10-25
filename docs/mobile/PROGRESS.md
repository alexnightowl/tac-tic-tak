# Progress log

Newest entry first. One entry per working session: what was done, what is verified (and how), what
is next, blockers. Link screenshots under `docs/mobile/screens/<phase>/`.

---

## 2026-10-25: inventory and plan done, Phase 0 started

**Done**
- Inventory of the web app and backend for the native port: `docs/mobile/inventory/*.md`
  (board, play, review, social, stats-settings-shell, sound, design-system, backend, gaps,
  stack-research). Committed in `e4016fe`.
- Architecture and delivery plan synthesised and approved: `docs/mobile/PLAN.md`.
- Phase 0 started on branch `mobile`:
  - `apps/mobile` scaffolded (Expo SDK 58, RN 0.88, React 19.3; `engines.node >=22.13` in the
    mobile package only; no `dev`/`build` scripts).
  - `packages/core` (`@tac/core`) created: pure TS, chess.js 1.4, vitest; `"./*"` subpath exports.
    Module extraction in progress (rules, puzzle, format, charts, i18n, themes, catalogs,
    validation, tokens, feel, board folders exist; runner and api not started).
  - React split verified: `apps/frontend` resolves react 18.3.1, `apps/mobile` resolves 19.3.0
    under pnpm's default isolated linker; no `.npmrc` needed.
  - Android toolchain present: SDK at `~/Library/Android/sdk`, JDK 17 (Homebrew), AVD
    `taktic_pixel` (Pixel 8, API 36, google_apis arm64). Maestro 2.11.0 installed.
  - Working docs written: root, `apps/mobile` and `apps/backend` CLAUDE.md;
    `docs/mobile/{PROGRESS,DECISIONS,OWNER-QUESTIONS,PARITY,IDEAS,FEEL}.md`.

**Next (Phase 0 remainder)**
- Finish the `@tac/core` modules with tests (rules parity on 10k inputs, i18n key parity).
- App config (name, scheme `tactictak`, dark, portrait, `#1d1b20`), fonts + splash gate, hello
  screen rendering `initPuzzle` on a fixed FEN.
- Asset pipeline v0 (`tools/assets`, `tools/audio`).
- `.maestro/00-smoke.yaml` on iOS sim and Android emulator.
- B1 CI PR (node 22, frozen lockfile, mobile job, deploy paths-filter) for the owner to merge.
- Phase 0 exit checks (PLAN.md §5): node 20 + 22 typecheck/build, `pnpm why -r react`, both Docker
  builds unchanged, `git diff main --stat -- apps/frontend apps/backend/src apps/backend/Dockerfile
  deploy` empty.

**Blockers / owner input**
- See OWNER-QUESTIONS.md #1 (app identity) and #22 (device scope); both needed before the first
  store upload, not before local builds.
