import type { TFn } from '@/ui/lang';

/**
 * SAN with the app language's piece letters ("Nf6+" → "Кf6+" in uk):
 * the leading piece letter and a promotion piece. Castling stays O-O.
 */
export function localSan(san: string, t: TFn): string {
  const letter = (c: string) => t(`blind.piece.${c}`);
  let out = san.replace(/^[KQRBN]/, letter);
  out = out.replace(/=([QRBN])/, (_, p: string) => `=${letter(p)}`);
  return out;
}
