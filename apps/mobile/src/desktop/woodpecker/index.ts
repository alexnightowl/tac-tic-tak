// Native: the desktop screens never render (useDesktop() is false), so each
// export is an empty stand-in with the web export's name and props.
export function DxWoodpecker(_: { setId?: string }) {
  return null;
}
export function DxWoodpeckerSolve(_: { setId: string; cycle: number; start: number }) {
  return null;
}
export function DxWoodpeckerCard() {
  return null;
}
