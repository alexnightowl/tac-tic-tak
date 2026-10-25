import { SOUND_CATALOG, SOUND_EVENT_ORDER, variantFor, type SoundEvent, type SoundVariant } from '@tac/core/feel';
import { eos, radii, space } from '@tac/core/tokens';
import { useFocusEffect } from 'expo-router';
import { Check, ChevronDown, Play } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { feel, setFeelPrefs, stopLongClip, useFeelPrefs, type FeelContext, type FeelEvent } from '@/feel';
import { useAppStore } from '@/stores/appStore';
import { AppText } from '@/ui/AppText';
import { useT } from '@/ui/lang';
import { PlateButton } from '@/ui/PlateButton';
import { Tap } from '@/ui/Tap';
import { BottomSheet, ControlRow, Section, SettingsPage, ToggleRow } from './parts';
import { saveSettings } from './patch';
import { startSoundMirror } from './soundMirror';
import { VolumeSlider } from './VolumeSlider';

// Settings › Sound & haptics (web SoundSettings + the Gameplay sound
// toggle, plus the mobile-only haptics switch). soundEnabled is an account
// setting (PATCH); volume, picks and haptics are per device (PLAN §8 #20,
// MMKV via src/feel/prefs). Previews go through feel.emit with `force`, so
// each ▶ also plays the event's paired haptic, as it will in play.

/** The feel event that plays each sound in the app, with the context it needs. */
const PAIRED: Record<SoundEvent, { event: FeelEvent; ctx?: FeelContext }> = {
  move: { event: 'drop' },
  capture: { event: 'capture' },
  check: { event: 'check' },
  castle: { event: 'castle' },
  promote: { event: 'promote' },
  correct: { event: 'correct' },
  mistake: { event: 'mistake' },
  gate: { event: 'normGateUp' },
  rankTomoe: { event: 'rankUp', ctx: { band: 'intermediate' } },
  rankMangekyo: { event: 'rankUp', ctx: { band: 'advanced' } },
  rankFinal: { event: 'rankUp', ctx: { band: 'expert' } },
  rankDown: { event: 'rankDown' },
};

function preview(ev: SoundEvent, variant?: string): void {
  stopLongClip(0);
  const p = PAIRED[ev];
  feel.emit(p.event, { ...p.ctx, variant, force: true });
}

function variantLabel(v: SoundVariant): string {
  return v.shinobi ? `${v.name} · shinobi` : v.name;
}

export function SoundScreen() {
  const t = useT();
  const soundEnabled = useAppStore((s) => s.settings.soundEnabled);
  const prefs = useFeelPrefs();
  const [picking, setPicking] = useState<SoundEvent | null>(null);

  // Long clips (rank-down music) never outlive the screen.
  useFocusEffect(useCallback(() => () => stopLongClip(0), []));
  // The toggle must reach the engine even where the app-wide effects
  // (SettingsEffects) aren't mounted.
  useEffect(() => startSoundMirror(), []);

  return (
    <SettingsPage testID="screen-settings-sound" title={t('settings.sound_haptics')}>
      <Section footer={soundEnabled ? t('settings.silent_hint') : t('settings.sound_off_hint')}>
        <ToggleRow
          label={t('settings.sound')}
          hint={t('settings.sound_hint')}
          value={soundEnabled}
          onChange={(v) => void saveSettings({ soundEnabled: v })}
          testID="settings-sound-toggle"
        />
        <ControlRow label={t('settings.sound_volume')}>
          <VolumeSlider
            value={prefs.volume}
            onCommit={(v) => {
              setFeelPrefs({ volume: v });
              // Preview at the new level on release (no samples while dragging).
              preview('move');
            }}
            testID="settings-volume"
            accessibilityLabel={t('settings.sound_volume')}
          />
        </ControlRow>
        <ToggleRow
          label={t('settings.haptics')}
          hint={t('settings.haptics_hint')}
          value={prefs.hapticsEnabled}
          onChange={(v) => setFeelPrefs({ hapticsEnabled: v })}
          testID="settings-haptics-toggle"
        />
      </Section>

      <Section title={t('settings.sound_section')} footer={t('settings.sound_section_hint')} testID="settings-sound-events">
        {SOUND_EVENT_ORDER.map((ev) => (
          <EventRow key={ev} ev={ev} pick={prefs.picks[ev]} onPick={() => setPicking(ev)} />
        ))}
      </Section>

      <VariantSheet
        ev={picking}
        pick={picking ? prefs.picks[picking] : undefined}
        onClose={() => {
          stopLongClip(0);
          setPicking(null);
        }}
      />
    </SettingsPage>
  );
}

function EventRow({ ev, pick, onPick }: { ev: SoundEvent; pick: string; onPick: () => void }) {
  const t = useT();
  const name = t(`sound.ev.${ev}`);
  const variants = SOUND_CATALOG[ev];
  const current = variantFor(ev, { [ev]: pick });
  const label = current ? variantLabel(current) : '';
  return (
    <View style={styles.eventRow}>
      <AppText variant="body" style={styles.eventName} numberOfLines={1}>
        {name}
      </AppText>
      {variants.length > 1 ? (
        <Tap
          testID={`sound-pick-${ev}`}
          accessibilityRole="button"
          accessibilityLabel={t('settings.sound_pick_a11y', { event: name, variant: label })}
          onPress={onPick}
          style={styles.picker}
        >
          <AppText variant="caption" color={eos.bone} numberOfLines={1} style={styles.pickerText}>
            {label}
          </AppText>
          <ChevronDown size={14} color={eos.ash} />
        </Tap>
      ) : (
        <AppText variant="caption" numberOfLines={1} style={styles.variant}>
          {label}
        </AppText>
      )}
      <Tap
        testID={`sound-play-${ev}`}
        accessibilityRole="button"
        accessibilityLabel={t('settings.sound_play', { event: name })}
        onPress={() => preview(ev)}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        style={styles.play}
      >
        <Play size={14} color={eos.bone} fill={eos.bone} />
      </Tap>
    </View>
  );
}

/** web <select> for multi-variant events (only rankDown today): pick + preview. */
function VariantSheet({ ev, pick, onClose }: { ev: SoundEvent | null; pick?: string; onClose: () => void }) {
  const t = useT();
  const prefs = useFeelPrefs();
  const name = ev ? t(`sound.ev.${ev}`) : '';
  return (
    <BottomSheet visible={ev !== null} onClose={onClose} testID="sound-variant-sheet" closeLabel={t('common.cancel')}>
      <AppText variant="title">{t('settings.sound_pick_title', { event: name })}</AppText>
      <View style={styles.variantList}>
        {ev
          ? SOUND_CATALOG[ev].map((v) => {
              const active = v.id === pick;
              return (
                <Tap
                  key={v.id}
                  testID={`sound-variant-${ev}-${v.id}`}
                  accessibilityRole="radio"
                  accessibilityLabel={variantLabel(v)}
                  accessibilityState={{ checked: active }}
                  onPress={() => {
                    feel.emit('segmented');
                    setFeelPrefs({ picks: { ...prefs.picks, [ev]: v.id } });
                    preview(ev, v.id);
                  }}
                  style={[styles.variantRow, active && styles.variantActive]}
                >
                  <AppText variant="body" style={styles.eventName}>
                    {variantLabel(v)}
                  </AppText>
                  {active ? <Check size={18} color={eos.ember} /> : null}
                </Tap>
              );
            })
          : null}
      </View>
      <PlateButton testID="sound-variant-done" label={t('settings.done')} variant="slate" block onPress={onClose} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 52, paddingLeft: space[4], paddingRight: space[2] },
  eventName: { flex: 1, minWidth: 0 },
  variant: { maxWidth: '45%' },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    height: 36,
    maxWidth: '52%',
    paddingHorizontal: space[2.5],
    borderRadius: radii.control,
    backgroundColor: eos.well,
  },
  pickerText: { flexShrink: 1 },
  play: { width: 36, height: 36, borderRadius: radii.control, backgroundColor: eos.rise, alignItems: 'center', justifyContent: 'center' },
  variantList: { borderRadius: radii.cardComponent, backgroundColor: eos.slate, overflow: 'hidden' },
  variantRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space[4], gap: space[3] },
  variantActive: { backgroundColor: eos.rise },
});
