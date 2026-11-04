# Web parity: paused (how to pick it up again)

**Status (2026-11-04):** the owner paused web parity after W0–W2 (all three on prod) ("давай тоді забʼєм на це …").
Nothing on the web is half-switched: every finished phase is on `main` and prod, and the
remaining phases start from a clean `main`. To resume, read this file, then `PLAN.md` and
`PARITY-WEB.md`, and start at the first phase marked "next" below.

## Where it stands

| Phase | State | Where |
|---|---|---|
| W0 Foundation | done, on prod (1d87dfc) | `@tac/core` in the web, `src/v2/tokens.ts`, `public/v2`, `src/v2/ui`, `/dev/kit` |
| W1 Shell | done, on prod (b505f8f) | `src/v2/shell`, `src/v2/auth`, `/login`, `/register` |
| W2 Board + runner | done, on prod (b505f8f) | `src/v2/board`, `src/v2/runner`, `src/v2/feel.ts`, `/dev/board` |
| W3 Play | **next** | — |
| W4 … W10 | not started | — |

### Last iteration (W1, W2), on prod since 2026-11-04

- **Shell** (`src/v2/shell`): header + bottom tab bar below 1024 px, a left rail from 1024 px,
  the account menu (sheet / dialog / rail popover), offline pill. `tabs.ts` points the tabs at
  the OLD pages until their phase lands: Home → `/dashboard`, Play → `/play`, Rivals →
  `/leaderboard`, Stats → `/analytics`; Learn is hidden by a flag (turn it on in W7).
  `routes.ts` decides each route's frame: old pages keep their 1024 px width, new v2 routes get
  the 560 px column, the four board routes get no shell. Review is reachable from the account
  menu until W4 puts it on the Play screen. `src/components/nav.tsx` is gone.
- **Auth** (`src/v2/auth`): v2 login / register with the app's validation and translated
  errors, an EN/УКР switch for signed-out visitors, logout clears the query cache.
  `src/lib/i18n.ts` has `tFor(lang)` for strings outside React.
- **Board** (`src/v2/board`): the app's `BoardHandle` on the DOM; `engine.ts` moves pieces with
  transforms and Web Animations, React renders only when idle (a drag = zero renders). Keyboard
  play and the app's screen-reader labels (`board.*` keys in core `common`).
- **Runners** (`src/v2/runner`): practice (all modes, D30 `browse`) and session controllers,
  `Countdown`, a web `PracticeBoard` with the cross-fade; `src/v2/api.ts` = core endpoints over
  the web token; snapshots in localStorage; a hidden tab pauses the session.
- **Feel** (`src/v2/feel.ts`): FEEL_TABLE → the web sound engine. `src/v2/motion.ts` = the app's
  reduced-motion policy.
- **Dev pages:** `/dev/kit` (primitives), `/dev/board` (board lab, drill demo; `?demo=session`
  plays a real session against the local API), `/dev/session?token=` (stores a token for
  headless screenshots; 404 outside `next dev`).
- **Loose ends:** the board's bench hooks (`onBoardFrame`, `onSlideTiming`) are not ported; in
  one W2 debug run a session reached its summary after ~12 s without Finish (not reproduced;
  check `/next` error handling when building W3). `public/v2` predates the 2026-11-04 rank-eye
  refresh in apps/mobile/assets: rerun `scripts/sync-assets.mjs` at the start of W3.

## What is already in place for the next phase

- **Shared logic:** the web imports `@tac/core` (TS source; `transpilePackages` in
  `apps/frontend/next.config.mjs`; the frontend Dockerfile copies `packages/core` and installs
  `--filter frontend...` from the lockfile).
- **Strings:** `useT()` / `useTn()` in `apps/frontend/src/lib/i18n.ts` read core's dictionaries
  (`t(key, vars?)`). New strings go into `packages/core/src/i18n/areas/<area>.{en,uk}.ts`, both.
- **Look:** `src/v2/tokens.ts` inlines every core token as a CSS variable (`--eos-ink`,
  `--surface-float`, `--control-…`, `--r-*`, `--s-*`, `--l-*`) and every text variant as a
  `.tv-<name>` class; `src/v2/ui/cssVars.ts` adds shadows, transitions and the logo glow.
  `--font-serif` becomes Forum for `<html lang="uk">`. App assets live in `public/v2`
  (`node apps/frontend/scripts/sync-assets.mjs` re-copies them from `apps/mobile/assets`).
- **Primitives:** `src/v2/ui` mirrors `apps/mobile/src/ui` (same names and props; `Press` = the
  app's `Tap`; Sheet = bottom sheet below 768 px, dialog above). `/dev/kit` shows every state.

## How to run the next phase

1. One phase = one branch `web/<phase>-<topic>` cut from `origin/main`, in its own worktree
   (`git worktree add <scratch>/wt-<phase> -b web/<phase>-<topic> origin/main`), then
   `pnpm install --frozen-lockfile --prefer-offline` and
   `pnpm --filter backend exec prisma generate` (a worktree has no Prisma client; the backend
   typecheck fails without it).
2. Port the app's screens for the phase (`PARITY-WEB.md` lists the app routes). Phases from W3 on
   are independent: two or three agents in parallel worktrees is fine; more heats the Mac.
   The agent brief template is below.
3. Checks before merging (`PLAN.md` §5): `pnpm -r run typecheck`, `pnpm --filter @tac/core test`,
   `pnpm --filter frontend build` in the worktree, and when deps or the Dockerfile changed a
   Docker build from a clean `git archive` plus a `docker run` smoke on a spare port.
4. Merge: fast-forward `main` to the branch (`git push origin HEAD:main`), then fast-forward
   `mobile` to `main`. A finished deploy shows a new `buildId` in the HTML of
   `https://tactictak.online/login` (GET only). GitHub's API is used without a token here
   (60 requests per hour), so poll it sparingly.
5. Update `PARITY-WEB.md` and add a `docs/mobile/PROGRESS.md` entry.

## Gotchas met so far

- **Two Reacts in one install:** the app is React 19, the web React 18. The root `.npmrc` keeps
  `@types/react` out of pnpm's hidden hoist, and the root `package.json` pins the app's
  `@types/react`; without that a clean install breaks the mobile typecheck. In web code import
  `type ReactNode` (and other React types) from `'react'` instead of using the global
  `React.` namespace.
- **Docker uses the lockfile:** the frontend image installs from `pnpm-lock.yaml`. Fresh
  resolution once pulled a second `@types/react` and broke the prod build.
- **Never `next build` in the main checkout** while the owner's dev server runs; build in the
  worktree.
- **Headless Chrome** won't go below ~500 px wide; for phone screenshots use a 390 px iframe page.
  Signed-in screenshots need a token: W1 added a dev-only `/dev/session?token=` helper (see the
  W1 notes below), and throwaway users are registered on the LOCAL API only.
- CI's `mobile` job is red on `expo-doctor` (15 Expo packages have patch updates); it does not
  block the deploy job.

## Agent brief template (one phase)

> You are building phase W<n> (<name>) of bringing the Next.js web app (apps/frontend) up to
> the native app (apps/mobile) in design v2 (D31). Read docs/web/PLAN.md §1–§3, §5 and
> docs/web/RESUME.md first. The app is the source of truth.
> **Setup:** worktree `<scratch>/wt-w<n>` on branch `web/w<n>-<topic>` from origin/main;
> `pnpm install --frozen-lockfile --prefer-offline`; `pnpm --filter backend exec prisma generate`.
> Never edit, build or run in the main checkout.
> **Scope:** port <app routes / feature folders> to <web routes>, using `src/v2/ui`,
> `src/v2/board`, `src/v2/runner`; old URLs redirect as in PLAN.md §2.
> **Rules:** colours via CSS variables only, text via `.tv-*`/AppText, strings via `useT()` with
> core keys (new keys in both en and uk area files), real buttons with aria labels, reduced
> motion, no new dependencies, no downloads; do not touch apps/mobile, apps/backend,
> Dockerfiles, CI, `.npmrc`, `pnpm-workspace.yaml`. Commit on your branch only with the
> attribution trailer; never push or merge.
> **Verify:** typecheck, web build in the worktree, dev server on a spare port (3101+) against the
> local API (http://localhost:4000/api), headless Chrome screenshots at 1280 and phone width in
> en and uk compared with docs/mobile/screens/, saved to docs/web/screens/w<n>/.
> **Report:** files, differences from the app and why, leftovers, commit hashes.
