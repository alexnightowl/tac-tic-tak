export const BOARD_THEMES = {
  green:    { light: '#ebecd0', dark: '#739552', label: 'Green' },
  brown:    { light: '#f0d9b5', dark: '#b58863', label: 'Brown' },
  blue:     { light: '#dee3e6', dark: '#8ca2ad', label: 'Blue' },
  gray:     { light: '#dcdcdc', dark: '#7d8796', label: 'Gray' },
  purple:   { light: '#efe6f6', dark: '#8f6fb5', label: 'Purple' },
  ocean:    { light: '#e7ecef', dark: '#3c6f8a', label: 'Ocean' },
  midnight: { light: '#cdd3dd', dark: '#394c6e', label: 'Midnight' },
  forest:   { light: '#e3ecd6', dark: '#4c6b35', label: 'Forest' },
  rose:     { light: '#f4e1de', dark: '#c27a78', label: 'Rose' },
  maple:    { light: '#f2d7a0', dark: '#b07038', label: 'Maple' },
} as const;

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
