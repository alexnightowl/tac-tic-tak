import { cn } from '@/lib/utils';

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('glass rounded-2xl p-4', className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-xs uppercase tracking-wider text-zinc-400 mb-1', className)} {...rest} />;
}

export function CardValue({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-2xl font-semibold text-white', className)} {...rest} />;
}
