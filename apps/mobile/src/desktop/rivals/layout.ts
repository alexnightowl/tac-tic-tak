import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * A container's measured width (the desktop pages size grids and charts
 * from their own box, not from the window, which the phone layout clamps).
 */
export function useWidth(): readonly [number, (e: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    setWidth((p) => (p === w ? p : w));
  };
  return [width, onLayout] as const;
}

/** Below this content width a two-column desktop page stacks its columns. */
export const TWO_COLUMN_MIN = 900;
