import { eos } from '@tac/core/tokens';
import type { RuleRow } from '@tac/core/validation';
import { router } from 'expo-router';
import { Keyboard } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { DevMenuButton } from '@/features/auth/DevMenuButton';
import { DText, Hover, Title } from '../kit';
import { dx } from '../tokens';
import { AuthHero } from './Hero';

/**
 * DXLogin / DXRegister frame: the hero on the left (flex 1.15), the 400 px
 * form centred on the right (scrolls on short windows).
 */
export function AuthSplit({
  testID,
  title,
  subtitle,
  children,
  enterHint,
}: {
  testID: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  enterHint: string;
}) {
  return (
    <View style={styles.root} testID={testID}>
      <AuthHero />
      <View style={styles.side}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Title size={30} style={styles.title}>
              {title}
            </Title>
            <DText size={14.5} color={dx.ash} style={styles.sub}>
              {subtitle}
            </DText>
            {children}
            <View style={styles.hint}>
              <Keyboard size={15} color={dx.dust} strokeWidth={1.8} />
              <DText size={12} color={dx.dust}>
                {enterHint}
              </DText>
            </View>
          </View>
        </ScrollView>
        <DevMenuButton />
      </View>
    </View>
  );
}

/** "No account? Create" under the plate. */
export function SwitchLink({ prompt, action, to, testID }: { prompt: string; action: string; to: '/login' | '/register'; testID: string }) {
  return (
    <View style={styles.switch}>
      <DText size={13.5} color={dx.ash}>
        {prompt}
      </DText>
      <Hover testID={testID} accessibilityRole="link" accessibilityLabel={action} onPress={() => router.replace(to)} style={styles.link}>
        <DText size={13.5} weight={700} color={dx.bone} style={styles.underline}>
          {action}
        </DText>
      </Hover>
    </View>
  );
}

const RULE_CHECK = 'M5 12.5l4.5 4.5L19 7.5';

/** DXRegister's rule row: a check per rule, sage once met, dust until then. */
export function RuleChecks({
  rows,
  t,
  testID,
  rowPrefix = testID,
}: {
  rows: readonly RuleRow<string>[];
  t: (k: string) => string;
  testID: string;
  /** Row testIDs are `<rowPrefix>-<rule>-met|unmet` (the phone screen's ids). */
  rowPrefix?: string;
}) {
  return (
    <View style={styles.rules} testID={testID}>
      {rows.map((r) => {
        const c = r.met ? dx.sage : dx.dust;
        return (
          <View key={r.id} style={styles.rule} testID={`${rowPrefix}-${r.id}-${r.met ? 'met' : 'unmet'}`}>
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
              <Path d={RULE_CHECK} stroke={c} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <DText size={12} color={c}>
              {t(r.labelKey)}
            </DText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: eos.ink },
  side: { flex: 1 },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  form: { width: 400, maxWidth: '100%' },
  title: { lineHeight: 38 },
  sub: { marginTop: 6 },
  hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 40 },
  switch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 20 },
  link: { paddingHorizontal: 2, paddingVertical: 4, borderRadius: 4 },
  underline: { textDecorationLine: 'underline' },
  rules: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 6, marginTop: -6 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
