// Native: the desktop screens never render (useDesktop() is false), so each
// export is an empty stand-in with the web export's name and props.
import type { CreateParams } from '@/features/challenge/useCreate';

export function DxHome() {
  return null;
}
export function DxPlay(_: { levelsOpen?: boolean; onLevelsClose?: () => void } = {}) {
  return null;
}
export function DxStormIntro() {
  return null;
}
export function DxStormResult(_: { clientId: string }) {
  return null;
}
export function DxChallenge(_: CreateParams) {
  return null;
}
