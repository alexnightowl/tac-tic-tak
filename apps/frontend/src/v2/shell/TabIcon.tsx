/* eslint-disable @next/next/no-img-element -- painted 24 px nav icon */
import type { ShellTabId } from './tabs';

/** The Learn tab's open book (canvas LearnHome nav). */
const LEARN = 'M2.5 5.5c3-1.3 6.2-1.3 9.5.8 3.3-2.1 6.5-2.1 9.5-.8v13c-3-1.3-6.2-1.3-9.5.8-3.3-2.1-6.5-2.1-9.5-.8zM12 6.3v13';

/**
 * The app's tab glyphs (shell/TabBar.tsx TabIcon) in a 28 × 24 box. They
 * draw in `currentColor`, so the tab's bone/dust colour transition
 * crossfades them; Home keeps its painted colours and dims to 0.5 when
 * idle. Line icons are 1.8 px, 2 px when active.
 */
export function TabIcon({ id, active }: { id: ShellTabId; active: boolean }) {
  const sw = active ? 2 : 1.8;
  let glyph;
  switch (id) {
    case 'home':
      glyph = (
        <img
          src="/v2/icons/nav-home@2x.webp"
          srcSet="/v2/icons/nav-home@2x.webp 2x, /v2/icons/nav-home@3x.webp 3x"
          width={24}
          height={24}
          alt=""
          draggable={false}
          className="v2-tab-home"
          style={{ opacity: active ? 1 : 0.5 }}
        />
      );
      break;
    case 'play':
      glyph = <span className="v2-tab-mask" style={{ maskImage: 'url(/v2/icons/nav-play@3x.webp)', WebkitMaskImage: 'url(/v2/icons/nav-play@3x.webp)' }} />;
      break;
    case 'learn':
      glyph = (
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d={LEARN} />
        </svg>
      );
      break;
    case 'rivals':
      glyph = (
        <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <rect x={3.5} y={3.5} width={17} height={17} rx={1.5} />
          <path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" />
        </svg>
      );
      break;
    default:
      glyph = (
        <svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
      );
  }
  return (
    <span className="v2-tab-icon" aria-hidden>
      {glyph}
    </span>
  );
}
