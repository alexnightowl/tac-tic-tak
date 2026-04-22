import { RefObject, useEffect, useRef, useState } from 'react';

type Options = {
  /** Start triggering when the element enters with this much margin. */
  rootMargin?: string;
  /** Fraction of the element that must be visible (0-1). */
  threshold?: number;
  /** Fire once, then unobserve — perfect for scroll-reveal-only effects. */
  once?: boolean;
};

/**
 * Observe an element with IntersectionObserver and expose a boolean flag.
 * Purely visual — don't use this for anything layout-shifting.
 */
export function useInView<T extends HTMLElement>(
  { rootMargin = '-10% 0px', threshold = 0.1, once = true }: Options = {},
): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            if (once) obs.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { rootMargin, threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin, threshold, once]);

  return [ref, inView];
}
