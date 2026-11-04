'use client';

import { normalizePieceSet, type AppPieceSet, type Orientation, type Square } from '@tac/core/board';
import type { ServerPuzzle } from '@tac/core/puzzle';
import type { CreateSessionResponse } from '@tac/core/api';
import { browseOf, canHint, drillCounterOf, type NextResponse, type PracticeItem } from '@tac/core/runner';
import { ANIMATION_MS } from '@tac/core/tokens';
import { Chess } from 'chess.js';
import { ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { getToken } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useAppStore, type Language } from '@/lib/store';
import { Board, START_FEN, type BoardHandle, type BoardMove, type LastMove } from '@/v2/board';
import { api } from '@/v2/api';
import { Countdown, PracticeBoard, usePractice, usePuzzleRunner, type PracticeController, type RunnerController } from '@/v2/runner';
import { AppText, BrandLogo, Chip, IconButton, MiniButton, PillButton, SectionLabel, Segmented } from '@/v2/ui';

// Dev-route-only copy, as the kit page: none of it ships in a product
// screen. Product strings (hint, prev / next move) use real core keys.
const DEV: Record<Language, Record<string, string>> = {
  en: {
    title: 'Board lab',
    board: 'Board · handle',
    drill: 'Drill · practice runner',
    fen: 'FEN',
    square: 'Square',
    load: 'reset',
    slide: 'slide to',
    flip: 'flip',
    mirror: 'mirror',
    coords: 'coords',
    inputOn: 'input on',
    inputOff: 'input off',
    flashOk: 'flash ok',
    flashFail: 'flash fail',
    shake: 'shake',
    sparks: 'sparks',
    hint0: 'hint 0',
    hint1: 'hint 1',
    hint2: 'hint 2',
    animate: 'animate',
    arrows: 'arrows',
    noArrows: 'no arrows',
    getFen: 'getFen',
    presets: 'Positions',
    calls: 'Handle calls',
    readout: 'Readout',
    solve: 'solve',
    wrong: 'wrong',
    skip: 'skip',
    session: 'Session · runner on the local API',
    newSession: 'new 1-min casual session',
    signIn: 'Sign in on /login first: the session runner calls the local API with the web token.',
    pause: 'pause',
    resume: 'resume',
    finish: 'finish',
    discard: 'discard',
  },
  uk: {
    title: 'Лабораторія дошки',
    board: 'Дошка · handle',
    drill: 'Дрил · practice runner',
    fen: 'FEN',
    square: 'Поле',
    load: 'reset',
    slide: 'посунути до',
    flip: 'перевернути',
    mirror: 'дзеркало',
    coords: 'координати',
    inputOn: 'ввід увімк.',
    inputOff: 'ввід вимк.',
    flashOk: 'спалах ok',
    flashFail: 'спалах fail',
    shake: 'трясти',
    sparks: 'іскри',
    hint0: 'підказка 0',
    hint1: 'підказка 1',
    hint2: 'підказка 2',
    animate: 'анімувати',
    arrows: 'стрілки',
    noArrows: 'без стрілок',
    getFen: 'getFen',
    presets: 'Позиції',
    calls: 'Виклики handle',
    readout: 'Стан',
    solve: 'розвʼязати',
    wrong: 'помилка',
    skip: 'пропустити',
    session: 'Сесія · runner на локальному API',
    newSession: 'нова 1-хв casual сесія',
    signIn: 'Спершу увійди на /login: runner сесії ходить у локальний API з веб-токеном.',
    pause: 'пауза',
    resume: 'далі',
    finish: 'завершити',
    discard: 'скасувати',
  },
};

const PRESETS: { id: string; fen: string }[] = [
  { id: 'start', fen: START_FEN },
  { id: 'promo', fen: '7k/P7/8/8/8/8/8/K7 w - - 0 1' },
  { id: 'castle', fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1' },
  { id: 'ep', fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1' },
  { id: 'check', fen: '4k3/8/8/8/8/8/4q3/4K3 w - - 0 1' },
  { id: 'capture', fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2' },
];

// Drill demo puzzles: packages/core/src/runner/modes/practice.test.ts LONG and
// MATE, plus a promotion mate (setup h1h2, then c7c8=Q#).
const DEMO: ServerPuzzle[] = [
  {
    id: '00008', fen: 'r6k/pp2r2p/4Rp1Q/3p4/8/1N1P2R1/PqP2bPP/7K b - - 0 24',
    moves: ['f2g3', 'e6e7', 'b2b1', 'b3c1', 'b1c1', 'h6c1'], rating: 1913, themes: ['crushing', 'fork'], gameUrl: null,
  },
  { id: 'mate', fen: '6k1/2p2ppp/8/8/8/8/1R6/R5K1 b - - 0 1', moves: ['c7c6', 'a1a8'], rating: 1300, themes: ['mateIn1', 'endgame'], gameUrl: null },
  { id: 'promo', fen: 'k7/2P5/1K6/8/8/8/8/7r b - - 0 1', moves: ['h1h2', 'c7c8q'], rating: 1100, themes: ['promotion', 'mateIn1'], gameUrl: null },
];

type LabWindow = Window & { __lab?: { board?: BoardHandle | null; practice?: PracticeController; session?: RunnerController } };

function useDev() {
  const lang = useAppStore((s) => s.settings.language);
  return DEV[lang] ?? DEV.en;
}

function query(): URLSearchParams {
  return new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
}

/** Flip the store language for this page (`?lang=uk` for screenshots); the original comes back on leave. */
function useLabLanguage() {
  const lang = useAppStore((s) => s.settings.language);
  const setSettings = useAppStore((s) => s.setSettings);
  const original = useRef<Language | null>(null);
  const set = useCallback(
    (next: Language) => {
      if (original.current === null) original.current = useAppStore.getState().settings.language;
      setSettings({ language: next });
    },
    [setSettings],
  );
  useEffect(() => {
    const q = query().get('lang');
    if (q === 'en' || q === 'uk') set(q);
    return () => {
      if (original.current !== null) useAppStore.getState().setSettings({ language: original.current });
    };
  }, [set]);
  return [lang, set] as const;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel size="section">{title}</SectionLabel>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

/** e2e-style probes (the app's E2EStrip): faint, readable by scripts through data-testid. */
function Probe({ id, children }: { id: string; children: ReactNode }) {
  return (
    <AppText variant="caption" color="var(--eos-ash)" testID={id} className="v2-tabular" style={{ wordBreak: 'break-all' }}>
      {children}
    </AppText>
  );
}

const inputStyle = {
  background: 'var(--eos-shade)',
  color: 'var(--eos-bone)',
  border: '1px solid var(--semantic-border-soft)',
  borderRadius: 'var(--r-control)',
  padding: '8px 10px',
  font: '500 13px/18px var(--font-sans)',
  minWidth: 0,
} as const;

// ─── Board + handle ─────────────────────────────────────────────────────

function BoardSection() {
  const d = useDev();
  const t = useT();
  const storeSet = useAppStore((s) => normalizePieceSet(s.settings.pieceSet));
  const board = useRef<BoardHandle | null>(null);
  const [initial] = useState(() => query().get('fen') || START_FEN);
  const [fenInput, setFenInput] = useState(initial);
  const [square, setSquare] = useState('e4');
  const [orientation, setOrientation] = useState<Orientation>(() => (query().get('o') === 'black' ? 'black' : 'white'));
  const [mirror, setMirror] = useState(false);
  const [coords, setCoords] = useState(true);
  const [set, setSet] = useState<AppPieceSet>(() => normalizePieceSet(query().get('set') ?? storeSet));
  const [interactive, setInteractive] = useState(true);
  const [pos, setPos] = useState<{ fen: string; last: LastMove | null }>({ fen: initial, last: null });
  const [log, setLog] = useState<string[]>([]);
  // Written on every board commit: a ref + DOM write, so counting renders causes none.
  const renderProbe = useRef<HTMLSpanElement>(null);
  const onRenderCount = useCallback((n: number) => {
    if (renderProbe.current) renderProbe.current.textContent = `renders ${n}`;
  }, []);

  const note = useCallback((s: string) => setLog((l) => [s, ...l].slice(0, 6)), []);
  const ref = useCallback((h: BoardHandle | null) => {
    board.current = h;
    const w = window as LabWindow;
    w.__lab = { ...w.__lab, board: h };
  }, []);
  const onMove = useCallback((m: BoardMove) => note(`move ${m.san} ${m.from}${m.to}${m.promotion ?? ''}`), [note]);
  const onPositionChange = useCallback((fen: string, last: LastMove | null) => setPos({ fen, last }), []);

  const sq = (square.trim() || 'e4') as Square;
  const timed = (name: string, p: Promise<void>) => {
    const t0 = performance.now();
    p.then(
      () => note(`${name} ✓ ${Math.round(performance.now() - t0)} ms`),
      (e: Error) => note(`${name} ✗ ${e.message}`),
    );
  };
  const animate = () => {
    const c = new Chess(board.current?.getFen() ?? START_FEN);
    const moves = c.moves({ verbose: true });
    const m = moves[Math.floor(Math.random() * moves.length)];
    if (m) timed(`animate ${m.from}${m.to}`, board.current!.animateMove(m.from as Square, m.to as Square, ANIMATION_MS.normal));
  };
  const hint = (level: 0 | 1 | 2) => {
    const c = new Chess(board.current?.getFen() ?? START_FEN);
    const m = c.moves({ verbose: true })[0];
    board.current?.setHint(level, (m?.from as Square) ?? null, (m?.to as Square) ?? null);
  };

  return (
    <Section title={d.board}>
      <Board
        ref={ref}
        initialFen={initial}
        orientation={orientation}
        mirror={mirror}
        pieceSet={set}
        coordinates={coords}
        onMove={onMove}
        onPositionChange={onPositionChange}
        onRenderCount={onRenderCount}
      />
      <div className="flex flex-col gap-1">
        <Probe id="lab-renders">
          <span ref={renderProbe} />
        </Probe>
        <Probe id="lab-fen">{pos.fen}</Probe>
        <Probe id="lab-last">{pos.last ? `${pos.last.from}${pos.last.to}` : '—'}</Probe>
        <Probe id="lab-log">{log.join(' · ')}</Probe>
      </div>
      <SectionLabel>{d.presets}</SectionLabel>
      <Row>
        {PRESETS.map((p) => (
          <Chip
            key={p.id}
            label={p.id}
            testID={`lab-preset-${p.id}`}
            onPress={() => {
              setFenInput(p.fen);
              board.current?.reset(p.fen);
            }}
          />
        ))}
      </Row>
      <div className="flex items-center gap-2">
        <input
          aria-label={d.fen}
          data-testid="lab-fen-input"
          value={fenInput}
          onChange={(e) => setFenInput(e.target.value)}
          style={{ ...inputStyle, flex: 1 }}
        />
        <MiniButton label={d.load} testID="lab-reset" onPress={() => board.current?.reset(fenInput)} />
        <MiniButton label={d.slide} testID="lab-slide" onPress={() => timed('setPosition', board.current!.setPosition(fenInput, null, ANIMATION_MS.normal))} />
      </div>
      <Row>
        <Segmented
          size="sm"
          value={set}
          onChange={setSet}
          accessibilityLabel={t('settings.pieces')}
          testID="lab-set"
          style={{ width: 180 }}
          options={[
            { value: 'classic', label: 'classic' },
            { value: 'ember', label: 'ember' },
          ]}
        />
        <Chip label={d.flip} testID="lab-flip" onPress={() => setOrientation((o) => (o === 'white' ? 'black' : 'white'))} />
        <Chip label={d.mirror} selected={mirror} testID="lab-mirror" onPress={() => setMirror((m) => !m)} />
        <Chip label={d.coords} selected={coords} testID="lab-coords" onPress={() => setCoords((c) => !c)} />
        <Chip
          label={interactive ? d.inputOn : d.inputOff}
          selected={interactive}
          testID="lab-input"
          onPress={() => {
            board.current?.setInteractive(!interactive);
            setInteractive(!interactive);
          }}
        />
      </Row>
      <SectionLabel>{d.calls}</SectionLabel>
      <div className="flex items-center gap-2">
        <AppText variant="caption">{d.square}</AppText>
        <input aria-label={d.square} data-testid="lab-square" value={square} onChange={(e) => setSquare(e.target.value)} style={{ ...inputStyle, width: 64 }} />
      </div>
      <Row>
        <MiniButton label={d.flashOk} testID="lab-flash-ok" onPress={() => timed('flash ok', board.current!.flash(sq, true))} />
        <MiniButton label={d.flashFail} testID="lab-flash-fail" onPress={() => timed('flash fail', board.current!.flash(sq, false))} />
        <MiniButton label={d.shake} testID="lab-shake" onPress={() => timed('shake', board.current!.shake(sq))} />
        <MiniButton label={d.sparks} testID="lab-sparks" onPress={() => timed('sparks', board.current!.sparks(sq))} />
        <MiniButton label={d.animate} testID="lab-animate" onPress={animate} />
      </Row>
      <Row>
        <MiniButton label={d.hint0} testID="lab-hint0" onPress={() => hint(0)} />
        <MiniButton label={d.hint1} testID="lab-hint1" onPress={() => hint(1)} />
        <MiniButton label={d.hint2} testID="lab-hint2" onPress={() => hint(2)} />
        <MiniButton
          label={d.arrows}
          testID="lab-arrows"
          onPress={() => board.current?.setArrows([{ from: 'e2', to: 'e4' }, { from: 'g1', to: 'f3' }, { from: 'd7', to: 'd5' }])}
        />
        <MiniButton label={d.noArrows} testID="lab-no-arrows" onPress={() => board.current?.setArrows([])} />
        <MiniButton label={d.getFen} testID="lab-getfen" onPress={() => note(`getFen ${board.current?.getFen()}`)} />
      </Row>
    </Section>
  );
}

// ─── Drill: the practice runner over core test puzzles ───────────────────

function DrillSection() {
  const d = useDev();
  const t = useT();
  const { controller, state, onMove, boardRef } = usePractice('drill', {
    advance: async (id) => {
      const i = DEMO.findIndex((p) => p.id === id);
      return { puzzle: DEMO[(i + 1) % DEMO.length] } satisfies PracticeItem;
    },
  });

  useEffect(() => {
    const w = window as LabWindow;
    w.__lab = { ...w.__lab, practice: controller };
    if (controller.state.phase !== 'idle') return;
    const first = DEMO.findIndex((p) => p.id === query().get('puzzle'));
    controller.dispatch({ type: 'start', items: [{ puzzle: DEMO[Math.max(0, first)] }], counterIds: DEMO.map((p) => p.id) });
  }, [controller]);

  const b = browseOf(state);
  const counter = drillCounterOf(state);
  const hintOk = canHint(state);
  return (
    <Section title={d.drill}>
      <div className="flex items-center justify-between">
        <AppText variant="heading">{state.item?.puzzle.themes.join(' · ') ?? '…'}</AppText>
        <AppText variant="caption" className="v2-tabular">
          {counter ? `${counter.position} / ${counter.total} · ${state.item?.puzzle.rating ?? ''}` : ''}
        </AppText>
      </div>
      <PracticeBoard controller={controller} boardRef={boardRef} onMove={onMove} loading={!state.item} />
      <div className="flex items-center justify-center gap-4">
        <IconButton
          variant="float"
          testID="practice-back"
          accessibilityLabel={t('puzzle.prev')}
          disabled={!b.back}
          onPress={() => controller.dispatch({ type: 'browse', delta: -1 })}
          icon={<ChevronLeft size={22} />}
        />
        <PillButton
          label={t('review.hint')}
          testID="practice-hint"
          accessibilityLabel={t('review.hint')}
          minWidth={120}
          disabled={!hintOk && state.hintLevel < 2}
          onPress={hintOk ? () => controller.dispatch({ type: 'hint' }) : undefined}
          icon={<Lightbulb size={16} color={state.hintLevel > 0 ? 'var(--eos-ember)' : 'var(--eos-bone)'} />}
        >
          <span className="flex gap-1" aria-hidden>
            {[1, 2].map((n) => (
              <span
                key={n}
                data-testid={state.hintLevel >= n ? `practice-hint-${n}` : undefined}
                style={{
                  width: 'var(--s-1_5)',
                  height: 'var(--s-1_5)',
                  borderRadius: 'var(--r-full)',
                  background: state.hintLevel >= n ? 'var(--eos-ember)' : 'var(--eos-seam)',
                }}
              />
            ))}
          </span>
        </PillButton>
        <IconButton
          variant="float"
          testID="practice-forward"
          accessibilityLabel={t('puzzle.next')}
          disabled={!b.forward}
          onPress={() => controller.dispatch({ type: 'browse', delta: 1 })}
          icon={<ChevronRight size={22} />}
        />
      </div>
      <SectionLabel>{d.readout}</SectionLabel>
      <Row>
        <MiniButton label={d.solve} testID="e2e-solve" onPress={controller.e2eSolve} />
        <MiniButton label={d.wrong} testID="e2e-wrong" onPress={controller.e2eWrong} />
        <MiniButton label={d.skip} testID="e2e-skip" onPress={() => controller.dispatch({ type: 'skip' })} />
      </Row>
      <div className="flex flex-col gap-1">
        <Probe id="puzzle-id">{state.item?.puzzle.id ?? ''}</Probe>
        <Probe id="runner-phase">{state.phase}</Probe>
        <Probe id="practice-rewinds">{`rewinds ${state.rewinds} · view ${state.view ?? 'live'} · line ${state.line.length} · hint ${state.hintLevel} · drilled ${state.drilled}`}</Probe>
        <Probe id="viewer-fen">{state.fen ?? ''}</Probe>
      </div>
    </Section>
  );
}

// ─── Session: the session runner against the local API (?demo=session) ───

function SessionRun({ created }: { created: CreateSessionResponse }) {
  const d = useDev();
  const t = useT();
  const pieceSet = useAppStore((s) => normalizePieceSet(s.settings.pieceSet));
  const [stash] = useState<{ v: NextResponse | null }>(() => ({ v: created.firstPuzzle }));
  const { controller, view, boardRef, onMove } = usePuzzleRunner(created.sessionId, () => {
    const v = stash.v;
    stash.v = null;
    return v;
  });
  useEffect(() => {
    const w = window as LabWindow;
    w.__lab = { ...w.__lab, session: controller };
  }, [controller]);
  const s = view.state;
  const result = s.result?.kind === 'summary' ? s.result.summary : null;
  return (
    <>
      <div className="flex items-center justify-between">
        <Countdown controller={controller} label={t('play.timer')} />
        <AppText variant="caption" className="v2-tabular">
          {`${s.rating ?? '—'} · ✓ ${s.counters.solved} · ✗ ${s.counters.failed} · streak ${s.streak}`}
        </AppText>
      </div>
      <Board ref={boardRef} onMove={onMove} moveFeel="caller" pieceSet={pieceSet} />
      <Row>
        <MiniButton label={d.solve} testID="session-solve" onPress={controller.e2eSolve} />
        <MiniButton label={d.wrong} testID="session-wrong" onPress={controller.e2eWrong} />
        <MiniButton
          label={s.paused ? d.resume : d.pause}
          testID="session-pause"
          onPress={() => controller.dispatch(s.paused ? { type: 'resume', source: 'user' } : { type: 'pause', source: 'user' })}
        />
        <MiniButton label={d.finish} testID="session-finish" onPress={() => controller.dispatch({ type: 'finish', save: true })} />
        <MiniButton label={d.discard} variant="danger" testID="session-discard" onPress={() => controller.dispatch({ type: 'finish', save: false })} />
      </Row>
      <div className="flex flex-col gap-1">
        <Probe id="session-id">{s.sessionId}</Probe>
        <Probe id="session-phase">{`${s.phase}${s.paused ? ' (paused)' : ''}`}</Probe>
        <Probe id="session-puzzle">{s.puzzle ? `${s.puzzle.id} · ${s.puzzle.rating}` : ''}</Probe>
        <Probe id="session-fen">{s.fen ?? ''}</Probe>
        <Probe id="session-result">
          {s.result?.kind === 'discarded'
            ? 'discarded'
            : result
              ? `summary (${s.result?.kind === 'summary' ? s.result.source : ''}) · solved ${result.solved} · failed ${result.failed} · accuracy ${result.accuracy}`
              : ''}
        </Probe>
      </div>
    </>
  );
}

function SessionSection() {
  const d = useDev();
  const [created, setCreated] = useState<CreateSessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token] = useState(() => getToken());
  const start = () => {
    setError(null);
    api.sessions.create({ startRating: 1200, durationSec: 60, mode: 'casual', style: 'blitz' }).then(setCreated, (e: Error) => setError(e.message));
  };
  return (
    <Section title={d.session}>
      {!token ? (
        <AppText variant="caption">{d.signIn}</AppText>
      ) : created ? (
        <SessionRun key={created.sessionId} created={created} />
      ) : (
        <Row>
          <MiniButton label={d.newSession} variant="ember" testID="session-new" onPress={start} />
        </Row>
      )}
      {error && <Probe id="session-error">{error}</Probe>}
    </Section>
  );
}

export function BoardLab() {
  const d = useDev();
  const t = useT();
  const [lang, setLang] = useLabLanguage();
  // Query-driven (?demo, ?fen, ?o, ?set, ?puzzle): render on the client only.
  const [demo, setDemo] = useState<string | null | undefined>(undefined);
  useEffect(() => setDemo(query().get('demo')), []);
  const showBoard = demo !== undefined && demo !== 'drill' && demo !== 'session';
  const showDrill = demo !== undefined && demo !== 'board' && demo !== 'session';
  const showSession = demo === 'session';
  return (
    <main className="min-h-dvh" style={{ background: 'var(--eos-ink)', overflowX: 'clip' }}>
      <div className="sticky top-0 z-20 flex items-center justify-between gap-4 px-4 py-3" style={{ background: 'var(--eos-shade)' }}>
        <div className="flex items-center gap-3">
          <BrandLogo size={28} glow={false} />
          <AppText as="h1" variant="navTitle">
            {d.title}
          </AppText>
        </div>
        <Segmented
          size="sm"
          value={lang}
          onChange={setLang}
          accessibilityLabel={t('settings.language')}
          style={{ width: 120 }}
          testID="lab-lang"
          options={[
            { value: 'en', label: 'EN' },
            { value: 'uk', label: 'UK' },
          ]}
        />
      </div>
      <div className="flex flex-wrap justify-center gap-10 px-4 py-6">
        {showBoard && (
          <div className="flex w-full min-w-0 max-w-[560px] flex-col gap-4">
            <BoardSection />
          </div>
        )}
        {showDrill && (
          <div className="flex w-full min-w-0 max-w-[560px] flex-col gap-4">
            <DrillSection />
          </div>
        )}
        {showSession && (
          <div className="flex w-full min-w-0 max-w-[560px] flex-col gap-4">
            <SessionSection />
          </div>
        )}
      </div>
    </main>
  );
}
