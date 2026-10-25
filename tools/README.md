# tools

Offline pipelines that turn the web app's assets into the native app's
bundle in `apps/mobile/assets`. Everything here is re-runnable and the
output is committed; nothing runs at app build time.

```sh
tools/assets/build-all.sh          # everything below, then the manifest
```

| Script | Writes |
|---|---|
| `assets/build-images.mjs [stage…]` | `pieces/ board/ plates/ textures/ icons/ themes/ surfaces/ images/` |
| `assets/fonts.sh` (→ `fonts.py`) | `fonts/` |
| `audio/process-sfx.mjs` | `sfx/*.wav`, `sfx/*.m4a` from the web clips |
| `audio/render-synth.mjs [--master 0.9]` | `sfx/mistake-thud.wav`, `sfx/gate-gongswell.wav` |
| `assets/build-manifest.mjs` | `manifest.json` (every asset: key, path, size or duration) |
| `assets/bake-fade.py`, `assets/bake-board.py` | copies of `apps/frontend/scripts/*`, see below |

Stages of `build-images.mjs`: `pieces board plates textures icons themes surfaces appicon`.
Each stage wipes and rewrites its own folder (`appicon` only overwrites its
five files in `images/`).

**Requirements:** macOS (`afconvert`, `afinfo`), Node 24, ImageMagick 7
(`magick`), `cwebp`, Python 3. `fonts.sh` needs network access and fontTools.
It uses the system fontTools if present, otherwise it creates a throwaway
venv in `$TMPDIR` with `fonttools==4.60.1`.

## Images

**Source.** Everything comes from `apps/frontend/public/design`, i.e. the
baked (fade-applied) images the web actually renders. `design-src` holds the
un-baked originals at the *same* resolutions (no larger masters exist), so
using it would only mean re-baking. Re-bake with `bake-fade.py image` if the
fade is retuned.

**Pieces.** `pieces/{ember,classic}/{wK…bP}.webp` are 256 px (the master
size), lossy q92 with lossless alpha. `pieces/manifest.json` maps set → piece →
file.

**Board.** `board/board.webp` is 2048 px: 8×8 squares of 256 px, each the
whole 512² tile Lanczos-downscaled, as the web stretches one tile per square
(`.sq-marble` / `.sq-slate`, `background-size: 100% 100%`). a1 is dark, so
the top-left (a8) is light. Use the image **unrotated for both
orientations**. The colour pattern is 180°-symmetric, and every tile has a
lighter top band that must stay on top, as it does on the web.
`board/tile-{light,dark}.webp` are the 512 px tiles, for TurnCard's disc and
for anything drawn per square.

**Plates (3-slice).** The web draws `.btn-ember` / `.btn-slate` with
`border-image-slice: 55 60 55 60 fill` and `border-image-repeat: round
stretch`. Border widths come from `PLATE_BORDER` in `components/ui/button.tsx`:

| size | height pt | border V pt | cap width pt (border H) | mid tile width pt (ember / slate) |
|---|---|---|---|---|
| sm | 36 | 10 | 11 | 162.91 / 166.18 |
| md | 44 | 12 | 13 | 195.49 / 199.42 |
| lg | 52 | 14 | 15 | 228.07 / 232.65 |

Per variant and size there are three images at @2x/@3x:
`plates/{ember,slate}-{sm,md,lg}-{left,mid,right}@{2,3}x.webp`.

- **left/right** are the source's 60 px side columns: corner, stretched edge
  and corner, each scaled to the exact web border box. Render them at
  `capWidth × height`.
- **mid** is the whole centre band (top edge + fill + bottom edge) at the
  width CSS `round` starts from: `srcMidWidth × borderV / 55`. To do what
  `round` does, lay out `n = max(1, round(midW / tileW))` copies, each
  stretched to `midW / n`, where `midW = buttonWidth − 2 × capWidth`. A plain
  `resizeMode="stretch"` single copy is the n = 1 case, which already holds
  for buttons up to ~1.5 tiles wide.

The plan asked for a 1–2 px stretchable middle column. That was rejected
because the plates are textured stone: stretching one column smears the
texture into streaks. The same numbers are in `plates/plates.json`.

**Textures.** `textures/slate.webp` is 512 px and seamless; the stage
checks the wrap seam against the image interior and fails if that changes.
The web tiles it at 520 CSS px. It ships as a 1x asset, so RN
`resizeMode="repeat"` tiles it at 512 pt. There is no separate marble
texture: on the web, "marble" means the light board tile.

**Icons.** No larger masters exist, so @3x is the source and @2x is ⅔ of it.
The logical size is therefore source/3:

- `mode-*`, `nav-home`, `nav-play`: 32 pt
- `nav-review`, `nav-review-book`: 32×24 pt
- `rank-*`, `tomoe-*`: 42.67 pt. RankCeremony shows them at 200 pt, an
  upscale, as on the web.
- `knight-logo`: 128 pt

Tinted masks (`mode-*`, `nav-play`, `nav-review*`, white on alpha, for
expo-image `tintColor`) are lossless; the painted ones are lossy q92.
`nav-review-book` is an SVG that cuts its page lines out with `<mask>`.
ImageMagick ignores masks, so the stage draws its paths as MVG and does the
cut itself. The cleaned SVG ships too.

**Theme glyphs.** `themes/*.svg` are the 43 web SVGs with the C2PA
`<metadata>` blocks and `xmlns:c2pa` stripped (384 KB → 58 KB), otherwise
untouched (fill `#7f7f7f`, viewBox 512). `CREDITS.md` (game-icons.net,
CC BY 3.0) is kept; the credit must stay visible in the app.

**Surfaces.**
- `surfaces/avatar-disc.png` (256 px) is `.eos-avatar` baked for a 60 pt
  disc at 4 px/pt: slate texture at 220 pt tiles, centred; linear veil;
  highlight; both inset shadows; the two 1 pt rings. The rings lie *outside*
  the disc, so render the image at `size + 4` with a `-2` margin. Leave the
  outer drop shadow to RN `boxShadow: '0 3px 8px rgba(17,15,17,0.45)'` and
  the initials to `Text`.
- `surfaces/background.png` (opaque, 860×1864 = 430×932 pt @2x) is the
  `.app-shell` ground: ink, the fixed vignette and the top ember glow.
  Stretch it to the screen.
- `surfaces/vignette.png` and `surfaces/top-glow.png` are the same two
  layers on transparency, for screens that scroll the glow with content.
  The vignette is all percentages, so stretching it is exact. The glow has
  fixed px radii (900×520 at 50% −12%); it was rendered for a 932 pt
  viewport, at full width × 260 pt.

**App icon, adaptive icon, splash** (`images/`, the paths `app.config.ts`
already uses). `src/app/icon.png` is a black knight on light paper. The
stage cuts the knight out:
- dark ink is unmixed to black + alpha;
- the red eyes keep their colour;
- paper-coloured negative space inside the head (the tear marks) stays
  negative space.

It then sets the knight on `#1d1b20` with the `<Logo glow>` radial ember
gradient behind it:
- `icon.png`: 1024, opaque RGB, knight at its original 68% height.
- `android-icon-foreground.png`: knight only, at 52% height. Its bounding
  box fits the 66 dp safe circle.
- `android-icon-background.png`: stone + glow, opaque.
- `android-icon-monochrome.png`: white silhouette.
- `splash-icon.png`: knight + glow on transparency, for the stone splash.
  The canvas is `<Logo glow>`'s 2.8 × size span, so the glow fades out
  inside the image and leaves no square edge on the stone. The knight is
  therefore 36% of `imageWidth`: at the current 96 it is ~34 pt; use
  ~200-280 for a 70-100 pt knight.

## Fonts

`fonts.py` downloads from `github.com/google/fonts` (raw), checks each file's
TrueType magic and parses it, and copies each family's `OFL.txt` to
`fonts/licenses/<Family>-OFL.txt`:

- **Manrope** 400/500/600/700/800 and **Cinzel** 400–900. These exist there
  only as variable fonts, so each weight is cut into a static instance
  (`fontTools.varLib.instancer`). Each instance is renamed so that family,
  full name and PostScript name are all `<Family>-<Weight>` (e.g.
  `Manrope-Bold`). On both platforms one `fontFamily` then selects one file,
  and iOS registers it under that PostScript name. Neither license has a
  Reserved Font Name, so the renamed instances are fine under the OFL.
- **Forum**, **Cormorant SC** (300–700), **Prata**: the Cyrillic display
  candidates for `uk`, shipped unmodified (Forum declares an RFN). Drop the
  losers once the owner picks: Cormorant SC alone is 3.7 MB.

`fonts/fonts.json` records each file's PostScript name, weight, glyph count
and Cyrillic coverage (А Б В а б в plus Ґ Є І Ї). Cinzel has none, as the inventory
says.

## Audio

`process-sfx.mjs` is the web's runtime `analyse()` (`src/lib/sound.ts`) done
offline, so the app plays every clip from sample 0 at gain 1.

1. Decode with `afconvert` to 16-bit WAV at 48 kHz, keeping the channels.
2. Find the onset: the first sample above 0.01 (−40 dBFS) in any channel.
3. Trim to the onset minus 3 ms.
4. Level the board and feedback clips (move-1, capture-1, check-1, castle-2,
   promote, correct-5) to −29 dBFS RMS. The RMS is measured over the 100 ms
   after the onset, across all channels, and the boost is capped at +6 dB.
   Rank clips keep their own mastering.
5. Write the short clips as 48 kHz mono 16-bit WAV. Write the `rank-*`
   clips as AAC `.m4a`: stereo, 48 kHz, 64 kbps per channel.

The script prints a before/after table of onset, RMS (100 ms window) and
peak, and exits non-zero if anything clipped.

The `.m4a` files store their 2112-frame AAC priming in the MP4 edit
metadata. AVFoundation and `afconvert` honour it, so the measured onset is
3 ms. A decoder that ignores it would start ~44 ms late, which matters only
for aligning the ceremony haptics. The long rank-down b/c clips are trimmed
too, where the web (an `<audio>` element) does not; they lose 64 ms and
25 ms of silence.

`render-synth.mjs` pre-renders the two synth recipes that are still default
picks, `mistake_thud` and `gate_gongswell`, from `src/lib/sound/engine.ts`.
It covers `tone`, `nz` and `bell` with Web Audio semantics:
- a-rate `setValueAtTime` / `exponentialRampToValueAtTime`;
- phase-accumulated sine oscillators;
- the shared 2 s noise buffer read from a random offset;
- spec biquads (lowpass/highpass Q in dB, bandpass Q linear), recomputed
  per sample;
- master gain 0.9.

`Math.random` is a seeded PRNG, so output is byte-identical across runs.
Recipes start at t = 0 because the web's +10 ms is scheduling lookahead.

**Validation.** The same recipes were rendered in Chrome's
`OfflineAudioContext` and the renders compared. 20 ms RMS envelopes agree
within 0.3 dB for the whole clip (noise realisation aside), and peaks within
0.2 dB.

**Volume.** On the web, `out.gain = volume × 0.9` applies to synth *and* clip
voices alike. The renders bake in the 0.9. If the app's master is also
`volume × 0.9`, the synth voices end up 0.9× too quiet relative to the clips.
Either use a master of `volume` for these two, or render with
`--master 1`.

## Manifest

`apps/mobile/assets/manifest.json` lists every file, with:
- `key`: the path without extension or scale suffix (unique; when two
  formats share a name, e.g. `icons/nav-review-book`, the scaled raster
  keeps the bare key and the other gets its extension: `….svg`);
- `path`: what `require()` takes;
- `kind`;
- dimensions: pt for @2x/@3x images (plus the px of each scale), px
  otherwise;
- duration, rate and channels for audio;
- PostScript name, weight and Cyrillic coverage for fonts;
- bytes.

## bake-fade.py / bake-board.py

These are copies of `apps/frontend/scripts/`; the plan moves them here.
Every new colour goes through `bake-fade.py color "#hex"` before it becomes a
token. Both scripts need `numpy` and `Pillow` for their `image` modes.
