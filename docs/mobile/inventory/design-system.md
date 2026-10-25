# Inventory: design-system

_Visual design system ("Ember on stone") and landing page: tokens, typography, surfaces, UI primitives, brand mark, motion catalogue, assets, landing sections and landing i18n_

Generated 2026-10-25 by a read-only analysis of the web app (apps/frontend) and backend, as the reference for the native port. Line-level details may drift as code changes.


## Colour tokens (Ember on stone palette)  ·  complexity S

**Where:** globals.css :root, tailwind.config.ts theme.extend.colors

**Behaviour**

There is one theme, dark only. layout.tsx always sets html class="dark", colorScheme 'dark' and themeColor #1d1b20 for both colour-scheme media queries. Core tokens: --eos-ink #1d1b20 (app ground), --eos-shade #222025 (bars, sheets), --eos-slate #29282d (cards), --eos-rise #353339 (pressed, chips), --eos-seam #413f46 (borders), --eos-well #1a181c (carved inputs, segmented track), --eos-bone #e7e0d7 (text), --eos-ash #a5a0a4 (secondary text), --eos-dust #736f74 (disabled, faint), --eos-ember #a64241 (the one accent), --eos-embers #592628 (pressed, tint), --eos-rose #d8847c (negative numbers), --eos-sage #afc0a9 (positive numbers), --eos-hl #3a6296 (board highlight and arrows, blue).

Legacy aliases: --accent = ember; --accent-soft = color-mix(ember 18%), which is rgba(166,66,65,0.18); --accent-weak = 8%; --accent-contrast #f5eee5; --bg-base = ink; --bg-card rgba(41,40,45,0.86); --bg-card-solid = slate; --bg-soft = shade; --bg-softer = rise; --border-soft rgba(255,255,254,0.05); --border = seam; --border-strong rgba(255,255,254,0.16); --text = bone; --text-dim = ash; --text-faint = dust; --danger #d07771.

The landing light-paper tokens --paper #f2ece5, --paper-soft #ebe4db, --ink #1c1b1d and --ink-dim #4f4e4d are unused.

Tailwind overrides: black → #110f11 and white → #fffffe (the fade is baked into both). The zinc ramp is remapped to warm graphite: 50 #f9f4ed, 100 #f2ebe2, 200 #e7e0d7, 300 #cbc5bf, 400 #a5a0a4, 500 #807c81, 600 #615e64, 700 #413f46, 800 #2f2d32, 900 #222025, 950 #1d1b20. Older screens use zinc-* classes, so they inherit this ramp. Also defined: bg.{DEFAULT, soft, softer, card, border}; accent.DEFAULT var(--accent) with a legacy fallback of #38c169 (green), accent.fg #f5eee5; board.light #cdcfd5, board.dark #505059, board.select rgba(58,98,150,0.45), board.highlight and board.lastmove rgba(58,98,150,0.35).

Colours that recur as literals: plate text #eee5d8; Segmented active text #f5eee5; input border #312f34; section rule shadow #2c2a31; ember tint rgba(166,66,65,0.14 or 0.16); sage tint rgba(148,165,142,0.16); rank-progress gradient #753132→#a64241; gate-bar gradient #64765f→#94a58e.

Rank band colours (levels.ts): novice #a5a0a4, beginner #cbc5bf, intermediate #d7b777, advanced #ba7058, expert #a64241, each with an rgba glow at 0.18–0.25.

Feedback colours: correct rgba(94,218,137,0.7), fail rgba(223,78,77,0.7), hint amber rgba(236,162,38,0.95), ember spark rgba(242,127,75,0.9), norm gold rgba(215,183,119,0.45).

User accent customisation is gone. store.ts setSettings removes any inline --accent or --accent-contrast, so the stored accentColor is ignored.

**State & persistence:** Static CSS variables. Nothing changes them at runtime: store.ts only removes old inline overrides.

**Web-only deps:** CSS custom properties; color-mix() in --accent-soft, --accent-weak, .app-shell, .app-glow and .ring-pulse; Tailwind class strings with arbitrary values

**Motion & sound:** none

**Mobile mapping:** Create packages/design-tokens/src/colors.ts with literal baked hex and rgba values. Precompute every color-mix() result, e.g. accentSoft = 'rgba(166,66,65,0.18)'. Use the same file for the web tailwind.config (if the web survives) and the RN theme so the two cannot drift.

Recommended RN styling: StyleSheet.create, or react-native-unistyles v3 (C++ and zero re-render theming, a good fit for the 60/120fps target), with a typed theme object built from these tokens. NativeWind is possible, since it would let tailwind-like class strings carry over, but most web classes depend on CSS features RN lacks (border-image, multi-layer and inset shadows, color-mix, arbitrary gradients). Porting class strings 1:1 would therefore give little, and NativeWind adds runtime style resolution.

Copy the zinc remap into the token set (graphite.50–950) so ported screens keep the warm greys. Lock the app to dark: app.json userInterfaceStyle 'dark', expo-system-ui background #1d1b20, expo-status-bar style 'light', Android navigationBar #1d1b20.

**Why S:** Pure data. The only work is precomputing color-mix values and copying the zinc remap.


## Baked global fade pipeline  ·  complexity S

**Where:** scripts/bake-fade.py, scripts/bake-board.py, design-src/ (originals), globals.css comment block lines 504-509

**Behaviour**

The look used to come from a full-screen overlay: "fade 35, desaturate 49, warmth 35, vignette 60", built from backdrop-filter and blend layers. That overlay is gone. Its colour transform is now applied ahead of time to every hex and rgba literal in the source and to every image.

bake-fade.py applies: contrast(0.962) saturate(0.892) brightness(1.02) sepia(0.035), then lightens with rgb(38,34,40) at 35%. Modes: `color "#hex"` prints the baked value; `image SRC DST` bakes one image and keeps alpha; `text FILE...` rewrites literals in place and is NOT idempotent.

bake-board.py bakes pieces (stone4/orig → final/pieces) and board tiles (board2/tile_*.jpg → final/board), applying fade 0.30 and temperature −22 (a soft-light blend with #3d7bff at 13.2% opacity). Un-baked originals live in apps/frontend/design-src/ (1.5MB, containing board, icons, knight-logo.webp, pieces, pieces-classic, plates and textures).

The only part of the overlay still drawn live is the vignette, which is part of the .app-shell background: radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(10,8,12,0.23) 100%) with background-attachment fixed.

**State & persistence:** Build-time tooling only.

**Motion & sound:** none

**Mobile mapping:** Treat every colour and image in the web code as already baked and copy them verbatim into RN. Do not apply any fade overlay; it would be applied twice.

Any new colour added for mobile must first go through `python3 apps/frontend/scripts/bake-fade.py color '#xxxxxx'`. Otherwise it will look over-saturated next to the rest. Move the scripts to a shared tools/ folder.

For the vignette, use a single static PNG overlay (expo-image, pointerEvents none) or a Skia RadialGradient drawn once at screen size. Do not animate it.

**Why S:** Tooling already exists. The RN side only needs to respect it.


## Typography (Cinzel, Manrope, Oswald)  ·  complexity M

**Where:** layout.tsx (next/font/google), globals.css .font-display, .font-serif-display, :where(.app-shell h1,h2), tailwind fontFamily.serif and fontFamily.sans

**Behaviour**

Fonts loaded:
- Manrope (--font-manrope) is the UI and body face. Weights 400, 500, 600, 700, 800; subsets latin, latin-ext, cyrillic.
- Cinzel (--font-cinzel) is the serif display face for titles, ranks, big numbers and plate buttons. Weights 500, 600, 700; subsets latin and latin-ext only, so it has NO CYRILLIC.
- Oswald (--font-display) has weights 500/600/700 and latin, latin-ext and cyrillic subsets. It is used only by Logo tone='light', which no code uses, so it is effectively dead.
All three use display: 'swap'.

Body: Manrope with fallbacks system-ui and -apple-system; -webkit-font-smoothing antialiased; text-rendering optimizeLegibility.

Rules inside the app shell:
- h1 and h2 use Cinzel 700 with letter-spacing 0.02em.
- h1, h2 or h3 with the uppercase class switch back to Manrope with letter-spacing 0.12em.

Recurring styles:
- Plate buttons: Cinzel bold, UPPERCASE, tracking 0.1em. Size sm is 36px tall at 13px, md is 44px at 14px, lg is 52px at 15px. Landing CTAs are 56px at 15px; secondary CTAs are 48px at 13px, or 56px at 14px on md screens.
- CardTitle: Manrope 700, 11px, uppercase, 0.12em, ash.
- CardValue: 24px, 800, tabular-nums.
- Eyebrow: 12px, 800, uppercase, 0.16em, ember.
- SectionTitle: Cinzel 700, 34px (50px on md), line-height 1.12.
- Hero h1: Cinzel 44px with line-height 1.05; 78px with line-height 1.02 on md.
- Landing small labels: 11–12px, 800, tracking 0.1–0.12em.
- Logo wordmark 'tac·tic·tak': Cinzel bold, 0.04em, font size = size × 0.6.
- Numbers use the tabular-nums class everywhere.

**State & persistence:** none

**Web-only deps:** next/font/google; CSS font-stretch condensed; em-based letter-spacing; element selectors (:where) for heading font switching

**Motion & sound:** none

**Mobile mapping:** Load the fonts with expo-font: the config plugin embeds them at build time, so nothing flashes. Use @expo-google-fonts/cinzel (Cinzel_500Medium, Cinzel_600SemiBold, Cinzel_700Bold) and @expo-google-fonts/manrope (400–800). Android needs a separate fontFamily per weight, so map weights to family names in a <Text variant> component; never rely on fontWeight with custom fonts.

RN letterSpacing is in px. Convert em to px: 0.1em at 15px = 1.5px; 0.12em at 11px = 1.32px; 0.16em at 12px = 1.92px. textTransform 'uppercase' works. tabular numbers use fontVariant ['tabular-nums'].

Build a typed Typography component with variants: display, title, sectionTitle, plateLabel, eyebrow, label, value, body, caption. There are no element selectors in RN, so every heading must pick its variant explicitly.

Set allowFontScaling or maxFontSizeMultiplier (about 1.3) on display text so Dynamic Type does not break the plate buttons. Pick a Cyrillic-capable serif for Ukrainian (see risks). Do not ship Oswald.

**Why M:** Font loading is easy. The work is the per-weight family mapping, em→px letter-spacing for every variant, and the missing Cyrillic in Cinzel, which needs a design decision.


## Surface treatments (glass, tx-slate, eos-well, eos-avatar, app-shell glow)  ·  complexity M

**Where:** .glass, .tx-slate, .eos-well, .eos-avatar, .app-shell, .accent-ring (unused), .app-glow (unused), .hero-chip (unused), .noise (unused)

**Behaviour**

- .glass (the name is historical: it is now a flat slate card): background #29282d; border 1px rgba(255,255,254,0.04); box-shadow inset 0 1px 0 rgba(255,255,254,0.04) plus 0 12px 28px -14px rgba(17,15,17,0.6). Used by Card, Toast, Onboarding, PullToRefresh, SessionList, TurnCard, Select popover and others.
- .tx-slate (hero card): linear-gradient veil rgba(32,30,35,0.74→0.86) over url('/design/textures/slate.jpg?v=3'); background-size cover for the veil and 520px tiles for the texture, so the texture reads at about 20%. Used by Card hero and the landing Hero board frame, Paces cards, Ranks panel and CTA panel.
- .eos-well (carved well): background #1a181c with inset 0 2px 4px rgba(17,15,17,0.55). Used by Input, Segmented track, Toggle off state, LangToggle, the Ranks bars, DifficultySlider, SoundSettings, ThemePicker, settings and leaderboard.
- .eos-avatar (round slate disc): a 3-layer background (a radial highlight at 35% 28% rgba(255,255,254,0.12), a linear rgba(74,72,80,0.35)→rgba(23,21,25,0.35), and the slate texture at 220px), a 5-layer box-shadow, Cinzel 700 initials and a text-shadow.
- .app-shell: radial-gradient(900px 520px at 50% −12%, ember 7%), so one faint warm glow from the top, plus the fixed vignette over ink. It applies safe-area padding at top and bottom.
- Hero-card shadow on Card hero: inset 0 0 0 1px rgba(255,255,254,0.06) plus 0 14px 30px rgba(17,15,17,0.5).
- Landing FloatCard: rgba(34,32,37,0.92) with backdrop-blur-sm and inset 1px ring plus 0 16px 32px shadow.
- Feature tiles: bg slate, rounded 14px, inset highlight.
- Section dividers use inset 0 1px 0 #2c2a31.

**State & persistence:** none

**Web-only deps:** multi-layer CSS backgrounds; inset box-shadow; background-attachment fixed; backdrop-filter blur; mix-blend-mode (noise, unused); CSS background tiling with background-size 520px

**Motion & sound:** none

**Mobile mapping:** - glass: View with backgroundColor #29282d and borderWidth StyleSheet.hairline at rgba(255,255,254,0.04). For the shadow, use RN 0.76+ boxShadow (New Architecture; supports inset and multiple shadows). On older versions or for lists, use iOS shadow* props and Android elevation as an approximation. For long FlashList lists, prefer a cheap 1px top-highlight View over an inset shadow.
- tx-slate: an Image or ImageBackground with resizeMode 'repeat' for the 520px tiling, plus an absolute veil View with a gradient (expo-linear-gradient). expo-image does not tile. Alternatively bake one pre-veiled texture PNG per card size, the cheapest option, or use a Skia ImageShader with tileMode 'repeat' when inside a Skia canvas.
- eos-well: boxShadow 'inset 0 2px 4px rgba(17,15,17,0.55)' on the New Architecture, or a 2px darker top-border gradient as a fallback.
- eos-avatar: bake one 256px disc PNG (highlight, texture and rim) and overlay the initials as Text with a textShadow. RN supports only one text shadow.
- app-shell glow and vignette: one static Skia canvas or PNG behind the root navigator.
- backdrop blur: avoid on Android (expo-blur is expensive). The cards are already 92% opaque, so a solid colour is visually the same.

**Why M:** Each treatment is simple, but the inset and multi-layer shadows and tiled textures need New-Architecture boxShadow or baked bitmaps, plus a performance check on Android.


## Plate buttons (9-slice stone plates) and Button primitive  ·  complexity M

**Where:** components/ui/button.tsx (Button), .btn-ember, .btn-slate, inline plate links in landing Hero, LandingNav and CTA, ~15 app screens using btn-ember or btn-slate classes directly (settings, sessions, friends, play/[id], AvatarCropper, ProfileEditor, FriendActionButton, RankCeremony, UserSearch, AchievementsGrid, profile)

**Behaviour**

Button variants:
- primary → .btn-ember: red clay plate image /design/plates/ember.webp (1016×201).
- secondary, outline and glass → .btn-slate: /design/plates/slate.webp (1034×194).
- ghost: transparent, bone text, hover bg white/5.
- danger: 1px border rgba(166,66,65,0.7), text #d07771, hover bg rgba(166,66,65,0.1).

Plates are CSS border-image 9-slice: slice 55 60 55 60 fill, repeat 'round stretch'. Border width must track the height or the bevel stretches. PLATE_BORDER is sm 10px 11px, md 12px 13px, lg 14px 15px; the landing uses 15px 16px for 56px CTAs and 13px 14px for 48px.

Plate text: Cinzel bold uppercase, tracking 0.1em, px-1.5. Colour #eee5d8 on ember, bone on slate. Triple text-shadow: ember is 0 -1px 0 rgba(255,255,254,0.22), 0 1px 1px rgba(17,15,17,0.75), 0 2px 4px rgba(40,16,18,0.6); slate is similar.

States:
- hover: filter brightness(1.1) saturate(1.05) on ember; brightness(1.15) on slate.
- active: brightness(0.8) or (0.86) plus translateY(1px).
- disabled: grayscale(0.6) brightness(0.7) with cursor not-allowed.
- Transitions: filter 150ms ease, transform 100ms ease.
- Non-plate variants use rounded-control (6px), font-semibold, colour transition 150ms, and disabled opacity 0.5.

Heights: sm h-9 (36px) / 13px text; md h-11 (44px) / 14px; lg 52px / 15px. Uses forwardRef and passes through all button attributes.

**State & persistence:** none

**Web-only deps:** CSS border-image 9-slice; CSS filter brightness/saturate/grayscale; multi text-shadow; hover pseudo-class

**Motion & sound:** Press: 100ms translateY(1px) plus brightness down. Hover brightness has no mobile equivalent.

**Mobile mapping:** RN has no border-image. Image capInsets is iOS-only.

Recommended: since buttons have a fixed set of heights, export 3-slice assets from design-src at @2x and @3x: left cap, a stretchable middle 1–2px column and right cap for ember and slate. Lay them out as Image(cap) + Image(middle, stretch) + Image(cap) behind the label. Alternatively draw the plate once in Skia with canvas.drawImageNine; verify in the chosen @shopify/react-native-skia version.

Press feedback: Pressable plus Reanimated. On pressIn, animate translateY to 1 and overlay a black View at opacity 0.2 (ember) or 0.14 (slate) to imitate brightness 0.8/0.86. CSS filters are not cheap on RN; an opacity overlay runs on the UI thread. Use withTiming 100ms; release with withSpring.

Add a haptic: expo-haptics impactAsync(Light) on pressIn for primary and selectionAsync for secondary.

Disabled: a static desaturated variant asset, or a 0.5 dark overlay. RN text supports one shadow, so keep 0 1px 1px rgba(17,15,17,0.75) as the main one.

Expose a <PlateButton variant size> used everywhere. The ~15 screens with raw btn-* classes collapse onto it.

**Why M:** The core brand control has no direct RN equivalent for 9-slice. It needs sliced assets or Skia, plus Reanimated press states. It is used on almost every screen, so it must be pixel-right first.


## Card, CardTitle, CardValue  ·  complexity S

**Where:** components/ui/card.tsx, used by settings, leaderboard, dashboard, sessions/[id], profile, friends, play, analytics, AchievementsGrid

**Behaviour**

Card renders `glass rounded-[12px] p-4`. With hero=true it renders `tx-slate rounded-[12px] p-5` with the hero shadow. CardTitle and CardValue are described under Typography.

**State & persistence:** none

**Web-only deps:** Tailwind classes

**Motion & sound:** none

**Mobile mapping:** <Card hero?> View with radius 12 and padding 16 (20 for hero), using the glass and tx-slate implementations above. CardTitle and CardValue become Text variants.

**Why S:** Trivial once the surfaces exist.


## Input and PasswordInput  ·  complexity S

**Where:** components/ui/input.tsx, components/ui/password-input.tsx, login, register, play setup, admin

**Behaviour**

Input is a carved field: eos-well, h-12 (48px), radius 6px, border 1px #312f34, px 14px, text 15px weight 500 bone, placeholder dust. On focus the border becomes ember at 70% and the outline is removed, with a colour transition.

PasswordInput wraps Input with pr-10. An absolute 32×32 eye button on the right toggles type between password and text using lucide Eye and EyeOff at 16px, zinc-400, hover white. It has tabIndex −1, so the tab order stays on the field, and an aria-label of 'Hide password' or 'Show password' (English only, hardcoded).

**State & persistence:** local useState(visible)

**Web-only deps:** focus pseudo-class; lucide-react; input type=password

**Motion & sound:** Border colour transition, about 150ms by Tailwind's default.

**Mobile mapping:** TextInput with onFocus/onBlur state driving borderColor; Reanimated interpolateColor for a smooth focus ring. Password: secureTextEntry toggled with a Pressable eye icon from lucide-react-native (the same icon set). Set textContentType 'password' / 'newPassword', autoComplete, autoCapitalize 'none' and keyboardAppearance 'dark'. Use a KeyboardAvoidingView or react-native-keyboard-controller on the auth screens. Haptic selectionAsync on the eye toggle. Localise the aria labels.

**Why S:** Standard TextInput mapping.


## Segmented control  ·  complexity S

**Where:** components/ui/segmented.tsx, settings, leaderboard, play setup, analytics

**Behaviour**

A generic Segmented<T> with value, onChange, options [{value, label, icon?}] and size sm|md.

The track is eos-well, rounded-lg (8px), p-1, full width, role tablist. Each option is a flex-1 tab button: rounded 6px, bold, sm h-8 (32px) with 12px text, md 38px with 14px text.

Active tab: bg ember, text #f5eee5, inset 0 1px 0 rgba(255,255,254,0.18) and inset 0 -2px 0 rgba(17,15,17,0.25). Inactive: ash, hover bone.

There is intentionally NO transition: the active plate swaps in the same frame, so fast switching never shows two half-lit tabs.

**State & persistence:** Controlled by the parent.

**Web-only deps:** inset box-shadow; role=tablist ARIA

**Motion & sound:** Instant swap, no animation, by design.

**Mobile mapping:** Pressable row on a well View. On native, a sliding indicator with Reanimated (withSpring, damping about 20, on layout-measured x) feels better, and an indicator that moves cannot show two half-lit tabs, so the web rationale does not apply. Alternatively keep the instant swap to match the web exactly. Haptics.selectionAsync() on every change. accessibilityRole 'tab' with accessibilityState selected.

**Why S:** Simple. The optional animated indicator is small extra work.


## Toggle switch  ·  complexity S

**Where:** components/ui/toggle.tsx, settings page

**Behaviour**

A switch button (role switch, aria-checked) 28px tall and 48px wide, fully rounded. Checked: bg ember with inset 0 1px 0 rgba(255,255,254,0.18). Unchecked: eos-well.

The thumb is 24×24 bone with shadow 0 1px 2px rgba(17,15,17,0.6) and a 2px inset. It translates 20px when checked.

Colour and transform transitions are 200ms ease-out. Disabled: opacity 0.5. The focus-visible ring is ember with a 2px offset.

**State & persistence:** Controlled.

**Web-only deps:** focus-visible ring

**Motion & sound:** Background colour and thumb translate, 200ms ease-out.

**Mobile mapping:** A custom Pressable with a Reanimated thumb (withSpring for a native feel, or withTiming 200ms Easing.out) and interpolateColor between well and ember. RN Switch cannot get the carved-well look, especially on iOS. Haptics.impactAsync(Light) on change. Support swiping the thumb with react-native-gesture-handler Pan for a premium touch feel.

**Why S:** A small custom component.


## Select, Slider and ColorPicker (currently unused)  ·  complexity S

**Where:** components/ui/select.tsx, components/ui/slider.tsx, components/ui/color-picker.tsx, globals.css input[type=range].ticks

**Behaviour**

No file imports any of the three; checked by grep for 'ui/select', 'ui/slider' and 'ui/color-picker'.

Select is a searchable single-select:
- At ≤640px (matchMedia) it opens as a bottom sheet: left/right/bottom 12px, max-h 70dvh, rounded-2xl, a bg-black/60 backdrop with backdrop-blur-sm, and safe-area bottom padding.
- On desktop it is a fixed-position dropdown under the trigger, 4px gap. It flips above when the space below is under 280px and there is more room above.
- On open it resets the query, highlights the selected item, focuses the search input on the next rAF and scrolls the selection into view.
- Keyboard: ↑ ↓ Enter Esc, listening on window.
- Outside mousedown or touchstart closes it, ignoring the trigger. It repositions on resize and scroll.
- Filtering is a case-insensitive substring match on the label.
- Trigger: h-11, rounded-xl, bg white/5, border becomes accent when open. The chevron rotates 180° over 150ms.
- Options: py-2.5. Active is accent text on bg accent/10 with a Check icon; highlighted is bg white/6.
- Defaults: 'Search…' and 'No results'.

Slider: a native range input with the .ticks CSS. Track 6px high, a gradient filled with accent up to --pct, the remainder bg-softer. Thumb 20px, bone, 2px ember border, shadow plus a 6px accent-weak halo. Optional tick labels at 10px zinc-500.

ColorPicker: 15 preset swatches (#38c169, #27b585, #2bb5a5, #4985e5, #6a6be0, #8c63e4, #a991ed, #de5396, #e34a63, #df4e4d, #eca226, #e5b625, #8eca2f, #22b3cb, #ec7a2a) plus a conic-gradient custom swatch wrapping a native input type=color. It belongs to the retired accent feature.

**State & persistence:** local useState only

**Web-only deps:** window.matchMedia; getBoundingClientRect; document listeners; scrollIntoView; requestAnimationFrame; input type=range pseudo-elements; input type=color; conic-gradient; backdrop-filter

**Motion & sound:** Chevron rotate 150ms; swatch scale 1.05 over 150ms.

**Mobile mapping:** Do not port ColorPicker; accent customisation was removed.

If a picker is needed later, use @gorhom/bottom-sheet with BottomSheetFlatList and BottomSheetTextInput. A sheet is the native idiom, so the desktop-dropdown branch disappears.

Slider: other files (DifficultySlider, play setup) may own the real slider. For a native one, use a custom Gesture Handler Pan with a Reanimated thumb, fire Haptics.selectionAsync when crossing each step or tick, and use @react-native-community/slider only as a fallback.

**Why S:** The code is dead, so the port effort is zero. A future bottom-sheet select would be M.


## Brand mark (Logo)  ·  complexity S

**Where:** components/brand/Logo.tsx, landing nav (36px glow with wordmark), CTA (104px glow; footer 24px with wordmark), login (128px glow), register (96px glow), nav.tsx (40px and 32px glow)

**Behaviour**

Props: size (default 36), withWordmark, tone dark|light, glow, className.

Dark tone (the only one in use) renders /design/knight-logo.webp (384×384 transparent cut-out knight with sharingan eyes) through next/image. priority is set when size ≥96. When size ≥64 it adds CSS filter drop-shadow(0 8px 14px rgba(17,15,17,0.55)).

The glow is an absolutely positioned circle 2.8 × size wide, offset −0.9 × size. Its fill is a radial-gradient: rgba(201,81,70,0.42) at 0%, rgba(166,66,65,0.26) at 18%, rgba(133,48,49,0.14) at 36%, rgba(96,35,39,0.06) at 54%, transparent at 72%. It is blurred by max(4, round(size × 0.11)) px.

The wordmark 'tac·tic·tak' is Cinzel bold, 0.04em, bone, at size × 0.6.

Light tone uses /brand/logo.png (1254² and 1.9MB) with rounded-full and Oswald for the wordmark. No code uses it.

**State & persistence:** none

**Web-only deps:** next/image; CSS filter blur and drop-shadow; radial-gradient

**Motion & sound:** none (static)

**Mobile mapping:** Use expo-image for the knight. Re-export it at @2x and @3x: 384px is too small for 128pt at @3x, which needs 384px exactly; take a larger master from design-src if one exists.

Glow: a Skia Canvas with a Circle filled by a RadialGradient using the same stops. The gradient is already soft, so the blur can be dropped. Alternatively, bake a glow PNG once and scale it.

Drop shadow: iOS shadow props work on the alpha shape of the Image's parent only when it has no background. On Android, bake the shadow into the asset.

The app icon and splash come from this mark through expo-splash-screen with background #1d1b20.

**Why S:** One image and one gradient.


## Puzzle-theme icons (theme-icons.ts)  ·  complexity S

**Where:** lib/theme-icons.ts themeIcon(slug), public/design/themes/*.svg (43 SVGs plus CREDITS.md), used by review, analytics, ThemePicker, landing Hero, Features, Motifs

**Behaviour**

LICHESS_THEMES is a Set of 43 slugs: advancedPawn, anastasiaMate, arabianMate, attackingF2F7, attraction, backRankMate, bishopEndgame, bodenMate, capturingDefender, castling, defensiveMove, deflection, discoveredAttack, doubleBishopMate, doubleCheck, dovetailMate, enPassant, exposedKing, fork, hangingPiece, hookMate, interference, intermezzo, killBoxMate, kingsideAttack, knightEndgame, mate, pawnEndgame, pin, promotion, queenEndgame, queenRookEndgame, queensideAttack, quietMove, rookEndgame, sacrifice, skewer, smotheredMate, trappedPiece, underPromotion, vukovicMate, xRayAttack, zugzwang.

themeIcon(slug) resolves as follows:
- a known slug → a mask icon;
- 'mate' or anything starting with 'mateIn' → the 'mate' icon;
- anything else → lucide Puzzle.

A mask icon is a span filled with bg-current, so it takes currentColor, and is masked with url(/design/themes/{file}.svg). It renders at round(size × 1.2) px because the Lichess glyphs carry less padding than lucide. Components are cached in a Map.

The icons come from game-icons.net under CC BY 3.0, which requires the credit line in the landing footer. The SVGs embed large C2PA metadata blocks.

**State & persistence:** Module-level cache Map.

**Web-only deps:** CSS mask / -webkit-mask; currentColor via bg-current

**Motion & sound:** none

**Mobile mapping:** Run the 43 SVGs through SVGO to strip the C2PA metadata, then turn them into React components with react-native-svg-transformer or an @svgr/cli build step targeting react-native-svg, using fill='currentColor' and a color prop. Keep the slug-resolution logic: share the Set and the 'mate'/'mateIn' fallback as a pure function returning a key, and let each platform render it.

Alternative: compile all icons into an icon font, or one Skia-drawn atlas. That gives the fastest rendering in long lists such as Motifs and ThemePicker.

Keep the 1.2× size factor. Show the CC BY credit in Settings → About.

**Why S:** Mechanical asset conversion plus a small shared resolver.


## Motion catalogue (keyframes and transitions in globals.css)  ·  complexity L

**Where:** globals.css, Chessboard.tsx, RankCeremony.tsx, play/[id]/page.tsx, review pages, StreakBadge.tsx, Toast.tsx, landing Reveal

**Behaviour**

Each keyframe with its duration, easing and where it is used:

1. square-feedback, 500ms ease-out forwards. Opacity 0→1 at 15%, holds to 70%, →0. Fill rgba(94,218,137,0.7) when correct, rgba(223,78,77,0.7) on fail. Chessboard: the wash on the destination square, drawn above the piece.
2. ember-spark, 560ms cubic-bezier(.15,.7,.3,1) forwards. Particles start at the centre, absolute and round, with glow 0 0 6px rgba(242,127,75,0.9). Each translates to (--dx, --dy) while scaling 1→0.3 and fading 1→0. Chessboard.
3. piece-shake, 340ms ease, using the translate property so it stacks with the piece-fit transform. X offsets: 0, −6%, 6%, −4%, 3%, 0. Chessboard, on a wrong move.
4. rank-spin, 1000ms cubic-bezier(.5,0,.2,1). Rotates 0→900° and scales to 1.08 by 80%, then reaches 1080°, scale 1.15 and opacity 0. RankCeremony.
5. rank-pop, 900ms cubic-bezier(.2,1.3,.4,1), an overshoot. Scale 0.6→1, rotate −120°→0, opacity 0→1. RankCeremony.
6. rank-flash, 700ms ease-out. Opacity 0, peaks at 0.55 at 15%, back to 0. RankCeremony.
7. review-solved-pop, 320ms cubic-bezier(.2,1.3,.4,1) both. Scale 0.9→1 with opacity. Review, session review and puzzle pages: the hint slot pops into a 'Solved' badge.
8. norm-drop, 900ms cubic-bezier(.2,.8,.3,1). Drops from y −14 to y 3, then shakes x −7, 6, −4, 2, 0 at 42/54/66/78/100%, while an ember ring box-shadow grows 0→14px and fades. play/[id] summary, when the norm moves inside the same rank.
9. norm-icon-drop, 900ms with 250ms delay, cubic-bezier(.3,1.4,.5,1). y −10→0 with fade. play/[id].
10. norm-rise, 900ms cubic-bezier(.2,1.25,.4,1). Scale 0.92→1, y 10→0, gold glow 0 0 22px 2px rgba(215,183,119,0.45) at 40%. play/[id].
11. norm-icon-rise, 1100ms with 200ms delay, cubic-bezier(.2,1.4,.4,1). Scale 0.3→1, rotate −90→0. play/[id].
12. streak-breath (.streak-pulse), 1.6s ease-in-out infinite. Opacity 1→0.55→1. StreakBadge, when today's play is not logged yet.
13. pulse-red, 1.2s ease-in-out infinite. A red ring box-shadow 0→10px fading. play/[id] timer warning.
14. hint-pulse, 1.2s ease-out infinite. Inset 4px amber ring rgba(236,162,38,0.95) plus an outer glow 0→14px. Chessboard review hint square.
15. slide-piece, translate 0→(--dx, --dy). The duration is set in Chessboard.tsx, which was not read. Chessboard piece moves.
16. slideInRight, translateX 110%→0 with fade. The duration is set in Toast.tsx, which was not read. Toasts.

Landing-only keyframes, all UNUSED: hero-pan (18s ease-in-out infinite gradient pan on .hero-gradient, which also used #6a6be0), float-y (6s, −8px, .float-slow), drift-right (−40px→0), stroke-grow (900ms cubic-bezier(.2,.8,.2,1), .stat-underline), ring-pulse (2.4s ease-out, 16px accent ring).

Transitions:
- .reveal: opacity and transform 700ms cubic-bezier(0.22,1,0.36,1), from translateY(24px) and opacity 0. Stagger classes .delay-1 to .delay-6 add 80, 160, 240, 320, 400 and 480ms.
- Buttons: filter 150ms and transform 100ms.
- Toggle: 200ms ease-out.
- Select chevron: 150ms.

Reduced motion: @media (prefers-reduced-motion: reduce) disables ONLY ember-spark, piece-shake, rank-spin, rank-pop, review-solved-pop, rank-flash, norm-drop, norm-icon-drop, norm-rise and norm-icon-rise. It does NOT cover square-feedback, streak-pulse, pulse-red, hint-pulse, the .reveal transitions or slideInRight.

**State & persistence:** none

**Web-only deps:** CSS @keyframes; CSS individual transform properties (translate, scale, rotate); CSS custom properties inside keyframes (--dx, --dy); animated box-shadow; prefers-reduced-motion media query; IntersectionObserver-triggered transitions

**Motion & sound:** Durations and easings are listed in behaviour. Sounds are not in this area; see lib/sound.

**Mobile mapping:** Build a shared motion module: packages/design-tokens/src/motion.ts exporting durations and Easing.bezier tuples. For example easeReveal = [0.22,1,0.36,1], easePop = [0.2,1.3,0.4,1] (an overshoot, so keep the bezier or use withSpring with damping about 12), easeSpark = [0.15,0.7,0.3,1].

Implement with react-native-reanimated (v3 or v4) using worklets on the UI thread:
- square-feedback: withSequence(withTiming(1, 75ms), withDelay(275ms), withTiming(0, 150ms)) on an overlay opacity.
- piece-shake: withSequence of translateX in px, using the % offsets multiplied by square size.
- rank-spin, rank-pop and norm-*: withTiming plus withSequence on transforms.
- Animated box-shadow rings (pulse-red, hint-pulse, norm-drop ring, ring-pulse): do not animate a shadow. Animate the scale and opacity of a separate ring View with a border, or use a Skia circle or rect with a blur MaskFilter. This is far cheaper.
- ember-spark: Skia particles in one Canvas driven by a single Reanimated shared value (useDerivedValue) rather than N Views.
- Reveal-on-scroll: on mobile, use Reanimated entering animations (FadeInDown.duration(700).easing(...)) with a delay of index × 80ms in lists. There is no IntersectionObserver.

Reduced motion: use Reanimated's useReducedMotion() or AccessibilityInfo.isReduceMotionEnabled(), or ReduceMotion.System on animations. Extend it to all of the above, including the infinite pulses, which should fall back to a static state.

Pair the animations with haptics; see hapticsOpportunities.

**Why L:** 16 live animations, several with overshoot, multi-step shakes and particles. Each must be rebuilt by hand on Reanimated or Skia, with box-shadow animations swapped for transform and opacity equivalents to hold 120fps.


## App shell, viewport and PWA chrome  ·  complexity S

**Where:** layout.tsx, globals.css body.focus-mode, html/body.play-locked, .rotate-lock, .board-top-slot, .no-scrollbar, public/manifest.webmanifest, src/app/icon.png (1254²), src/app/apple-icon.png (180²), public/icons/icon-192, icon-512, icon-maskable

**Behaviour**

Metadata: title 'tac·tic·tak — Sharpen your instincts'; description 'Adaptive chess tactics trainer. Bullet, blitz, rapid — real progression, every session.'; appleWebApp capable with statusBarStyle black-translucent; mobile-web-app-capable.

Viewport: maximumScale 1, userScalable false, viewportFit cover.

Root mounts Providers, OnboardingModal and ToastContainer.

.rotate-lock: phones only (landscape with max-height 500px). It shows a full-screen '↻' at 48px with 'Please rotate your device' / 'Будь ласка, поверніть пристрій' and hides the rest of the page. Tablets are unaffected.

.play-locked: overflow hidden, height 100% and overscroll none on html and body; it also removes the safe-area padding because the runner applies its own. This is an iOS PWA ghost-scroll fix.

body.focus-mode sets overflow hidden.

.board-top-slot is min-height 218px: on play, review and drills, everything above the board sits in one fixed-height slot so the board stays at the same y on every screen.

Manifest: start_url /dashboard, standalone, portrait, background and theme #0b0d10. These are stale; the app uses #1d1b20.

**State & persistence:** none

**Web-only deps:** Next Metadata/Viewport API; web manifest; CSS env(safe-area-inset-*); 100dvh; orientation media query; overflow locking on html/body

**Motion & sound:** none

**Mobile mapping:** - Safe areas: react-native-safe-area-context; SafeAreaView edges are set per screen.
- Orientation: app.json orientation 'portrait' for phones. On iPad (supportsTablet), expo-screen-orientation can unlock rotation for tablets only, which replaces the rotate-lock entirely.
- Scroll and ghost-scroll hacks: not needed. The play runner is a non-scrolling View.
- Focus mode: expo-navigation-bar setVisibilityAsync('hidden') on Android, StatusBar hidden, and keep-awake via expo-keep-awake during sessions.
- board-top-slot: keep a fixed 218pt top slot, or better, compute it from the window height so the board lands in the same place.
- Icons and splash: generate from the knight mark through app.json icon, adaptiveIcon (foreground plus background #1d1b20) and expo-splash-screen.

**Why S:** Most of these web workarounds disappear on native.


## Landing page (marketing)  ·  complexity M

**Where:** app/page.tsx (Home), landing/LandingNav, landing/Hero, landing/LandingBoard, landing/Motifs, landing/Paces, landing/Ranks, landing/Features, landing/HowItWorks, landing/CTA (with footer), landing/Section (Eyebrow, SectionTitle), landing/Reveal, landing/LangToggle, lib/useInView

**Behaviour**

Home is a 'use client' page. On mount it calls getToken(): with a token it router.replace('/dashboard'), otherwise it sets ready. It returns null until then, so there is no SSR content and no SEO HTML. It wraps everything in LandingLangProvider, inside `main.relative.overflow-x-hidden.bg-eos-ink`.

Section order: Hero (containing LandingNav) → Motifs → Paces → Ranks → Features → HowItWorks → CTA with footer. Max width 1200px; section padding 72px vertical on mobile and 104px on md; anchors use scroll-mt-6.

LandingNav: h-16 (84px on md). Logo 36 with glow and wordmark. On lg it shows anchor links #paces, #ranks, #features and #how (14px bold ash, hover bone), then LangToggle. 'Log in' appears from md; the 'Get started' plate (h-11, border 12px 13px) also appears only from md, through a wrapper span because the btn class forces display inline-flex.

Hero:
- A radial ember glow circle (640px, 900px on md), rgba(166,66,65,0.30)→transparent at 66%.
- On lg only, a 620px grayscale watermark of the knight at opacity 0.045.
- Eyebrow pill: 28–30px, ember-tint background, rose text 11–12px, 800 weight, 0.12em.
- h1 = title_1 + ember-coloured title_2.
- Subtitle 16px (19px on md).
- CTA row: ember plate 56px with a lucide Play icon → /register; slate plate 48px (56px on md) → /login. Stacked on mobile, in a row on md.
- On md, a stats row: three StyleIcons | five BAND_ICON rank images | fork, pin and skewer theme icons, each with a label and vertical seam dividers.
- Right column: a tx-slate frame (p-3, rounded-xl, deep shadow) holding LandingBoard, max 350px (520px on md).
- Two FloatCards: 'Your turn / Find the best move for white' with a white swatch, at top-left; the blitz icon with 'BLITZ RATING 1612 +32' in a sage pill, at bottom-right.
- On lg, an 'ADVANCED' rank pill at the top-right.
- Reveal delays run 0 to 4.

LandingBoard: a static 8×8 grid built from FEN 'r2q3k/ppp3pp/8/4N3/8/8/PPP2PPP/R2Q2K1' by a local parse(). Squares use sq-marble (light) and sq-slate (dark), 512px tiles stretched 100%. A per-square backgroundPosition from the POS array is a NO-OP because the background size is 100% 100%. e5 is highlighted rgba(81,123,181,0.38) and f7 at 0.22. Coordinates are 9px (11px on md), 800 weight, in the opposite square colour (#505059 or #cdcfd5). Pieces are /design/pieces/{wN…}.png with EMBER_FIT transform translateY(y%) scale(s), origin 50% 94%. An SVG viewBox 0 0 8 8 draws the knight-fork arrow path 'M4.5 3.2 L4.5 1.5 L5.18 1.5' with stroke rgba(82,132,199,0.85), width 0.19 and a marker arrowhead.

Motifs: a bg-shade band with top and bottom inset rules #2c2a31. Label '42 MOTIFS\nFROM LICHESS' uses whitespace-pre-line. The 14 slugs are fork, pin, skewer, discoveredAttack, sacrifice, deflection, attraction, backRankMate, smotheredMate, zugzwang, interference, promotion, xRayAttack and quietMove, each shown as a 17px icon plus themeLabel(slug, lang) from lib/theme-labels.ts, which was not read.

Paces: for each STYLE_ORDER entry (rapid, blitz, bullet), a tx-slate card with a 56px icon well, a time pill, a Cinzel 28px name, body text, and a 'SEPARATE RATING' sample (hardcoded rapid 1640, blitz 1612, bullet 1448).

Ranks: section background linear-gradient(#1d1b20, #19181d 30%, #1d1b20). Left column: three check-bullet points. Right column, a tx-slate panel:
- 'BLITZ RATING', the ADVANCED icon and 2000;
- a fake slider: a well track, a 70% ember gradient #753132→#a64241, and a 24px bone radial-gradient thumb with a 4px ember halo;
- five band icons (30px, 40px on md; the active one scale 1.18, the others opacity 0.55) with names and minimums, 'expert' shown as '2200+';
- a LEVEL-UP GATE with a sage badge '4 / 4 · NORM +50' and four full sage bars: Solved 9/8, Accuracy 84%/80%, Avg speed 11.4s/12s, Peak 1664/1650. All values are hardcoded.

Features: six tiles (review uses NavIcons ReviewIcon; focus Maximize; motif uses the fork theme icon; stats BarChart3; social Trophy; board Grid3x3). Grid of 1 / 2 (md) / 3 (lg) columns; Reveal delay (i % 3) + 1.

HowItWorks: three steps with roman numerals I, II and III in ember Cinzel 44px (56px on md), a top seam border with a 56×2px ember accent, title and body.

CTA: a tx-slate panel, rounded 18px, with an ember glow above, Logo 104 with glow, an h2 32px (52px on md) with an ember second half, a subtitle, and plates → /register and /login.

Footer: Logo 24 with wordmark and © {current year}; links Log in, Sign up and 'Puzzles via Lichess' → https://database.lichess.org/; the credit 'Theme icons: game-icons.net, CC BY 3.0' → https://game-icons.net.

Reveal uses useInView with threshold 0.15, rootMargin '-10% 0px' and once=true (it disconnects after the first intersection), toggling .is-in.

**State & persistence:** Reads the token through getToken() from lib/api (localStorage key 'taktic.token', not read in detail) only to redirect. Language is stored in localStorage 'taktic.lang' (see Landing i18n). No react-query.

**Web-only deps:** next/link; next/navigation useRouter; IntersectionObserver; anchor hash navigation; responsive Tailwind breakpoints md/lg/xl; SVG marker arrowheads; CSS grid; backdrop-blur; img elements

**Motion & sound:** Reveal fade-up, 700ms cubic-bezier(0.22,1,0.36,1), 24px, staggered 80ms. Hover colour transitions on links. Nothing else is animated. The unused hero-pan, float and ring-pulse keyframes were meant for this page.

**Mobile mapping:** DECISION: keep the landing as a WEB marketing site, but repurpose it.
1. Make it statically rendered (Next static export, or move it to a tiny apps/site). Remove the client-only `ready` gate and the token redirect; today it renders null until JS runs, which hurts SEO and LCP.
2. Swap the /register and /login CTAs for App Store and Google Play badges, plus an iOS Smart App Banner (apple-itunes-app meta) and an Android intent link.
3. Host apple-app-site-association and assetlinks.json on the same domain for universal and app links, so shared profile, session and puzzle URLs open in the app. Keep a lightweight web fallback for shared links.
4. Add the privacy-policy, terms and support pages the App Store and Google Play require.
5. Keep EN and UK.
The web app screens can then be retired.

In the native app, do NOT port the landing as a screen. Reuse its copy and visuals for a 3–4 page onboarding and intro carousel shown before signup: a Paces card, the Ranks/gate panel and the Motifs strip, using react-native-pager-view or a Reanimated FlatList pager with parallax. The CTA becomes the auth entry.

LandingBoard can be reproduced with the real native Chessboard component in static mode, or as one pre-rendered image for zero cost.

**Why M:** As a web marketing site it is mostly kept (S–M: SSG conversion, store badges, deep-link files). As a native onboarding it is an M carousel reusing the components.


## Landing i18n (EN/UK)  ·  complexity S

**Where:** lib/landingI18n.tsx (LandingLangProvider, useLandingT), landing/LangToggle.tsx

**Behaviour**

Two flat dictionaries, EN and UK, with 83 keys each, in the namespaces nav.*, hero.*, rank.* (5 ranks), motifs.label, paces.*, ranks.*, features.* (6 × title/body), how.*, cta.* and footer.*.

t(k) returns DICTS[lang][k], falling back to EN[k], then to the key.

On mount the provider hydrates: a stored choice in localStorage 'taktic.lang' ('en' or 'uk') wins; otherwise navigator.language starting with 'uk' or 'ru' gives 'uk'; otherwise 'en'. The initial render is always 'en', which can briefly show English before Ukrainian.

setLang writes 'taktic.lang'. The in-app store (store.ts) shares the same key, so the choice carries over to login, register and a new account's settings.

LangToggle is a carved well group: rounded-lg, p 3px, 11px, 800 weight, 0.05em. Buttons EN and УК are 26px tall and px 9px. Active is bg rise with bone text; inactive is dust, hover bone. aria-pressed is set.

**State & persistence:** localStorage 'taktic.lang', shared with lib/store.ts and lib/providers.tsx. 'taktic.settings' is also written by store.ts.

**Web-only deps:** localStorage; navigator.language; React context (portable)

**Motion & sound:** Colour transition on the toggle.

**Mobile mapping:** Move the EN and UK dictionaries into a shared packages/i18n, plain TS objects. Merge them with the app's main i18n (lib/i18n.ts, not read here) so there is one t().

On mobile:
- Initial language from expo-localization getLocales()[0].languageCode ('uk' or 'ru' → uk).
- Persist with react-native-mmkv (synchronous, so the first frame is already in the right language with no English flash) under the same key name.
- Sync to the user's server settings after login.
- Consider i18next with react-i18next for plurals, or keep the tiny custom t() for zero overhead.
- LangToggle becomes a Segmented sm with a haptic selection.

**Why S:** Pure data plus a storage swap.


## Visual asset inventory and mobile packaging  ·  complexity M

**Where:** public/brand, public/icons, public/design/textures, public/design/plates, public/design/icons, public/design/board, public/design/pieces, public/design/pieces-classic, public/design/themes, design-src

**Behaviour**

public/brand (9.6MB in total):
- 1hero-desktop.png 1693×929, 2.1MB
- hero-desktop.png 1672×941, 2.1MB
- hero-mobile.png 864×1821, 2.1MB
- logo-light.png 1254², 1.8MB
- logo.png 1254², 1.9MB
No code references any of them except Logo tone='light' (logo.png), which is itself unused, so the whole folder is effectively dead.

public/icons: icon-192.png (192²), icon-512.png (512², 285KB) and icon-maskable.png (512², identical bytes to icon-512, so it is not a true maskable design). Referenced by the manifest. src/app/icon.png is 1254² and apple-icon.png 180².

public/design/textures: slate.jpg 512², 58KB. Used by tx-slate (veiled, tiled at 520px) and eos-avatar (220px). Referenced with ?v=3.

public/design/plates: ember.webp 1016×201 (56KB) and slate.webp 1034×194 (61KB). 9-slice border-images for the buttons.

public/design/icons:
- mode-blitz.png, mode-bullet.png and mode-rapid.png, 96². StyleIcon masks.
- nav-home.png and nav-play.png 96²; nav-review.png 96×72; nav-review-book.svg 32×24.
- tomoe-1, tomoe-2 and tomoe-3.webp, 128²: novice, beginner and intermediate BAND_ICON.
- rank-4.webp and rank-5.webp, 128²: advanced and expert.

public/design/board: tile-light.jpg and tile-dark.jpg, 512² (.sq-marble and .sq-slate, ?v=1, stretched 100% per square).

public/design/pieces: 12 PNGs (wK…bP), the Ember set. pieces-classic has a second set; its contents were not listed in detail.

public/design/knight-logo.webp: 384², 18.5KB.

public/design/themes: 43 SVGs plus CREDITS.md.

design-src (1.5MB) holds the un-baked originals.

**State & persistence:** Static files. Cache-busting uses ?v= query strings.

**Web-only deps:** URL-referenced public assets; query-string cache busting

**Motion & sound:** none

**Mobile mapping:** - Bundle the board, piece, plate, texture, rank and mode icons in the app binary through require() in an assets map: packages/assets/index.ts mapping keys to require paths. Do not fetch them over the network.
- Use expo-image for every raster: memory and disk cache, decode off the JS thread. Preload board and pieces at app start with Asset.loadAsync, or Image.prefetch, so the first board render has no pop-in.
- Produce @2x and @3x exports. The 96px mode and nav icons are too small for crisp 32pt @3x (96px is exactly the limit), and the 128px rank icons cap at about 42pt. Re-export from design-src where larger masters exist.
- Convert the PNG pieces to WebP, or draw them through a Skia atlas for board performance.
- Exclude public/brand (9.6MB) entirely.
- Generate real adaptive or maskable icons from the knight mark.
- Monochrome icons that use currentColor masks (StyleIcon, theme SVGs) need tintColor on Image, which expo-image supports for PNGs, or react-native-svg for the SVGs.

**Why M:** Many assets need re-exporting at native densities, slicing for plates, and SVG cleanup. All of it is mechanical, but it gates every screen.


## Shared-logic candidates

- `apps/frontend/src/lib/landingI18n.tsx` — The EN and UK Dict objects (83 keys each) and the type LandingLang. Also the fallback rule: lang → EN → key. — blockers: The file is 'use client' and mixes in a React context provider plus localStorage and navigator. Extract the dictionaries into packages/i18n/landing.ts; the provider stays per platform.
- `apps/frontend/src/lib/theme-icons.ts` — The LICHESS_THEMES Set (43 slugs) and the slug→file resolution: a known slug resolves to itself; 'mate' and 'mateIn*' resolve to 'mate'; anything else to a Puzzle fallback. — blockers: Rendering uses a CSS mask span and lucide-react. Extract only a pure resolveThemeIconKey(slug): string | null; each platform maps the key to its own component (react-native-svg on mobile).
- `apps/frontend/tailwind.config.ts and globals.css :root` — Every colour token (eos.*, the zinc remap, board.*, black and white), radii (control 6, card 10, sheet 16), and the font family names. — blockers: They are written as CSS variables and color-mix. Move the literal values into packages/design-tokens (TS) and have both the web Tailwind config and the RN theme import it.
- `apps/frontend/src/lib/pieces.ts (EMBER_FIT, CLASSIC_FIT)` — Per-piece scale and y (and x) fit numbers. — blockers: The adjacent helper returns a CSS transform string. Share the numbers and build the RN transform arrays on mobile. Percentages must be converted to points from the square size.
- `apps/frontend/src/lib/levels.ts (DIFFICULTY_BANDS, bandFor, TRAINING_STYLES)` — Rank bands with min, max, colour and glow; bandFor(rating); style order. — blockers: BAND_ICON holds web URL paths. On mobile, swap them for a require() asset map keyed by band. The rest is pure; only the lines read here were checked.
- `apps/frontend/src/lib/utils.ts` — fmtResponseTime, fmtDuration, formatLocalDate, streakState, type StreakState. — blockers: cn() depends on clsx and tailwind-merge, which are web-only. Leave cn behind and share the other four pure functions verbatim.
- `apps/frontend/src/components/landing/LandingBoard.tsx parse()` — A tiny FEN placement → square map parser. — blockers: Not exported today. chess.js already covers this on mobile; share only if a dependency-free version is needed.
- `apps/frontend/scripts/bake-fade.py and bake-board.py` — The colour and image fade transform used for every token and asset. — blockers: Python tooling, not runtime code. Move it to the repo-level tools/ folder so mobile designers bake new colours the same way.

## Haptics opportunities

- PlateButton primary: Haptics.impactAsync(Light) on pressIn, synced with the 1px press-down. Secondary or slate: selectionAsync.
- Segmented and LangToggle: Haptics.selectionAsync() on every option change.
- Toggle switch: impactAsync(Light) when the thumb settles, or on swipe crossing the midpoint.
- Slider (difficulty or rating): selectionAsync on each step or tick crossing, and a stronger Rigid tick at the comfort-zone boundaries.
- PasswordInput eye toggle: selectionAsync.
- square-feedback correct: notificationAsync(Success). Fail together with piece-shake: notificationAsync(Error) or impactAsync(Heavy), timed with the 340ms shake.
- ember-spark burst on a correct move: one soft impactAsync(Soft) at burst start.
- pulse-red timer warning: a Rigid tick each second in the final seconds, matched to the 1.2s pulse; see the play area for exact thresholds.
- hint-pulse appearing in review: impactAsync(Soft).
- review-solved-pop 'Solved' badge: notificationAsync(Success).
- RankCeremony: a crescendo of light impacts during the 1000ms rank-spin, then Heavy plus Success at rank-pop (900ms overshoot), with rank-flash at the same moment.
- norm-rise (norm up): Success at the 40% glow peak (~360ms). norm-drop (norm down): Warning at the 30% landing beat (~270ms), then light ticks on the x-shake steps.
- Select or bottom-sheet option pick and sheet snap: selectionAsync.

## Push opportunities

- Streak at risk: the .streak-pulse state ('today's play hasn't been logged yet', streakState 'at_risk') maps directly to a local evening reminder (expo-notifications scheduled locally, so no server is needed).
- Review queue: the landing promises 'Every miss lands in a timerless Review queue'. A 'You have N puzzles waiting in Review' digest.
- Rank and norm progress: 'Your norm rose +50' or 'You reached Advanced' after a session that cleared the 4/4 gate, useful when the session finished on another device or for celebration recaps.
- Friends and leaderboards (the landing's social feature): 'X passed your blitz rating' or 'X added you as a friend'. These need backend events.
- Re-engagement copy can reuse the landing strings: hero.subtitle, cta.title_1/2 'Your next rank is one session away.'

## Risks

- Cinzel was loaded only with latin and latin-ext subsets and has no Cyrillic glyphs. All Ukrainian headings, plate buttons and section titles (e.g. 'Загостри свої', 'ПОЧАТИ ТРЕНУВАННЯ') therefore fall back to Times New Roman on the web today, and on mobile they would fall back to the system font. A Cyrillic-capable display serif must be chosen before the port, or the brand look breaks for the primary UK audience.
- There is no native border-image 9-slice in RN; Image capInsets is iOS-only. The plate buttons, the most-used brand control, need pre-sliced 3-part assets or Skia drawImageNine. Getting this wrong stretches the bevel.
- The design relies heavily on inset and multi-layer box-shadows and CSS filters (brightness, grayscale on press and disabled). RN boxShadow and filter exist only on the New Architecture (RN 0.76+), and filter support is partial across platforms. Animated shadows (pulse-red, hint-pulse, norm-drop, norm-rise) must be re-implemented as transform and opacity rings or in Skia to keep 120fps.
- color-mix() appears in tokens and backgrounds. Every value must be precomputed. Any new colour must be passed through bake-fade.py, or it will clash with the baked palette. Applying a fade overlay again would double-fade.
- Warm zinc remap: ported screens that copy zinc-* hexes from Tailwind defaults instead of this remap will look cold and blue-grey. Use only the token package.
- Reduced motion is incomplete on the web. square-feedback, streak-pulse, pulse-red, hint-pulse, reveal and toast are not covered. Mobile should cover everything with useReducedMotion and ReduceMotion.System.
- backdrop-blur (FloatCard, Select backdrop) through expo-blur is expensive on Android. Prefer opaque surfaces, which the design already approximates at 92% opacity.
- The repeat-tiled slate texture: expo-image does not tile. Use RN Image resizeMode='repeat', Skia ImageShader, or pre-baked per-size textures.
- Asset densities: knight-logo 384px, mode and nav icons 96px and rank icons 128px are borderline or insufficient for @3x at the larger sizes. Re-export from design-src where larger masters exist.
- Bundle bloat: public/brand is 9.6MB of unused PNGs and the theme SVGs carry large C2PA metadata. Exclude or strip both before bundling into the app.
- Landing SEO: page.tsx returns null until client JS runs (token check), so search engines and link previews get no content. This must be fixed if the landing stays as the marketing site.
- Stale PWA manifest colours (#0b0d10 against the real #1d1b20), and icon-maskable.png is byte-identical to icon-512 (not truly maskable). Do not reuse them for the Android adaptive icon.
- Dead code that must not be ported as-is: Select, Slider and ColorPicker components; the CSS classes hero-gradient, float-slow, hero-chip, drift-right, noise, stat-underline, ring-pulse, app-glow, accent-ring, font-serif-display and no-scrollbar; the --paper and --ink tokens; the Oswald font and Logo tone='light'; the legacy green accent fallback #38c169 in tailwind.
- LandingBoard sets per-square backgroundPosition, which is a no-op because .sq-marble and .sq-slate use background-size 100% 100%. Every square shows the identical tile. If per-square variation was intended, it is a latent bug; decide before copying the behaviour to the native board.

## Open questions

- Which Expo SDK and RN version will be targeted, and is the New Architecture mandatory? This decides whether boxShadow, filter and gradient style props can be used or Skia or baked bitmaps are required.
- Which display serif with Cyrillic support should replace or pair with Cinzel for Ukrainian, and should headings switch font by locale?
- Is the web landing kept on the same domain as API and shared links? Universal links and app links need apple-app-site-association and assetlinks.json there. Do privacy policy and terms pages exist? They were not found in this area.
- Should the Segmented control keep the web's instant swap, or get a native sliding indicator?
- Durations for slide-piece (Chessboard.tsx) and slideInRight (Toast.tsx) are set inline in files outside this area and were not read.
- Are larger masters of the knight logo, rank and tomoe icons and mode icons in design-src, or elsewhere, usable for @3x exports? design-src was listed only at the top level.
- Was the identical-tile-per-square board look intentional, given the no-op backgroundPosition, or should squares vary?
- Is tablet and landscape support wanted on mobile? The web blocks phone landscape only.
- Does the backend still store a user accentColor? store.ts ignores it, so the mobile app can drop it.
