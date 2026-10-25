import { createTranslator, LANDING_DICTS, type Language } from '@tac/core/i18n';
import { eos, layout, space, text } from '@tac/core/tokens';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  AppText,
  Card,
  LangProvider,
  PlateButton,
  UK_DISPLAY_CANDIDATES,
  UK_DISPLAY_DEFAULT,
  useLang,
  type TextVariantName,
  type UkDisplayCandidate,
} from '@/ui';
import { DevLangProvider, DevLangSwitch } from '@/ui/dev/devLang';
import { useDevT } from '@/ui/dev/devStrings';

// /dev/typography: every AppText variant in en + uk, and the uk display
// line in each Cyrillic candidate beside Cinzel (en) for the owner's pick
// (PLAN §8 #2). The switch only changes the chrome language.

const tr = { en: createTranslator('en'), uk: createTranslator('uk') };
const landing = { en: createTranslator('en', LANDING_DICTS), uk: createTranslator('uk', LANDING_DICTS) };

/** Sample copy per variant, from real i18n keys. */
function sample(v: TextVariantName, lang: Language): string {
  const t = tr[lang].t;
  const l = landing[lang].t;
  switch (v) {
    case 'display':
      return `${l('hero.title_1')} ${l('hero.title_2')}`;
    case 'sectionTitle':
      return t('review.title');
    case 'title':
    case 'turnTitle':
      return t('stats.title');
    case 'sectionLabel':
      return t('profile.ratings');
    case 'plateLabelSm':
    case 'plateLabel':
    case 'plateLabelLg':
      return t('play.new_session');
    case 'eyebrow':
      return l('hero.eyebrow');
    case 'label':
      return t('stats.lifetime.accuracy');
    case 'value':
      return '1 842 · 87%';
    case 'timer':
      return '0:42';
    case 'segmented':
    case 'segmentedSm':
      return t('stats.tab_achievements');
    case 'input':
      return t('auth.nickname');
    case 'boardCoord':
      return 'a b c d e f g h · 1 8';
    case 'caption':
    case 'turnSubtitle':
      return t('stats.rating_history_hint');
    default:
      return t('stats.activity_hint');
  }
}

const VARIANTS = Object.keys(text) as TextVariantName[];
const CANDIDATES = Object.keys(UK_DISPLAY_CANDIDATES) as UkDisplayCandidate[];
const COMPARE: TextVariantName[] = ['display', 'sectionTitle', 'title', 'plateLabel', 'turnTitle'];

export default function TypographyScreen() {
  return (
    <DevLangProvider>
      <Typography />
    </DevLangProvider>
  );
}

function Typography() {
  const d = useDevT();
  return (
    <ScrollView contentContainerStyle={styles.page} testID="ty-scroll">
      <Stack.Screen options={{ title: 'Typography' }} />
      <DevLangSwitch testID="ty-lang" />

      <AppText variant="sectionLabel">{d('candidates')}</AppText>
      <AppText variant="caption">{d('candidatesHint')}</AppText>

      {COMPARE.map((v) => (
        <Card key={v} testID={`ty-compare-${v}`} style={styles.compare}>
          <AppText variant="caption" color={eos.dust}>{`${v} · ${text[v].fontSize}px`}</AppText>
          <Row name="Cinzel · en">
            <AppText variant={v} lang="en" numberOfLines={2}>
              {sample(v, 'en')}
            </AppText>
          </Row>
          {CANDIDATES.map((c) => (
            <Row key={c} name={`${UK_DISPLAY_CANDIDATES[c].label} · uk${c === UK_DISPLAY_DEFAULT ? ' ★' : ''}`}>
              {/* paddingTop: Prata's З overshoots the 46 pt display line box and
                  iOS clips it at the text frame; headroom keeps the comparison fair. */}
              <AppText variant={v} lang="uk" ukDisplay={c} numberOfLines={2} testID={`ty-${v}-${c}`} style={styles.headroom}>
                {sample(v, 'uk')}
              </AppText>
            </Row>
          ))}
        </Card>
      ))}

      <AppText variant="sectionLabel">{d('plates')}</AppText>
      <View style={styles.plates}>
        <PlateButton label={sample('plateLabel', 'en')} testID="ty-plate-en" />
        {CANDIDATES.map((c) => (
          <LangProvider key={c} lang="uk" ukDisplay={c}>
            <PlateButton label={sample('plateLabel', 'uk')} variant="slate" testID={`ty-plate-${c}`} />
          </LangProvider>
        ))}
      </View>
      <AppText variant="caption">{`Cinzel · ${CANDIDATES.map((c) => UK_DISPLAY_CANDIDATES[c].label).join(' · ')}`}</AppText>

      <AppText variant="sectionLabel">{d('text')}</AppText>
      {VARIANTS.map((v) => (
        <VariantRow key={v} v={v} />
      ))}
    </ScrollView>
  );
}

function VariantRow({ v }: { v: TextVariantName }) {
  const { lang } = useLang();
  const spec = text[v];
  const meta = `${v} · ${spec.role} ${spec.weight} · ${spec.fontSize}/${'lineHeight' in spec ? spec.lineHeight : '–'} · ls ${spec.letterSpacing}`;
  // The chrome language goes first; the other one follows for comparison.
  const order: Language[] = lang === 'en' ? ['en', 'uk'] : ['uk', 'en'];
  return (
    <View style={styles.variant} testID={`ty-variant-${v}`}>
      <AppText variant="caption" color={eos.dust}>{meta}</AppText>
      {order.map((l) => (
        <AppText key={l} variant={v} lang={l}>
          {sample(v, l)}
        </AppText>
      ))}
    </View>
  );
}

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" style={styles.rowName}>
        {name}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: layout.gutter, gap: space[4], paddingBottom: space[16], backgroundColor: eos.ink },
  compare: { gap: space[3] },
  row: { gap: space[1] },
  rowName: { color: eos.dust },
  headroom: { paddingTop: space[1] },
  plates: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  variant: {
    gap: space[1],
    paddingBottom: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: eos.seam,
  },
});
