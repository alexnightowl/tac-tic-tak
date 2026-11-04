import type { Metadata } from 'next';

import { BoardLab } from './BoardLab';

// Hidden board lab (docs/web/PLAN.md W2): the v2 board with every handle
// method, and a drill-mode practice runner over core test puzzles. No API.
// Not linked from anywhere.
export const metadata: Metadata = {
  title: 'Board lab · tac·tic·tak',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <BoardLab />;
}
