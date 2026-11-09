import type { AnimationSpeedSetting, ColorMode } from '@tac/core/api';
import { normalizePieceSet } from '@tac/core/board';
import { StyleSheet, View } from 'react-native';

import { LiveBoard, PieceSetPicker } from '@/features/settings/GameplayScreen';
import { saveSettings } from '@/features/settings/patch';
import { feel } from '@/feel';
import { useAppStore } from '@/stores/appStore';
import { Toggle } from '@/ui/Toggle';
import { useT } from '@/ui/lang';
import { DText, Label, Seg } from '../kit';
import { dx } from '../tokens';
import { DxSettingsFrame } from './DXSettings';
import { PaneTitle, RowsCard, SettingRow, useNarrow } from './parts';

/**
 * DXSettingsGameplay (/settings/gameplay): exactly the phone Gameplay
 * settings (pieces, animation, side, mirror, focus, streak), each saved
 * optimistically, with the live board preview on the right.
 */
export function DxSettingsGameplay() {
  const t = useT();
  const s = useAppStore((st) => st.settings);
  const pieceSet = normalizePieceSet(s.pieceSet);
  // Narrow windows put the preview under the settings.
  const narrow = useNarrow();
  const seg = <T extends string>(save: (v: T) => void) => (v: T) => {
    feel.emit('segmented');
    save(v);
  };

  return (
    <DxSettingsFrame pane="gameplay">
      <PaneTitle>{t('settings.gameplay')}</PaneTitle>
      <View style={[styles.cols, narrow && styles.stack]}>
        <RowsCard style={narrow ? styles.full : styles.flex}>
          <SettingRow first title={t('settings.pieces')}>
            {/* The phone's picker: each set's pieces on board tiles. */}
            <View style={styles.pieces} testID="settings-pieces">
              <PieceSetPicker value={pieceSet} onChange={(v) => void saveSettings({ pieceSet: v })} />
            </View>
          </SettingRow>
          <SettingRow title={t('settings.animation')}>
            <Seg
              options={(['instant', 'fast', 'normal', 'slow'] as const).map((v) => ({ value: v, label: t(`settings.animation.${v}`) }))}
              value={s.animationSpeed}
              onChange={seg((v: AnimationSpeedSetting) => void saveSettings({ animationSpeed: v }))}
              small
              testID="settings-animation"
              accessibilityLabel={t('settings.animation')}
              style={styles.w330}
            />
          </SettingRow>
          <SettingRow title={t('settings.fixed_color')} hint={t('settings.fixed_color_hint')}>
            <Seg
              options={(['auto', 'white', 'black'] as const).map((v) => ({ value: v, label: t(`settings.fixed_color.${v}`) }))}
              value={s.fixedColor}
              onChange={seg((v: ColorMode) => void saveSettings({ fixedColor: v }))}
              small
              testID="settings-fixed-color"
              accessibilityLabel={t('settings.fixed_color')}
              style={styles.w300}
            />
          </SettingRow>
          <SettingRow title={t('settings.mirror_view')} hint={t('settings.mirror_view_hint')}>
            <Toggle value={s.mirrorView} onChange={(v) => void saveSettings({ mirrorView: v })} testID="settings-mirror" accessibilityLabel={t('settings.mirror_view')} />
          </SettingRow>
          <SettingRow title={t('settings.focus')} hint={t('settings.focus_hint_mobile')}>
            <Toggle value={s.focusMode} onChange={(v) => void saveSettings({ focusMode: v })} testID="settings-focus" accessibilityLabel={t('settings.focus')} />
          </SettingRow>
          <SettingRow title={t('settings.show_streak')} hint={t('settings.show_streak_hint')}>
            <Toggle value={s.showStreak} onChange={(v) => void saveSettings({ showStreak: v })} testID="settings-show-streak" accessibilityLabel={t('settings.show_streak')} />
          </SettingRow>
        </RowsCard>
        <View style={styles.preview}>
          <Label style={styles.mb10}>{t('settings.preview')}</Label>
          <LiveBoard pieceSet={pieceSet} mirror={s.mirrorView} fixedColor={s.fixedColor} speed={s.animationSpeed} />
          <DText size={12} color={dx.dust} style={styles.mt10}>
            {t('settings.preview_hint')}
          </DText>
        </View>
      </View>
    </DxSettingsFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: 24, marginTop: 14 },
  stack: { flexDirection: 'column' },
  full: { alignSelf: 'stretch' },
  preview: { width: 300 },
  mb10: { marginBottom: 10 },
  mt10: { marginTop: 10 },
  pieces: { width: 340 },
  w300: { width: 300 },
  w330: { width: 330 },
});
