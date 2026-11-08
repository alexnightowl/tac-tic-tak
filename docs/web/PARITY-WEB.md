# Web parity with the app (D31)

One row per app screen. **State:** `missing` (no web screen), `old` (an old web screen exists, not
v2 yet), `wip`, `done` (v2, app behaviour), `behind` (done, but a later app change is not on the web yet), `n/a` (not on the web). Phase as in `PLAN.md` §3.

| App route | Web route | Phase | State | Notes |
|---|---|---|---|---|
| shell: tab bar, header, account menu | (app) layout | W1 | done | desktop gets a left rail; tabs point at old pages until their phase |
| `(auth)/login`, `(auth)/register` | `/login`, `/register` | W1 | done | EN/УКР switch for signed-out visitors |
| `onboarding` | modal on first visit | W1+ | old | needs the W2 board |
| board, feel | `src/v2/board`, `src/v2/feel.ts` | W2 | done | no haptics on the web |
| runners (session, practice) | `src/v2/runner` | W2 | done | used by no screen yet |
| `(tabs)/play`, `play/levels`, `play/theme-picker` | `/play` | W3 | old | |
| `play/[id]` (runner, pause, summary, RankCeremony) | `/play/[id]` | W3 | old | |
| `review/index` | `/review` | W4 | old | |
| `review/[puzzleId]` (drill) | `/review/[puzzleId]` | W4 | old | instant next, D30 take-back and ‹ › |
| `sessions/index` | — | W4 | missing | web has a dashboard list only |
| `sessions/[id]`, `sessions/[id]/review` | same | W4 | old | |
| `puzzles/[puzzleId]` (viewer) | same | W4 | old | |
| `(tabs)/index` (Home) | `/dashboard` → `/home` | W5 | old | |
| `streak` | — | W5 | missing | |
| `experience` (XP, levels) | — | W5 | missing | |
| `achievement/[slug]` | — | W5 | missing | web shows a grid only |
| `(tabs)/rivals` (leaderboard, challenges) | `/leaderboard` → `/rivals` | W6 | old | |
| `friends/index`, `friends/search` | `/friends` | W6 | old | |
| `profile/[nickname]` | same | W6 | old | presence dot |
| `avatar-source` | profile editor | W6 | old | |
| `(tabs)/learn` | — | W7 | missing | |
| `course/*` (intro, solve, exam, result, certificate, done) | — | W7 | missing | |
| `library/*` (books, solve, done) | — | W7 | missing | |
| `storm/*` (start, run, result, friends) | — | W8 | missing | |
| `challenge/new`, `challenge/[id]` | — | W8 | missing | |
| `(tabs)/stats` | `/analytics` → `/stats` | W9 | old | |
| `settings/*` (index, profile, account, gameplay, sound, notifications, about) | `/settings` | W9 | old | notifications: email/web only, no push |
| `menu` | account menu | W1 | done | |
| `offline/*` | — | — | n/a | offline packs are app-only |
| push notifications, haptics | — | — | n/a | |
| `admin` | `/admin` | — | old | web-only, stays |
| landing | `/` | W10 | old | |
