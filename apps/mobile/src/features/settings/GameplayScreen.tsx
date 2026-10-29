import type { AnimationSpeedSetting, ColorMode } from '@tac/core/api';
import { APP_PIECE_SETS, normalizePieceSet, pieceFitTransform, type AppPieceSet, type PieceType } from '@tac/core/board';
import { ANIMATION_MS, board as boardColors, eos, radii, shadows, space } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { Board, type BoardHandle } from '@/board';
import { PIECE_IMAGES, type PieceCode } from '@/board/assets';
import { useAppStore } from '@/stores/appStore';
import { AppText, ControlBlock, ListSection, Segmented, Tap, ToggleRow } from '@/ui';
import { useT } from '@/ui/lang';
import { SettingsPage } from './parts';
import { saveSettings } from './patch';

// Settings › Gameplay (design v2 MobGameplay; web GameplayTab). Every UserSettings field the app
// uses, each saved optimistically. Hidden on mobile (PLAN §8 #19, D6):
// accentColor, boardTheme, soundPack, reviewAutoAdvance, and knightArrow
// (no user-drawn arrows on mobile). Sound moved to its own screen.

/** Italian game after 3.Nf3 Nc6; the demo move is Bc4 (a slide long enough to judge the speed). */
const PREVIEW_FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

export function GameplayScreen() {
  const t = useT();
  const settings = useAppStore((s) => s.settings);
  const pieceSet = normalizePieceSet(settings.pieceSet);

  return (
    <SettingsPage testID="screen-settings-gameplay" title={t('settings.gameplay')}>
      <ListSection title={t('settings.preview')} footer={t('settings.preview_hint')}>
        <ControlBlock style={styles.center}>
          <LiveBoard
            pieceSet={pieceSet}
            mirror={settings.mirrorView}
            fixedColor={settings.fixedColor}
            speed={settings.animationSpeed}
          />
        </ControlBlock>
      </ListSection>

      <ListSection title={t('settings.pieces')}>
        <ControlBlock>
          <PieceSetPicker value={pieceSet} onChange={(v) => void saveSettings({ pieceSet: v })} />
        </ControlBlock>
      </ListSection>

      <ListSection title={t('settings.section.board')}>
        <ControlBlock label={t('settings.animation')}>
          <Segmented
            options={(['instant', 'fast', 'normal', 'slow'] as const).map((v) => ({ value: v, label: t(`settings.animation.${v}`) }))}
            value={settings.animationSpeed}
            onChange={(v: AnimationSpeedSetting) => void saveSettings({ animationSpeed: v })}
            size="sm"
            tone="soft"
            testID="settings-animation"
            accessibilityLabel={t('settings.animation')}
          />
        </ControlBlock>
        <ControlBlock label={t('settings.fixed_color')} hint={t('settings.fixed_color_hint')}>
          <Segmented
            options={(['auto', 'white', 'black'] as const).map((v) => ({ value: v, label: t(`settings.fixed_color.${v}`) }))}
            value={settings.fixedColor}
            onChange={(v: ColorMode) => void saveSettings({ fixedColor: v })}
            size="sm"
            tone="soft"
            testID="settings-fixed-color"
            accessibilityLabel={t('settings.fixed_color')}
          />
        </ControlBlock>
        <ToggleRow
          label={t('settings.mirror_view')}
          hint={t('settings.mirror_view_hint')}
          value={settings.mirrorView}
          onChange={(v) => void saveSettings({ mirrorView: v })}
          testID="settings-mirror"
        />
      </ListSection>

      <ListSection title={t('settings.section.display')}>
        <ToggleRow
          label={t('settings.focus')}
          hint={t('settings.focus_hint_mobile')}
          value={settings.focusMode}
          onChange={(v) => void saveSettings({ focusMode: v })}
          testID="settings-focus"
        />
        <ToggleRow
          label={t('settings.show_streak')}
          hint={t('settings.show_streak_hint')}
          value={settings.showStreak}
          onChange={(v) => void saveSettings({ showStreak: v })}
          testID="settings-show-streak"
        />
      </ListSection>
    </SettingsPage>
  );
}

/**
 * The real Board with the account's piece set, side and mirror. Changing
 * the animation speed replays the demo move at the new speed. View-only:
 * the board's pan claims a touch at once, so a playable board would stop
 * the page from scrolling under a finger that lands on it.
 */
function LiveBoard({
  pieceSet,
  mirror,
  fixedColor,
  speed,
}: {
  pieceSet: AppPieceSet;
  mirror: boolean;
  fixedColor: ColorMode;
  speed: AnimationSpeedSetting;
}) {
  const ref = useRef<BoardHandle>(null);
  const first = useRef(true);
  const orientation = fixedColor === 'black' ? 'black' : 'white';

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    let cancelled = false;
    const b = ref.current;
    if (!b) return;
    b.reset(PREVIEW_FEN);
    const ms = ANIMATION_MS[speed];
    let reset: ReturnType<typeof setTimeout> | undefined;
    // Let the reset paint, slide, hold, then put the bishop back.
    const start = setTimeout(() => {
      if (cancelled) return;
      void b.animateMove('f1', 'c4', ms).then(() => {
        if (cancelled) return;
        reset = setTimeout(() => !cancelled && b.reset(PREVIEW_FEN), 900);
      });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(start);
      if (reset) clearTimeout(reset);
    };
  }, [speed]);

  return (
    <View style={styles.boardWrap} testID="settings-preview-board" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.boardClip}>
        <Board
          ref={ref}
          initialFen={PREVIEW_FEN}
          orientation={orientation}
          mirror={mirror}
          pieceSet={pieceSet}
          moveFeel="board"
          style={styles.board}
        />
      </View>
    </View>
  );
}

const PREVIEW_SIZE = 300;
const PREVIEW: readonly PieceCode[] = ['wK', 'wN', 'bQ', 'bP'];
const TILE = 36;

/** web PieceSetPicker: a radio pair, four pieces each on alternating tiles. */
function PieceSetPicker({ value, onChange }: { value: AppPieceSet; onChange: (v: AppPieceSet) => void }) {
  const t = useT();
  return (
    <View style={styles.sets} accessibilityRole="radiogroup" accessibilityLabel={t('settings.pieces')}>
      {APP_PIECE_SETS.map((set) => {
        const active = set === value;
        const name = t(`settings.pieces.${set}`);
        return (
          <Tap
            key={set}
            testID={`settings-pieces-${set}`}
            accessibilityRole="radio"
            accessibilityLabel={t('settings.pieces_pick', { name })}
            accessibilityState={{ checked: active, selected: active }}
            onPress={() => {
              if (!active) onChange(set);
            }}
            style={[styles.set, active && styles.setActive]}
          >
            <View style={styles.tiles}>
              {PREVIEW.map((code, i) => {
                const fit = pieceFitTransform(set, code[1].toLowerCase() as PieceType, TILE);
                return (
                  <View key={code} style={[styles.tile, { backgroundColor: i % 2 === 0 ? boardColors.light : boardColors.dark }]}>
                    <Image
                      source={PIECE_IMAGES[set][code]}
                      style={[styles.piece, { transform: [{ translateX: fit.translateX }, { translateY: fit.translateY }, { scale: fit.scale }] }]}
                      contentFit="contain"
                    />
                  </View>
                );
              })}
            </View>
            <AppText variant="label" color={active ? eos.bone : eos.ash} style={styles.setName}>
              {name}
            </AppText>
          </Tap>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  // 300 pt square (fixed: Yoga sizes a %-wide aspectRatio box before its
  // maxWidth clamp), radius 6, a bone/8 % ring and a soft drop.
  boardWrap: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: radii.board,
    boxShadow: [...shadows.boardPreview],
  },
  boardClip: { flex: 1, borderRadius: radii.board, overflow: 'hidden' },
  board: { flex: 1 },
  sets: { flexDirection: 'row', gap: space[2] },
  set: {
    flex: 1,
    padding: space[2],
    gap: space[2],
    borderRadius: radii.xl,
    backgroundColor: eos.well,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  setActive: { borderColor: eos.ember },
  tiles: { flexDirection: 'row', borderRadius: radii.md, overflow: 'hidden', alignSelf: 'center' },
  tile: { width: TILE, height: TILE },
  // The design's caps label has the browser's normal line height (~1.36 × 11).
  setName: { lineHeight: 15 },
  piece: { width: TILE, height: TILE },
});
