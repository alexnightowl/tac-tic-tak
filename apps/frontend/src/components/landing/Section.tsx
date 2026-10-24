import { cn } from '@/lib/utils';

export function Eyebrow({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div className={cn('text-xs font-extrabold uppercase tracking-[0.16em] text-eos-ember', center && 'text-center')}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, center, className }: { children: React.ReactNode; center?: boolean; className?: string }) {
  return (
    <h2 className={cn('mt-3 font-serif text-[34px] font-bold leading-[1.12] text-eos-bone md:text-[50px]', center && 'text-center', className)}>
      {children}
    </h2>
  );
}
