'use client';

import { useLandingT } from '@/lib/landingI18n';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{ value: 'en' | 'uk'; label: string }> = [
  { value: 'en', label: 'EN' },
  { value: 'uk', label: 'УК' },
];

type Props = {
  tone?: 'dark' | 'light';
};

export function LangToggle({ tone = 'dark' }: Props) {
  const { lang, setLang } = useLandingT();
  const isLight = tone === 'light';
  return (
    <div
      role="group"
      aria-label="Language"
      className={cn(
        'flex items-center rounded-lg p-0.5 text-[11px] font-semibold tracking-wider border',
        isLight
          ? 'bg-black/5 border-black/10'
          : 'bg-white/5 border-white/10',
      )}
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
              ? isLight ? 'bg-black/10 text-black' : 'bg-white/10 text-white'
              : isLight ? 'text-[#6a6a6a] hover:text-black' : 'text-zinc-500 hover:text-zinc-300',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
