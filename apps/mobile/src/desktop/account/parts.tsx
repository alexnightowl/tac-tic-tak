import type { XpRankKey } from '@tac/core/rules';
import { alpha, semantic, tone } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { rankPiece } from '@/features/experience/xp';
import { useRawWindow } from '@/platform/webFrame';
import { feel } from '@/feel';
import { fontFamily } from '@/ui/fonts';
import { useLang, useT } from '@/ui/lang';
import { Bar, Card, DText, Label } from '../kit';
import { dx } from '../tokens';

// Building blocks the account screens share (DXProfile, DXXP, DXFriends,
// DXSettings*): settings rows in a card, the .inp field with its label and
// counter, the gold XP bar and the rank piece tile.

/** Below this real window width the account pages stack their side columns. */
const NARROW = 1280;

/** True on a desktop window narrower than 1280 px (1024–1279): two-column pages stack. */
export function useNarrow(): boolean {
  return useRawWindow().width < NARROW;
}

/** A card of settings rows (padding 4 / 22, rows 16 apart with a rule). */
export function RowsCard({ children, style, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <Card style={[styles.rowsCard, style]} testID={testID}>
      {children}
    </Card>
  );
}

/** One settings row: 14.5 px title over a 12.5 px hint, the control on the right. */
export function SettingRow({
  title,
  hint,
  children,
  first,
  testID,
  titleWidth,
}: {
  title: string;
  hint?: string | null;
  children?: ReactNode;
  first?: boolean;
  testID?: string;
  /** Fixed title column (the volume row) instead of a flexible one. */
  titleWidth?: number;
}) {
  return (
    <View style={[styles.row, !first && styles.rule]} testID={testID}>
      <View style={titleWidth ? { width: titleWidth } : styles.title}>
        <DText size={14.5} weight={700} numberOfLines={1}>
          {title}
        </DText>
        {hint ? (
          <DText size={12.5} color={dx.dust} style={styles.hint}>
            {hint}
          </DText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A Cinzel 20 pane / section title. */
export function PaneTitle({ children, style }: { children: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      <DText serif weight={700} size={20} accessibilityRole="header">
        {children}
      </DText>
    </View>
  );
}

/** .lbl 10.5 above a field, with an optional right-hand note (a 4/40 counter). */
export function FieldLabel({ label, note, noteColor }: { label: string; note?: string; noteColor?: string }) {
  return (
    <View style={styles.labelRow}>
      <Label size={10.5} style={styles.flex}>
        {label}
      </Label>
      {note ? (
        <DText size={11.5} color={noteColor ?? dx.dust} tabular>
          {note}
        </DText>
      ) : null}
    </View>
  );
}

type FieldProps = Omit<TextInputProps, 'style'> & {
  testID: string;
  accessibilityLabel: string;
  /** Password: masked, with the eye. */
  secret?: boolean;
  /** Multiline box height (bio). */
  height?: number;
  error?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * .inp: 46 px well (#18161a, 1 px edge); focused = a 1.5 px ember edge and
 * a 4 px ember halo. `secret` adds the eye; `height` makes it a multiline box.
 */
export function DxField({ testID, secret, height, error, style, onFocus, onBlur, ...rest }: FieldProps) {
  const t = useT();
  const { lang } = useLang();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;
  const multi = height != null;
  return (
    <View style={[styles.well, multi && { height, alignItems: 'flex-start' }, focused && styles.focus, error && styles.errorRing, style]}>
      <TextInput
        testID={testID}
        placeholderTextColor={dx.dust}
        selectionColor={dx.ember}
        autoCorrect={false}
        spellCheck={false}
        {...rest}
        multiline={multi}
        secureTextEntry={secret ? !visible : undefined}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, multi && styles.inputMulti, { fontFamily: fontFamily(lang, 'body', 500) }]}
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
          <Icon size={17} color={dx.dust} strokeWidth={1.8} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The gold experience bar (.bar with the gold run). */
export function XpBar({ value, height = 6 }: { value: number; height?: number }) {
  return <Bar value={value} height={height} colors={[dx.xpFrom, tone.gold]} />;
}

/** The rank's piece on its tile: ember (current / reached) or the ghost tile (`dim`). */
export function RankPiece({ rank, size, radius, dim, tile = dx.rankTile }: { rank: XpRankKey; size: number; radius: number; dim?: boolean; tile?: string }) {
  const piece = Math.round(size * 0.72);
  return (
    <View style={[styles.rankTile, { width: size, height: size, borderRadius: radius, backgroundColor: tile }]}>
      <Image
        source={rankPiece(rank)}
        style={{ width: piece, height: piece }}
        tintColor={dim ? tone.stone : tone.parchment}
        contentFit="contain"
        transition={null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  rowsCard: { paddingVertical: 4, paddingHorizontal: 22 },
  // A control too wide for the row wraps under its title (narrow windows).
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 16, rowGap: 10, paddingVertical: 16 },
  title: { flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 0 },
  rule: { borderTopWidth: 1, borderTopColor: dx.rowRule },
  hint: { marginTop: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  well: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: dx.input,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.inputEdge, inset: true }],
  },
  focus: {
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: dx.ember, inset: true },
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 4, color: alpha(dx.ember, 0.18) },
    ],
  },
  errorRing: { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: semantic.danger, inset: true }] },
  input: { flex: 1, minWidth: 0, width: '100%', alignSelf: 'stretch', paddingHorizontal: 14, fontSize: 14.5, color: dx.bone },
  inputMulti: { paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
  eye: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  rankTile: { alignItems: 'center', justifyContent: 'center' },
});
