import { eos, layout, space } from '@tac/core/tokens';
import { Stack } from 'expo-router';
import { Profiler, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useRenderCount } from '@/dev/renderCount';
import {
  AppText,
  Card,
  HeroCard,
  Input,
  PasswordInput,
  PlateButton,
  Segmented,
  Toggle,
  useT,
  Well,
  type PlateSize,
  type PlateVariant,
} from '@/ui';
import { DevLangProvider, DevLangSwitch } from '@/ui/dev/devLang';
import { useDevT } from '@/ui/dev/devStrings';

// /dev/kitchen-sink: every primitive in every state, en and uk (PLAN §2.5;
// the only screen with pixel baselines). Each element has a stable testID.

const VARIANTS: PlateVariant[] = ['ember', 'slate'];
const SIZES: PlateSize[] = ['sm', 'md', 'lg'];

// React commits per section, via <Profiler>; read on demand so the counter
// itself never causes a commit while you press things. A plate tap shows +2:
// Reanimated 4.7's FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS re-renders the
// internal AnimatedComponent once per settled press-in / press-out; the
// primitives themselves (PlateButton, Tap, PlateBackground) do not render.
const commits: Record<string, number> = {};
const onRender = (id: string) => {
  commits[id] = (commits[id] ?? 0) + 1;
};
// Recognised plate taps (a scroll that starts on a plate must not count).
let presses = 0;
const countPress = () => {
  presses += 1;
};

export default function KitchenSinkScreen() {
  return (
    <DevLangProvider>
      <KitchenSink />
    </DevLangProvider>
  );
}

function KitchenSink() {
  const t = useT();
  const d = useDevT();
  const screenRenders = useRenderCount('kitchen-sink');
  const [counts, setCounts] = useState<string>('');

  return (
    <ScrollView contentContainerStyle={styles.page} testID="ks-scroll">
      <Stack.Screen options={{ title: 'Kitchen sink' }} />
      <DevLangSwitch testID="ks-lang" />
      <Card style={styles.counts}>
        <AppText variant="caption" testID="ks-render-count" style={styles.flex}>
          {`${d('renders')}: screen ${screenRenders}${counts}`}
        </AppText>
        <PlateButton
          variant="slate"
          size="sm"
          label={d('refresh')}
          testID="ks-refresh-counts"
          onPress={() =>
            setCounts(` · ${Object.entries(commits).map(([k, n]) => `${k} ${n}`).join(' · ')} · taps ${presses}`)
          }
        />
      </Card>

      <Section title={d('plates')}>
        <Profiler id="plates" onRender={onRender}>
          {VARIANTS.map((v) => (
            <View key={v} style={styles.group}>
              {SIZES.map((s) => (
                <View key={s} style={styles.row}>
                  <PlateButton variant={v} size={s} label={t('play.start')} onPress={countPress} testID={`ks-plate-${v}-${s}`} />
                  <PlateButton
                    variant={v}
                    size={s}
                    label={t('common.save')}
                    pressedPreview
                    testID={`ks-plate-${v}-${s}-pressed`}
                  />
                  <PlateButton variant={v} size={s} label={t('common.cancel')} disabled testID={`ks-plate-${v}-${s}-disabled`} />
                  <PlateButton variant={v} size={s} label={t('auth.login')} loading testID={`ks-plate-${v}-${s}-loading`} />
                </View>
              ))}
              <PlateButton variant={v} size="lg" block label={t('play.new_session')} testID={`ks-plate-${v}-block`} />
            </View>
          ))}
          <AppText variant="caption">
            {`${d('normal')} · ${d('pressed')} · ${d('disabled')} · ${d('loading')} · ${d('block')}`}
          </AppText>
        </Profiler>
      </Section>

      <Section title={d('surfaces')}>
        <Card testID="ks-card">
          <AppText variant="label">{t('stats.lifetime.accuracy')}</AppText>
          <AppText variant="value">87%</AppText>
        </Card>
        <HeroCard testID="ks-hero">
          <AppText variant="eyebrow">{d('hero')}</AppText>
          <AppText variant="title">{t('stats.title')}</AppText>
          <AppText variant="body" style={styles.mt}>
            {t('stats.activity_hint')}
          </AppText>
        </HeroCard>
        <Well testID="ks-well" style={styles.wellDemo}>
          <AppText variant="caption">{d('well')}</AppText>
        </Well>
      </Section>

      <Section title={d('segmented')}>
        <Profiler id="segmented" onRender={onRender}>
          <SegmentedDemo />
        </Profiler>
      </Section>

      <Section title={d('toggle')}>
        <Profiler id="toggle" onRender={onRender}>
          <ToggleDemo />
        </Profiler>
      </Section>

      <Section title={d('inputs')}>
        <Input
          testID="ks-input-empty"
          accessibilityLabel={t('auth.nickname')}
          label={`${t('auth.nickname')} · ${d('empty')}`}
          placeholder={t('auth.nickname')}
          autoCapitalize="none"
          autoComplete="username"
          textContentType="username"
        />
        <Input
          testID="ks-input-filled"
          accessibilityLabel={t('auth.nickname')}
          label={`${t('auth.nickname')} · ${d('filled')}`}
          defaultValue="magnus_c"
          autoCapitalize="none"
        />
        <Input
          testID="ks-input-error"
          accessibilityLabel={t('auth.nickname')}
          label={`${t('auth.nickname')} · ${d('error')}`}
          defaultValue="a"
          error={t('auth.rule_nick_len')}
        />
        <Input
          testID="ks-input-disabled"
          accessibilityLabel={t('auth.nickname')}
          label={`${t('auth.nickname')} · ${d('disabled')}`}
          defaultValue="magnus_c"
          disabled
        />
        <PasswordInput testID="ks-password" accessibilityLabel={t('auth.password')} label={t('auth.password')} placeholder={t('auth.password')} />
        <PasswordInput
          testID="ks-password-new"
          kind="new"
          accessibilityLabel={t('profile.new_password')}
          label={t('profile.new_password')}
          defaultValue="short1"
          error={t('auth.rule_pw_len')}
        />
      </Section>

    </ScrollView>
  );
}

function SegmentedDemo() {
  const t = useT();
  const [three, setThree] = useState<'weak' | 'strong' | 'all'>('weak');
  const [two, setTwo] = useState<'stats' | 'ach'>('stats');
  return (
    <>
      <Segmented
        testID="ks-seg-md"
        accessibilityLabel={t('stats.by_theme')}
        value={three}
        onChange={setThree}
        options={[
          { value: 'weak', label: t('stats.themes_tab_weakest') },
          { value: 'strong', label: t('stats.themes_tab_strongest') },
          { value: 'all', label: t('stats.themes_tab_all') },
        ]}
      />
      <Segmented
        testID="ks-seg-sm"
        size="sm"
        accessibilityLabel={t('stats.title')}
        value={two}
        onChange={setTwo}
        options={[
          { value: 'stats', label: t('stats.tab_stats') },
          { value: 'ach', label: t('stats.tab_achievements') },
        ]}
      />
    </>
  );
}

function ToggleDemo() {
  const t = useT();
  const d = useDevT();
  const [a, setA] = useState(true);
  const [b, setB] = useState(false);
  return (
    <View style={styles.toggles}>
      <Labeled text={t('settings.sound')}>
        <Toggle testID="ks-toggle-a" accessibilityLabel={t('settings.sound')} value={a} onChange={setA} />
      </Labeled>
      <Labeled text={t('settings.show_streak')}>
        <Toggle testID="ks-toggle-b" accessibilityLabel={t('settings.show_streak')} value={b} onChange={setB} />
      </Labeled>
      <Labeled text={`${d('disabled')} · ${d('on')}`}>
        <Toggle testID="ks-toggle-disabled-on" accessibilityLabel={d('disabled')} value disabled onChange={() => {}} />
      </Labeled>
      <Labeled text={`${d('disabled')} · ${d('off')}`}>
        <Toggle testID="ks-toggle-disabled-off" accessibilityLabel={d('disabled')} value={false} disabled onChange={() => {}} />
      </Labeled>
    </View>
  );
}

function Labeled({ text, children }: { text: string; children: ReactNode }) {
  return (
    <View style={styles.labeled}>
      <AppText variant="body" style={styles.flex}>
        {text}
      </AppText>
      {children}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="sectionLabel">{title}</AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: layout.gutter, gap: space[6], paddingBottom: space[16], backgroundColor: eos.ink },
  section: { gap: space[3] },
  group: { gap: space[3], marginBottom: space[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'center' },
  mt: { marginTop: space[2] },
  wellDemo: { padding: space[4] },
  toggles: { gap: space[3] },
  labeled: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  flex: { flex: 1 },
  counts: { flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[3] },
});
