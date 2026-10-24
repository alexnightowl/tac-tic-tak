import { cn } from '@/lib/utils';

/** Slate card. `hero` adds the veiled slate texture used for the main call-to-action panels. */
export function Card({ className, hero, ...rest }: React.HTMLAttributes<HTMLDivElement> & { hero?: boolean }) {
  return (
    <div
      className={cn(
        hero
          ? 'tx-slate rounded-[12px] p-5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06),0_14px_30px_rgba(0,0,0,0.5)]'
          : 'glass rounded-[12px] p-4',
        className,
      )}
      {...rest}
    />
  );
}

/** Small caps label — Manrope 700, 11–12px, wide tracking. */
export function CardTitle({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-[11px] font-bold uppercase tracking-[0.12em] text-eos-ash mb-1', className)} {...rest} />;
}

/** Big tabular number. */
export function CardValue({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-2xl font-extrabold tabular-nums text-eos-bone', className)} {...rest} />;
}
