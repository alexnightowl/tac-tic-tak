'use client';

import { layout } from '@tac/core/tokens';
import clsx from 'clsx';
import { useRef, type CSSProperties, type KeyboardEvent } from 'react';

import { textClass } from './AppText';
import { Press } from './Press';
import { Well } from './Surfaces';
import './kit.css';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** 16 px mask icon before the label (play-setup styles), tinted with the label. A public URL. */
  icon?: string;
  /** Small pill after the label (`?2/5` calibration). */
  badge?: string;
  /** Accessible name override (defaults to label + badge). */
  accessibilityLabel?: string;
};

/**
 * - `md`: 38 px segments, 14 px labels (Stats/Achievements, Rivals style);
 * - `sm`: 32 px segments, 12 px labels (theme order, leaderboard scope, settings board rows);
 * - `tight`: the play-setup / theme-picker track — 38 px outside, 30 px segments, 14 px labels.
 */
export type SegmentedSize = 'sm' | 'md' | 'tight';

/**
 * - `carved` (default): page-level `.well` track (`inset 0 2px 4px`), active
 *   segment with a top highlight and a 2 px inner bottom shade;
 * - `soft`: the track inside a grouped list (settings language / board):
 *   `inset 0 2px 3px` + a bone/3 % ring, active segment with a small drop.
 */
export type SegmentedTone = 'carved' | 'soft';

export type SegmentedProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: SegmentedSize;
  tone?: SegmentedTone;
  /** Each tab gets `${testID}-${value}`. */
  testID?: string;
  accessibilityLabel: string;
  /** Width etc. (stretches by default; Rivals' scope switch is 220 wide). */
  className?: string;
  style?: CSSProperties;
};

/**
 * Carved track with one ember plate that slides between segments (CSS
 * transform, the app's toggle timing; instant under reduced motion). A
 * WAI-ARIA tablist: arrows / Home / End move the selection.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  tone = 'carved',
  testID,
  accessibilityLabel,
  className,
  style,
}: SegmentedProps<T>) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const n = options.length;
  const h = layout.segmentedHeight[size];
  const labelClass = textClass(size === 'sm' ? 'segmentedSm' : 'segmented');
  const tabs = useRef<(HTMLElement | null)[]>([]);

  const select = (i: number) => {
    const o = options[i];
    tabs.current[i]?.focus();
    if (o && o.value !== value) onChange(o.value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? (index + 1) % n
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? (index - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : -1;
    if (next < 0) return;
    e.preventDefault();
    select(next);
  };

  return (
    <Well
      tone={tone}
      role="tablist"
      aria-label={accessibilityLabel}
      testID={testID}
      className={clsx('v2-seg', tone === 'soft' && 'v2-seg--soft', className)}
      style={style}
    >
      <span
        className="v2-seg-plate"
        aria-hidden
        style={{
          width: `calc((100% - ${layout.segmentedTrackPadding * 2}px) / ${n})`,
          height: h,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o, i) => {
        const on = i === index;
        return (
          <Press
            key={o.value}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            testID={testID ? `${testID}-${o.value}` : undefined}
            role="tab"
            aria-selected={on}
            aria-label={o.accessibilityLabel ?? (o.badge ? `${o.label}, ${o.badge}` : undefined)}
            tabIndex={on ? 0 : -1}
            onPress={() => {
              if (!on) onChange(o.value);
            }}
            onKeyDown={onKeyDown}
            className="v2-seg-tab"
            style={{ height: h }}
          >
            {o.icon ? (
              <span
                className="v2-seg-icon"
                aria-hidden
                style={{ maskImage: `url(${o.icon})`, WebkitMaskImage: `url(${o.icon})`, maskSize: 'contain', WebkitMaskSize: 'contain' }}
              />
            ) : null}
            <span className={clsx('v2-text v2-trunc', labelClass)}>{o.label}</span>
            {o.badge ? (
              <span
                className={clsx('v2-text v2-seg-badge', textClass('captionStrong'))}
                style={{ fontSize: 9, lineHeight: '12px' }}
              >
                {o.badge}
              </span>
            ) : null}
          </Press>
        );
      })}
    </Well>
  );
}
