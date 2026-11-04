# tac·tic·tak web: catch up with the app (plan)

Owner, 2026-11-04 (D31): the web is a full client again. It gets every feature the app has, in
the app's design v2, and runs on the same shared logic (`@tac/core`). Audience: Claude Code
sessions doing the work, and the owner reviewing it.

## 1. Ground rules

- **Source of truth:** the app (`apps/mobile`) and the design canvas, in that order. The web
  copies the app's behaviour and look; it does not invent its own. A web-only layout (desktop)
  is drawn into the canvas like any other app-only state.
- **Shared logic:** the web imports `@tac/core` (rules, runners, Storm, i18n, tokens, formats,
  API types). No copied logic. React stays 18 on the web; core has no React, so nothing clashes.
- **Same backend:** no web-only API. A web screen calls the routes the app calls.
- **Not on the web:** offline packs, push, haptics, the dev routes. Sound stays (the web engine).
- **Deploy:** `web/<phase>-<topic>` branches cut from `main`, merged into `main` by Claude after
  the checks in §5 (owner: "Мерджу сам, як api/*"). A merge deploys to prod.

## 2. Architecture

- **Core in the web:** `apps/frontend/package.json` depends on `@tac/core: workspace:*`;
  `next.config.mjs` sets `transpilePackages: ['@tac/core']` (core ships TS source). The frontend
  Dockerfile copies `packages/core` (package.json in the deps stage, the source in the build
  stage) and installs `--filter frontend...` so core's own deps come along.
- **Tokens:** CSS variables generated from `@tac/core/tokens` in the root layout, so the web and
  the app read one palette. Tailwind maps onto those variables. No raw hex in new screens.
- **Assets:** the app's fonts, plates, surfaces, textures, board tiles, pieces, portraits and
  achievement art are copied into `apps/frontend/public/v2/` by `apps/frontend/scripts/sync-assets.mjs`
  (committed output; the Docker build context has no `apps/mobile`).
- **Layout:**
  - Phone width (< 768 px): the app's layout, bottom tab bar (Home, Play, Learn, Rivals, Stats).
  - Desktop: a left rail with the same five items, and the app's screen in a centred column
    (max 560 px). Runner screens (board) use the full height; the board grows up to 640 px.
- **Routes:** the app's paths. Old web URLs redirect: `/dashboard` → `/home`, `/leaderboard` →
  `/rivals`, `/analytics` → `/stats`. `/` stays the landing page for signed-out visitors and sends
  signed-in users to `/home`. `/admin`, `/login`, `/register` stay.
- **Runners:** the session runner and the practice runner (`@tac/core/runner`) drive a web board
  through the same effect interpreter shape as the app's `PracticeController` /
  `usePuzzleRunner`. The board is the existing web board restyled with v2 tiles and pieces, and
  given the app's imperative handle (`animate`, `setPosition`, `flash`, `shake`, hints).
- **i18n:** core's `en` / `uk` areas through a small `useT()` on the web. The web's old
  dictionaries go away screen by screen.
- **Auth and data:** the web's current API client and token handling stay (no refresh tokens on
  the web, as today). React Query keys come from `@tac/core/api` where they exist.

## 3. Phases

Each phase ends deployed, with the old screens it replaces removed or redirected.

| Phase | Scope | Exit |
|---|---|---|
| W0 Foundation | core in the web + Dockerfile; tokens as CSS vars; fonts; asset sync; `useT` on core i18n; v2 primitives (AppText styles, PlateButton, Card, Segmented, Toggle, Input, Chip, Sheet/Dialog, Toast) | typecheck, frontend build, Docker image builds locally; a hidden `/dev/kit` page shows every primitive in en and uk |
| W1 Shell | v2 tab bar / desktop rail, header with logo and avatar, menu, route redirects, login / register in v2, onboarding | signed-in shell on phone and desktop widths |
| W2 Board + runner | v2 board (tiles, pieces, drag, tap-tap, arrows, flash, shake, hint), sound pairing, session runner on core | a session plays end to end on the web against the local API |
| W3 Play | Play setup v2 (styles, slider, levels, theme picker, Storm / Challenge / Review rows), runner screen, pause / exit, summary, RankCeremony | Play parity with the app |
| W4 Review | Review tab, theme drill (instant next, D30 take-back and ‹ ›), session mistakes, viewer, sessions list and detail | Review parity |
| W5 Home | Home, streak page, experience (XP, levels), achievements and their pages, toasts | Home parity |
| W6 Rivals | leaderboard, friends, search, profiles, presence, challenge rows | Rivals parity |
| W7 Learn | courses (intro, solve, exam, result, certificate) and the nine books (library, solve, done) | Learn parity |
| W8 Storm + Challenge | `/storm` start, run, result, friends; `/challenge/new`, `/challenge/[id]` | Storm and async Race on the web |
| W9 Stats + Settings | Stats charts, settings sections (profile, account, gameplay, sound, about) | Stats and Settings parity |
| W10 Sweep | parity table pass, landing refresh in v2, perf, a11y, old code removed | PARITY-WEB.md all green |

W0–W2 go in order. From W3 on, phases are independent and can run in parallel worktrees.

## 4. Parity tracking

`docs/web/PARITY-WEB.md` lists every app route and its web state (missing / in progress / done /
not on web). Each phase updates it. `docs/mobile/PROGRESS.md` keeps one dated log for both
clients.

## 5. Checks before a merge into main

1. `pnpm -r run typecheck` and `pnpm --filter @tac/core test`.
2. `pnpm --filter frontend build` in the branch's own worktree (never in the main checkout while
   the owner's dev server runs).
3. When the Dockerfile or dependencies changed: `docker build -f apps/frontend/Dockerfile .`.
4. The changed screens checked in Chrome against the local API at 390 px and 1280 px, en and
   uk; screenshots in `docs/web/screens/<phase>/`.
5. After the merge: CI green, then a GET-only look at tactictak.online.
