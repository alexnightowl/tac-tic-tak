// Which routes have a desktop layout (canvas "Desktop — redesign") and what
// shell they sit in. Read by WebFrame on a desktop-wide window:
//  - 'full'    sidebar + the page at full width (the screen draws its own
//              PageHeader);
//  - 'compact' the 64 px icon sidebar + the page (board screens);
//  - 'bare'    no sidebar at all (login, register, onboarding).
// A route not listed keeps its phone layout in a centred 600 px column next
// to the full sidebar (or alone, for the legacy focus routes below).
// Each area adds its own lines when its desktop screen lands.

export type DesktopChrome = 'full' | 'compact' | 'bare';

type Entry = { re: RegExp; chrome: DesktopChrome };

export const DESKTOP_ROUTES: readonly Entry[] = [
  // ── auth + onboarding ──
  { re: /^\/login$/, chrome: 'bare' },
  { re: /^\/register$/, chrome: 'bare' },
  { re: /^\/onboarding$/, chrome: 'bare' },
  // ── home, play setup, storm intro/result, challenge ──
  { re: /^\/$/, chrome: 'full' },
  { re: /^\/play$/, chrome: 'full' },
  { re: /^\/play\/levels$/, chrome: 'full' },
  { re: /^\/storm$/, chrome: 'full' },
  { re: /^\/storm\/result$/, chrome: 'full' },
  { re: /^\/challenge\/new$/, chrome: 'full' },
  // ── board screens (runner, storm run, drills, course/library solve) ──
  { re: /^\/play\/(?!levels$|theme-picker)[^/]+$/, chrome: 'compact' },
  { re: /^\/storm\/run$/, chrome: 'compact' },
  { re: /^\/review\/[^/]+$/, chrome: 'compact' },
  { re: /^\/sessions\/[^/]+\/review$/, chrome: 'compact' },
  { re: /^\/(course\/(solve|exam)|library\/solve)$/, chrome: 'compact' },
  // ── review, learn, courses, books ──
  { re: /^\/learn$/, chrome: 'full' },
  { re: /^\/review$/, chrome: 'full' },
  { re: /^\/course\/intro$/, chrome: 'full' },
  { re: /^\/course\/(?!solve$|exam$|done$|result$|certificate$)[^/]+$/, chrome: 'full' },
  { re: /^\/library\/(?!solve$|done$)[^/]+$/, chrome: 'full' },
  // ── league, stats, achievements ──
  { re: /^\/rivals$/, chrome: 'full' },
  { re: /^\/stats$/, chrome: 'full' },
  { re: /^\/sessions$/, chrome: 'full' },
  { re: /^\/sessions\/[^/]+$/, chrome: 'full' },
  // ── profile, experience, friends, settings ──
  { re: /^\/profile\/[^/]+$/, chrome: 'full' },
  { re: /^\/experience$/, chrome: 'full' },
  { re: /^\/friends$/, chrome: 'full' },
  { re: /^\/settings(\/(profile|gameplay|sound|account|about))?$/, chrome: 'full' },
];

/**
 * Phone-layout routes that own the whole window (a runner, an exam,
 * onboarding): no sidebar until their desktop layout lands.
 */
const LEGACY_FOCUS = [
  /^\/onboarding/,
  /^\/play\/(?!levels|theme-picker)[^/]+$/,
  /^\/review\/[^/]+$/,
  /^\/sessions\/[^/]+\/review/,
  /^\/storm\/run/,
  /^\/(course|library|offline)\/(solve|exam|done|result|certificate|synced)/,
];

/**
 * Sheet routes (transparent modals over the page beneath): the frame stays
 * the one of the page they cover.
 */
const SHEETS = [/^\/menu$/, /^\/play\/theme-picker/, /^\/friends\/search/, /^\/avatar-source/, /^\/achievement\//, /^\/streak$/];

export function isSheetPath(path: string): boolean {
  return SHEETS.some((re) => re.test(path));
}

export type DesktopFrame = { chrome: DesktopChrome | 'none'; column: boolean };

/** The shell a path gets on a desktop-wide window. */
export function desktopFrame(path: string): DesktopFrame {
  const hit = DESKTOP_ROUTES.find((e) => e.re.test(path));
  if (hit) return { chrome: hit.chrome, column: false };
  return { chrome: LEGACY_FOCUS.some((re) => re.test(path)) ? 'none' : 'full', column: true };
}
