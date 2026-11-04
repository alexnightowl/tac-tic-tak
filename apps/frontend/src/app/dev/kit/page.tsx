import type { Metadata } from 'next';

import { KitPage } from './KitPage';

// Hidden design v2 kit (docs/web/PLAN.md W0): every primitive of src/v2/ui
// in every state, en and uk. Not linked from anywhere.
export const metadata: Metadata = {
  title: 'Kit · tac·tic·tak',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <KitPage />;
}
