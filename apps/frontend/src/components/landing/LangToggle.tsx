'use client';

import { useLandingT } from '@/lib/landingI18n';
import { cn } from '@/lib/utils';

const OPTIONS: Array<{ value: 'en' | 'uk'; label: string }> = [
  { value: 'en', label: 'EN' },
  { value: 'uk', label: 'УК' },
];

/** Carved EN / УК switch (Ember on stone). */
export function LangToggle() {
  const { lang, setLang } = useLandingT();
  return (
    <div
      role="group"
      aria-label="Language"
      className="eos-well flex items-center rounded-lg p-[3px] text-[11px] font-extrabold tracking-[0.05em]"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          aria-pressed={lang === o.value}
          className={cn(
            'h-[26px] rounded-md px-[9px] transition-colors',
            lang === o.value ? 'bg-eos-rise text-eos-bone' : 'text-eos-dust hover:text-eos-bone',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
