# tac·tic·tak: working rules for coding agents

Chess-tactics trainer. Monorepo: `apps/backend` (NestJS 10 + Prisma 5 + Redis), `apps/frontend`
(Next 14 / React 18, live at tactictak.online), `apps/mobile` (Expo SDK 58 / RN 0.88 / React 19.3),
`packages/core` (`@tac/core`, pure TS shared logic).

## Mission

Rebuild every web feature as a native iOS + Android app in `apps/mobile`. The approved plan is
`docs/mobile/PLAN.md`; follow its phases and exit criteria. **The web is frozen**: it stays live for
fixes only until parity, then is trimmed to a landing page (Phase 12). Do not port web bugs: the
plan and PARITY.md mark them "fix".

**Talk to the owner in Ukrainian** (chat replies, questions, morning summaries). Code, comments,
commits, PRs and the docs/mobile files are in English, except `docs/mobile/OWNER-QUESTIONS.md`,
which the owner reads and answers in Ukrainian.

## Branches and commits

The owner runs Claude Code in bypass-permissions mode and expects autonomy. That makes these rules
load-bearing, not optional:

- **Every push to `main` deploys to prod** (GitHub Actions, ssh, `docker compose --profile app`,
  migrations on container start). Never commit on `main`, never push to `main`, never force-push.
- **Mobile work stays on `mobile`** (optionally `mobile/<phase>-<topic>` branches merged into
  `mobile`). `mobile` merges into `main` only at Phase 12.
- **Backend changes** go on short-lived `api/<topic>` branches **cut from `main`**, one small PR
  each into `main`. Only the owner merges. After a merge, merge `main` into `mobile`. Use a git
  worktree per `api/*` branch so the `mobile` checkout and the local backend keep working.
- Conventional commits (`feat(mobile): …`, `fix(core): …`, `feat(backend): …`), one coherent unit
  each, ending with the harness attribution trailer.
- PR body = the morning report: what changed, screenshots/video paths, Maestro results, perf
  numbers, provisional decisions, open questions. Backend PRs add a "web impact" statement and a
  prod verification checklist. Run `/code-review` on the diff before opening a PR.

## Do not touch

- `apps/frontend`, except a fix the owner asked for. Never run `next build` inside `apps/frontend`
  while the owner's dev server runs: it clobbers `.next`. Prefer `pnpm --filter frontend typecheck`.
- The deploy job in `.github/workflows`, `deploy/` (outside the B12/B16/B17 PRs), both Dockerfiles.
- Root `package.json` `engines` (Docker runs node 20; pnpm fails on a project's own engines
  mismatch). Node 22 is declared in `apps/mobile/package.json` only.
- `pnpm-workspace.yaml` (copied into both Docker images). A linker fallback, if ever needed, goes in
  a root `.npmrc`, never in the workspace yaml.
- `.env`, `.claude-test-account`, any `*.p8`, `google-services*.json`, `GoogleService-Info.plist`:
  never read, print or commit them.
- Applied migrations in `apps/backend/prisma/migrations/*`.
- Prod: no `ssh`, no `docker compose --profile app`, no mutating `curl` to tactictak.online, no
  `eas submit` / production `eas update`. The prod smoke is GET-only with a throwaway account.
- Your own permission settings, hooks and `.claude/settings*.json`.

## Backend contract

- Additive only: nullable or defaulted columns, new tables, optional DTO fields, new response
  fields, new routes. The live web must behave byte-for-byte the same.
- Mobile calls `/api/v1/*` once B2 (URI versioning, `defaultVersion: [VERSION_NEUTRAL, '1']`) is on
  `main`; until then the Phase 2 slice uses today's `/api/*`. Both paths hit the same handler, so
  mobile-only behaviour is keyed on DTO fields (`client: 'mobile'`), never on the path.
- The web-contract golden test and `tools/contract/legacy-smoke.ts` must be green on every backend
  PR (they arrive with B0; before that, smoke the local web by hand). Details: `apps/backend/CLAUDE.md`.
- A change that cannot be made additive is a stop-and-report condition.

## Where the truth lives

Read only the section you need; the inventories are long.

| Topic | File |
|---|---|
| Board, pieces, drag, arrows, feedback, TurnCard, theme icons | `docs/mobile/inventory/board.md` |
| Play setup, slider, runner state machine, pause/exit, summary, RankCeremony, session rules | `docs/mobile/inventory/play.md` |
| Review queue, drills, session detail, mistakes runner, viewer, history | `docs/mobile/inventory/review.md` |
| Home, streak, profiles, avatar, friends, search, leaderboard, achievements, toasts | `docs/mobile/inventory/social.md` |
| Stats charts, settings, onboarding, login/register, api client, shell, i18n, admin | `docs/mobile/inventory/stats-settings-shell.md` |
| Sound catalogue, engine, clip pipeline, haptics pairing | `docs/mobile/inventory/sound.md` |
| Tokens, fonts, surfaces, plates, primitives, motion catalogue, assets, landing | `docs/mobile/inventory/design-system.md` |
| Every API route, data model, NEW backend work (refresh, push, versioning, throttling) | `docs/mobile/inventory/backend.md` |
| Background/kill, deep links, a11y, offline, timezone, dev tooling, share | `docs/mobile/inventory/gaps.md` |
| Library versions and API notes (RNGH 3, Reanimated 4, MMKV, audio, EAS) | `docs/mobile/inventory/stack-research.md` |

`docs/mobile/`: `PLAN.md` (architecture, phases, exit criteria), `PROGRESS.md` (dated log),
`DECISIONS.md` (decisions incl. PROVISIONAL ones), `OWNER-QUESTIONS.md` (owner answers and
`[feel]`/`[look]`/`[bug]`/`[decision]` feedback), `PARITY.md` (the parity contract), `FEEL.md`
(FEEL_TABLE values and tuning history), `IDEAS.md` (post-launch; ideas go here, not into the build),
`screens/<phase>/` (screenshots).

**Every session starts** by reading OWNER-QUESTIONS.md, the last PROGRESS.md entry, DECISIONS.md
and the current phase's exit criteria in PLAN.md.

## Commands

```bash
pnpm db:up                                    # Postgres + Redis in docker (local ports below)
pnpm db:migrate                               # prisma migrate dev (local DB only)
pnpm puzzles:import                           # Lichess puzzle import from apps/backend/data
pnpm --filter backend dev                     # API on http://localhost:4000/api
pnpm --filter backend test:e2e                # after B0 lands (no backend test runner today)
pnpm --filter @tac/core typecheck && pnpm --filter @tac/core test
pnpm --filter mobile start                    # Metro for the dev client
pnpm --filter mobile ios | android            # expo run:ios / run:android (dev build)
pnpm --filter mobile typecheck
maestro test apps/mobile/.maestro/<flow>.yaml # e2e; whole suite: maestro test apps/mobile/.maestro
pnpm -r run typecheck                         # what CI runs (plus pnpm -r run build)
```

Prefer typecheck over builds. Never run `pnpm install` or add dependencies to `apps/frontend` or
`apps/backend` casually; in `apps/mobile` always use `npx expo install`.

**Local ports.** Backend 4000, web dev 3000, Metro 8081, Postgres **5433** on the host
(`docker-compose.override.yml` remaps it because the host already runs Postgres on 5432), Redis
**6380** (`docker-compose.yml`). Prod compose publishes Postgres on 5432; never point anything at prod.

**Android env.**

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH
emulator -avd taktic_pixel -no-window &       # Pixel 8, API 36, google_apis arm64
```

iOS: iPhone 17 simulator (Xcode 26.6). Mobile-specific rules: `apps/mobile/CLAUDE.md`.

## When to stop and report

Never stop the night for a decision listed in PLAN.md §8: adopt the default as PROVISIONAL, log it
in DECISIONS.md and OWNER-QUESTIONS.md, continue. Stop and report (PROGRESS.md and the PR) on: a
backend change that cannot be additive; anything touching prod, the VPS env, secrets or
credentials; an account requirement; an `apps/frontend` edit beyond a requested fix; a spike that
misses its numeric gate twice; deviating from an SDK-pinned library.

## Definition of done

1. `pnpm -r run typecheck` passes.
2. `@tac/core` tests pass (and backend tests once B0 exists).
3. The phase's Maestro flows pass on the iOS simulator (and the Android emulator at phase end).
4. Screenshots in en and uk saved to `docs/mobile/screens/<phase>/`.
5. The PARITY.md row is updated, FEEL.md updated if feel changed, and a PROGRESS.md entry added.
