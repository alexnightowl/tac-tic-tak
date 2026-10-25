# Feel: haptics, sound and motion values

The code is the source of truth: `FEEL_TABLE` and the sound catalogue in `@tac/core/feel`, motion
constants in `@tac/core/tokens` and `apps/mobile/src/feel/motion.ts`. This file mirrors the current
values in human terms and keeps the **tuning history**, so every change is reviewable and
reversible. Every haptic and sound fires through `feel.emit(event)`.

Global rules:
- Sound and haptic for one event fire in the same frame.
- Haptics respect `hapticsEnabled` only; sound respects `soundEnabled` and the volume (master gain
  `volume * 0.9`). Muting sound never silences haptics.
- Haptics stay on under Reduce Motion.
- Engine: expo-haptics (`performAndroidHapticsAsync` on Android); Pulsar only if the Phase 1
  device spike wins (Q4). Preset names below are expo-haptics names.
- Deliberate differences from the web (D8): the winning-move click is suppressed; a mistake is
  thud + Error only (web overlaps click + thud); check and castle sounds also play on review
  replies; opponent sound and haptic fire at landing, not at move start.

## FEEL_TABLE defaults (PLAN.md §2.8, 2026-10-25)

| Event | Haptic | Sound |
|---|---|---|
| Pickup | selection | none |
| Hover onto a legal square | light tick (throttled) | none |
| Drop | Light | move click |
| Capture | Medium | capture |
| Check | Rigid | check |
| Castle | Light ×2, 80 ms apart | castle |
| Promote | Medium, then Light | promote |
| Illegal | soft Rigid | none |
| Opponent landing | Soft at 60% | on landing |
| Correct | Success | correct sting; winning click suppressed |
| Mistake | Error | thud only |
| Streak up (>= 2) | Light; Medium at 5, Heavy at 10 | none |
| Streak broken | Warning | none |
| Timer threshold | Warning once, then a Rigid tick per second for the last 5 s | none |
| Pause / resume | Light | none |
| Exit sheet / Discard | Warning / Heavy | none |
| Norm gate up | Soft at 0, Medium at 550 ms | gate clip (gongswell: 350 ms attack, bell at +550 ms) |
| Norm rise / drop | Success at 360 ms / Warning at 270 ms | per clip |
| RankCeremony up | Soft, light-tick crescendo over 950 ms, then Heavy + Success at the flash | ceremony clip |
| RankCeremony down | Warning at 0, Soft at 750 ms | rankDown variant |
| Segmented / tab change | selection | none |
| Toggle | Light | none |
| Slider | tick per 25 pts; Medium at a magnet detent; Warning + rubber-band at the locked cap | none |
| Sheet detent | Soft | none |
| Refresh trigger | Light | none |
| Achievement toast | Success (throttled) | none |
| Form error | Error + shake | none |

Additional events named in the per-phase specs (PLAN.md §2.5, §5); not yet in the §2.8 table:

| Event | Haptic | Sound |
|---|---|---|
| Plate button pressIn | a haptic on pressIn; preset not fixed yet (start with Light) | none |
| Register rule satisfied | Light tick per rule | none |
| Viewer step / long-press auto-repeat | tick per ply | none |
| Heatmap scrub | tick per cell | none |
| History swipe-delete threshold | Medium at 44 px | none |
| Friend request swipe accept | Success | none |
| Reset progress (destructive) | Heavy | none |
| 429 rate-limit toast | Warning | none |
| Sound settings ▶ preview | the event's own haptic | the selected variant |

Ceremony and gate timelines are re-aligned to the measured clip hit points once the audio pipeline
measures them (Phase 5); record the measured offsets here.

## Motion and gesture parameters

| Parameter | Default | Source |
|---|---|---|
| Drag threshold (tap vs drag) | 4 px | PLAN §2.6 |
| Drag lift above the finger | ~0.6 sq | PLAN §2.6 (tunable) |
| Drag piece scale | spring to ~1.08–1.12 | PLAN §2.6 (tunable) |
| Illegal-drop snap-back | 180 ms spring | PLAN §2.6 |
| Move slide (`animateMove`) easing | `bezier(0.4, 0, 0.2, 1)` | web |
| Animation speed (`ANIMATION_MS`) | instant 0 · fast 160 · normal 280 · slow 460 ms | web settings |
| Next-puzzle delays | 220 / 360 ms | web |
| Square feedback flash | 500 ms | web |
| Wrong-move reset (theme drill, session mistakes) | 520 ms | web |
| Solved pause (theme drill, session mistakes) | 1000 ms | web |
| Piece shake | 340 ms | PLAN §2.6 |
| Sparks | 14 views on one progress value, scaled by sq/50 | PLAN §2.6 |
| CountTo | 350 / 900 ms | web |
| Plate press | 100 ms `translateY(1)` + dark overlay 0.20 ember / 0.14 slate | PLAN §2.5 |
| Reduced motion | sparks and shake off, pulses static, move slides 120 ms | PLAN §2.6 |

## Audio parameters

| Parameter | Default |
|---|---|
| Leading-silence trim | -40 dBFS onset, 3 ms pre-roll (offline) |
| Board clip level | -29 dBFS RMS (move, capture, check, castle, promote, correct) |
| Formats | 48 kHz mono 16-bit WAV for short clips; AAC m4a for rank and long clips |
| iOS audio session | `ambient` + mixWithOthers (Q5) |
| Long clips | fade with `linearRampToValueAtTime`; stop on background, interruption and unmount |

## Tuning history

Newest first. One entry per change: date, source (owner `[feel]` note in OWNER-QUESTIONS.md,
feel-lab / tuning JSON export, or a measurement), the parameter, before → after, and why. Paste the
owner's tuning JSON verbatim under its entry.

| Date | Source | Parameter | Before → after | Why |
|---|---|---|---|---|
| 2026-10-25 | PLAN.md §2.8 | all | initial defaults above | starting point; no device tuning yet |
