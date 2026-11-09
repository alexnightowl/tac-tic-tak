import type { StormFormat } from '@tac/core/storm';

// Native: the desktop screens never render (useDesktop() is false), so each
// export is an empty stand-in with the web export's name and props.
export function DxSession(_: { sessionId: string; finishOnStart?: boolean }) {
  return null;
}
export function DxStormRun(_: { challengeId: string | null; format: StormFormat }) {
  return null;
}
export function DxReviewDrill(_: { puzzleId: string; theme?: string }) {
  return null;
}
export function DxMistakes(_: { sessionId: string }) {
  return null;
}
export function DxCourseSolve(_: { courseId: string; chapter: number; cycle: number; replay?: boolean }) {
  return null;
}
export function DxCourseExam(_: { courseId: string }) {
  return null;
}
export function DxLibrarySolve(_: { bookId: string; chapter: number; cycle: number }) {
  return null;
}
