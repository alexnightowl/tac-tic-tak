'use client';

import clsx from 'clsx';

import { Press } from './Press';
import './kit.css';

export type ToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel: string;
  /** Id of the visible label instead of accessibilityLabel. */
  labelledBy?: string;
};

/**
 * Carved-well switch (`.tg`, 48 × 28, thumb 24): the well and the ember
 * track stacked, so each keeps its own inset shadow; the ember fades in and
 * the thumb slides with the 200 ms ease-out of the app.
 */
export function Toggle({ value, onChange, disabled = false, testID, accessibilityLabel, labelledBy }: ToggleProps) {
  return (
    <Press
      testID={testID}
      role="switch"
      aria-checked={value}
      aria-label={labelledBy ? undefined : accessibilityLabel}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onPress={() => onChange(!value)}
      className={clsx('v2-toggle')}
    >
      <span className="v2-toggle-track v2-toggle-well" />
      <span className="v2-toggle-track v2-toggle-ember" />
      <span className="v2-toggle-thumb" />
    </Press>
  );
}
