# feat(backend): keep the level-up norm on the 25-point grid

Branch `api/norm-grid`, cut from `main` (independent of the other api/* branches).
Owner request (2026-10-29): the norm (`unlockedStartRating`, the slider's lock) and everything
derived from it (the level-up floor = norm − 50) must always be a multiple of 25. Live ratings
(`currentPuzzleRating`) stay as they are.

## What changed

- `sessions.service.ts`:
  - a stable-mode demotion clamped the new norm at the raw entry rating (`startPuzzleRating`,
    e.g. 1191), which left norms off the grid. It now clamps at the entry rating rounded **down**
    to 25, so the clamp never cancels a demotion;
  - the stored norm is snapped to the nearest 25 on every progression update (belt and braces;
    unlock +50, demote −25 and calibration's 50-grid already keep it aligned once the data is).
- Migration `20261029000000_norm_grid_25`: one-off `UPDATE` rounding every off-grid
  `unlockedStartRating` (in `UserStyleProgression` and the legacy `UserProgression`) to the nearest
  multiple of 25, so at most 12 points either way. No schema change.

## Web impact

The web reads the same field: users whose norm was off-grid see it move by ≤12 points (e.g. 2022 →
2025), and the slider's cap and floor follow. No request or response shape changes.

## Verification

- `tsc --noEmit` on the backend: clean.
- Migration dry-run on the local DB inside `BEGIN … ROLLBACK`: 1 off-grid row (bullet 2022 → 2025),
  0 left off-grid afterwards.
- Demotion case worked by hand: entry 1191, norm 1200, penalty 25 → `max(1175, 1175)` = 1175
  (the old code returned 1191).

## Owner checklist

- [ ] `pg_dump` before merging (the migration updates rows).
- [ ] After deploy: open the web play page, check the slider lock and floor are multiples of 25.
