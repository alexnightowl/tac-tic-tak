'use client';

import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';
import {
  forwardRef,
  useId,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';

import { useT } from '@/lib/i18n';
import { AppText } from './AppText';
import { Press } from './Press';
import './kit.css';

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

export type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'size' | 'disabled' | 'children'
> & {
  testID?: string;
  /** Accessible name; `label` names the field when given. */
  accessibilityLabel?: string;
  /** Field label above the well (11 px caps). */
  label?: string;
  /** Right side of the label row (`.cnt`: "12/40" counter or a short hint), 12/16 dust. */
  labelRight?: string;
  /** Leading glyph inside the well (search fields); 16 px dust. */
  leading?: ReactNode;
  /** Error message; also turns the border danger. */
  error?: string | null;
  /** Absolutely positioned control at the right edge (PasswordInput's eye). */
  accessory?: ReactNode;
  disabled?: boolean;
  /** Bio textarea: min 104 px, 15/22, a graphite-800 border. */
  multiline?: boolean;
  rows?: number;
  onChange?: (e: ChangeEvent<FieldElement>) => void;
  /** RN-style: the new text. */
  onChangeText?: (text: string) => void;
};

/**
 * Carved field (`eos-well`, 48 px, 1 px border → ember/70 on focus, danger
 * with an error). A real `<input>` (or `<textarea>` with `multiline`) with
 * its `<label>`, error text tied in through aria-describedby.
 */
export const Input = forwardRef<FieldElement, InputProps>(function Input(
  {
    testID,
    accessibilityLabel,
    label,
    labelRight,
    leading,
    error,
    accessory,
    disabled = false,
    multiline = false,
    rows,
    onChange,
    onChangeText,
    id: idProp,
    className,
    ...rest
  },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  const errId = `${id}-error`;
  const hasError = !!error;
  const field = {
    id,
    'data-testid': testID,
    'aria-label': label ? undefined : accessibilityLabel,
    'aria-invalid': hasError || undefined,
    'aria-describedby': hasError ? errId : undefined,
    disabled,
    className: clsx(
      'v2-input tv-input',
      leading ? 'v2-input--leading' : null,
      accessory ? 'v2-input--accessory' : null,
      className,
    ),
    onChange: (e: ChangeEvent<FieldElement>) => {
      onChange?.(e);
      onChangeText?.(e.target.value);
    },
  };

  return (
    <div className="v2-field">
      {label || labelRight ? (
        <div className="v2-field-head">
          {label ? (
            <AppText as="label" htmlFor={id} variant="label">
              {label}
            </AppText>
          ) : (
            <span />
          )}
          {labelRight ? (
            <AppText variant="caption" color="var(--eos-dust)" numberOfLines={1} className="v2-field-count v2-tabular">
              {labelRight}
            </AppText>
          ) : null}
        </div>
      ) : null}
      <div
        className="v2-input-well"
        data-multiline={multiline || undefined}
        data-error={hasError || undefined}
        data-disabled={disabled || undefined}
      >
        {leading ? <span className="v2-input-leading">{leading}</span> : null}
        {multiline ? (
          <textarea
            ref={ref as Ref<HTMLTextAreaElement>}
            rows={rows ?? 4}
            {...(rest as InputHTMLAttributes<HTMLTextAreaElement>)}
            {...field}
          />
        ) : (
          <input ref={ref as Ref<HTMLInputElement>} {...rest} {...field} />
        )}
        {accessory}
      </div>
      {hasError ? (
        <AppText
          id={errId}
          as="p"
          variant="caption"
          color="var(--semantic-danger)"
          testID={testID ? `${testID}-error` : undefined}
          role="alert"
          style={{ marginTop: 6 }}
        >
          {error}
        </AppText>
      ) : null}
    </div>
  );
});

export type PasswordInputProps = Omit<InputProps, 'type' | 'accessory' | 'multiline'> & {
  /** 'new' asks the password manager for a new password. */
  kind?: 'current' | 'new';
};

/** Input + eye toggle; password-manager autofill via autoComplete. */
export const PasswordInput = forwardRef<FieldElement, PasswordInputProps>(function PasswordInput(
  { kind = 'current', testID, ...rest },
  ref,
) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <Input
      ref={ref}
      testID={testID}
      autoComplete={kind === 'new' ? 'new-password' : 'current-password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      {...rest}
      type={visible ? 'text' : 'password'}
      accessory={
        <Press
          testID={testID ? `${testID}-eye` : undefined}
          aria-label={t(visible ? 'ui.password_hide' : 'ui.password_show')}
          onPress={() => setVisible((v) => !v)}
          className="v2-eye"
        >
          <Icon size={16} aria-hidden />
        </Press>
      }
    />
  );
});
