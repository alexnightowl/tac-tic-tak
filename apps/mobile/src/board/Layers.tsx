// Board layers below/above the pieces. Everything that changes during a
// gesture (selection, legal dots, hover ring, drag overlay, flash, sparks,
// hint pulse) reads SharedValues in useAnimatedStyle; React renders these
// components only when size / orientation / position change.
import {
  arrowGeometry, coordLabels, gridPos, isLightSquare, maskHas, pieceFitTransform, SPARKS, sparkState,
  squareCenter, squareName, squareToXY, type AppPieceSet, type KnightArrowMode, type Orientation,
  type PieceType, type Square,
} from '@tac/core/board';
import { board as BOARD, feedback, fontFamilies, radii } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useRenderCount } from '@/dev/renderCount';
import { PIECE_CODES, PIECE_IMAGES } from './assets';
import type { BoardShared } from './shared';

type Geo = { size: number; orientation: Orientation; mirror: boolean };

const SQUARES: Square[] = Array.from({ length: 64 }, (_, i) => squareName(i));

/** Keep fixed-px web strokes proportional: web squares were ~50 px. */
const px = (s: number, webPx: number) => Math.max(1, Math.round((s * webPx) / 50));

// ─── Highlights under the pieces: last move + selection ──────────────────

export function Highlights({ sv, size, orientation, mirror }: Geo & { sv: BoardShared }) {
  const s = size / 8;
  const at = (idx: number) => {
    'worklet';
    return squareToXY(squareName(idx), size, orientation, mirror);
  };
  const lastFrom = useAnimatedStyle(() => {
    const i = sv.lastFrom.get();
    const p = i >= 0 ? at(i) : { x: 0, y: 0 };
    return { opacity: i >= 0 ? 1 : 0, transform: [{ translateX: p.x }, { translateY: p.y }] };
  });
  const lastTo = useAnimatedStyle(() => {
    const i = sv.lastTo.get();
    const p = i >= 0 ? at(i) : { x: 0, y: 0 };
    return { opacity: i >= 0 ? 1 : 0, transform: [{ translateX: p.x }, { translateY: p.y }] };
  });
  const selected = useAnimatedStyle(() => {
    const i = sv.selected.get();
    const p = i >= 0 ? at(i) : { x: 0, y: 0 };
    return { opacity: i >= 0 ? 1 : 0, transform: [{ translateX: p.x }, { translateY: p.y }] };
  });
  const box = { width: s, height: s };
  return (
    <>
      <Animated.View pointerEvents="none" testID="board-last-move" style={[styles.abs, box, styles.lastMove, lastFrom]} />
      <Animated.View pointerEvents="none" style={[styles.abs, box, styles.lastMove, lastTo]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.abs, box, styles.selected, { borderWidth: px(s, 3) }, selected]}
      />
    </>
  );
}

// ─── Check glow (UI thread; React only names it for the testID) ─────────

export function CheckGlow({ sv, square, size, orientation, mirror }: Geo & { sv: BoardShared; square: Square | null }) {
  const s = size / 8;
  // Always mounted, moved by checkSq: a check costs no mount and shows
  // in the same frame as the move's slide starts.
  const style = useAnimatedStyle(() => {
    const i = sv.checkSq.get();
    const p = i >= 0 ? squareToXY(squareName(i), size, orientation, mirror) : { x: 0, y: 0 };
    return { opacity: i >= 0 ? 1 : 0, transform: [{ translateX: p.x }, { translateY: p.y }] };
  });
  const [c0, c1] = BOARD.check;
  const [o0, o1, o2] = BOARD.checkStops;
  return (
    <Animated.View
      pointerEvents="none"
      testID={square ? `check-${square}` : undefined}
      style={[styles.abs, { width: s, height: s }, style]}
    >
      <Svg width={s} height={s}>
        <Defs>
          <RadialGradient id="checkGlow" cx="50%" cy="50%" r="50%">
            <Stop offset={o0} stopColor={c0} />
            <Stop offset={o1} stopColor={c1} />
            <Stop offset={o2} stopColor={c1} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={s} height={s} fill="url(#checkGlow)" />
      </Svg>
    </Animated.View>
  );
}

// ─── Coordinates (sq * 0.2, opposite square colour) ──────────────────────

export function Coordinates({ size, orientation, mirror }: Geo) {
  const s = size / 8;
  const fontSize = Math.max(8, Math.round(s * 0.2));
  const pad = Math.max(1, Math.round(s * 0.05));
  const out: React.ReactNode[] = [];
  for (const sq of SQUARES) {
    const { rank, file } = coordLabels(sq, orientation, mirror);
    if (!rank && !file) continue;
    const p = squareToXY(sq, size, orientation, mirror);
    const color = isLightSquare(sq) ? BOARD.coordOnLight : BOARD.coordOnDark;
    const text = { color, fontSize, lineHeight: fontSize * 1.15, fontFamily: fontFamilies.sans[700] };
    if (rank) {
      out.push(
        <Text key={`r${sq}`} allowFontScaling={false} style={[styles.abs, text, { left: p.x + pad, top: p.y + pad * 0.4 }]}>
          {rank}
        </Text>,
      );
    }
    if (file) {
      out.push(
        <Text key={`f${sq}`} allowFontScaling={false} style={[styles.abs, text, { left: p.x + s - pad - fontSize * 0.62, top: p.y + s - fontSize * 1.2 }]}>
          {file}
        </Text>,
      );
    }
  }
  // Hidden from VoiceOver/TalkBack: each square's label already names it.
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {out}
    </View>
  );
}

// ─── Squares: a11y + testIDs + legal dot / capture ring (above pieces) ───

type SquareProps = Geo & {
  sq: Square;
  idx: number;
  label: string;
  sv: BoardShared;
  onA11yTap: (idx: number) => void;
};

function SquareCellImpl({ sq, idx, label, size, orientation, mirror, sv, onA11yTap }: SquareProps) {
  useRenderCount(`Square:${sq}`);
  const s = size / 8;
  const { col, row } = gridPos(sq, orientation, mirror);
  // Masks only (no `codes`): a move's position push re-runs none of these 128 mappers.
  const dot = useAnimatedStyle(() => ({ opacity: maskHas(sv.dotLo.get(), sv.dotHi.get(), idx) ? 1 : 0 }));
  const ring = useAnimatedStyle(() => ({ opacity: maskHas(sv.ringLo.get(), sv.ringHi.get(), idx) ? 1 : 0 }));
  const d = Math.round(s * 0.26);
  const inset = s * 0.04;
  return (
    <View
      testID={`sq-${sq}`}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onAccessibilityTap={() => onA11yTap(idx)}
      style={[styles.abs, { left: col * s, top: row * s, width: s, height: s }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.abs, styles.dot, { left: (s - d) / 2, top: (s - d) / 2, width: d, height: d, borderRadius: d / 2 }, dot]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.abs,
          styles.ring,
          { left: inset, top: inset, width: s - 2 * inset, height: s - 2 * inset, borderRadius: s, borderWidth: px(s, 6) },
          ring,
        ]}
      />
    </View>
  );
}

/** memo: only squares whose label changed re-render on a commit. */
export const SquareCell = memo(SquareCellImpl);

// ─── Feedback above the pieces: hint rings, drop ring, flash ─────────────

export function Feedback({ sv, size, orientation, mirror }: Geo & { sv: BoardShared }) {
  const s = size / 8;
  const at = (idx: number) => {
    'worklet';
    return squareToXY(squareName(idx), size, orientation, mirror);
  };
  const ringAt = (idx: number) => {
    'worklet';
    const p = idx >= 0 ? at(idx) : { x: 0, y: 0 };
    return { opacity: idx >= 0 ? 1 : 0, transform: [{ translateX: p.x }, { translateY: p.y }] };
  };
  const glowAt = (idx: number) => {
    'worklet';
    // hint-pulse: glow grows to its peak at 60% of the cycle, then fades.
    const k = sv.hintPulse.get();
    const a = k < 0.6 ? k / 0.6 : (1 - k) / 0.4;
    const p = idx >= 0 ? at(idx) : { x: 0, y: 0 };
    return {
      opacity: idx >= 0 ? a : 0,
      transform: [{ translateX: p.x }, { translateY: p.y }, { scale: 1 + 0.28 * k }],
    };
  };
  const hintFromRing = useAnimatedStyle(() => ringAt(sv.hintFrom.get()));
  const hintToRing = useAnimatedStyle(() => ringAt(sv.hintTo.get()));
  const hintFromGlow = useAnimatedStyle(() => glowAt(sv.hintFrom.get()));
  const hintToGlow = useAnimatedStyle(() => glowAt(sv.hintTo.get()));
  const drop = useAnimatedStyle(() => ringAt(sv.hover.get()));
  const flash = useAnimatedStyle(() => {
    const i = sv.flashSq.get();
    const p = i >= 0 ? at(i) : { x: 0, y: 0 };
    return {
      opacity: i >= 0 ? sv.flashOpacity.get() : 0,
      backgroundColor: sv.flashOk.get() ? feedback.correct : feedback.fail,
      transform: [{ translateX: p.x }, { translateY: p.y }],
    };
  });
  const box = { width: s, height: s };
  const hintRing = { borderWidth: px(s, 4), borderColor: feedback.hint, borderRadius: radii.squareRing };
  const hintGlow = { borderWidth: px(s, 5), borderColor: feedback.hintGlow, borderRadius: radii.squareRing * 2 };
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.abs, box, hintGlow, hintFromGlow]} />
      <Animated.View pointerEvents="none" style={[styles.abs, box, hintGlow, hintToGlow]} />
      <Animated.View pointerEvents="none" testID="board-hint-from" style={[styles.abs, box, hintRing, hintFromRing]} />
      <Animated.View pointerEvents="none" testID="board-hint-to" style={[styles.abs, box, hintRing, hintToRing]} />
      <Animated.View
        pointerEvents="none"
        style={[styles.abs, box, { borderWidth: px(s, 4), borderColor: BOARD.dropRing, borderRadius: radii.squareRing }, drop]}
      />
      <Animated.View pointerEvents="none" style={[styles.abs, box, flash]} />
    </>
  );
}

// ─── Sparks: 14 views on one clock (correct answer) ──────────────────────

function Spark({ i, sv, size, orientation, mirror }: Geo & { i: number; sv: BoardShared }) {
  const spark = SPARKS[i];
  const k = size / 8 / 50; // web offsets are px at a ~50 px square
  const d = Math.max(2, spark.size * k * 1.2);
  const style = useAnimatedStyle(() => {
    const idx = sv.sparkSq.get();
    if (idx < 0) return { opacity: 0 };
    const c = squareCenter(squareName(idx), size, orientation, mirror);
    const st = sparkState(spark, sv.sparkClock.get(), k);
    return {
      opacity: st.opacity,
      transform: [{ translateX: c.x + st.x - d / 2 }, { translateY: c.y + st.y - d / 2 }, { scale: st.scale }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        {
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: spark.color,
          boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 6 * k, spreadDistance: 0, color: feedback.sparkGlow }],
        },
        style,
      ]}
    />
  );
}

export function Sparks(props: Geo & { sv: BoardShared }) {
  return (
    <>
      {SPARKS.map((_, i) => (
        <Spark key={i} i={i} {...props} />
      ))}
    </>
  );
}

// ─── Drag overlay / slide cover: one piece above all; 12 sprites, one visible ─

function OverlaySprite({ i, set, s, code }: { i: number; set: AppPieceSet; s: number; code: SharedValue<number> }) {
  const pc = PIECE_CODES[i];
  const fit = pieceFitTransform(set, pc[1].toLowerCase() as PieceType, s);
  // Switching the visible sprite by opacity keeps pickup free of React renders.
  const style = useAnimatedStyle(() => ({ opacity: code.get() === i ? 1 : 0 }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Image
        source={PIECE_IMAGES[set][pc]}
        style={[StyleSheet.absoluteFill, { transform: [{ translateX: fit.translateX }, { translateY: fit.translateY }, { scale: fit.scale }] }]}
        contentFit="contain"
        cachePolicy="memory"
        transition={null}
      />
    </Animated.View>
  );
}

function Sprites({ set, s, code }: { set: AppPieceSet; s: number; code: SharedValue<number> }) {
  return (
    <>
      {PIECE_CODES.map((_, i) => (
        <OverlaySprite key={i} i={i} set={set} s={s} code={code} />
      ))}
    </>
  );
}

export function DragOverlay({ sv, size, set }: { sv: BoardShared; size: number; set: AppPieceSet }) {
  const s = size / 8;
  const style = useAnimatedStyle(() => ({
    opacity: sv.dragVisible.get(),
    transform: [
      { translateX: sv.fingerX.get() + sv.offX.get() - s / 2 },
      { translateY: sv.fingerY.get() + sv.offY.get() - s / 2 },
      { scale: sv.dragScale.get() },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" testID="board-drag-overlay" style={[styles.abs, styles.overlay, { width: s, height: s }, style]}>
      <Sprites set={set} s={s} code={sv.dragCode} />
    </Animated.View>
  );
}

/**
 * The sliding main piece, drawn above every piece view (capturer over its
 * victim, knight over what it jumps). Stacking piece views by zIndex would
 * need a commit per move; this rides the same SharedValue timings instead,
 * while the real view slides hidden underneath.
 */
export function SlideCover({ sv, size, set }: { sv: BoardShared; size: number; set: AppPieceSet }) {
  const s = size / 8;
  const style = useAnimatedStyle(() => {
    // A drag-capture's cover waits under the settling drop overlay (no double piece).
    const settling = sv.dropPhase.get() !== 0 && sv.dragSq.get() === sv.coverSq.get();
    return {
      opacity: sv.coverCode.get() >= 0 && !settling ? 1 : 0,
      transform: [{ translateX: sv.coverX.get() }, { translateY: sv.coverY.get() }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.abs, { width: s, height: s }, style]}>
      <Sprites set={set} s={s} code={sv.coverCode} />
    </Animated.View>
  );
}

// ─── Arrows (hint / solution) ────────────────────────────────────────────

export type ArrowSpec = { from: Square; to: Square };

export function Arrows({ arrows, size, orientation, mirror, knightArrow }: Geo & { arrows: readonly ArrowSpec[]; knightArrow: KnightArrowMode }) {
  if (arrows.length === 0) return null;
  return (
    <Svg pointerEvents="none" width={size} height={size} style={StyleSheet.absoluteFill} testID="board-arrows">
      {arrows.map((a, i) => {
        const g = arrowGeometry(a.from, a.to, size, orientation, mirror, knightArrow);
        return [
          <Path key={`s${i}`} d={g.shaftPath} stroke={BOARD.arrow} strokeWidth={g.strokeWidth} strokeLinejoin="round" strokeLinecap="butt" fill="none" />,
          <Path key={`h${i}`} d={g.headPath} fill={BOARD.arrow} />,
        ];
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  lastMove: { backgroundColor: BOARD.lastMove },
  selected: { backgroundColor: BOARD.selected, borderColor: BOARD.selectedRing },
  dot: { backgroundColor: BOARD.legal },
  ring: { borderColor: BOARD.legal },
  overlay: { zIndex: 50 },
});
