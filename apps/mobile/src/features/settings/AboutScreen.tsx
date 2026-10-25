import { eos, space } from '@tac/core/tokens';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { ExternalLink, ShieldCheck } from 'lucide-react-native';
import { Platform, StyleSheet, View } from 'react-native';

import { APP_VERSION } from '@/platform/config';
import { AppText } from '@/ui/AppText';
import { useT } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { PRIVACY_URL } from './flags';
import { GroupBody, NavRow, Section, SettingsPage } from './parts';

// Settings › About (new; PLAN Phase 9): version and build, the licences the
// app ships under (Lichess puzzle DB, game-icons theme glyphs, OFL fonts;
// gaps.md "Outbound external links": the landing CTA credits move here),
// and the privacy policy.

const LINKS = {
  lichess: 'https://database.lichess.org/#puzzles',
  icons: 'https://game-icons.net',
  ofl: 'https://openfontlicense.org',
} as const;

function build(): string {
  const cfg = Constants.expoConfig;
  const native = Platform.OS === 'ios' ? cfg?.ios?.buildNumber : cfg?.android?.versionCode;
  return `${native ?? '1'}${__DEV__ ? ' · dev' : ''}`;
}

function open(url: string) {
  void WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
}

export function AboutScreen() {
  const t = useT();
  return (
    <SettingsPage testID="screen-settings-about" title={t('settings.about')}>
      <View style={styles.brand}>
        <AppText variant="title">{t('brand.name')}</AppText>
        <AppText variant="caption">{t('brand.tagline')}</AppText>
      </View>

      <Section>
        <InfoRow label={t('settings.about.version')} value={APP_VERSION} testID="about-version" />
        <InfoRow label={t('settings.about.build')} value={build()} testID="about-build" />
      </Section>

      <Section title={t('settings.about.licences')}>
        <Credit
          title={t('settings.about.puzzles')}
          body={t('settings.about.puzzles_body')}
          testID="about-lichess"
          onPress={() => open(LINKS.lichess)}
        />
        <Credit
          title={t('settings.about.icons')}
          body={t('settings.about.icons_body')}
          testID="about-icons"
          onPress={() => open(LINKS.icons)}
        />
        <Credit
          title={t('settings.about.fonts')}
          body={t('settings.about.fonts_body')}
          testID="about-fonts"
          onPress={() => open(LINKS.ofl)}
        />
      </Section>

      <Section>
        <NavRow
          icon={ShieldCheck}
          label={t('settings.about.privacy')}
          hint={t('settings.about.open_hint')}
          testID="about-privacy"
          onPress={() => open(PRIVACY_URL)}
        />
      </Section>
    </SettingsPage>
  );
}

function InfoRow({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View style={styles.info}>
      <AppText variant="body" style={styles.flex}>
        {label}
      </AppText>
      <AppText variant="body" color={eos.ash} testID={testID} selectable>
        {value}
      </AppText>
    </View>
  );
}

/** One licence: what, under which terms, and a link to the source. */
function Credit({ title, body, testID, onPress }: { title: string; body: string; testID: string; onPress: () => void }) {
  const t = useT();
  return (
    <GroupBody>
      <View style={styles.credit}>
        <View style={styles.flex}>
          <AppText variant="body">{title}</AppText>
          <AppText variant="caption">{body}</AppText>
        </View>
        <LinkButton testID={testID} label={`${title}, ${t('settings.about.open_hint')}`} onPress={onPress} />
      </View>
    </GroupBody>
  );
}

function LinkButton({ testID, label, onPress }: { testID: string; label: string; onPress: () => void }) {
  return (
    <Tap testID={testID} accessibilityRole="link" accessibilityLabel={label} onPress={onPress} style={styles.link}>
      <ExternalLink size={18} color={eos.ash} />
    </Tap>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: space[1], paddingVertical: space[2] },
  info: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: space[4], gap: space[3] },
  flex: { flex: 1, minWidth: 0, gap: space[0.5] },
  credit: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  link: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -space[2] },
});
