export type ThemeColors = {
  /** Square colours. */
  light: string;
  dark: string;
  /** Colour used for the pulse-free last-move ring (harmonises with theme). */
  lastMove: string;
  /** Colour for the currently selected square ring. */
  highlight: string;
  /** Label shown in settings. */
  label: string;
};

export const BOARD_THEMES: Record<string, ThemeColors> = {
  // Ember on stone — the one board of the app (marble + slate textures
  // are layered on top of these fills by the Chessboard component).
  stone:    { light: '#cdcfd5', dark: '#505059', lastMove: '#3a6296', highlight: '#3a6296', label: 'Stone' },
  green:    { light: '#eeeed4', dark: '#7a965c', lastMove: '#d4a84c', highlight: '#ecd77b', label: 'Green' },
  brown:    { light: '#f0dcbb', dark: '#b38c6c', lastMove: '#c38f4a', highlight: '#e7cf6f', label: 'Brown' },
  blue:     { light: '#e2e5e6', dark: '#93a4ac', lastMove: '#4884ae', highlight: '#a5d1e3', label: 'Blue' },
  gray:     { light: '#e0dedc', dark: '#838a96', lastMove: '#c7a352', highlight: '#e5d488', label: 'Gray' },
  purple:   { light: '#f2e9f4', dark: '#9075af', lastMove: '#c19b46', highlight: '#e6ca88', label: 'Purple' },
  ocean:    { light: '#ebeeee', dark: '#477187', lastMove: '#d1994d', highlight: '#eed38b', label: 'Ocean' },
  midnight: { light: '#d1d5dc', dark: '#40506c', lastMove: '#d1aa41', highlight: '#e6cc7e', label: 'Midnight' },
  forest:   { light: '#e7eed9', dark: '#536d3e', lastMove: '#c29e42', highlight: '#e3cf74', label: 'Forest' },
  rose:     { light: '#f5e4df', dark: '#bd807d', lastMove: '#c19a4a', highlight: '#ebd285', label: 'Rose' },
  maple:    { light: '#f2daa9', dark: '#ac7545', lastMove: '#d0934a', highlight: '#e7c981', label: 'Maple' },
};

export type BoardTheme = keyof typeof BOARD_THEMES;

export const PIECE_SETS = [
  'ember',
  'cburnett',
  'merida',
  'alpha',
  'california',
  'cardinal',
  'chess7',
  'staunty',
  'fantasy',
  'maestro',
  'pirouetti',
] as const;

export type PieceSet = typeof PIECE_SETS[number];

export const PIECE_SET_LABELS: Record<PieceSet, string> = {
  ember: 'Ember',
  cburnett: 'Cburnett',
  merida: 'Merida',
  alpha: 'Alpha',
  california: 'California',
  cardinal: 'Cardinal',
  chess7: 'Chess 7',
  staunty: 'Staunty',
  fantasy: 'Fantasy',
  maestro: 'Maestro',
  pirouetti: 'Pirouetti',
};
