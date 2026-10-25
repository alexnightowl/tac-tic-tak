# Ideas (post-launch)

Parking lot for anything that is not needed for parity or the store launch. Ideas go here, **not
into the build**. Each item names where it came from; promote one to PLAN.md / PARITY.md only with
the owner's go-ahead.

## Accounts and auth
- **Password recovery by email**, and optionally Sign in with Apple / Google. Any third-party login
  makes Sign in with Apple mandatory on iOS. (Q12; backend.md open questions)
- **GDPR data export**: `GET /api/v1/users/me/export`. (backend.md › account deletion)

## Notifications
- **Weekly `review_backlog` push** when unresolved review items >= N, deep-linking to the top theme.
  (backend.md › push opportunities; B15 optional)
- **`weekly_summary` push**: sessions, solved, peak change. (backend.md)
- **Win-back pushes** after 3 / 7 / 14 days of inactivity, or after a streak reset; capped and
  preference-aware. (backend.md, social.md)
- **`streak_freeze_used` push**: needs server-side simulation of `applyStreakOnPlay` at local
  midnight, since freezes are applied lazily. (backend.md)
- **Last-chance streak reminder** around 22:30 local in addition to the 20:00 one. (social.md)
- **Puzzle of the day** push deep-linking to `puzzles/[puzzleId]`. (board.md)
- **`calibration_reminder` push** for users with 1–4 calibration sessions left who have been
  inactive for 2+ days. (backend.md › push opportunities)
- **Friend-overtook-you push** on the friends leaderboard; needs a rank snapshot job.
  (backend.md › push opportunities)
- **Admin push on new sign-up.** (stats-settings-shell.md › admin)

## Board and training
- **User-drawn arrows and highlights** (long-press), plus the `knightArrow` setting; built behind a
  flag and hidden in v1. (Q6; board.md)
- **Achievement progress rings**: expose threshold progress (e.g. totalSolved / 1000) from the
  backend. (social.md › achievements)
- **Richer celebrations**: Lottie flame burst on a continued streak, ice shimmer on a used freeze.
  (social.md, stack-research.md)
- **Pulsar ceremony / gate / castle patterns** if expo-haptics was kept at launch. (Q4; PLAN Phase 11)
- **Skia (`react-native-skia` 2.15.x, not v3)** for glow effects or charts if Views/SVG hit a limit.
  (stack-research.md › board)

## Social and sharing
- **Rendered session result image** (react-native-view-shot) for the share sheet, beyond the link
  share in Phase 10. (gaps.md › share & invite)
- **Server flag for the creator crown** instead of `creators.ts`. (Q17)

## Platform
- **Home-screen widgets** (iOS widget / Android widget) showing the streak flame.
  (social.md › daily streak)
- **iPad and landscape** support (`expo-screen-orientation` for tablets only). (Q22;
  design-system.md › app shell)
- **Native admin screen** (isAdmin-gated stack from Settings) instead of the web `/admin`. (Q25;
  stats-settings-shell.md › admin)
- **Custom circular avatar cropper** (pinch + pan, soft haptic at zoom limits) instead of the
  system 1:1 crop. (social.md › avatar)
- **iOS large-title header search** for user search. (social.md › user search)

## Backend and infrastructure
- **Multipart avatar upload** (`FileInterceptor`) with sharp re-encoding, replacing the base64
  JSON endpoint; or presigned object storage. (PLAN §4; Q18; backend.md, social.md)
- **Backend imports `@tac/core`** instead of keeping mirrored rule files (needs the Dockerfile to
  copy `packages/core`). (PLAN B18)
- **BullMQ on the existing Redis** for delayed/retried pushes if the backend ever runs more than
  one instance. (backend.md › notification scheduler)
- **Generated API types** (OpenAPI) instead of hand-written types + zod. Rejected for v1.
  (PLAN §3; review.md, stats-settings-shell.md)
- **i18next / react-i18next** only if plurals or interpolation outgrow the custom `t()`.
  (stack-research.md › i18n)
