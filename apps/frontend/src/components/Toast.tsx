'use client';

import { useEffect } from 'react';
import { Trophy, X } from 'lucide-react';
import { useToastStore, type Toast as T } from '@/lib/toast';
import { ACHIEVEMENT_ICON_MAP } from '@/components/achievements/icons';
import { cn } from '@/lib/utils';

const AUTO_DISMISS_MS = 4500;

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="fixed top-3 right-3 z-[200] flex flex-col gap-2 pointer-events-none w-[min(360px,calc(100vw-1.5rem))]"
         style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {toasts.map((t) => (
        <ToastCard key={t.id} t={t} />
      ))}
    </div>
  );
}

function ToastCard({ t }: { t: T }) {
  const dismiss = useToastStore((s) => s.dismiss);
  useEffect(() => {
    const id = setTimeout(() => dismiss(t.id), AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [t.id, dismiss]);

  const Icon = t.achievementSlug
    ? ACHIEVEMENT_ICON_MAP[t.achievementSlug] ?? Trophy
    : Trophy;

  return (
    <div
      className={cn(
        'pointer-events-auto glass rounded-2xl px-3 py-3 shadow-2xl flex items-start gap-3',
        'border border-amber-300/30',
        'animate-[slideInRight_220ms_ease-out]',
      )}
    >
      <div
        className="h-10 w-10 rounded-xl shrink-0 flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #fde68a 0%, #f59e0b 60%, #d97706 100%)',
        }}
        aria-hidden
      >
        <Icon size={20} className="text-amber-950" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-amber-300 leading-none">
          {t.tone === 'achievement' ? 'Achievement' : 'Notice'}
        </div>
        <div className="text-sm font-semibold text-white mt-1 truncate">{t.title}</div>
        {t.description && (
          <div className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{t.description}</div>
        )}
      </div>
      <button
        onClick={() => dismiss(t.id)}
        className="text-zinc-400 hover:text-white shrink-0 -mr-1 -mt-1 p-1"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
