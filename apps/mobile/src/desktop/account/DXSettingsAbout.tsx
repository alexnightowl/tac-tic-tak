import { ExternalLink, ShieldCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { build, LINKS, open } from '@/features/settings/AboutScreen';
import { PRIVACY_URL } from '@/features/settings/flags';
import { APP_VERSION } from '@/platform/config';
import { useT } from '@/ui/lang';
import { DText, GhostButton, Label } from '../kit';
import { dx } from '../tokens';
import { DxSettingsFrame } from './DXSettings';
import { PaneTitle, RowsCard, SettingRow } from './parts';

/** /settings/about in the DXSettings style: version, licences and the privacy policy (the phone About). */
export function DxSettingsAbout() {
  const t = useT();
  const credits = [
    { key: 'lichess', title: t('settings.about.puzzles'), body: t('settings.about.puzzles_body'), url: LINKS.lichess },
    { key: 'icons', title: t('settings.about.icons'), body: t('settings.about.icons_body'), url: LINKS.icons },
    { key: 'fonts', title: t('settings.about.fonts'), body: t('settings.about.fonts_body'), url: LINKS.ofl },
  ];
  return (
    <DxSettingsFrame pane="about">
      <PaneTitle>{t('settings.about')}</PaneTitle>
      <DText size={13.5} color={dx.ash} style={styles.mt4}>
        {`${t('brand.name')} · ${t('brand.tagline')}`}
      </DText>
      <RowsCard style={styles.mt16}>
        <SettingRow first title={t('settings.about.version')} testID="about-version">
          <DText size={14} weight={700} color={dx.ash} tabular>
            {APP_VERSION}
          </DText>
        </SettingRow>
        <SettingRow title={t('settings.about.build')} testID="about-build">
          <DText size={14} weight={700} color={dx.ash} tabular>
            {build()}
          </DText>
        </SettingRow>
      </RowsCard>

      <Label style={styles.section}>{t('settings.about.licences')}</Label>
      <RowsCard style={styles.mt10}>
        {credits.map((c, i) => (
          <SettingRow key={c.key} first={i === 0} title={c.title} hint={c.body}>
            <GhostButton
              testID={`about-${c.key}`}
              accessibilityLabel={`${c.title}, ${t('settings.about.open_hint')}`}
              icon={ExternalLink}
              square
              onPress={() => open(c.url)}
            />
          </SettingRow>
        ))}
      </RowsCard>

      <RowsCard style={styles.mt16}>
        <SettingRow first title={t('settings.about.privacy')} hint={t('settings.about.open_hint')}>
          <View>
            <GhostButton testID="about-privacy" accessibilityLabel={t('settings.about.privacy')} icon={ShieldCheck} square onPress={() => open(PRIVACY_URL)} />
          </View>
        </SettingRow>
      </RowsCard>
    </DxSettingsFrame>
  );
}

const styles = StyleSheet.create({
  mt4: { marginTop: 4 },
  mt10: { marginTop: 10 },
  mt16: { marginTop: 16 },
  section: { marginTop: 24 },
});
