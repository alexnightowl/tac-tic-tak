import { useRawWindow } from '@/platform/webFrame';
import { dxSize } from '../tokens';

/**
 * True when the page body (window less the full sidebar and the page
 * gutters) is at least `min` px wide: the two-column artboard layout.
 * Narrower desktop windows (1024–1279) stack the right column under the
 * main one instead of squeezing both.
 */
export function useTwoColumns(min: number): boolean {
  const { width } = useRawWindow();
  return width - dxSize.sidebar - dxSize.padX * 2 >= min;
}
