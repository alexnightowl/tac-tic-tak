# Feature parity

The contract for "done": one row per inventory feature, seeded from PLAN.md §6. Phase 9 exits with
**zero `todo` rows**, and every `deferred` row cites a decision (`Q#` in OWNER-QUESTIONS.md /
DECISIONS.md, or `D#`). When a web fix lands on `main`, add or update the row here.

- **Status:** `todo` · `in-progress` (work in its first listed phase has started) · `done` (exit
  criteria for its last listed phase pass on iOS and Android) · `deferred` (dropped or postponed,
  with the reason).
- **Phase:** the PLAN.md phase(s) that deliver it; several numbers mean staged delivery.
- **Notes:** "Fix" = a known web bug that is fixed, not ported. Inventory file in parentheses
  where the row name alone is ambiguous.

## Auth, shell, cross-cutting

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Login screen (stats-settings-shell) | 2 (minimal), 4 | todo | Phase 2 uses the legacy 7 d token; Phase 4 refresh auth + one-time token migration |
| Register with live rule checklist | 4 | todo | Rules from `@tac/core/validation`, same as the DTO; Light tick per satisfied rule |
| Auth/session plumbing and bootstrap (api client, Providers, store) | 4 (refresh, `resetAll`) | todo | Fix: a 401 from change-password no longer logs out (B5); only a failed refresh calls `resetAll()` |
| App shell: nav (6 → 5 tabs + avatar), focus routes, pull-to-refresh, fonts | 4 | todo | Q3 (tabs); Settings and profile behind the header avatar |
| Rotate lock | — | deferred | Dropped: portrait-only app config (Q22) |
| PWA install card (Settings › App) | — | deferred | Dropped: no PWA in a native app (D1) |
| Toast notifications | 4 | todo | Store ported verbatim; drops from the top, swipe up to dismiss |
| i18n en/uk, useT, useTn, plural rules, locale dates (gaps) | 0 (dicts), 4, 9 (completeness) | in-progress | Dicts moved verbatim to `@tac/core/i18n` with a key-parity test; Hermes `Intl.PluralRules` checked, `pluralizeUk` fallback |
| Onboarding welcome modal (5 slides) | 4 | todo |  |
| Landing page and landing i18n → welcome pager; web landing kept | 4 / 12 | todo | Web landing trimmed in Phase 12 |
| Error, empty, offline, session-expiry states (gaps) | 4, 11 (audit) | todo |  |
| Interrupted session lifecycle (gaps) | 2 (auto-pause), 5 | todo | Q9 (auto-pause); snapshot + resume card, sweeper (Q10) |
| Focus mode (gaps) → immersive runner chrome | 2, 9 (setting) | todo | Replaces web fullscreen |
| Keyboard shortcuts (gaps) | — | deferred | Dropped: phones have no hardware keyboard (Q22); the viewer copy loses "← → to step", swipe replaces it |
| Reduced motion and CountTo (gaps) | 1, 5, 9 (audit) | todo | Policy in `src/feel/motion.ts` |
| Route / deep-link map (gaps) | 4 (scheme, native-intent), 10 (universal links) | todo | Scheme `tactictak://` (Q1); `+native-intent` maps web paths to tabs |
| Outbound external links (Lichess, GitHub) via expo-web-browser | 6, 7 | todo |  |
| Accessibility baseline (gaps) | 1 (board), 9 | todo | 64 square labels, VoiceOver tap-to-move; hit slop >= 44 pt |
| Text-input behaviours: autofill, keyboard types (gaps) | 4 | todo |  |
| Server-side timezone (gaps) | 3 (`tz` on finish), 10 | todo | `finish` carries `localDate` + IANA `tz` (B6) |
| Dev and QA tooling: seed, LAN, test account (gaps) | 0 | in-progress | Seed users `e2e_*` in the local DB only; never `.claude-test-account` |
| App icons, store screenshots (gaps) | 11 | todo |  |
| Share and invite (gaps, new) | 8, 10 | todo | No web equivalent |
| Admin dashboard | 12 | deferred | Stays on the web (Q25) |

## Board

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Board grid rendering (squares, textures, coordinates, frame) | 1 | todo |  |
| Piece rendering and per-set fit (Ember/Classic), fixing the scale-origin "pop" | 1 | todo | Fix: 94% origin compensation also on moving pieces |
| Tap-to-move, selection, legal indicators | 1 | todo | Selection driven by SharedValues, zero React renders; input blocked during the opponent move (Q6) |
| Drag-and-drop | 1 | todo | 4 px drag threshold; lift/scale/snap-back in FEEL.md |
| Promotion picker | 1 | todo |  |
| Arrows: hint and solution arrows | 1 | todo |  |
| Arrows: user-drawn arrows and highlights, knightArrow | — | deferred | Behind a flag (Q6) |
| Last-move highlight, check indicator | 1 | todo |  |
| animateMove slide, extended to all moves | 1 | todo | Improvement: every move slides (Q6) |
| Hint squares and arrow | 1 (API), 6 (drill) | todo |  |
| Feedback: flash, sparks, shake | 1 | todo |  |
| Orientation and mirror view | 1, 5 (setting) | todo | fixedColor in every mode (Q13) |
| Board sizing and layout | 1 | todo |  |
| BoardThumbnail | 6 | todo |  |
| LandingBoard (hero) → welcome pager decoration | 4 | todo |  |
| TurnCard | 2 | todo |  |
| Puzzle theme icons | 0 (assets), 6 | in-progress |  |

## Play loop

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Play setup (styles, durations, modes, previews, off-form, comfort) | 2 (minimal), 5 | todo |  |
| DifficultySlider (bands, magnets) | 2, 5 | todo |  |
| ThemePicker | 5 | todo |  |
| Session runner state machine (stale-style fix, pause cancels timeouts) | 2, 5 | todo | Fix: style from the response, never previous state; theme sessions never patch progressions; pause defers effects |
| TurnCard and in-session streak chip | 2 | todo |  |
| Pause / resume, plus auto-pause on background | 2 | todo |  |
| Exit flow: save vs discard (i18n-ised) | 2, 5 | todo | Fix: ExitDialog strings were hardcoded English |
| Finish and summary outcome cards | 2 (basic), 5 | todo |  |
| RankCeremony | 5 | todo | Haptic timeline aligned to measured clip hit points |
| Backend session rules (in core, parity-tested; startPuzzleRating fix) | 0, 3 | in-progress | Verbatim copies + parity test (>10k inputs); startPuzzleRating fix gated on Q11 (B8) |
| StyleIcon and style catalogue | 2 | todo |  |
| First-puzzle hand-off | 2 | todo |  |
| creators.ts badge | 5 / 8 | todo | Q17 |

## Sound and haptics

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Sound catalogue, variants, defaults | 1 | todo | `@tac/core/feel` |
| Sound prefs store (volume, per-event pick) | 1, 9 | todo | Per device (Q20) |
| Playback API (sfx, moveSoundEvent, stopLongClip) | 1 | todo |  |
| Short-clip pipeline (trim, level, preload), done offline | 0, 1 | in-progress | Trim -40 dBFS + 3 ms pre-roll, level -29 dBFS RMS (tools/audio) |
| Synth engine, pre-rendered | 0 | in-progress | `mistake_thud`, `gate_gongswell` rendered offline |
| Long clips with fade | 1, 5 | todo |  |
| Sound settings panel | 9 | todo |  |
| Board sound call sites (with the consistency fixes) | 2 | todo | Fix: winning click suppressed, mistake thud only, check/castle on review replies (D8) |
| Progression sounds: norm gate, RankCeremony | 5 | todo |  |
| Haptics pairing (new) | 1, 2, 5 | todo | Web has no haptics; expo-haptics engine (Q4); values in FEEL.md |

## Review and sessions

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Review landing theme cards (firstPuzzleId, no N+1) | 6 | todo | Needs B9 `firstPuzzleId` |
| Theme drill runner | 6 | todo | Shared runner, mode `drill` |
| Session detail (fmtResponseTime fix) | 6 | todo | Fix: attempt times used fmtDuration on milliseconds |
| Session mistakes runner | 6 | todo | Mode `mistakes`; Q14 |
| Read-only puzzle viewer and stepper | 6 | todo | Mode `viewer`; swipe replaces ← → keys |
| Session history with day grouping and swipe-delete (own lists only; fix) | 6 | todo | Fix: delete was a no-op on profiles; undo toast (Q15); needs B9 pagination |
| Pull-to-refresh → per-screen RefreshControl | 4 onward | todo |  |
| Theme labels and meta-theme filtering | 6 | todo |  |

## Home, social, achievements

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Home dashboard (lifetime.sessions fix; resume card) | 5 | todo | Fix: Sessions tile capped at 20 |
| Daily streak badge, state, freezes, streak sheet | 5 | todo | `streakState` from core |
| Public profile (streakState fix; no delete on others' profiles) | 8 | todo | Fix: stale streak count |
| Profile editor (explicit Save) | 8 | todo | No commit on blur |
| Avatar picker, crop, upload | 8 | todo | Existing base64 endpoint, 512 px JPEG q0.8 (Q18) |
| Avatar display, crown, verified badge | 4 (primitive), 8 | todo | Crown from `creators.ts` (Q17) |
| Friends screen | 8 | todo |  |
| User search (state-after-accept fix) | 8 | todo | Fix: stayed "Requested" after accept |
| Friend action button | 8 | todo |  |
| Leaderboard (+ sticky self row) | 8 | todo | Sticky row needs B13 `me` |
| Achievements grid, evaluation, star-repo (owner decision) | 7 | todo | star-repo hidden in mobile (Q16) |
| Achievement unlock toasts (cross-cutting) | 4 (host), 5–9 | todo | Requester toasts on next open need B14 |
| Push for social, streak, achievements | 9 (local streak), 10 (remote) | todo | Q21; remote push needs accounts (Q24) and B15 |

## Stats and settings

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Stats shell (Stats \| Achievements, style filter) | 7 | todo | Recommendation text needs B13 |
| ActivityHeatmap | 7 | todo | Fix: hover readout never worked on touch; press-and-drag scrub |
| RatingHistoryChart | 7 | todo |  |
| RadarChart | 7 | todo |  |
| Themes list | 7 | todo |  |
| Settings › Profile (edit, avatar, change password with the 403 fix, logout) | 8, 9 | todo |  |
| Settings › Gameplay (every UserSettings field; legacy ones hidden) | 5 (runner effects), 9 (UI) | todo | Legacy fields hidden (Q19) |
| Settings › App (language, replay onboarding, reset progress) | 9 | todo |  |
| Account deletion (new, store-mandated) | 3 (API), 9 (UI) | todo | B10; store requirement |
| Notification preferences (new) | 9 (local), 10 | todo | Q21 |
| About and licences (new) | 9 | todo |  |

## Design system

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Colour tokens; baked fade pipeline | 0 | in-progress | Every `color-mix` baked to rgba; highlight blue Q7 |
| Typography, plus the Cyrillic display face | 1 | todo | Cinzel has no Cyrillic (Q2) |
| Surfaces (glass → opaque, tx-slate, eos-well, avatar disc, glow) | 0, 1 | in-progress | Opaque 92% fills instead of blur (D5) |
| Plate buttons and Button | 1 | todo |  |
| Card, Input/PasswordInput, Segmented, Toggle | 1, 4 | todo |  |
| Select, Slider, ColorPicker (unused on web) | — | deferred | Dropped: dead code on the web; a native sheet if ever needed (D5) |
| Brand mark (logo) | 0 | in-progress |  |
| Motion catalogue | 1, 5 | todo |  |
| App shell / PWA chrome → native splash and icons | 0, 11 | in-progress | Store icons and screenshots in Phase 11 |
| Visual asset packaging | 0 | in-progress |  |

