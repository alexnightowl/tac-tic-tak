'use client';

import { themeIcon } from '@/lib/theme-icons';
import { themeLabel } from '@/lib/theme-labels';
import { useLandingT } from '@/lib/landingI18n';

const SLUGS = [
  'fork', 'pin', 'skewer', 'discoveredAttack', 'sacrifice', 'deflection', 'attraction',
  'backRankMate', 'smotheredMate', 'zugzwang', 'interference', 'promotion', 'xRayAttack', 'quietMove',
];

export function Motifs() {
  const { t, lang } = useLandingT();
  return (
    <section className="bg-eos-shade px-4 py-7 shadow-[inset_0_1px_0_#2c2a31,inset_0_-1px_0_#2c2a31] md:px-6 md:py-[30px]">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 md:flex-row md:gap-9">
        <div className="shrink-0 whitespace-pre-line text-center text-[11px] font-extrabold leading-normal tracking-[0.12em] text-eos-dust md:text-left md:text-xs">
          {t('motifs.label')}
        </div>
        <div className="hidden w-px self-stretch bg-eos-seam md:block" />
        <div className="flex flex-wrap justify-center gap-x-[18px] gap-y-3.5 md:justify-start md:gap-x-[30px]">
          {SLUGS.map((s) => {
            const Icon = themeIcon(s);
            return (
              <span key={s} className="inline-flex items-center gap-2 text-[13px] font-bold text-eos-ash md:text-sm">
                <Icon size={17} className="text-eos-bone" />
                {themeLabel(s, lang)}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
