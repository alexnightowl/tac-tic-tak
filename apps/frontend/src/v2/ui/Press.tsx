'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { forwardRef, type AriaAttributes, type Ref, type CSSProperties, type KeyboardEventHandler, type ReactNode } from 'react';

import './kit.css';

/**
 * The web's stand-in for the app's `Tap`: a real `<button>` (or a Next
 * `<Link>` when `href` is set) with the kit's reset and focus ring. Press
 * feedback is CSS (`:active`), so nothing re-renders on press.
 */
export type PressProps = AriaAttributes & {
  onPress?: () => void;
  /** Navigate instead of calling onPress (renders an `<a>`). */
  href?: string;
  disabled?: boolean;
  /** Button type (default `button`). */
  type?: 'button' | 'submit';
  role?: string;
  tabIndex?: number;
  id?: string;
  title?: string;
  testID?: string;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export const Press = forwardRef<HTMLElement, PressProps>(function Press(
  { onPress, href, disabled = false, type = 'button', testID, className, children, ...rest },
  ref,
) {
  const cls = clsx('v2-reset v2-focus', className);
  if (href && !disabled) {
    return (
      <Link
        ref={ref as Ref<HTMLAnchorElement>}
        href={href}
        className={cls}
        data-testid={testID}
        onClick={onPress}
        {...rest}
      >
        {children}
      </Link>
    );
  }
  return (
    <button
      ref={ref as Ref<HTMLButtonElement>}
      type={type}
      className={cls}
      disabled={disabled}
      data-testid={testID}
      onClick={onPress}
      {...rest}
    >
      {children}
    </button>
  );
});
