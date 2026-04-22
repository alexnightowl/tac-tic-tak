'use client';

import { useInView } from '@/lib/useInView';
import { cn } from '@/lib/utils';

type Props = {
  as?: 'div' | 'section' | 'article' | 'li' | 'span';
  delay?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  className?: string;
  children: React.ReactNode;
};

/**
 * Fades children in + 24px upward slide when they scroll into view.
 */
export function Reveal({ as = 'div', delay = 0, className, children }: Props) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.15 });
  const Tag = as as any;
  return (
    <Tag
      ref={ref}
      className={cn(
        'reveal',
        inView && 'is-in',
        delay > 0 && `delay-${delay}`,
        className,
      )}
    >
      {children}
    </Tag>
  );
}
