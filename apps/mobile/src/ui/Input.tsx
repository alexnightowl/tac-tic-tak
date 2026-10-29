import { eos, graphite, layout, radii, semantic, shadows, space, surface } from '@tac/core/tokens';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { feel } from '@/feel';
import { AppText, textStyle } from './AppText';
import { useLang } from './lang';
import { colorsTiming } from './motion';
import { useUiT } from './strings';
import { Tap } from './Tap';

export type InputProps = Omit<TextInputProps, 'style'> & {
  testID: string;
  accessibilityLabel: string;
  /** Field label above the well (CardTitle style). */
  label?: string;
  /** Right side of the label row (`.cnt`: "12/40" counter or a short hint), 12/16 dust. */
  labelRight?: string;
  /** Leading glyph inside the well (search fields); 16 pt dust. */
  leading?: ReactNode;
  /** Error message; also turns the border danger. */
  error?: string | null;
  /** Absolutely positioned control at the right edge (PasswordInput's eye). */
  accessory?: ReactNode;
  disabled?: boolean;
};

/**
 * Carved field (`eos-well`, 48 pt, 1 pt #312f34 border → ember/70 on focus).
 * The focus ring is a SharedValue crossfade, so focusing never re-renders.
 */
export function Input({
  testID,
  accessibilityLabel,
  label,
  labelRight,
  leading,
  error,
  accessory,
  disabled = false,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const multiline = !!rest.multiline;
  const restBorder = multiline ? surface.textareaBorder : surface.inputBorder;
  const { lang } = useLang();
  const focus = useSharedValue(0);
  const hasError = !!error;

  const ring = useAnimatedStyle(() => ({
    borderColor: hasError
      ? semantic.danger
      : interpolateColor(focus.get(), [0, 1], [restBorder, surface.inputBorderFocus]),
  }));

  return (
    <View style={styles.root}>
      {label || labelRight ? (
        <View style={styles.head}>
          {label ? <AppText variant="label">{label}</AppText> : <View />}
          {labelRight ? (
            <AppText variant="caption" color={eos.dust} style={styles.count} numberOfLines={1}>
              {labelRight}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <Animated.View
        style={[styles.well, multiline && styles.wellMulti, leading ? styles.withLeading : null, ring, disabled && styles.disabled]}
      >
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <TextInput
          testID={testID}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={error ?? undefined}
          editable={!disabled}
          placeholderTextColor={eos.dust}
          selectionColor={eos.ember}
          cursorColor={eos.ember}
          keyboardAppearance="dark"
          maxFontSizeMultiplier={1.4}
          {...rest}
          onFocus={(e) => {
            focus.set(withTiming(1, colorsTiming));
            onFocus?.(e);
          }}
          onBlur={(e) => {
            focus.set(withTiming(0, colorsTiming));
            onBlur?.(e);
          }}
          style={[
            textStyle('input', lang),
            styles.input,
            multiline && styles.inputMulti,
            leading ? styles.inputLeading : null,
            accessory ? styles.withAccessory : null,
          ]}
        />
        {accessory}
      </Animated.View>
      {hasError ? (
        <AppText variant="caption" color={semantic.danger} testID={`${testID}-error`} style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

export type PasswordInputProps = Omit<InputProps, 'secureTextEntry' | 'accessory'> & {
  /** 'new' drives the iOS strong-password / Android new-password autofill. */
  kind?: 'current' | 'new';
};

/** Input + eye toggle; keychain autofill via textContentType/autoComplete. */
export function PasswordInput({ kind = 'current', testID, ...rest }: PasswordInputProps) {
  const t = useUiT();
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <Input
      testID={testID}
      textContentType={kind === 'new' ? 'newPassword' : 'password'}
      autoComplete={kind === 'new' ? 'new-password' : 'current-password'}
      passwordRules={kind === 'new' ? 'minlength: 8; required: lower; required: digit;' : undefined}
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      {...rest}
      secureTextEntry={!visible}
      accessory={
        <Tap
          testID={`${testID}-eye`}
          accessibilityRole="button"
          accessibilityLabel={t(visible ? 'ui.password_hide' : 'ui.password_show')}
          accessibilityState={{ checked: visible }}
          onPress={() => {
            feel.emit('toggle');
            setVisible((v) => !v);
          }}
          style={styles.eye}
        >
          <Icon size={16} color={graphite[400]} />
        </Tap>
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'stretch' },
  // `.head`: label left, counter right, baseline-aligned, 6 pt above the well.
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space[2],
    marginBottom: space[1.5],
  },
  count: { flexShrink: 1, textAlign: 'right', fontVariant: ['tabular-nums'] },
  well: {
    height: layout.inputHeight,
    borderRadius: radii.control,
    borderWidth: 1,
    backgroundColor: eos.well,
    boxShadow: [...shadows.well],
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  // Bio textarea: min 104, padding 12/14, 15/22, a graphite-800 border.
  wellMulti: { height: undefined, minHeight: 104, justifyContent: 'flex-start' },
  withLeading: { flexDirection: 'row', alignItems: 'center' },
  leading: { paddingLeft: layout.inputPaddingX },
  input: { flex: 1, paddingHorizontal: layout.inputPaddingX, paddingVertical: 0 },
  inputMulti: { paddingVertical: space[3], lineHeight: 22, textAlignVertical: 'top', minHeight: 104 },
  inputLeading: { paddingLeft: space[2] },
  withAccessory: { paddingRight: 40 },
  eye: {
    position: 'absolute',
    right: 0,
    top: 1,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { marginTop: space[1.5] },
});
