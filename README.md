# Taktic-Tac — Chess Tactics Trainer

Monorepo: `apps/backend` (NestJS + Prisma), `apps/frontend` (Next.js).

## Quick start

```bash
pnpm install
pnpm db:up                 # start postgres + redis
pnpm --filter backend prisma migrate dev
pnpm puzzles:import        # download + import Lichess dataset
pnpm dev                   # run backend (4000) + frontend (3000)
```

## Dataset

Imports `lichess_db_puzzle.csv.zst` from https://database.lichess.org/ — streams the .zst, parses CSV, batch-inserts into Postgres. Filters: `RatingDeviation <= 90`, `NbPlays >= 50`.
