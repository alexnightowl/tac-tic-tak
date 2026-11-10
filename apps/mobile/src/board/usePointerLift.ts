import type { RefObject } from 'react';
import type { HostInstance } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

/** Native boards are touched with a finger: the lift stays (web only, see the .web file). */
export function usePointerLift(_target: RefObject<HostInstance | null>, _liftSq: SharedValue<number>): void {}
