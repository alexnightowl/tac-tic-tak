# ci: dump the prod DB before any deploy that brings migrations

Branch `api/deploy-backup`, cut from `main`. Owner request (2026-10-29): backups before migrations
must happen automatically, not by hand.

## What changed

The deploy job's VPS script (`.github/workflows/ci.yml`) now records the deployed commit before
`git reset`, and after `docker compose build` checks whether the new range adds any
`apps/backend/prisma/migrations/*/migration.sql`. If it does:

- `pg_dump -Fc` of the whole `taktic` DB into `~/tac-tic-tak-backups/pre-migrate-<UTC time>-<sha>.dump`
  (written as `.part`, renamed when complete);
- keeps the last 5 dumps, prints the folder and the free disk space into the CI log;
- a failed dump stops the deploy (`set -e`) before `up -d`, so no migration runs without a backup.

Deploys without migrations behave exactly as before.

Measured on the local copy of the data (4.6 M puzzles): ~33 s, ~300 MB per dump; the old containers
keep serving during the dump. Five dumps ≈ 1.5 GB of VPS disk.

## Web impact

None. Only the deploy script changes.

## Verification

- The workflow YAML parses; the extracted script passes `bash -n`.
- Migration detection checked with git: `main..api/norm-grid` → backup, `main..api/deploy-backup` → none.
- The same `pg_dump -Fc` on the local DB, then `pg_restore` into a scratch database: users, attempts and
  all 4.6 M puzzles came back (~40 s).

## Restoring (only if a migration went wrong)

A forward fix is usually better than a restore. If a restore is needed, on the VPS:

```bash
cd /opt/tac-tic-tak
ls -lt ~/tac-tic-tak-backups                       # pick the dump taken before the bad deploy
docker compose --profile app stop backend
docker compose exec -T postgres psql -U taktic -d postgres \
  -c 'DROP DATABASE taktic WITH (FORCE)' -c 'CREATE DATABASE taktic OWNER taktic'
docker compose exec -T postgres pg_restore -U taktic -d taktic --no-owner < ~/tac-tic-tak-backups/<file>.dump
git reset --hard <sha from the file name's previous deploy>   # code matching the restored schema
docker compose --profile app up -d --build
```

## Not covered

The dumps live on the same VPS, so they protect against a bad migration, not against losing the
server. An off-site copy (e.g. a nightly upload to object storage) is a separate step.
