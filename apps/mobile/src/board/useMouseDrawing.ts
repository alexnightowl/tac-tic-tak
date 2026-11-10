import type { Orientation } from '@tac/core/board';
import type { RefObject } from 'react';
import type { HostInstance } from 'react-native';
import type { Drawing } from './drawing';

/** Right-click drawing is a mouse feature: phones have no input for it yet (web only, see the .web file). */
export function useMouseDrawing(
  _target: RefObject<HostInstance | null>,
  _drawing: Drawing,
  _geo: { size: number; orientation: Orientation; mirror: boolean },
): void {}
