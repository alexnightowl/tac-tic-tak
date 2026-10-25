import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import {
  DEFAULT_SOUND_PICKS, FEEL_TABLE, LEVELLED, SOUND_CATALOG, SOUND_EVENT_ORDER, allClipKeys,
  clipKey, hapticSteps, moveSoundEvent, rankUpPattern, rankUpSound, streakUpHaptic, variantFor,
  type HapticKind,
} from '../src/feel';

const HAPTICS: HapticKind[] = ['selection', 'light', 'medium', 'heavy', 'rigid', 'soft', 'success', 'warning', 'error'];

describe('sound catalogue', () => {
  it('every event has its default pick and is listed in order', () => {
    expect([...SOUND_EVENT_ORDER].sort()).toEqual(Object.keys(SOUND_CATALOG).sort());
    for (const e of SOUND_EVENT_ORDER) {
      expect(SOUND_CATALOG[e].some((v) => v.id === DEFAULT_SOUND_PICKS[e]), e).toBe(true);
    }
    expect([...LEVELLED]).toEqual(['move', 'capture', 'check', 'castle', 'promote', 'correct']);
  });

  it('uses asset keys and pre-rendered synth keys', () => {
    expect(clipKey('move', variantFor('move')!)).toBe('move-1');
    expect(clipKey('mistake', variantFor('mistake')!)).toBe('mistake_thud');
    expect(clipKey('gate', variantFor('gate')!)).toBe('gate_gongswell');
    expect(allClipKeys()).toHaveLength(15);
    for (const k of allClipKeys()) expect(k.includes('/')).toBe(false);
  });

  it('falls back from unknown picks to the default', () => {
    expect(variantFor('rankDown', { rankDown: 'gone' })!.id).toBe('a');
    expect(variantFor('rankDown', { rankDown: 'b' })!.long).toBe(true);
    expect(variantFor('castle', {}, 'nope')!.id).toBe('clip2');
  });

  it('rank clip by band', () => {
    expect(rankUpSound('expert')).toBe('rankFinal');
    expect(rankUpSound('advanced')).toBe('rankMangekyo');
    expect(rankUpSound('beginner')).toBe('rankTomoe');
  });
});

describe('moveSoundEvent', () => {
  function play(fen: string, san: string) {
    return moveSoundEvent(new Chess(fen).move(san));
  }
  it('classifies chess.js moves like the web', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(play(start, 'e4')).toBe('move');
    expect(play('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1', 'exd5')).toBe('capture');
    expect(play('4k3/8/8/8/8/8/8/R3K3 w Q - 0 1', 'O-O-O')).toBe('castle');
    expect(play('4k3/8/8/8/8/8/8/4K2R w K - 0 1', 'Rh8+')).toBe('check');
    expect(play('8/P6k/8/8/8/8/8/4K3 w - - 0 1', 'a8=Q')).toBe('promote');
    // promotion wins over check, castle over check
    expect(play('4k3/P7/8/8/8/8/8/4K3 w - - 0 1', 'a8=Q+')).toBe('promote');
    expect(moveSoundEvent(null)).toBe('move');
  });
});

describe('FEEL_TABLE', () => {
  it('every entry has valid haptics and sound', () => {
    const sounds = new Set<string>([...SOUND_EVENT_ORDER, 'byMove', 'byRank']);
    for (const [k, e] of Object.entries(FEEL_TABLE)) {
      for (const s of hapticSteps(e.haptic)) {
        expect(HAPTICS, k).toContain(s.haptic);
        expect(s.at, k).toBeGreaterThanOrEqual(0);
      }
      if (e.sound) expect(sounds, k).toContain(e.sound);
      expect(e.notes.length, k).toBeGreaterThan(0);
    }
  });

  it('follows the PLAN §2.8 defaults', () => {
    expect(FEEL_TABLE.pickup).toMatchObject({ haptic: 'selection' });
    expect(FEEL_TABLE.pickup.sound).toBeUndefined();
    expect(FEEL_TABLE.drop).toMatchObject({ haptic: 'light', sound: 'move' });
    expect(FEEL_TABLE.castle.haptic).toEqual([{ haptic: 'light', at: 0 }, { haptic: 'light', at: 80 }]);
    expect(FEEL_TABLE.mistake).toMatchObject({ haptic: 'error', sound: 'mistake' });
    expect(FEEL_TABLE.normGateUp.haptic).toEqual([{ haptic: 'soft', at: 0 }, { haptic: 'medium', at: 550 }]);
    expect(FEEL_TABLE.rankDown.haptic).toEqual([{ haptic: 'warning', at: 0 }, { haptic: 'soft', at: 750 }]);
  });

  it('rank-up pattern builds to Heavy + Success at the flash', () => {
    const p = rankUpPattern();
    expect(p[0]).toEqual({ haptic: 'soft', at: 0 });
    expect(p.slice(-2)).toEqual([{ haptic: 'heavy', at: 950 }, { haptic: 'success', at: 950 }]);
    const ticks = p.filter((s) => s.haptic === 'light');
    expect(ticks.length).toBeGreaterThan(2);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].at).toBeGreaterThan(ticks[i - 1].at);
      expect(ticks[i].intensity!).toBeGreaterThan(ticks[i - 1].intensity!);
      // gaps shrink: the build accelerates
      if (i > 1) expect(ticks[i].at - ticks[i - 1].at).toBeLessThan(ticks[i - 1].at - ticks[i - 2].at);
    }
  });

  it('streak haptic escalates at 5 and 10', () => {
    expect([2, 4, 5, 9, 10, 25].map(streakUpHaptic)).toEqual(['light', 'light', 'medium', 'medium', 'heavy', 'heavy']);
  });
});
