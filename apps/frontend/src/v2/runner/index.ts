// Runner controllers for the web (docs/web/PLAN.md W2): the app's effect
// interpreters over @tac/core/runner, driving the v2 board.
export { usePuzzleRunner, type PuzzleRunner } from './usePuzzleRunner';
export {
  RunnerController, SNAPSHOT_KEY, readSnapshot, readActiveSnapshot, clearActiveSnapshot, type RunnerView,
} from './controller';
export { Countdown } from './Countdown';
export { PracticeController, type PracticeHooks, type Fader } from './PracticeController';
export { usePractice, type Practice } from './usePractice';
export { PracticeBoard } from './PracticeBoard';
