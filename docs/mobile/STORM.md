# Puzzle Storm and Challenge a friend

Owner (2026-11-03): build the canvas page "New: modes & social" sections **Puzzle Storm**
(`StormStart`, `StormRun`, `StormResult`) and **Challenge a friend** (`ChallengeCreate`,
`ChallengeIncoming`, `ChallengeRace`, `ChallengeTogether`, `ChallengeResult`) in two stages.
Decisions: D29. Mobile-only.

- **Stage A (this build):** solo Storm, and the asynchronous Race: the challenger plays a stream,
  the friend plays the same stream within 24 h, then both see the result.
- **Stage B (later):** a live Race where each player sees the other's score, and Together. Both
  need a realtime channel the backend does not have yet.
- **No chat for now.** The result screen has no "Open chat", Together has no message box, and the
  live Race has no quick taunts. Chat is its own feature (canvas section "Chat").

## Rules (one engine for Storm and Race)

| | Storm | Race 3 min | Race 5 min | Race Survival |
|---|---|---|---|---|
| Clock | 3:00 | 3:00 | 5:00 | none |
| Lives | 3 | 3 | 3 | 3 |
| A mistake | −1 life, −10 s, combo resets | same | same | −1 life, combo resets |
| Combo bonus (D34) | from combo 5: +1 s a move, +3 s a solve; 12: +2 / +4; 20 (max): +3 / +5 | same | same | none |
| Ends when | the clock hits 0, or 3 mistakes | same | same | 3 mistakes |

- **The clock never pauses** and runs on wall time. Backgrounding the app does not stop it, and
  coming back after 0:00 ends the run. The run's state is saved after every puzzle; if the app was
  killed, the next launch submits it as finished.
- **Moves.** A puzzle is the Lichess line: the opponent's setup move, then the player's moves.
  Every player move must be the line's move, except that any mate in one is accepted. A solved
  puzzle scores +1. The combo counts right moves in a row (D34, like Lichess), the solving move
  included; a mistake resets it. A wrong move is a mistake: the right move flashes for
  ~400 ms, then the next puzzle comes. Storm has no hints and no skip. Tap-tap and drag both work.
- **Score** is the number of puzzles solved. The runs feed **accuracy** (solved / (solved +
  mistakes)), **best combo**, and **hardest solved** (the highest-rated puzzle solved).
- **Pure logic** lives in `@tac/core/storm`: `stormInit`, `stormReduce`, `stormClock`,
  `stormLadder`, `raceVerdict` and the wire types. The runner uses the practice mode `storm`
  (`@tac/core/runner`): a wrong move holds ~260 ms, the right move slides in for 400 ms, then the
  next puzzle; a solve moves on after 200 ms.

## Streams

- A stream is 100 puzzles in rising rating, stored on the server so a friend can replay it.
  Puzzle `i` targets `base + 1600·(1 − e^(−i/50))`, rounded to 10. That gives about base at 0,
  base+290 at 10, base+800 at 35 and base+1380 at 99. The puzzle comes from a ±25 band around the
  target, and the stream is sorted by rating.
- **Solo Storm base** is a fixed 1000 for everyone, so friends' scores compare.
- **Race base** is `clamp(round10(avg − 600), 600, 1800)`, where avg is the mean of both players'
  ratings. The Create screen shows that rating as "Between you both · ~avg". A rating is the
  player's highest style `currentPuzzleRating`.
- **Quality floor:** popularity ≥ 85, plays ≥ 300, deviation ≤ 90, at most 6 plies including the
  setup move. Ids are drawn from an in-memory pool per 50-rating bucket (300 random ids each,
  refreshed every 6 h, warmed in the background at boot).

## Solo Storm

**Start** (`/storm`, from Play's "Puzzle Storm" row; the back link reads "Play"):
- the rules card;
- "Your best" (score + date);
- "Today" (the day's best score and the number of runs);
- "This week among friends": the top 3, plus you as a 4th row if you are outside the top 3,
  highlighted. "All" opens the full list (`/storm/friends`);
- the Start storm button.

**Run** (`/storm/run`):
- **Header:** ✕ ends the run after a confirm, then shows the result. The time bar and m:ss turn
  ember at ≤ 20 s.
- **Score row:** the score, the combo meter (chip "Combo ×n" with level pips, a bar towards the
  next level in that level's colours, the line pricing a move and a solve) and the lives.
- **Board:** the board, "Puzzle n · rating" and the side to move (a king on a square-coloured disc).
- **History:** the run so far as squares: green solved, ember mistake, light for the current one.
- **Footer:** "No hints in Storm · tap the piece, then the square".

**Result** (`/storm/result`):
- **Score card:** the score, the "New personal best" chip, and a line. A new best reads "Beat
  your old best of N · Kth among friends". Otherwise it reads "Your best is N · d to go" (or
  "Your best is N" when equal).
- **Stats:** Solved, Accuracy, Best combo, Hardest solved.
- **Difficulty chart:** one bar per puzzle played, with height = rating and ember = mistake. Tap a
  mistake to open that puzzle in the viewer.
- **Buttons:** Play again, and "Dare a friend to beat N". The dare opens Create with the run
  attached; the format is the run's own (3 min).
- **Review:** a mistake puts the puzzle in Review, as in the Library.
- **Credit:** a run gives XP for its time, like Library time, and counts its day for the streak.
  It never touches the rating.

## Challenge a friend (async Race)

**Create** (`/challenge/new?friend&run`):
- **Who:** friend search ("Search friends or @nickname"; friends only for now). Below it, a row
  of friend avatars, online friends first, with a green dot for activity in the last 2 minutes.
- **How:** Race is selected. Together shows as **disabled** with a "Soon" tag (stage B).
- **Format:** 3 min / 5 min / Survival, with the hint line under it.
- **Difficulty and When:** "Between you both · ~avg", then "Within 24 h".
- **Note:** an optional one-line note, up to 80 characters (app-only; the Incoming card shows it).
- **Send to {name}:**
  - Without a run, it creates the challenge and its stream, then the challenger plays right away.
    The challenge reaches the friend only when the challenger's run is posted.
  - With a run (a dare), it is sent at once, using that run's stream.
- **Limits:** 30 challenges per day.

**Incoming** (`/challenge/[id]` while the challenge is pending for me):
- both avatars with ratings, then "Race · 3 minutes";
- "{name} already played: N solved in 3:00" (Survival reads "N solved before 3 mistakes");
- the note card;
- "Expires in hh:mm:ss · doesn't affect rating";
- Accept & play (plays the stream), Later (back), Decline.

**Result** (`/challenge/[id]` when finished):
- **Verdict:** "You win" / "{name} wins" / a tie. A tie on solved goes to whoever was faster, by
  the elapsed time at their last solve, which gives "Tie on solved — you were faster".
- **Strips and table:** puzzle-by-puzzle strips for both players, then a table of Solved,
  Mistakes, Hardest solved, and "Avg per puzzle" (timed) or "Lasted" (Survival).
- **Rematch:** a new challenge to the same friend in the same format, which the player plays
  first. It is the only button: there is no chat yet.
- **Waiting** (app-only): the challenger sees this screen with their own run, "Waiting for {name}"
  and the expiry. A declined or expired challenge says so.

**Where challenges show:**
- **Rivals:** a "Challenges" section (app-only) lists incoming ones first, then sent ones, then
  the last 10 finished.
- **Play:** the "Challenge a friend" row shows the number of incoming challenges.
- No push yet: Phase 10 brings push. Until then the app polls `GET /challenges` on focus.

## API (all JWT; additive)

| Route | Body / query | Returns |
|---|---|---|
| `POST /storm/streams` | `{ challengeId? }` | `{ streamId, base, puzzles: StormPuzzle[] }` (solo: base 1000) |
| `GET /storm/streams/:id` | | the same |
| `POST /storm/runs` | `StormRunBody` | `StormRunSaved` |
| `GET /storm/summary` | `?tzOffsetMin` | `{ best, today, week }` (week = me + friends, best solo score since Monday) |
| `POST /challenges` | `{ opponentId, format, note?, runId? }` | `{ challenge, stream? }` |
| `GET /challenges` | | `{ incoming, outgoing, finished }` |
| `GET /challenges/:id` | | `ChallengeDetail` |
| `POST /challenges/:id/decline` | | `ChallengeSummary` |
| `POST /challenges/:id/remove` | | `{ ok }`: withdraws mine (`cancelled`), declines theirs, hides a finished one from my list |
| `GET /friends` | | rows gain `online: boolean` |

`StormRunBody`:

```
{ clientId, streamId, format: 'time3'|'time5'|'survival', challengeId?, score, mistakes, bestCombo,
  durationMs, lastSolveMs, results: [{ i, ok, ms }], localDay?, tzOffsetMin? }
```

The server rejects a run whose results disagree with its score or mistakes, or whose indices fall
outside the stream. Each player gets one run per challenge.

Tables: `StormStream`, `StormRun`, `Challenge`. Presence is a Redis key `seen:<userId>` (TTL
120 s), set on every authenticated request.
