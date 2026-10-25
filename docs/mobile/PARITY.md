# Feature parity

The contract for "done": one row per inventory feature, seeded from PLAN.md §6. Phase 9 exits with
**zero `todo` rows**, and every `deferred` row cites a decision (`Q#` in OWNER-QUESTIONS.md /
DECISIONS.md, or `D#`). When a web fix lands on `main`, add or update the row here.

- **Status:**
  - `done`: built, and its Maestro flows pass on the iOS simulator and the Android emulator.
  - `partial`: built and passing on iOS; the note names what is still missing (a sub-feature,
    the Android run, a device-only check).
  - `blocked B#`: everything that works on today's API is built and passing; the rest waits for
    that backend PR (PLAN §4) and is feature-flagged off in the app.
  - `todo`: not started. `deferred`: dropped or postponed, with the decision.
- **Phase:** the PLAN.md phase(s) that deliver it; several numbers mean staged delivery.
- **Notes:** "Fix" = a known web bug that is fixed, not ported. Flow names are `.maestro/*.yaml`.
  "iOS" = iPhone 17 simulator, "Android" = `taktic_pixel` emulator.
- **Last audit:** 2026-10-25 integration pass (PROGRESS.md). Counts: see the end of this file.

## Auth, shell, cross-cutting

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Login screen (stats-settings-shell) | 2 (minimal), 4 | blocked B4 | Login, inline wrong-password error, autofill types (`02-auth`). Still the legacy 7 d token: refresh auth and the one-time token migration need B4 |
| Register with live rule checklist | 4 | done | Rules from `@tac/core/validation`; `02-register` (iOS, incl. the Strong Password sheet) and `10-walkthrough` (both) |
| Auth/session plumbing and bootstrap (api client, Providers, store) | 4 (refresh, `resetAll`) | blocked B4, B5 | `Stack.Protected` guard, MMKV-hydrated stores, persisted query cache, `resetAll` on logout. Fix (client side): only the "current password is incorrect" 401 is a form error in change-password; the server's 403 (B5) and refresh (B4) are pending |
| App shell: nav (6 → 5 tabs + avatar), focus routes, pull-to-refresh, fonts | 4 | done | `04-shell`: 5 tabs, account menu, every route by deep link, language switch survives relaunch, logout. Social tab badge = incoming requests. Q3/Q31 custom tab bar |
| Rotate lock | — | deferred | Dropped: portrait-only app config (Q22) |
| PWA install card (Settings › App) | — | deferred | Dropped: no PWA in a native app (D1) |
| Toast notifications | 4 | partial | Top drop, swipe up, exit animation, achievement glyphs registered at startup. Open: while a toast shows, XCUITest sees only its overlay window (flows retry taps); real-device tap-through not checked |
| i18n en/uk, useT, useTn, plural rules, locale dates (gaps) | 0 (dicts), 4, 9 (completeness) | done | Every screen via `t()`/`tn()` with the key-parity test; uk walkthrough (`10-walkthrough`, `04-shell`, `09-settings`). Fix: all 73 dataset theme slugs labelled (D17); "attempts" pluralised |
| Onboarding welcome modal (5 slides) | 4 | done | Gate mounted (D19): `09-onboarding` (new account → slides → Play, server flag, no repeat), `10-walkthrough`. Fix: uk "Додаток" copy |
| Landing page and landing i18n → welcome pager; web landing kept | 4 / 12 | todo | Login screen has no welcome pager yet; web landing trimmed in Phase 12 |
| Error, empty, offline, session-expiry states (gaps) | 4, 11 (audit) | partial | Loading / empty / error states on every list screen, offline banner, error boundary. Phase 11 audit not done |
| Interrupted session lifecycle (gaps) | 2 (auto-pause), 5 | blocked B6, B7 | Auto-pause (`02-slice`), device snapshot + resume card (`05-resume`: same puzzle, ±2 s, no duplicate attempt in psql). Needs B6 (`clientAttemptId`, `/sessions/active`, outbox) and B7 (sweeper); a Start over a resume card leaves the old session open |
| Focus mode (gaps) → immersive runner chrome | 2, 9 (setting) | partial | D16: the setting hides the status bar on the runner, drill and mistakes review; keep-awake always on in a session. Android immersive nav bar needs `expo-navigation-bar` (native change, not installed) |
| Keyboard shortcuts (gaps) | — | deferred | Dropped: phones have no hardware keyboard (Q22); the viewer copy loses "← → to step", swipe replaces it |
| Reduced motion and CountTo (gaps) | 1, 5, 9 (audit) | partial | Policy in `src/feel/motion.ts`, CountTo, pager/parallax off. Not measured: RankCeremony under reduced motion (< 400 ms) |
| Route / deep-link map (gaps) | 4 (scheme, native-intent), 10 (universal links) | partial | `tactictak://` reaches every route (`04-shell`, `08-profile-edit`). Missing: `+native-intent` web-path mapping and universal links (Phase 10) |
| Outbound external links (Lichess, GitHub) via expo-web-browser | 6, 7 | partial | Viewer "Lichess" link and About (licences, privacy) open in expo-web-browser; no flow covers them. Privacy page needs B16 |
| Accessibility baseline (gaps) | 1 (board), 9 | partial | testID + label + role on interactive elements, square labels, adjustable slider value (rating + band). A VoiceOver / TalkBack pass by hand is still due |
| Text-input behaviours: autofill, keyboard types (gaps) | 4 | done | `textContentType`/`autoComplete` on login and register, number pad for custom minutes, keyboard-controller avoidance |
| Server-side timezone (gaps) | 3 (`tz` on finish), 10 | blocked B6 | Client uses local dates; `finish` cannot carry `tz` until B6 |
| Dev and QA tooling: seed, LAN, test account (gaps) | 0 | done | Local `e2e_*` users, `05-outcomes.sh`, `06-seed.js`, `08-friends-seed.js`, `10-walkthrough` |
| App icons, store screenshots (gaps) | 11 | todo |  |
| Share and invite (gaps, new) | 8, 10 | partial | Profile Share sheet with the https link (`/profile/<nick>`). Invite + universal links in Phase 10 |
| Admin dashboard | 12 | deferred | Stays on the web (Q25) |

## Board

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Board grid rendering (squares, textures, coordinates, frame) | 1 | done | `01-board-android-smoke` on both; every runner screen |
| Piece rendering and per-set fit (Ember/Classic), fixing the scale-origin "pop" | 1 | done | Piece set switch in `09-settings` |
| Tap-to-move, selection, legal indicators | 1 | done | `01-board-tap` (iOS), `01-board-android-smoke` (both); input blocked during the opponent move (Q6) |
| Drag-and-drop | 1 | partial | `01-board-drag`, `01-board-drag-capture` (iOS, zero board renders during drag). Android drag not automated (iOS-coordinate flows); 120 Hz feel needs the owner's phone (Q29) |
| Promotion picker | 1 | partial | `01-board-promotion` (iOS only, coordinates) |
| Arrows: hint and solution arrows | 1 | done | Drill hint 2 draws the arrow (`06-review`) |
| Arrows: user-drawn arrows and highlights, knightArrow | — | deferred | Behind a flag (Q6) |
| Last-move highlight, check indicator | 1 | partial | `01-board-check` passes on iOS; on Android the 01-board-* flows assert iOS frame coordinates |
| animateMove slide, extended to all moves | 1 | done | Every runner, viewer stepping (`06-viewer`) |
| Hint squares and arrow | 1 (API), 6 (drill) | done | `06-review` |
| Feedback: flash, sparks, shake | 1 | done | Runner wrong/right moves; reduced motion drops sparks/shake |
| Orientation and mirror view | 1, 5 (setting) | done | `01-board-flipped` (iOS), mirror in `09-settings`; fixedColor in every mode (Q13) |
| Board sizing and layout | 1 | done |  |
| BoardThumbnail | 6 | todo | History and session rows have no position thumbnail yet |
| LandingBoard (hero) → welcome pager decoration | 4 | todo | Comes with the welcome pager |
| TurnCard | 2 | done |  |
| Puzzle theme icons | 0 (assets), 6 | partial | 43 Lichess glyphs drawn in two components (`features/play/themes/ThemeIcon` via SvgXml, `features/review/ThemeIcon` via expo-image); pick one |

## Play loop

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Play setup (styles, durations, modes, previews, off-form, comfort) | 2 (minimal), 5 | done | `05-outcomes` (7 cases, DB-checked), `02-slice`. Fix: start rating clamped to the current cap |
| DifficultySlider (bands, magnets) | 2, 5 | done | Fixes: thumb position after a style switch; a pick survives `['me']` revalidation; drag starts only on horizontal movement. Look: locked part is a solid fill, not the web's stripes |
| ThemePicker | 5 | done | Sheet with search; theme mode from Stats rows (D18) |
| Session runner state machine (stale-style fix, pause cancels timeouts) | 2, 5 | done | `02-slice`, `05-outcomes` |
| TurnCard and in-session streak chip | 2 | done |  |
| Pause / resume, plus auto-pause on background | 2 | done | `02-slice` (20 s in another app not counted) |
| Exit flow: save vs discard (i18n-ised) | 2, 5 | done | `02-slice-exit`; fix: ExitDialog strings translated |
| Finish and summary outcome cards | 2 (basic), 5 | done | `05-outcomes`: calibration, unlock, unlock-rank, demote, demote-rank, comfort, early. Fix: progression patched from `/finish`, Home shows the new norm at once |
| RankCeremony | 5 | partial | Up and down ceremonies (`05-outcomes`). Haptic timeline vs clip hit points needs a real device; reduced-motion timing not measured |
| Backend session rules (in core, parity-tested; startPuzzleRating fix) | 0, 3 | blocked B8 | Core rules parity-tested. Q11 seen live: a "demotion" can raise the norm; the client hides it, the server still stores it |
| StyleIcon and style catalogue | 2 | done |  |
| First-puzzle hand-off | 2 | done |  |
| creators.ts badge | 5 / 8 | done | Crown on the shared Avatar (header, menu, profile, lists); Q17 |

## Sound and haptics

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Sound catalogue, variants, defaults | 1 | done | `01-feel-lab` |
| Sound prefs store (volume, per-event pick) | 1, 9 | done | Volume and variant picks per device (Q20); the account `soundEnabled` is mirrored into the engine (Q40) |
| Playback API (sfx, moveSoundEvent, stopLongClip) | 1 | done |  |
| Short-clip pipeline (trim, level, preload), done offline | 0, 1 | done | Clips preload at launch: the first sound is no longer late (`01-feel-background`) |
| Synth engine, pre-rendered | 0 | done |  |
| Long clips with fade | 1, 5 | partial | Works in the simulator; fades and the silent switch need the owner's phone (Q29) |
| Sound settings panel | 9 | done | `09-settings`; volume slider ticks every 10 %, preview on release, ▶ per event with its paired haptic |
| Board sound call sites (with the consistency fixes) | 2 | done | D8 |
| Progression sounds: norm gate, RankCeremony | 5 | done | Through `feel.emit` |
| Haptics pairing (new) | 1, 2, 5 | partial | Every haptic goes through `feel.emit`. Several screens borrow events (scrub, friend accept, hint, stepping: `sliderTick`, `achievementToast`, `pickup`, …); FEEL_TABLE needs dedicated ones; device check Q29 |

## Review and sessions

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Review landing theme cards (firstPuzzleId, no N+1) | 6 | blocked B9 | Cards, skeletons, empty/error, refetch on focus (`06-review`). Uses `firstPuzzleId` when present; until B9 a card fetches its list on tap |
| Theme drill runner | 6 | done | `06-review`: hints, wrong move rewinds, done screen, items resolved (psql) |
| Session detail (fmtResponseTime fix) | 6 | done | `06-mistakes`; fix: attempt times read `4.0s`, not `83:20` |
| Session mistakes runner | 6 | done | `06-mistakes`; Q14 default (failed items also leave the global queue) |
| Read-only puzzle viewer and stepper | 6 | done | `06-viewer`: solution, swipe stepping, scrubber, try again |
| Session history with day grouping and swipe-delete (own lists only; fix) | 6 | blocked B9 | `06-history`: swipe delete, undo bar (Q15), 404 after expiry. Only the latest 20 sessions until B9 pagination; fix: no delete on others' profiles |
| Pull-to-refresh → per-screen RefreshControl | 4 onward | done |  |
| Theme labels and meta-theme filtering | 6 | done | D17 |

## Home, social, achievements

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Home dashboard (lifetime.sessions fix; resume card) | 5 | done | Fix: Sessions tile uses `lifetime.sessions` (not capped at 20) |
| Daily streak badge, state, freezes, streak sheet | 5 | done | `streakState` from core; sheet from the badge and by deep link |
| Public profile (streakState fix; no delete on others' profiles) | 8 | done | `08-profile-edit` deep link, `10-walkthrough`; fix: stale streak count hidden |
| Profile editor (explicit Save) | 8 | done | `08-profile-edit` (DB-checked) |
| Avatar picker, crop, upload | 8 | partial | `08-avatar` on iOS (512×512 JPEG, 16 KB). Android picker not automated. "Remove photo" hidden: no endpoint (`AVATAR_REMOVE`) |
| Avatar display, crown, verified badge | 4 (primitive), 8 | done | Shared Avatar now also in the header, account menu and Settings |
| Friends screen | 8 | done | `08-friends`, `08-search-accept` (swipe accept/decline, unfriend confirm) |
| User search (state-after-accept fix) | 8 | done | Fix: reads "Friends" after an accept (`08-search-accept`) |
| Friend action button | 8 | done |  |
| Leaderboard (+ sticky self row) | 8 | blocked B13 | Podium, docked own row inside the top 100. Outside it the row shows "100+" until B13 `me` (`LEADERBOARD_ME_ROW`) |
| Achievements grid, evaluation, star-repo (owner decision) | 7 | done | `07-achievements`: 15/22, star-repo hidden (Q16), detail sheet |
| Achievement unlock toasts (cross-cutting) | 4 (host), 5–9 | blocked B14 | Toasts with glyphs everywhere; the requester's toast on next open needs B14 |
| Push for social, streak, achievements | 9 (local streak), 10 (remote) | blocked B15 | Local streak reminder (`09-reminder`, iOS). Remote push needs accounts (Q24) and B15 |

## Stats and settings

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Stats shell (Stats \| Achievements, style filter) | 7 | blocked B13 | `07-stats`. Recommendation sentence rebuilt on the device from the theme row (Q34) until B13 (`STRUCTURED_RECOMMENDATIONS`) |
| ActivityHeatmap | 7 | done | Fix: touch readout (tap; press-and-drag scrub is not automatable). 202 active days = psql |
| RatingHistoryChart | 7 | done | Draw-in, crosshair tooltip |
| RadarChart | 7 | done | Radius fitted to the card; uk labels wrap |
| Themes list | 7 | done | Row → drill, or Play in theme mode (D18, `07-theme-drill`) |
| Settings › Profile (edit, avatar, change password with the 403 fix, logout) | 8, 9 | blocked B5 | Edit and avatar reuse the profile editor; `09-account` (wrong password inline, change, re-login). Server-side 403 is B5 |
| Settings › Gameplay (every UserSettings field; legacy ones hidden) | 5 (runner effects), 9 (UI) | done | Live board preview; legacy fields hidden (Q19); focus mode now has an effect (D16) |
| Settings › App (language, replay onboarding, reset progress) | 9 | done | `09-settings`, reset progress checked in psql (verifier) |
| Account deletion (new, store-mandated) | 3 (API), 9 (UI) | blocked B10 | UI built, off until B10 (grey in dev builds, hidden in release, Q39) |
| Notification preferences (new) | 9 (local), 10 | partial | Local reminder, hour grid (Q37), permission state (`09-reminder`, iOS). Reminder tap from a killed app opens Home, not Play (Phase 10) |
| About and licences (new) | 9 | done | Privacy link points at `/privacy`, live once B16 ships |

## Design system

| Feature | Phase | Status | Notes |
|---|---|---|---|
| Colour tokens; baked fade pipeline | 0 | done | No raw hex in screens. Gold gradient, verified sky-blue and bronze medal still borrow the nearest tokens |
| Typography, plus the Cyrillic display face | 1 | partial | Forum provisional (Q2/Q30); user names pick the face by their glyphs |
| Surfaces (glass → opaque, tx-slate, eos-well, avatar disc, glow) | 0, 1 | done | D5 |
| Plate buttons and Button | 1 | done | `01-ui-kitchen-sink` |
| Card, Input/PasswordInput, Segmented, Toggle | 1, 4 | done | `01-ui-kitchen-sink` |
| Select, Slider, ColorPicker (unused on web) | — | deferred | Dropped: dead code on the web; a native sheet if ever needed (D5) |
| Brand mark (logo) | 0 | done |  |
| Motion catalogue | 1, 5 | done | `src/feel/motion.ts` |
| App shell / PWA chrome → native splash and icons | 0, 11 | partial | Splash done; store icons and screenshots in Phase 11 |
| Visual asset packaging | 0 | done |  |

## Counts (2026-10-25)

COUNTS_PLACEHOLDER
