# Design system v2 (the "Mobile app" canvas page)

The foundation layer for the `Mob*.dc.html` artboards. Build screens from these, not from raw
styles. Everything is exported from `@/ui` (`apps/mobile/src/ui/index.ts`); tokens come from
`@tac/core/tokens`. Live reference: `/dev/kitchen-sink` (Phase 1 `ks-*` sections, then the v2
`ks2-*` sections in `src/ui/dev/KitchenSinkV2.tsx`). Screenshots: `screens/design-v2/foundation-*`.

## Tokens (`packages/core/src/tokens`)

**The accent changed.** The canvas uses `#8e4542` (rgba 142,69,66) wherever the web used
`#a64241`, so `eos.ember` is now `#8e4542` and every ember tint in `colors.ts`/`shadows.ts`
moved with it (`control.dangerBorder` = ember/70, `control.dangerFill` = ember/10, heat levels,
`logoGlow`, `control.rankProgress` = `#683231 → #8e4542`). `rank.expert` (`#a64241`) is untouched
because `rules/levels.ts` owns rank colours.

| Design value | Token |
|---|---|
| `#1d1b20` ground / `#222025` sheets, bars / `#29282d` cards / `#353339` tiles / `#413f46` seams / `#1a181c` wells | `eos.ink` / `eos.shade` (= `surface.sheet`) / `eos.slate` / `eos.rise` (= `control.tile`) / `eos.seam` / `eos.well` |
| `#e7e0d7` / `#a5a0a4` / `#736f74` text | `eos.bone` / `eos.ash` / `eos.dust` |
| `#f5eee5` on ember, `#eee5d8` plate ink | `tone.onEmber`, `tone.plateInk` |
| `#d07771` danger, `#d8847c` rose (negative, kicker), `#afc0a9` sage (positive), `#d7b777` gold | `tone.danger`, `tone.rose`, `tone.sage`, `tone.gold` |
| Other solids (`#c98c55`, `#8f8a8f`, `#928e94`, `#9cc0e6`, medal discs, warm sheet grounds…) | `tone.*`; each is commented with where it is used |
| `.float` `rgba(34,32,37,.92)` + border `.05`/`.04` | `surface.float`, `surface.floatBorder`, `surface.floatBorderSubtle` |
| `.glass` `rgba(43,41,46,.9)` + border `.08` | `surface.glass`, `surface.glassBorder`, `shadows.glass` |
| `.back` fill `.06` + ring `.08` | `surface.backFill`, `shadows.backRing` |
| grabbers `#413f46` / ash .45 / bone .22 / .28 / `#535058` | `surface.grabber*` |
| `.mini-ghost`, `.chip`, `.chip-on` | `control.miniGhost*`, `control.chip*` |
| gold tints `.16` / `.20` / border `.45` | `control.goldTint16`, `control.goldTint20`, `control.goldBorder` |
| progress gradients | `control.progressCopper`, `progressEmberCopper`, `progressFlame`, `progressIdle`, `rankProgress` |
| any other tint of a token | `alpha(tone.gold, 0.16)` → `'rgba(215,183,119,0.16)'` |

New shadows: `wellSoft`, `segmentedActiveSoft`, `toggleTrackOff/On`, `toggleKnob`, `glass`,
`backRing`, `sheet`, `sheetRule`, `noteGlow`, `boardPreview`; `avatar` lost the web's 2 pt bone
ring (4 layers, as `.av`). Layout: `layout.shellHeaderHeight 56`, `tabBarHeight 64`,
`navHeaderHeight 54` / `navHeaderCompactHeight 44`, `headerButton 44`, `rowMinHeight 52`,
`rowCompactMinHeight 48`, `seamInset 16`, `miniHeight 32`, `chipHeight 32`, `outlineHeight 44`,
`grabber 36×5`, `segmentedHeight.tight 30`, `radii.sheetLg 20`. Motion: `transitions.sheet`
(200 ms ease-out), `transitions.press`; `src/ui/motion.ts` has `sheetTiming`, `sheetSpring`,
`SHEET_DISMISS`.

### Type (`AppText variant=`)

| Variant | Spec | Design use |
|---|---|---|
| `display` / `sectionTitle` | Cinzel 44/46, 34/38 | splash, login wordmark |
| `heading` | Cinzel 26/32, 0.44 | Home name, profile name |
| `title` | Cinzel 22/28, 0.44 | page h1, sheet titles, profile row name |
| `navTitle` | Cinzel 18 | nested header title |
| `brand` | Cinzel 20/22, 0.8 | header wordmark (render with `lang="en"`) |
| `turnTitle` | Cinzel 15, 0.45 | list-card titles, TurnCard, editor title |
| `plateLabelSm/plateLabel/plateLabelLg` | Cinzel 13/14/15 caps, 0.1em | plates, danger button |
| `bodyLg` | 16/24 | `.row .lbl` |
| `body` / `bodyStrong` | 14/20 (700) | `.body`, ledes / callout titles |
| `caption` / `captionStrong` | 12/16 (700), ash default | `.hint`, `.cap` (pass `color={eos.dust}`) |
| `label` | 11 700 caps 1.32 | `.lbl`, `.sect`, mini buttons |
| `sectionLabel` | 12 700 caps 1.44 | `.sec`, `.slbl` |
| `eyebrow` | 12 800 caps 1.92, ember | "Recommended focus" |
| `kicker` | 12 700 caps 2 px, rose | `.kick` |
| `value` / `valueSm` | 24/32, 20/28 800 tabular | `.val`, counters |
| `chip`, `tabLabel` | 12.5 700; 10/14 700 | `.chip`; tab labels, badges |

## Primitives

| Component (file) | Implements | Props (beyond testID / a11y) |
|---|---|---|
| `PlateButton` (PlateButton.tsx) | `.btn-ember` / `.btn-slate` `.plate`, `.plate-sm` | `label, variant 'ember'\|'slate', size 'sm'(36)\|'md'(44)\|'lg'(52), block, icon (leading, gap 8), disabled, loading, pressFeel, style` |
| `MiniButton` (Buttons.tsx) | `.mini .mini-ember / .mini-ghost`, Home "Discard" | `label, icon (Lucide), variant 'ember'\|'ghost'\|'danger'(36 pt), iconOnly (36 wide), block, busy, disabled` |
| `DangerButton` | sheet destructive button: 44 pt, r12, ember/70 border, Cinzel 14 danger | `label, filled (ember/10), busy ("…", 0.6), disabled` |
| `Chip` | `.chip` / `.chip-on` | `label, selected, onPress` |
| `IconButton` | `.back`, `.float`, `.glass`, `.link`/`.eye`, `.play` | `variant 'back'\|'float'\|'glass'\|'plain'\|'tile', size (44; 36 tile; 48 viewer), icon (node)` |
| `PillButton` | `.float.pill` (44), runner `.glass` (40), sage "Solved!" status | `label, icon, height 44\|40, status, minWidth, labelVariant, children (trailing), contentStyle` |
| `TextLink` | ember caps link + chevron ("All sessions") | `label, onPress, chevron, color` |
| `CountBadge` | header/friends count bubble (18, 2 pt ink ring, "9+") | `count, style` (position it) |
| `Card` (Surfaces.tsx) | `.card` | `padding (16; 12 for tiles), radius (12)` |
| `HeroCard` | `.tx-slate` hero (slate texture + veil, r12, p20) | — |
| `Well` | `.well` / `.seg` track | `tone 'carved'\|'soft'` (soft = inside a group) |
| `Float` | `.float` surface | `radius (16), subtle (.04 border)` |
| `Note` | `.note` callout, Home resume card | `tone 'neutral'\|'ember'\|'emberSoft'\|'gold', title, body, icon (row layout), glow, children` |
| `GroupedList` (GroupedList.tsx) | `.grp` with `.seam`s auto-inserted | `seams, style` |
| `ListSection` | `.sect` + `.grp` + footer hint | `title, footer` |
| `Row` | `.row` (52 pt, icon · label/hint · value · chevron) | `label, hint, value, icon (Lucide, 20/1.8 ash), leading, trailing, onPress (+testID required), chevron, danger, disabled, padding, labelVariant, hintLines` |
| `ToggleRow` | `.row` + `.tg` | `label, hint, value, onChange, testID, disabled` |
| `ControlBlock` | `.blk` (label/hint above a control) | `label, hint, children` |
| `InfoRow` | About key/value line (48 pt, 14/20) | `label, value` |
| `Seam` | `.seam` | `inset (16)` |
| `SectionLabel` (SectionLabel.tsx) | `.sect` (`size='group'`, 11 pt, 4 pt inset) / `.sec` `.slbl` (`size='section'`, 12 pt) | `size, color, inset` |
| `Kicker` | `.kick` | `color` |
| `PageTitle` | tab page h1 + lede (Review, Stats) | `title, subtitle, children` |
| `CardRow` (CardRow.tsx) | list card: r16, p12, gap 12, tile · title/meta · chevron | `title, subtitle, titleVariant ('turnTitle'), leading, trailing, children (custom middle), onPress, chevron, elevated (false = Home's flat session rows)` |
| `EmptyState` | 56 pt card disc + 22/28 title + ash body | `icon, title, body, children` |
| `IconTile` (IconTile.tsx) | rise tile 36/r8, 40/r10–12, 48/r12 | `size, radius, color, children` |
| `TintIcon` | CSS `mask: url()` + currentColor | `source, size, width, color` |
| `ProgressBar` | thin gradient bars (6; 5 in achievements) | `value 0..1, colors, height, trackColor` |
| `Segmented` (Segmented.tsx) | `.seg`/`.seg-on`/`.segbtn` | `options [{value,label,icon?,badge?}], value, onChange, size 'md'(38)\|'sm'(32)\|'tight'(30 in a 38 track), tone 'carved'\|'soft', style (e.g. width 220)` |
| `Toggle` | `.tg` / `.tg-th` (48×28, thumb 24) | `value, onChange, disabled` |
| `Input` / `PasswordInput` | `.well input`, `.field`, `.head` + `.cnt`, bio textarea | `label, labelRight (counter/hint), leading (icon), error, accessory, disabled, multiline` + TextInput props; `PasswordInput kind 'current'\|'new'` |
| `Sheet` (Sheet.tsx) | confirm bottom sheet: shade, r16, top rule, inline grabber, ink/70 backdrop | `visible, onClose, closeLabel, grabber, dismissible, style`; drag-down / backdrop closes |
| `SheetBody` | same panel without the Modal (in-screen overlays, e.g. runner ExitSheet) | as Sheet minus `visible` |
| `SheetGrabber` | 36×5 grabber | `tone 'seam'\|'ash'\|'glass'\|'light'\|'iron', floating (top 5)` |
| `NavHeader` (NavHeader.tsx) | `.back` header: 54 pt row, centred Cinzel 18, round back left 16 / top 5 | `title, titleNode, onBack, backVariant 'back'\|'float'\|'glass', backGlyph 'chevron'\|'close', right, compact (44 row, `.glass` screens), transparent, safeTop` |
| `BackButton` | the round back button | `variant, glyph, onPress`; testID defaults to `BackButton` (Maestro) |
| `stackHeader(variant)` | native-stack `header` built from options | reads `title`/`headerTitle`/`headerRight`/`headerTransparent` |
| `BrandLogo` | knight + glow | `size, glow: boolean \| {box, blur}`; `HEADER_LOGO_GLOW` = 120/5 |
| `AppText`, `Tap` | text variants; RNGH press target with UI-thread `pressed` | — |

## Shell

- **Tab header** (`shell/ShellHeader.tsx`): 56 pt row on ink, 32 pt knight with the 120 pt / blur 5
  glow (MobRivals / MobStats), `brand` wordmark, 36 pt avatar + `CountBadge`. testIDs unchanged.
- **Tab bar** (`shell/TabBar.tsx`): already matched; ember rule now `#8e4542`, all line icons
  1.8 → 2 pt active (Settings shuriken included).
- **Nested screens** (`app/(app)/_layout.tsx`): every push route gets `stackHeader('back')`, so a
  screen only sets `<Stack.Screen options={{ title }} />`. For `float`/`glass` back buttons use
  `options={{ header: stackHeader('float') }}` (or `headerShown: false` and render `NavHeader`
  inside the screen when it overlaps a hero, as MobProfile does). `headerRight` still works.
- Route sheets (formSheet) keep the native grabber; `contentStyle` is `surface.sheet`.

## Migration notes for area agents

- `features/settings/parts.tsx` (`Section`, `NavRow`, `ToggleRow`, `ControlRow`, `BottomSheet`)
  and `features/social/MiniButton.tsx` predate these; switch to `ListSection`/`Row`/`ToggleRow`/
  `ControlBlock`/`Sheet` and `@/ui` `MiniButton` (same API plus `danger`, `block`).
- `features/play/runner/overlays.tsx` ExitSheet → `SheetBody` + `DangerButton`.
- `ProfileScreen` / `ViewerScreen` `headerRight` render in the new header's right slot; restyle
  them as `IconButton variant="glass"` / `PillButton labelVariant="caption"`.
- `charts/ratingHistory.ts` still draws blitz in `#a64241`; the canvas uses `#8e4542`.
- Comparing with the canvas: `python3 -I <scratchpad>/tools/render-artboard.py MobHome out.png
  streak=secured --scale 3` renders any artboard (with its tweak props) via headless Chrome.
