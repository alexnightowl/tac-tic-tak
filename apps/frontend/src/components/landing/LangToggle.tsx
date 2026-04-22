'use client';

import { useLandingT } from '@/lib/landingI18n';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{ value: 'en' | 'uk'; label: string }> = [
  { value: 'en', label: 'EN' },
  { value: 'uk', label: 'УК' },
];

export function LangToggle() {
  const { lang, setLang } = useLandingT();
  return (
    <div
      role="group"
      aria-label="Language"
      className="flex items-center rounded-lg bg-white/5 border border-white/10 p-0.5 text-[11px] font-semibold tracking-wider"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          aria-pressed={lang === o.value}
          className={cn(
            'h-7 px-2.5 rounded-md transition-colors',
            lang === o.value
              ? 'bg-white/10 text-white'
              : 'text-zinc-500 hover:text-zinc-300',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
