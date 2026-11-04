// How the signed-in shell frames a route (docs/web/PLAN.md §2 Layout).
//
// - 'none':   no shell at all. Board runners own the whole viewport
//             (the old nav's focus mode, plus the puzzle viewer, which is
//             h-dvh with its own back button).
// - 'column': the app's screen in a centred column (max 560 px) next to
//             the desktop rail. The default for v2 screens.
// - 'wide':   the pre-v2 web pages, which were laid out for a 1024 px
//             container with md:/lg: grids. They keep that width until
//             their phase replaces them, then move to 'column'.
export type ShellFrame = 'none' | 'column' | 'wide';

const RUNNER = [
  /^\/play\/[^/]+/, // session runner
  /^\/review\/[^/]+/, // theme drill
  /^\/sessions\/[^/]+\/review$/, // session mistakes
  /^\/puzzles\/[^/]+/, // puzzle viewer
];

/** Pre-v2 pages still rendered by the old web screens. */
const LEGACY = ['/dashboard', '/play', '/review', '/leaderboard', '/friends', '/profile', '/analytics', '/sessions', '/settings', '/admin'];

export function shellFrame(pathname: string | null): ShellFrame {
  if (!pathname) return 'wide';
  if (RUNNER.some((re) => re.test(pathname))) return 'none';
  if (LEGACY.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return 'wide';
  return 'column';
}
