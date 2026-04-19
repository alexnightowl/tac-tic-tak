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
  green:    { light: '#ebecd0', dark: '#739552', lastMove: '#d8a53a', highlight: '#edd56b', label: 'Green' },
  brown:    { light: '#f0d9b5', dark: '#b58863', lastMove: '#c78b3a', highlight: '#e8cd5d', label: 'Brown' },
  blue:     { light: '#dee3e6', dark: '#8ca2ad', lastMove: '#3b82b5', highlight: '#9bd0e8', label: 'Blue' },
  gray:     { light: '#dcdcdc', dark: '#7d8796', lastMove: '#c9a041', highlight: '#e5d27a', label: 'Gray' },
  purple:   { light: '#efe6f6', dark: '#8f6fb5', lastMove: '#c49835', highlight: '#e7c77b', label: 'Purple' },
  ocean:    { light: '#e7ecef', dark: '#3c6f8a', lastMove: '#d6953d', highlight: '#efd17d', label: 'Ocean' },
  midnight: { light: '#cdd3dd', dark: '#394c6e', lastMove: '#d4a72c', highlight: '#e7ca6f', label: 'Midnight' },
  forest:   { light: '#e3ecd6', dark: '#4c6b35', lastMove: '#c49b30', highlight: '#e3cd64', label: 'Forest' },
  rose:     { light: '#f4e1de', dark: '#c27a78', lastMove: '#c49739', highlight: '#ecd077', label: 'Rose' },
  maple:    { light: '#f2d7a0', dark: '#b07038', lastMove: '#d68e3a', highlight: '#e9c673', label: 'Maple' },
};

export type BoardTheme = keyof typeof BOARD_THEMES;

export const PIECE_SETS = [
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
