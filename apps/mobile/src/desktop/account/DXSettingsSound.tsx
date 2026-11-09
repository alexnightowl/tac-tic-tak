import { SOUND_CATALOG, SOUND_EVENT_ORDER, variantFor, type SoundEvent } from '@tac/core/feel';
import { ChevronDown, Play } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { saveSettings } from '@/features/settings/patch';
import { preview, variantLabel, VariantSheet } from '@/features/settings/SoundScreen';
import { startSoundMirror } from '@/features/settings/soundMirror';
import { VolumeSlider } from '@/features/settings/VolumeSlider';
import { setFeelPrefs, stopLongClip, useFeelPrefs } from '@/feel';
import { HAS_HAPTICS } from '@/platform/capabilities';
import { useAppStore } from '@/stores/appStore';
import { Toggle } from '@/ui/Toggle';
import { useT } from '@/ui/lang';
import { Card, Chip, DText, GhostButton, Label } from '../kit';
import { dx } from '../tokens';
import { DxSettingsFrame } from './DXSettings';
import { PaneTitle, RowsCard, SettingRow, useNarrow } from './parts';

/**
 * DXSettingsSound (/settings/sound): the phone Sound screen on the desktop
 * frame: the account sound switch, the device volume, haptics where the
 * platform has them, and each event's sound (a picker where it has
 * several, ▶ to hear it).
 */
export function DxSettingsSound() {
  const t = useT();
  const soundEnabled = useAppStore((s) => s.settings.soundEnabled);
  const prefs = useFeelPrefs();
  const [picking, setPicking] = useState<SoundEvent | null>(null);
  // Two columns of events; one on a narrow window.
  const cols = useNarrow() ? 1 : 2;

  // The toggle must reach the engine; long clips never outlive the page.
  useEffect(() => {
    const stop = startSoundMirror();
    return () => {
      stop();
      stopLongClip(0);
    };
  }, []);

  return (
    <DxSettingsFrame pane="sound">
      <PaneTitle>{t(HAS_HAPTICS ? 'settings.sound_haptics' : 'settings.sound')}</PaneTitle>
      <RowsCard style={styles.mt14}>
        <SettingRow first title={t('settings.sound')} hint={t('settings.sound_hint')}>
          <Toggle value={soundEnabled} onChange={(v) => void saveSettings({ soundEnabled: v })} testID="settings-sound-toggle" accessibilityLabel={t('settings.sound')} />
        </SettingRow>
        <SettingRow title={t('settings.sound_volume')} titleWidth={120}>
          <View style={styles.slider}>
            <VolumeSlider
              value={prefs.volume}
              onCommit={(v) => {
                setFeelPrefs({ volume: v });
                preview('move');
              }}
              testID="settings-volume"
              accessibilityLabel={t('settings.sound_volume')}
            />
          </View>
        </SettingRow>
        {HAS_HAPTICS ? (
          <SettingRow title={t('settings.haptics')} hint={t('settings.haptics_hint')}>
            <Toggle value={prefs.hapticsEnabled} onChange={(v) => setFeelPrefs({ hapticsEnabled: v })} testID="settings-haptics-toggle" accessibilityLabel={t('settings.haptics')} />
          </SettingRow>
        ) : null}
      </RowsCard>
      {/* The phone's section footer under the switch. */}
      <DText size={12} color={dx.dust} style={styles.mt10} testID="settings-sound-footer">
        {soundEnabled ? t('settings.silent_hint') : t('settings.sound_off_hint')}
      </DText>

      <Label style={styles.eventsLabel}>{t('settings.sound_section')}</Label>
      <Card style={styles.events} testID="settings-sound-events">
        {SOUND_EVENT_ORDER.map((ev, i) => (
          <EventRow key={ev} ev={ev} pick={prefs.picks[ev]} top={i >= cols} wide={cols === 1} onPick={() => setPicking(ev)} />
        ))}
      </Card>
      <DText size={12} color={dx.dust} style={styles.mt10}>
        {t('settings.sound_section_hint')}
      </DText>

      <VariantSheet
        ev={picking}
        pick={picking ? prefs.picks[picking] : undefined}
        onClose={() => {
          stopLongClip(0);
          setPicking(null);
        }}
      />
    </DxSettingsFrame>
  );
}

function EventRow({ ev, pick, top, wide, onPick }: { ev: SoundEvent; pick: string; top: boolean; wide: boolean; onPick: () => void }) {
  const t = useT();
  const name = t(`sound.ev.${ev}`);
  const current = variantFor(ev, { [ev]: pick });
  const label = current ? variantLabel(current) : '';
  const several = SOUND_CATALOG[ev].length > 1;
  return (
    <View style={[styles.event, wide && styles.eventWide, top && styles.rule]}>
      <DText size={14} weight={700} style={styles.flex} numberOfLines={1}>
        {name}
      </DText>
      {several ? (
        <Chip
          testID={`sound-pick-${ev}`}
          accessibilityLabel={t('settings.sound_pick_a11y', { event: name, variant: label })}
          label={label}
          icon={ChevronDown}
          onPress={onPick}
          style={styles.chip}
        />
      ) : (
        <DText size={12.5} color={dx.ash} numberOfLines={1} style={styles.variant}>
          {label}
        </DText>
      )}
      <GhostButton testID={`sound-play-${ev}`} accessibilityLabel={t('settings.sound_play', { event: name })} icon={Play} square height={32} onPress={() => preview(ev)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt10: { marginTop: 10 },
  mt14: { marginTop: 14 },
  slider: { flex: 1 },
  eventsLabel: { marginTop: 24 },
  events: { marginTop: 10, paddingVertical: 4, paddingHorizontal: 22, flexDirection: 'row', flexWrap: 'wrap', columnGap: 40 },
  eventWide: { width: '100%' },
  event: { width: '46%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rule: { borderTopWidth: 1, borderTopColor: dx.rowRule },
  chip: { height: 32, maxWidth: '55%' },
  variant: { maxWidth: '50%' },
});
