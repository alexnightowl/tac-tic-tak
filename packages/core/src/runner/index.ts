// @tac/core/runner: the puzzle runner as a pure reducer (PLAN §2.7).
// usePuzzleRunner (apps/mobile) dispatches events stamped with `at` and
// interprets the returned effects against the Board handle, feel and api.
export * from './types';
export * from './reducer';
export * from './selectors';
export * from './snapshot';
