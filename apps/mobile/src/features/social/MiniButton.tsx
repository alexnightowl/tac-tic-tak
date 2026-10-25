import { control, eos, radii, semantic, space } from '@tac/core/tokens';
import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/ui/AppText';
import { Tap } from '@/ui/Tap';

/**
 * Compact row action (web btn-ember h-7 / bordered ghost), sized for list
 * rows; the hit area is padded to 44 pt.
 */
export function MiniButton({
  label,
  icon: Icon,
  variant = 'ghost',
  onPress,
  busy = false,
  disabled = false,
  testID,
  accessibilityLabel,
  iconOnly = false,
}: {
  label: string;
  icon?: LucideIcon;
  variant?: 'ember' | 'ghost';
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  testID: string;
  accessibilityLabel?: string;
  iconOnly?: boolean;
}) {
  const ember = variant === 'ember';
  const color = ember ? control.segmentedActiveText : eos.bone;
  return (
    <Tap
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy, disabled }}
      disabled={disabled || busy}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <View style={[styles.btn, ember ? styles.ember : styles.ghost, (disabled || busy) && styles.off, iconOnly && styles.icon]}>
        {busy ? <ActivityIndicator size="small" color={color} /> : Icon ? <Icon size={14} color={color} /> : null}
        {iconOnly ? null : (
          <AppText variant="label" color={color} numberOfLines={1}>
            {label}
          </AppText>
        )}
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 32,
    paddingHorizontal: space[2.5],
    borderRadius: radii.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
  },
  icon: { width: 36, paddingHorizontal: 0, justifyContent: 'center' },
  ember: { backgroundColor: eos.ember },
  ghost: { borderWidth: 1, borderColor: semantic.border, backgroundColor: control.ghostPressBg },
  off: { opacity: 0.6 },
});
