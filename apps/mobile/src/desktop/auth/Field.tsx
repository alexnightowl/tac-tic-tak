import { alpha, semantic } from '@tac/core/tokens';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState, type ComponentRef, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { feel } from '@/feel';
import { fontFamily } from '@/ui/fonts';
import { useLang, useT } from '@/ui/lang';
import { DText, Label } from '../kit';
import { dx } from '../tokens';

type FieldProps = Omit<TextInputProps, 'style'> & {
  testID: string;
  label: string;
  error?: string | null;
  /** Password field: masked, with the eye toggle. */
  secret?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

/**
 * .inp with its .lbl above (DXLogin / DXRegister): 46 px well, #18161a,
 * 1 px edge; focused = 1.5 px ember edge + a 4 px ember halo. The eye on a
 * password field flips the mask.
 */
export function Field({ testID, label, error, secret, ref, onFocus, onBlur, ...rest }: FieldProps) {
  const t = useT();
  const { lang } = useLang();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <View>
      <Label size={10.5} style={styles.label}>
        {label}
      </Label>
      <View style={[styles.well, focused && styles.focus, !!error && styles.errorRing]}>
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={label}
          accessibilityHint={error ?? undefined}
          placeholderTextColor={dx.dust}
          selectionColor={dx.ember}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          {...rest}
          secureTextEntry={secret ? !visible : undefined}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { fontFamily: fontFamily(lang, 'body', 500) }]}
        />
        {secret ? (
          <Pressable
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
            <Icon size={18} color={dx.dust} strokeWidth={1.8} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <DText size={12.5} color={semantic.danger} testID={`${testID}-error`} style={styles.error}>
          {error}
        </DText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 8 },
  well: {
    height: 46,
    borderRadius: 10,
    backgroundColor: dx.input,
    flexDirection: 'row',
    alignItems: 'center',
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.inputEdge, inset: true }],
  },
  focus: {
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: dx.ember, inset: true },
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 4, color: alpha(dx.ember, 0.18) },
    ],
  },
  errorRing: {
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: semantic.danger, inset: true }],
  },
  input: { flex: 1, alignSelf: 'stretch', paddingHorizontal: 14, fontSize: 14.5, color: dx.bone },
  eye: { width: 44, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  error: { marginTop: 8 },
});
