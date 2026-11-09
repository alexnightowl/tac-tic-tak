import { alpha, eos, tone } from '@tac/core/tokens';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { fontFamily } from '@/ui/fonts';
import { useLang } from '@/ui/lang';
import { DText, Hover } from '../kit';
import { dx } from '../tokens';

// Pieces shared by the home-area desktop pages (DXHome, DXPlay*, DXStorm*,
// DXChallenge): the .card2 surface, the radio option card, summary rows,
// the "Other modes" card and the .inp text field.

/** .card2: the inner panel (#2b292f, r 12, faint edge). */
export function Card2({ children, style, testID }: { children?: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View style={[styles.card2, style]} testID={testID}>
      {children}
    </View>
  );
}

/** The 20 px radio mark: a 6 px rose ring when on, a thin iron ring off. */
export function RadioMark({ on }: { on: boolean }) {
  return <View style={[styles.radio, on ? styles.radioOn : styles.radioOff]} />;
}

/**
 * A radio option card (DXPlay mode cards, DXChallenge mode): icon square or
 * radio, title, description; `on` = ember outline on the warm ground.
 */
export function OptionCard({
  title,
  desc,
  icon,
  on,
  onPress,
  disabled,
  badge,
  radioFirst,
  testID,
  style,
}: {
  title: string;
  desc: string;
  icon?: ReactNode;
  on: boolean;
  onPress?: () => void;
  disabled?: boolean;
  badge?: ReactNode;
  /** The radio leads (DXChallenge) instead of trailing (DXPlay). */
  radioFirst?: boolean;
  testID: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Hover
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={`${title}. ${desc}`}
      selected={on}
      disabled={disabled}
      onPress={onPress}
      style={[styles.card2, styles.option, radioFirst && styles.optionTop, on && styles.picked, style]}
      hoverStyle={on ? styles.none : styles.optionHover}
    >
      {radioFirst ? <RadioMark on={on} /> : null}
      {icon ? <View style={[styles.optIcon, on && styles.optIconOn]}>{icon}</View> : null}
      <View style={styles.flex}>
        <View style={styles.row8}>
          <DText size={15} weight={800}>
            {title}
          </DText>
          {badge}
        </View>
        <DText size={12.5} color={dx.ash} lh={18} style={styles.mt2}>
          {desc}
        </DText>
      </View>
      {radioFirst ? null : <RadioMark on={on} />}
    </Hover>
  );
}

/** A label / value row of the summary card (13.5 px, rule below). */
export function SummaryRow({ label, value, last, testID }: { label: string; value: string; last?: boolean; testID?: string }) {
  return (
    <View style={[styles.sumRow, !last && styles.sumRule]}>
      <DText size={13.5} color={dx.ash}>
        {label}
      </DText>
      <DText size={13.5} weight={700} numberOfLines={1} style={styles.sumValue} testID={testID}>
        {value}
      </DText>
    </View>
  );
}

/** "Other modes" card: rose glyph square, Cinzel title, caption, chevron. */
export function ModeLink({ title, sub, icon: Icon, glyph, onPress, testID }: { title: string; sub: string; icon?: LucideIcon; glyph?: ReactNode; onPress: () => void; testID: string }) {
  return (
    <Hover testID={testID} accessibilityRole="link" accessibilityLabel={`${title}, ${sub}`} onPress={onPress} style={[styles.card2, styles.modeLink]} hoverStyle={styles.optionHover}>
      <View style={styles.linkIcon}>{Icon ? <Icon size={18} color={tone.rose} strokeWidth={1.8} /> : glyph}</View>
      <View style={styles.flex}>
        <DText serif weight={700} size={15} numberOfLines={1}>
          {title}
        </DText>
        <DText size={12} color={dx.ash} numberOfLines={1} style={styles.mt2}>
          {sub}
        </DText>
      </View>
      <ChevronRight size={16} color={dx.dust} strokeWidth={1.8} />
    </Hover>
  );
}

/** .inp: the 44 px carved text field with an optional leading glyph. */
export function DInput({ icon: Icon, height = 44, style, ...p }: TextInputProps & { icon?: LucideIcon; height?: number; testID: string; accessibilityLabel: string }) {
  const { lang } = useLang();
  return (
    <View style={[styles.inp, { height }, style]}>
      {Icon ? <Icon size={16} color={dx.dust} strokeWidth={1.8} /> : null}
      <TextInput
        {...p}
        placeholderTextColor={dx.dust}
        style={[styles.inpText, { fontFamily: fontFamily(lang, 'body', 500), fontSize: height < 40 ? 13 : 14 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  none: {},
  mt2: { marginTop: 2 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card2: {
    backgroundColor: dx.card2,
    borderRadius: 12,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  picked: {
    backgroundColor: dx.pickedBg,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: dx.ember, inset: true }],
  },
  option: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16, paddingHorizontal: 18 },
  optionTop: { alignItems: 'flex-start', gap: 12, padding: 16 },
  optionHover: { backgroundColor: dx.ghostHover },
  optIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: eos.rise },
  optIconOn: { backgroundColor: dx.ember },
  radio: { width: 20, height: 20, borderRadius: 10 },
  radioOn: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 6, color: tone.rose, inset: true }] },
  radioOff: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: tone.iron, inset: true }] },
  sumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 11 },
  sumRule: { borderBottomWidth: 1, borderBottomColor: dx.rowRule },
  sumValue: { flexShrink: 1, textAlign: 'right' },
  modeLink: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  linkIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: eos.rise },
  inp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: dx.input,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.inputEdge, inset: true }],
  },
  inpText: { flex: 1, minWidth: 0, height: '100%', color: eos.bone, outlineStyle: 'none' } as object,
});

/**
 * The page body's column: cards 16 px apart. DesktopPage gaps its main
 * column only in two-column mode; a stacked (narrow) page needs its own.
 */
export function Col({ children }: { children: ReactNode }) {
  return <View style={colStyle.col}>{children}</View>;
}

const colStyle = StyleSheet.create({ col: { gap: 16 } });
