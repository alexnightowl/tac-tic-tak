# Inventory: sound

_audio (SFX engine, sound catalog, sound settings, all playback call sites, sound assets)_

Generated 2026-10-25 by a read-only analysis of the web app (apps/frontend) and backend, as the reference for the native port. Line-level details may drift as code changes.


## Sound catalogue (events, variants, defaults)  ·  complexity S

**Where:** src/lib/sound/catalog.ts

**Behaviour**

12 SoundEvents: move, capture, check, castle, promote, correct, mistake, gate, rankTomoe, rankMangekyo, rankFinal, rankDown. SoundVariant = {id, name (English only), shinobi?, file?, long?}. A variant with `file` is a clip under /sounds/sfx/<n>.mp3 (helper F()); a variant without `file` is a synth recipe resolved as `${event}_${id}` in engine.ts. Shipped catalogue (the 2026-10-25 design-canvas pass): one variant per event except rankDown (4). Files: move->move-1, capture->capture-1, check->check-1, castle->castle-2 ('Castling — short'), promote->promote, correct->correct-5 ('Clip #5'), rankTomoe->rank-tomoe, rankMangekyo->rank-mangekyo, rankFinal->rank-final, rankDown a 'Short clip' rank-down-a, b 'Music' rank-down-b long:true, c 'Music II' rank-down-c long:true, d 'Clip' rank-down-d. SYNTH-ONLY events: mistake = 'thud' ('Muted thud', recipe mistake_thud), gate = 'gongswell' ('Gong swell', recipe gate_gongswell). DEFAULT_SOUND_PICKS: move clip1, capture clip1, check clip1, castle clip2, promote clip1, correct clip5, mistake thud, gate gongswell, rank* clip1, rankDown 'a'. SOUND_EVENT_ORDER = the 12 events in the order above (Settings list order). Picks saved under older ids silently fall back to defaults (variantFor: requested id -> default id -> list[0]). `shinobi` flag is not set on any shipped variant (dead feature). Comment mentions i18n `sound.v.<event>.<id>` for Ukrainian variant names but no such keys exist; variant names render English in both languages.

**State & persistence:** Static constants only.

**Motion & sound:** Defines which events are clips vs synth. Durations of assets listed under the Assets feature.

**Mobile mapping:** Share verbatim in a packages/shared (or packages/sound-core) module, but change `file` from a URL string to an asset key so mobile can map key -> require('./assets/sfx/move-1.wav'). E.g. keep `file: 'move-1'` and let each platform resolve. If synth recipes are pre-rendered (recommended, see engine feature), mistake/gate become file variants too.

**Why S:** Pure data; only the file-path convention needs abstracting.


## Sound preferences store (volume + per-event pick)  ·  complexity S

**Where:** src/lib/sound.ts: useSoundPrefs, loadPrefs, persist

**Behaviour**

Per-device prefs: volume 0..1 (default 0.7) and picks Record<SoundEvent,string> (default DEFAULT_SOUND_PICKS merged under stored picks). setVolume(v) sets state, pushes to engine master gain via setSynthVolume(v), persists. pick(e,id) sets and persists. loadPrefs runs at module init (SSR returns fallback; on client reads localStorage synchronously). Corrupt JSON -> fallback. These prefs are NOT synced to the backend.

**State & persistence:** zustand store `useSoundPrefs` (not using zustand/persist; manual). localStorage key `taktic.soundPrefs` = JSON {volume:number, picks:{...}}. Writes wrapped in try/catch. Separate from global settings: `useAppStore().settings.soundEnabled` (boolean, default true) and `settings.soundPack` (legacy string, default 'wood'; only value with an effect is 'mute' in playSound) — those two are persisted to backend via PATCH /users/me/settings (Prisma User.soundEnabled default true, soundPack default 'wood') and mirrored in localStorage `taktic.settings`.

**Web-only deps:** window.localStorage (synchronous read at module load)

**Motion & sound:** Volume change is applied immediately to master GainNode (out.gain.value = volume*0.9).

**Mobile mapping:** zustand + `persist` middleware with react-native-mmkv storage (synchronous, so the first sound after cold start already uses the user's volume/picks; AsyncStorage would be async and race the first move). Keep key name `taktic.soundPrefs`. Consider adding `hapticsEnabled` (+ maybe intensity) to the same per-device store. Decide whether volume/picks should become account-level (backend currently has no columns).

**Why S:** Small store; swap localStorage for MMKV.


## Playback API: sfx(), playSound() (legacy), moveSoundEvent(), stopLongClip()  ·  complexity M

**Where:** src/lib/sound.ts

**Behaviour**

sfx(e, {variant?, force?, delay?}): returns early unless force or useAppStore.getState().settings.soundEnabled; returns if volume<=0; resolves variant; if variant.file -> playFile(), else setSynthVolume(volume) + synth(`${e}_${v.id}`, delay). `delay` (seconds) is supported but no call site passes it. `force` is used only by Settings previews. playSound(pack, kind) back-compat: kind 'move'|'capture'|'correct'|'fail'; pack==='mute' -> silent; 'fail' maps to 'mistake'; then sfx(). moveSoundEvent(chess.js move) priority: null->'move'; promotion or flags includes 'p' -> 'promote'; flags 'k'/'q' -> 'castle'; san contains + or # -> 'check'; captured -> 'capture'; else 'move'. So a promoting capture with check plays 'promote', a castle giving check plays 'castle'. stopLongClip(fadeMs=600): clears any running fade, detaches the current long HTMLAudioElement, fadeMs<=0 -> pause immediately, else linear 12-step volume ramp via setInterval(fadeMs/12) then pause. Only one long clip at a time (playing a new long clip calls stopLongClip(0) first).

**State & persistence:** Module-level singletons: `longClip: HTMLAudioElement|null`, `fadeTimer`, `clipCache: Map<file, Promise<Clip|null>>`.

**Web-only deps:** HTMLAudioElement (new Audio) for long clips; setInterval-driven fade on HTMLMediaElement.volume (read-only on iOS Safari, so long-clip volume and fade do not work on iOS web); useAppStore.getState() coupling

**Motion & sound:** Long-clip fade: linear, 12 steps; durations used: 400ms (SessionSummary effect cleanup), 500ms (RankCeremony Continue), 0ms (Settings preview), default 600ms unused.

**Mobile mapping:** Keep the same public API (sfx/stopLongClip/moveSoundEvent) in a platform `sound.native.ts` so screen ports are mechanical. moveSoundEvent is pure and shareable. Long-clip fade should become a GainNode linearRampToValueAtTime (react-native-audio-api) or a Reanimated/JS volume ramp on an expo-audio player. Add a parallel `haptic(e)` call or, better, have sfx() fire the paired haptic itself (single choke point).

**Why M:** API is small but needs a native audio backend, session config and haptic pairing behind the same façade.


## Short clip pipeline: Web Audio playback, leading-silence trim, loudness levelling, preload  ·  complexity M

**Where:** src/lib/sound.ts: analyse, loadClip, preloadClips, playFile

**Behaviour**

Introduced in commit afec3e5 (2026-10-25). Short (non-long) clips are fetched, decoded with ctx.decodeAudioData, analysed once and cached as {buffer, offset, gain}, then played via AudioBufferSourceNode -> per-clip GainNode(clip.gain) -> shared master gain. Reason: <audio> added tens of ms jitter and its volume is read-only on iOS. Leading-silence trim: first sample with |x| > ONSET_THRESHOLD 0.01 (-40 dBFS) across all channels; start offset = onset - PREROLL_S 0.003s (keeps the transient); an all-silent buffer uses offset 0. Commit message: move-1 / capture-1 / promote had 160-290ms leading silence, so a move's sound landed after the opponent's reply / after the mistake thud. Loudness levelling only for LEVELLED = {move, capture, check, castle, promote, correct}: RMS over LEVEL_WINDOW_S 0.1s after onset (all channels), gain = min(MAX_BOOST 2, TARGET_RMS / rms) where TARGET_RMS = 10^(-29/20) (~0.0355, i.e. -29 dBFS, where the move/capture/check clicks already sit); correct-5 was ~19dB hotter so it gets attenuated. Rank clips (rankTomoe/Mangekyo/Final/rankDown a,d) are onset-trimmed but keep their own mastering (gain 1). Scheduling: when = ctx.currentTime + 0.01 + delay; if decode is still pending when the promise resolves it starts at max(when, currentTime) (late, never skipped). Each play creates new source+gain nodes, so overlapping plays (move click + mistake thud, move + opponent reply) mix freely. Preload: on the first window pointerdown (once, capture phase) preloadClips() decodes the CURRENT pick of every event except long ones; variants picked later in Settings are lazily loaded on first play. Fetch/decode failures cache null forever for that file (silent).

**API**

- `GET /sounds/sfx/*.mp3 (static Next public assets)`

**State & persistence:** clipCache Map (session memory only).

**Web-only deps:** fetch + ArrayBuffer; AudioContext.decodeAudioData; AudioBuffer.getChannelData; window.addEventListener('pointerdown', ..., {once, capture}) as autoplay-unlock gesture

**Motion & sound:** +10ms scheduling lookahead; 3ms preroll; -29 dBFS RMS target over first 100ms; max +6 dB boost.

**Mobile mapping:** No autoplay unlock is needed natively, so preload at app start (or splash) instead of first pointerdown. Strongly recommended: do trim + levelling OFFLINE in a build script (Node + an offline decoder, or run the existing analyse() in a browser OfflineAudioContext) and ship already-trimmed, already-levelled PCM assets; mobile then plays from sample 0 with gain 1 and the runtime analyse() disappears. Ship board clips as mono 16-bit WAV (or CAF on iOS) rather than MP3: MP3 adds encoder/decoder delay padding (part of the leading silence) and decode cost. With react-native-audio-api, keep the decode-once-into-AudioBuffer + fresh BufferSourceNode-per-play pattern (verbatim port of playFile). With expo-audio, emulate with a small pool of pre-created players per event (2-3) and seekTo(0) before play().

**Why M:** Logic is small and portable to react-native-audio-api, but asset loading on RN (expo-asset localUri -> decode) differs from fetch, and an offline asset-processing script is advisable.


## Synth engine (Web Audio recipes)  ·  complexity M

**Where:** src/lib/sound/engine.ts: ac, audioOut, setSynthVolume, synth, tone, nz, bell, metal, pluck, crackle, poof, whirl, flute, saw, noiseBuf

**Behaviour**

Lazily creates one AudioContext (webkitAudioContext fallback) and a master GainNode (gain = volume*0.9, volume clamped 0..1, default 0.7) -> destination; every ac() call resumes a suspended context. audioOut() exposes {ctx, out} so clips share the same clock and volume stage. Building blocks: tone(type,f0,t,dur,peak,f1?,attack=4ms) exponential attack/decay, optional exponential pitch glide; nz() noise burst from a cached 2s white-noise buffer (random start offset Math.random() s) through a Biquad (type, f0->f1, Q), attack 2ms; bell = 4 sine partials [1,2.76,5.4,8.93] amps [1,.32,.12,.05]; metal = 5 partials [1,2.32,4.25,6.63,9.38]; pluck = sawtooth through a lowpass sweeping f*6 -> f*1.2; crackle = n random highpass ticks; poof = two filtered noise bursts; whirl = looped noise through Q6 bandpass 500->2400Hz modulated by LFO 6->22Hz (LFO connected into bq.frequency AudioParam); flute = sine + 5.5Hz vibrato LFO into frequency + breath noise; saw = detuned sawtooth with lowpass sweep. Recipes (48 cases, ported 1:1 from the design canvas 'Sound & motion lab'): move_{stone,wood,felt,clay,kunai,shuriken,seal,tag}, capture_{crack,heavy,slide,snap,slash,poof,crackle,log}, check_{ping,double,tick,kunaiwarn}, correct_{bell,chime,koto,whoosh,shing,spiral,flute,summon}, mistake_{thud,gong,minor,buzz,taiko,parry,gust,broken}, gate_{taiko,shamisen,pad,gongswell,chidori,bigsummon,awaken,kage}. Only TWO are reachable from the shipped catalogue: mistake_thud = sine 82->52Hz 0.26s peak 0.6 + lowpass(400Hz) noise 0.15s peak 0.4 (~0.3s total); gate_gongswell = 4 slightly detuned sine partials 65/98/131/175Hz, 2.0s, peak 0.3/(i+1), 350ms attack + bandpass noise swell 400->1200Hz 0.6s (300ms attack) + bell at 1567.98Hz starting +0.55s lasting 1.4s (~2.05s total). The other 46 recipes are dead code. Unknown ids are ignored silently.

**State & persistence:** Module singletons ctx, out, noise, volume.

**Web-only deps:** window.AudioContext / webkitAudioContext; OscillatorNode, BiquadFilterNode, GainNode, AudioBufferSourceNode, AudioParam automation (setValueAtTime, exponentialRampToValueAtTime, linearRampToValueAtTime); AudioParam modulation by node connection (LFO -> gain -> frequency) in whirl/flute

**Motion & sound:** Everything is scheduled at currentTime + 10ms. Gongswell has a 350ms soft attack and a delayed bell at +550ms — ideal for a matching haptic swell.

**Mobile mapping:** Option A (verbatim): react-native-audio-api implements the Web Audio API surface used here, so engine.ts can be ported almost line-for-line (swap the context constructor/import). Requires an Expo dev build (no Expo Go). Verify LFO->AudioParam connections and BiquadFilter coverage on the installed version. Option B (recommended): pre-render mistake_thud and gate_gongswell (and any recipe you want to keep as an option) to WAV with an OfflineAudioContext script (browser/Playwright or node-web-audio-api) once, commit the files, and treat them as plain clips. Benefits: zero synthesis CPU on the JS/audio thread during animations, deterministic loudness (can be levelled with the same -29 dB rule), works with any playback backend, identical sound on iOS/Android. Cost: noise randomness (nz random offset, crackle) is frozen into one take, which is inaudible for these two. Keep engine.ts in the repo as the authoring tool for the design canvas.

**Why M:** Verbatim port is S-M with react-native-audio-api; pre-rendering needs a small one-off render script but simplifies the runtime.


## Long clips (rank-down music) with fade  ·  complexity S

**Where:** src/lib/sound.ts: playFile (long branch), stopLongClip, SessionSummary in play/[id]/page.tsx, RankCeremony.tsx, SoundSettings.tsx

**Behaviour**

Variants with long:true (rankDown b 'Music' 15.49s, c 'Music II' 11.28s) play through `new Audio(file)` with a.volume = prefs volume, NOT through Web Audio (so no onset trim, no master gain; iOS ignores the volume). Only one long clip exists at a time. They are faded out when their screen closes: SessionSummary effect cleanup stopLongClip(400) (fires on unmount or when rankChange changes), RankCeremony 'Continue' stopLongClip(500), Settings preview stopLongClip(0) before every preview. Note: short rank clips (rank-tomoe 2.0s, rank-mangekyo 4.13s, rank-final 3.52s, rank-down-a 1.78s, rank-down-d 4.60s) are not stoppable and continue after the screen closes. Default rankDown pick is 'a' (short), so long clips only play for users who picked b/c.

**API**

- `GET /sounds/sfx/rank-down-b.mp3`
- `GET /sounds/sfx/rank-down-c.mp3`

**State & persistence:** longClip + fadeTimer module singletons.

**Web-only deps:** HTMLAudioElement; setInterval volume fade

**Motion & sound:** Linear 12-step fade, 400/500/0 ms per call site.

**Mobile mapping:** Use one engine for everything: react-native-audio-api BufferSource -> GainNode with gain.linearRampToValueAtTime(0, now+fade) then stop() (sample-accurate, no JS timers). Alternatively expo-audio AudioPlayer with a JS volume ramp. Re-encode long clips as AAC .m4a (smaller than MP3 at equal quality on both OSes). Also stop/fade long clips when the app goes to background (AppState 'background') and on audio interruptions (calls).

**Why S:** Two call sites and a simple fade.


## Settings → Gameplay → Sound toggle and SoundSettings panel  ·  complexity S

**Where:** src/app/(app)/settings/page.tsx (ToggleRow sound + conditional <SoundSettings/>), src/components/SoundSettings.tsx

**Behaviour**

ToggleRow 'Sound' (settings.sound / settings.sound_hint 'Plays on every move and outcome') toggles settings.soundEnabled via patch() -> optimistic setSettings + PATCH /users/me/settings (may return achievementsUnlocked -> achievement toasts). When enabled, SoundSettings renders: header (settings.sound_section 'Sounds', settings.sound_section_hint 'Pick a sound for each event. Tap ▶ to hear it.'); volume row: label settings.sound_volume, <input type=range 0..100> (accent #a64241), live percentage with tabular-nums; list (divide-y divide-eos-rise, rounded-lg bg-black/20) of the 12 events in SOUND_EVENT_ORDER, label t(`sound.ev.${ev}`); events with >1 variant (only rankDown) get a <select> (eos-well h-9 max-w-[52%]) whose change picks + stopLongClip(0) + previews the new variant (force); single-variant events show the variant name as static text; each row has a 36x36 ▶ button (lucide Play size 14 filled, bg-eos-rise hover:bg-eos-seam, aria-label '<event> ▶') -> stopLongClip(0) + sfx(ev,{force:true}). Volume slider does not play a preview sample while dragging. Synth volume change is applied immediately.

**API**

- `PATCH /users/me/settings {soundEnabled}`

**State & persistence:** useSoundPrefs (localStorage taktic.soundPrefs) for volume/picks; useAppStore.settings.soundEnabled (backend + localStorage taktic.settings). i18n: 15 keys used by SoundSettings (settings.sound_section, settings.sound_section_hint, settings.sound_volume, 12x sound.ev.*) + 2 by the toggle (settings.sound, settings.sound_hint), each in en and uk. 4 legacy keys appear unused: settings.sound_pack, settings.sound_correct, settings.sound_fail, settings.sound_preview_hint.

**Web-only deps:** <input type=range>; <select>/<option>; lucide-react; Tailwind classes / eos-* tokens

**Motion & sound:** Preview plays the event sound; no UI animation.

**Mobile mapping:** Slider: @react-native-community/slider or a custom Reanimated + Gesture Handler slider with selection haptics every 10% and a short 'move' preview on release. Variant picker: native ActionSheet / bottom sheet (@gorhom/bottom-sheet) or inline segmented list. Play button: Pressable with press-scale animation (Reanimated, ~100ms) and the event's paired haptic. lucide-react-native for the icon. Add a separate 'Haptics' toggle (+ maybe 'haptics only when sound off'). Add iOS-specific choice 'Play sounds in silent mode' if desired.

**Why S:** One small list screen; only controls need native equivalents.


## Board sound call sites (move / capture / check / castle / promote / correct / mistake)  ·  complexity M

**Where:** play/[id]/page.tsx (rated session), puzzles/[puzzleId]/page.tsx (single puzzle re-solve + solution stepper), review/[puzzleId]/page.tsx (mistake review), sessions/[id]/review/page.tsx (session attempts queue)

**Behaviour**

Common pattern: (1) Puzzle setup (opponent's first move) plays 'move' immediately when the setup animation starts, the post-setup FEN is swapped in after ANIMATION_MS[speed]+20ms (instant 0, fast 160, normal 280, slow 460). play page uses sfx('move') (setup is always a plain 'move' even if it is a capture/check); the other three use playSound(pack,'move'). (2) Player move: sfx(moveSoundEvent(legal)) EXCEPT when the move wins the puzzle (final mainline move; on play page also any checkmate) — then only 'correct' plays standalone. (3) Wrong move: the move click AND 'mistake' (thud) are triggered in the same tick (overlap by design) + red square wash for 500ms; puzzles/review pages reset the puzzle after 520ms. (4) Correct final: 'correct' + green wash 500ms; review pages advance after SOLVED_PAUSE_MS=1000ms. (5) Opponent reply after max(animMs, 80)ms: sfx(moveSoundEvent(move)) — except review/[puzzleId] which uses playSound(pack, mv.captured ? 'capture' : 'move') so its replies never play check/castle/promote (inconsistency). (6) puzzles/[puzzleId] solution stepper goToPly: a single forward step plays moveSoundEvent(played); backward/jumps are silent; ArrowLeft/ArrowRight keys drive it. play page sfx calls rely on sfx's internal soundEnabled check; the other pages also guard with settings.soundEnabled. Play page mistake check: wrong move that delivers checkmate counts as correct.

**State & persistence:** None beyond settings; timers are page-local setTimeout.

**Web-only deps:** window keydown (ArrowLeft/Right) in solution mode; setTimeout choreography tied to CSS animation speeds

**Motion & sound:** Sound fires at animation START for setup/opponent moves (the piece then slides for animMs), and at drop for player moves. Feedback wash 500ms, reset 520ms, solved pause 1000ms, opponent delay max(animMs,80).

**Mobile mapping:** Centralise in a `useBoardFeedback()` hook that emits {sound, haptic} per board event so the four screens don't duplicate the soundEnabled checks. Fire the haptic for the player's own move on gesture end (piece drop) from the UI thread if possible (Reanimated runOnJS -> haptic is fine; latency ~1 frame). For opponent moves consider firing sound+haptic when the piece LANDS (animation callback) rather than at start — but this is a UX change versus web; decide explicitly. Replace keyboard arrows with swipe/press-and-hold stepper buttons.

**Why M:** Many call sites with subtly different rules (winning-move suppression, legacy playSound, review page reply inconsistency) must be unified.


## Progression sounds: norm gate up/down and RankCeremony  ·  complexity M

**Where:** SessionSummary (play/[id]/page.tsx ~line 897-917), src/components/RankCeremony.tsx

**Behaviour**

SessionSummary computes rankChange (skips early sessions, calibration, unknown ceilingBefore). If the norm moved without crossing a band: sfx('gate') (synth gongswell) on up, sfx('rankDown') on down, while the outcome card animates (.norm-rise 900ms cubic-bezier(.2,1.25,.4,1) / .norm-drop 900ms, .norm-icon-rise 1100ms delay 200ms). Effect cleanup stopLongClip(400). If a band was crossed: full-screen RankCeremony portal. On mount it plays rankFinal (to==='expert'), rankMangekyo (to==='advanced'), else rankTomoe for up; rankDown for down. Stages: 40ms -> stage 1 (old eye .rank-spin 1000ms cubic-bezier(.5,0,.2,1)); at 950ms (up) / 750ms (down) / 200ms (prefers-reduced-motion) -> stage 2: new eye .rank-pop 900ms cubic-bezier(.2,1.3,.4,1), white .rank-flash 700ms ease-out (peak opacity 0.55 at 15%) on up only, text slides in (500ms, delay 150ms), norm counter ticks normFrom->normTo in 14 steps over 600ms, Continue button fades in (500ms, delay 500ms). Continue -> stopLongClip(500) + onClose. Glow radial gradient alpha 0.08/0.22/0.34 (up) or 0.14/0.04 (down); final glow rgba(149,98,206,0.6) for expert else rgba(201,81,70,0.55). i18n rank.up, rank.down, rank.norm, rank.line_tomoe, rank.line_mangekyo, rank.line_final, rank.line_down, rank.continue (8 keys) + levels.<band>.

**State & persistence:** Local component state (stage, norm), timers ref.

**Web-only deps:** createPortal(document.body); window.matchMedia('(prefers-reduced-motion)'); CSS keyframes rank-spin/rank-pop/rank-flash/norm-*; <img> band icons; autoFocus

**Motion & sound:** Sound starts at t=0; visual climax (flash + pop) at 950ms up / 750ms down. Rank clips are 2.0-4.6s; rank-down long music 11-15s.

**Mobile mapping:** Native modal (react-native Modal or a root-level Reanimated overlay) instead of portal; Reanimated withTiming/withSpring for spin/pop/flash (use the same bezier curves via Easing.bezier); AccessibilityInfo.isReduceMotionEnabled() for reduced motion. Choreograph haptics to the stage timeline: start (light/soft impact), ramping light ticks during the 950ms spin, Heavy impact + success notification exactly at stage 2 (the flash), optional selection ticks on the 14 norm counter steps. Consider aligning stage-2 time to the audio clip's actual hit point for each rank clip (measure offline).

**Why M:** Audio part is trivial; the coupled animation + haptic timeline is the bulk.


## Sound assets  ·  complexity S

**Where:** apps/frontend/public/sounds/**

**Behaviour**

Measured with afinfo/stat: sfx/move-1.mp3 24,087 B, 0.432s, 2ch 48kHz 320kbps; sfx/capture-1.mp3 33,687 B, 0.672s, 2ch 48k 320k; sfx/check-1.mp3 11,923 B, 0.360s, 2ch 48k 128k; sfx/castle-2.mp3 11,155 B, 0.312s, 2ch 48k 128k; sfx/promote.mp3 26,967 B, 0.504s, 2ch 48k 320k; sfx/correct-5.mp3 7,542 B, 0.183s, 1ch 44.1k 75kbps; sfx/rank-tomoe.mp3 86,519 B, 2.010s, 2ch 44.1k 320k; sfx/rank-mangekyo.mp3 72,185 B, 4.127s, 2ch 44.1k 128k; sfx/rank-final.mp3 147,121 B, 3.524s, 2ch 44.1k 320k; sfx/rank-down-a.mp3 77,940 B, 1.776s, 2ch 48k 320k; sfx/rank-down-b.mp3 129,953 B, 15.491s, 2ch 22.05kHz 64kbps (long); sfx/rank-down-c.mp3 186,613 B, 11.285s, 2ch 44.1k 128k (long); sfx/rank-down-d.mp3 79,615 B, 4.598s, 2ch 44.1k 128k. Total sfx ≈ 895 KB. Orphans (no references in src): sounds/correct.mp3 2,507 B 0.078s 2ch 44.1k; sounds/fail.mp3 7,523 B 0.235s 1ch 44.1k (leftovers from commit 6636a7a). Mixed sample rates (22.05/44.1/48k) and bitrates. Per commit afec3e5, move-1/capture-1/promote contain 160-290ms leading silence.

**State & persistence:** Static files.

**Web-only deps:** Served from Next public/

**Motion & sound:** See durations.

**Mobile mapping:** Bundle into the app (no network fetch): apps/mobile/assets/sfx. Pre-process once: decode -> trim leading silence (same -40 dBFS/3ms rule) -> level board/feedback clips to -29 dBFS RMS over first 100ms -> resample to 48kHz -> mono for board clicks -> export WAV/CAF for short clips (~0.3-0.7s mono 16-bit 48k ≈ 30-65 KB each) and AAC .m4a for rank/long clips. Drop the two orphan files. Add the two pre-rendered synth files (mistake-thud, gate-gongswell).

**Why S:** One-off processing script plus asset moves.


## Haptics pairing (new on mobile; web has none)  ·  complexity M

**Where:** (new) haptics façade paired inside sfx(), Board drag/drop, RankCeremony, SessionSummary, SoundSettings

**Behaviour**

Web has no haptics at all (no navigator.vibrate usage). Proposed mapping per SoundEvent (expo-haptics presets): piece pickup/drag start (no sound today) -> selectionAsync; move -> impactAsync(Light) on drop; capture -> impactAsync(Medium); check -> impactAsync(Rigid) or Medium+Light 60ms later; castle -> two Light impacts ~80ms apart (king + rook); promote -> impactAsync(Heavy) or Medium then Light; correct -> notificationAsync(Success) (do not add the move tap, matching the web rule that the winning move suppresses the click); mistake -> notificationAsync(Error) only (web overlaps click+thud; on haptics the double would feel mushy — suppress the move impact on wrong moves); gate (gongswell, 350ms attack, bell at +550ms) -> soft impact at 0 then Medium at ~550ms, or a Core Haptics continuous swell; rankTomoe/Mangekyo/Final -> ceremony timeline (soft at 0, light ticks during 950ms spin, Heavy+Success at 950ms flash; stronger/longer for final); rankDown -> notificationAsync(Warning) at 0 and Soft at 750ms; illegal drop / snapback (silent today) -> Rigid light; hint reveal -> selection; settings slider -> selection every 10%; ▶ preview -> the event's haptic. Haptics should have their own toggle independent of soundEnabled, and should still fire when sound is muted (unless toggled off).

**State & persistence:** New per-device pref `hapticsEnabled` (MMKV); possibly backend column if account-level.

**Motion & sound:** Fire haptic and sound on the same frame; audio output latency on Android can be 20-80ms so optionally delay the haptic a few ms on Android to match perceived sound onset (tune on device).

**Mobile mapping:** expo-haptics covers presets (impact Light/Medium/Heavy/Soft/Rigid, notification, selection); on Android it maps to Vibrator effects whose quality varies by device. Custom patterns (gongswell swell, ceremony ramp) need Core Haptics (AHAP) on iOS via a community module or a small custom Expo module; Android via VibrationEffect.createWaveform/Composition (API 30+). Keep a tiny shared table `HAPTIC_FOR_EVENT: Record<SoundEvent, HapticSpec>` in the shared package.

**Why M:** Preset pairing is S; custom swell/ceremony patterns need a native module and device tuning.


## Shared-logic candidates

- `apps/frontend/src/lib/sound/catalog.ts` — SoundEvent, SoundVariant, SOUND_CATALOG, DEFAULT_SOUND_PICKS, SOUND_EVENT_ORDER — blockers: `file` values are web URL paths (/sounds/sfx/*.mp3) built by F(); change to platform-neutral asset keys resolved per platform (RN needs static require()).
- `apps/frontend/src/lib/sound.ts (moveSoundEvent only)` — moveSoundEvent(m) -> SoundEvent; SoundKind mapping from playSound ('fail' -> 'mistake') — blockers: Lives in a 'use client' module that imports zustand store, engine and window; extract the pure function to the shared package.
- `apps/frontend/src/lib/sound.ts (analyse + constants)` — analyse(buffer, level) onset/levelling algorithm; ONSET_THRESHOLD 0.01, PREROLL_S 0.003, LEVEL_WINDOW_S 0.1, TARGET_RMS 10^(-29/20), MAX_BOOST 2, LEVELLED set — blockers: Typed against AudioBuffer; trivially generalisable to Float32Array[] + sampleRate. Best used in an offline asset-processing script rather than at runtime on mobile.
- `apps/frontend/src/lib/sound/engine.ts` — synth(id, delay), setSynthVolume, audioOut + all recipe building blocks — blockers: Depends on window.AudioContext; portable nearly verbatim to react-native-audio-api (different import/constructor), or reusable as-is inside a browser/OfflineAudioContext render script to pre-render recipes to WAV.

## Haptics opportunities

- Piece pickup / drag start: selection or Light impact (no sound exists today).
- Own move drop: Light impact, fired on gesture end together with the move click.
- Capture: Medium impact; Check: Rigid (or Medium + delayed Light); Castle: two Light taps ~80ms apart; Promote: Heavy (or Medium then Light), also on promotion picker selection.
- Opponent reply (after max(animMs,80)ms): softer variant (Soft/Light at ~60% intensity) so the player can feel the reply without confusing it with their own move.
- Correct puzzle: notification Success (no extra move tap, mirroring the web rule that the winning move suppresses the click).
- Mistake: notification Error only; suppress the simultaneous move tap that the web plays under the thud.
- Illegal drop / snapback and blocked input while opponentBusy: Rigid light tap (silent on web).
- Hint reveal (hintLevel 1/2): selection tick.
- Norm gate up (gongswell): soft impact at 0ms then Medium at ~550ms when the bell enters; norm down: Warning notification.
- RankCeremony: timeline-synced pattern - soft at 0, ramping light ticks across the 950ms spin, Heavy + Success at the 950ms flash/pop (750ms for down, 200ms reduced motion), optional selection ticks on the 14 norm-counter steps over 600ms; 'Continue' press: Light.
- Settings volume slider: selection tick every 10%; ▶ preview buttons play the event's paired haptic; Sound/Haptics toggles: Light.
- Solution stepper (puzzles/[puzzleId]): selection tick per forward/back step (replaces ArrowLeft/Right).

## Push opportunities

- Custom notification sound for rank-up / norm-gate push (iOS requires a bundled .caf/.wav/.aiff under 30s; Android needs a notification channel with the sound set at channel creation) - could reuse a trimmed rank-tomoe or gongswell render.
- Streak / daily reminder pushes could use a short neutral clip (e.g. pre-rendered correct-5 or move-1) as a branded notification sound; keep default OS sound as an option.

## Risks

- Two playback paths today (Web Audio for short clips, HTMLAudioElement for long clips); on iOS web the long-clip volume and fade do not work (HTMLMediaElement.volume is read-only). Unify on one native engine to avoid carrying this split over.
- react-native-audio-api requires an Expo dev client / prebuild (native module), not Expo Go; its API surface around asset decoding (decodeAudioData from a local file URI) and AudioParam modulation (LFO -> filter frequency used by whirl/flute) should be verified against the installed version before committing to a verbatim engine port.
- expo-audio is player-per-source (AVPlayer/ExoPlayer style): higher start latency and no native overlap of the same sound without a player pool; overlapping move-click + mistake + opponent reply would need 2-3 players per event. Not suitable for synthesis.
- MP3 assets carry encoder delay and 160-290ms leading silence on move-1/capture-1/promote; if ported as-is to a backend that cannot seek with sample accuracy, the sound will lag the move again. Pre-trim offline.
- iOS audio session category: must choose ambient/mixWithOthers (respect silent switch, don't stop the user's music) vs playback (ignores silent switch). Wrong choice either kills Spotify when a move plays or makes sounds silent unexpectedly.
- Audio interruptions (phone call, Siri) and app backgrounding: AudioContext/engine must be resumed on return; long rank-down music must be stopped on background.
- Android audio output latency varies widely (often 20-80ms+); haptic-sound sync needs on-device tuning; low-end Android vibrators make preset haptics feel buzzy.
- Sound timing is coupled to setTimeout choreography and CSS animation durations (ANIMATION_MS 0/160/280/460, +20ms swap, 80ms min reply delay, 500ms wash, 520ms reset, 1000ms solved pause); porting animations to Reanimated changes when 'landing' happens, so sound/haptic triggers must be re-anchored deliberately.
- Inconsistency to fix during port: review/[puzzleId] opponent replies use playSound('capture'|'move') so check/castle/promote sounds never play there; all setup moves play plain 'move' even when the setup is a capture/check.
- soundPack is a legacy backend column (default 'wood') whose only effective value is 'mute'; carrying it into the mobile API contract perpetuates dead state.
- Short rank clips (up to 4.6s) cannot be stopped when the ceremony closes; only long clips fade. On mobile with faster navigation this may bleed into the next screen.
- Synth recipes use Math.random (noise offsets, crackle timing), so pre-rendering freezes one take; negligible for thud/gongswell but would matter if crackle-heavy recipes are revived.

## Open questions

- Engine choice: adopt react-native-audio-api for all audio (recommended: Web Audio semantics, sample-accurate start, cheap overlapping BufferSourceNodes, GainNode fades) with expo-audio only as a fallback? Or pre-render everything to files and use expo-audio with player pools?
- Should the two synth-only defaults (mistake_thud, gate_gongswell) be pre-rendered to WAV (recommended), and should the 46 unreachable recipes be deleted or kept as design-canvas tooling?
- Should sound volume/picks (and a new hapticsEnabled) stay per-device (MMKV) or become account settings on PATCH /users/me/settings?
- Should sounds play when the iOS ring/silent switch is on silent, and should they mix with the user's background music?
- Is the legacy soundPack field to be dropped from the backend/mobile contract (only 'mute' has an effect, and no UI sets it any more)?
- For opponent moves, should sound + haptic fire at animation start (current web behaviour) or when the piece lands?
- Should a wrong move keep the overlapping move click + thud on mobile, or play the thud alone (with Error haptic)?
- Are the orphan files public/sounds/correct.mp3 and fail.mp3 safe to drop (no references found in src)?
- Is iOS web pointerdown actually a user-activation event for AudioContext.resume (touch pointerdown may not be); irrelevant for native but explains any 'first sound silent' reports on web.
- Does the rank ceremony's 950ms stage-2 timing line up with the hit point inside each rank clip? Not measured; would matter for syncing the Heavy haptic.
