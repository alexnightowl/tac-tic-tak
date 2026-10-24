import { createElement, type CSSProperties } from 'react';
import { Puzzle } from 'lucide-react';

/**
 * Puzzle-theme glyphs from the Lichess project (game-icons.net, CC BY 3.0 —
 * see /public/design/themes/CREDITS.md). They're single-colour SVGs, so we
 * render them as CSS masks filled with `currentColor`; callers keep using
 * them like a lucide icon: `<Icon size={16} className="text-…" />`.
 */
const LICHESS_THEMES = new Set<string>(["advancedPawn", "anastasiaMate", "arabianMate", "attackingF2F7", "attraction", "backRankMate", "bishopEndgame", "bodenMate", "capturingDefender", "castling", "defensiveMove", "deflection", "discoveredAttack", "doubleBishopMate", "doubleCheck", "dovetailMate", "enPassant", "exposedKing", "fork", "hangingPiece", "hookMate", "interference", "intermezzo", "killBoxMate", "kingsideAttack", "knightEndgame", "mate", "pawnEndgame", "pin", "promotion", "queenEndgame", "queenRookEndgame", "queensideAttack", "quietMove", "rookEndgame", "sacrifice", "skewer", "smotheredMate", "trappedPiece", "underPromotion", "vukovicMate", "xRayAttack", "zugzwang"]);

type IconProps = { size?: number; className?: string; strokeWidth?: number; style?: CSSProperties };
export type ThemeIconComponent = (props: IconProps) => ReturnType<typeof createElement>;

const cache = new Map<string, ThemeIconComponent>();

function maskIcon(file: string): ThemeIconComponent {
  const hit = cache.get(file);
  if (hit) return hit;
  const url = `url(/design/themes/${file}.svg)`;
  const C: ThemeIconComponent = ({ size = 16, className, style }) =>
    createElement('span', {
      'aria-hidden': true,
      className: ['inline-block shrink-0 bg-current', className].filter(Boolean).join(' '),
      // Lichess glyphs carry little padding, so render ~20% larger than
      // the equivalent lucide size to match optical weight.
      style: {
        width: Math.round(size * 1.2),
        height: Math.round(size * 1.2),
        WebkitMask: `${url} center / contain no-repeat`,
        mask: `${url} center / contain no-repeat`,
        ...style,
      },
    });
  cache.set(file, C);
  return C;
}

export function themeIcon(slug: string): ThemeIconComponent {
  if (LICHESS_THEMES.has(slug)) return maskIcon(slug);
  if (slug === 'mate' || slug.startsWith('mateIn')) return maskIcon('mate');
  return Puzzle as unknown as ThemeIconComponent;
}
