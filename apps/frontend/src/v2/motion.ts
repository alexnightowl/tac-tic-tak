'use client';

import { useSyncExternalStore } from 'react';

// The app's motion policy on the web: under prefers-reduced-motion,
// decorative motion (shake, sparks, pulses, pops) is off and piece slides
// are kept short (timing.reducedMotionSlide), as on the app.

const QUERY = '(prefers-reduced-motion: reduce)';

function media(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(QUERY) : null;
}

/** Current value, for imperative code (the board engine, controllers). */
export function prefersReducedMotion(): boolean {
  return media()?.matches ?? false;
}

function subscribe(fn: () => void): () => void {
  const m = media();
  if (!m) return () => {};
  m.addEventListener('change', fn);
  return () => m.removeEventListener('change', fn);
}

/** Live value for components; false during SSR. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, prefersReducedMotion, () => false);
}
