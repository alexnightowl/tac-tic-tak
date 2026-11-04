import { notFound } from 'next/navigation';

import { DevSession } from './DevSession';

// Dev-only screenshot helper (docs/web/screens): /dev/session?token=…&next=/dashboard
// stores a local-API token and opens `next`. A 404 outside `next dev`.
export default function Page() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <DevSession />;
}
