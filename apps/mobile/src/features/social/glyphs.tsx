import Svg, { Path } from 'react-native-svg';

// Glyphs drawn on the design v2 canvas that lucide lacks. Shared by the
// leaderboard, profile and achievements.

/** The canvas streak flame (filled, even-odd inner tongue), 24-unit box. */
export const FLAME_PATH =
  'M12 23C7.6 23 4.5 20 4.5 15.8C4.5 12.6 6.2 10.4 7.6 9C7.6 10.8 8.2 12 9.4 12.6C8.9 8.6 10.6 4.6 14.2 1.2C13.6 4.8 14.6 7.6 16.4 9.8C17.2 10.8 17.6 11.8 17.6 12.6C18.4 12 18.8 11 18.9 10.2C20.2 11.8 20.5 13.6 20.5 15.4C20.5 19.8 16.8 23 12 23ZM12.4 22.2C10.4 22.2 9.2 20.9 9.2 19.4C9.2 17.9 10.3 16.9 11.1 16.2C11.2 17.2 11.7 17.8 12.3 18C12.2 16.7 12.9 15.4 14.2 14.4C14.1 15.8 14.9 16.9 15.4 17.8C15.7 18.4 15.8 19 15.8 19.5C15.8 21.1 14.3 22.2 12.4 22.2Z';

export function FlameGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d={FLAME_PATH} fill={color} fillRule="evenodd" />
    </Svg>
  );
}
