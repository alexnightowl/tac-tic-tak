'use client';

import { text } from '@tac/core/tokens';
import {
  Bell,
  CircleCheck,
  Globe,
  History,
  Info,
  Lightbulb,
  LogOut,
  Play,
  Search,
  Settings,
  Sparkles,
  Trash2,
  TrendingDown,
  User,
  UserPlus,
  Volume2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { useT } from '@/lib/i18n';
import { useAppStore, type Language } from '@/lib/store';
import {
  AppText,
  BackButton,
  BrandLogo,
  Card,
  CardRow,
  Chip,
  ControlBlock,
  CountBadge,
  DangerButton,
  EmptyState,
  Float,
  HEADER_LOGO_GLOW,
  HeroCard,
  IconButton,
  IconTile,
  InfoRow,
  Input,
  Kicker,
  ListSection,
  MiniButton,
  NavHeader,
  Note,
  PageTitle,
  PasswordInput,
  PillButton,
  PlateButton,
  ProgressBar,
  Row,
  SectionLabel,
  Segmented,
  Sheet,
  SheetBody,
  SheetGrabber,
  TextLink,
  TintIcon,
  Toggle,
  ToggleRow,
  Well,
  type TextVariantName,
} from '@/v2/ui';

// Dev-route-only copy (state names, section heads), as the app's
// devStrings.ts: none of it ships in a product screen. Demo content uses
// real @tac/core/i18n keys so en/uk shows the product strings.
const DEV: Record<Language, Record<string, string>> = {
  en: {
    title: 'Design v2 kit',
    phone: 'Phone · 390',
    desktop: 'Desktop · 560 column',
    normal: 'normal',
    pressed: 'pressed',
    focus: 'focus',
    disabled: 'disabled',
    loading: 'loading',
    busy: 'busy',
    filled: 'filled',
    selected: 'selected',
    error: 'error',
    sizes: 'sm · md · lg',
    block: 'block',
    open: 'Open the sheet',
    text: 'Text variants',
    logo: 'BrandLogo',
    nav: 'NavHeader / BackButton',
    plates: 'PlateButton',
    small: 'Small buttons',
    surfaces: 'Surfaces',
    lists: 'GroupedList',
    cards: 'CardRow / EmptyState',
    tiles: 'IconTile / TintIcon / ProgressBar',
    segmented: 'Segmented',
    toggle: 'Toggle',
    inputs: 'Input / PasswordInput',
    sheet: 'Sheet',
  },
  uk: {
    title: 'Кіт дизайну v2',
    phone: 'Телефон · 390',
    desktop: 'Десктоп · колонка 560',
    normal: 'звичайний',
    pressed: 'натиснутий',
    focus: 'фокус',
    disabled: 'вимкнений',
    loading: 'завантаження',
    busy: 'зайнятий',
    filled: 'заливка',
    selected: 'вибраний',
    error: 'помилка',
    sizes: 'sm · md · lg',
    block: 'на всю ширину',
    open: 'Відкрити шит',
    text: 'Стилі тексту',
    logo: 'BrandLogo',
    nav: 'NavHeader / BackButton',
    plates: 'PlateButton',
    small: 'Малі кнопки',
    surfaces: 'Поверхні',
    lists: 'GroupedList',
    cards: 'CardRow / EmptyState',
    tiles: 'IconTile / TintIcon / ProgressBar',
    segmented: 'Segmented',
    toggle: 'Toggle',
    inputs: 'Input / PasswordInput',
    sheet: 'Sheet',
  },
};

const noop = () => {};

function useDev() {
  const lang = useAppStore((s) => s.settings.language);
  return DEV[lang] ?? DEV.en;
}

/** Flip the store language for this page; the original comes back on leave. */
function useKitLanguage() {
  const lang = useAppStore((s) => s.settings.language);
  const setSettings = useAppStore((s) => s.setSettings);
  const original = useRef<Language | null>(null);
  const set = (next: Language) => {
    if (original.current === null) original.current = useAppStore.getState().settings.language;
    setSettings({ language: next });
  };
  useEffect(() => {
    // `?lang=uk` for screenshots.
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'en' || q === 'uk') set(q);
    return () => {
      if (original.current !== null) useAppStore.getState().setSettings({ language: original.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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

/** One labelled state: the caption under the demo. */
function State({ name, preview, children, grow }: { name: string; preview?: 'press' | 'focus'; children: ReactNode; grow?: boolean }) {
  return (
    <div className={grow ? 'flex min-w-0 flex-1 flex-col gap-1.5' : 'flex flex-col items-start gap-1.5'}>
      <div data-v2-preview={preview} className={grow ? 'flex flex-col' : 'flex'}>
        {children}
      </div>
      <AppText variant="caption" color="var(--eos-dust)">
        {name}
      </AppText>
    </div>
  );
}

function Line({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-3">{children}</div>;
}

const TEXT_SAMPLES: Partial<Record<TextVariantName, string>> = {
  value: '1612',
  valueSm: '87%',
  timer: '2:47',
  boardCoord: 'a b c 1 2 3',
};

function TextVariants() {
  const t = useT();
  const names = Object.keys(text) as TextVariantName[];
  return (
    <Card padding={12} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {names.map((n) => (
        <div key={n} className="flex items-baseline justify-between gap-3">
          <AppText variant={n} numberOfLines={1}>
            {TEXT_SAMPLES[n] ?? t('settings.reset_progress.title')}
          </AppText>
          <AppText variant="caption" color="var(--eos-dust)" style={{ flex: 'none' }}>
            {n}
          </AppText>
        </div>
      ))}
    </Card>
  );
}

function Showcase({ desktop }: { desktop: boolean }) {
  const t = useT();
  const d = useDev();
  const [scope, setScope] = useState<'global' | 'friends'>('global');
  const [style, setStyle] = useState<'bullet' | 'blitz' | 'rapid'>('blitz');
  const [lang, setLang] = useState<'en' | 'uk'>('en');
  const [chip, setChip] = useState(true);
  const [on, setOn] = useState(true);
  const [off, setOff] = useState(false);
  const [name, setName] = useState('Magnus');
  const [open, setOpen] = useState(false);
  const id = desktop ? 'd' : 'p';

  // `?sheet=open` opens the real Sheet (phone column's) for screenshots.
  useEffect(() => {
    if (!desktop && new URLSearchParams(window.location.search).get('sheet') === 'open') setOpen(true);
  }, [desktop]);

  const styles = [
    { value: 'bullet' as const, label: t('style.bullet.name'), icon: '/v2/icons/mode-bullet@2x.webp' },
    { value: 'blitz' as const, label: t('style.blitz.name'), icon: '/v2/icons/mode-blitz@2x.webp' },
    { value: 'rapid' as const, label: t('style.rapid.name'), icon: '/v2/icons/mode-rapid@2x.webp', badge: '?2/5' },
  ];

  return (
    <div className="flex flex-col gap-8">
      <Section title={d.logo}>
        <Line>
          <BrandLogo size={96} />
          <div className="flex items-center gap-6 self-center">
            <BrandLogo size={32} glow={HEADER_LOGO_GLOW} />
            <BrandLogo size={48} glow={false} />
          </div>
        </Line>
      </Section>

      <Section title={d.nav}>
        <div className="flex flex-col gap-2 overflow-hidden rounded-[12px]" style={{ background: 'var(--eos-shade)' }}>
          <NavHeader title={t('settings.about')} onBack={noop} backTestID={`${id}-back`} safeTop={false} />
          <NavHeader
            title={t('sessions.title')}
            onBack={noop}
            backVariant="float"
            backTestID={`${id}-back-float`}
            right={<IconButton variant="float" icon={<Settings size={20} aria-hidden />} onPress={noop} accessibilityLabel={t('settings')} />}
            safeTop={false}
          />
          <NavHeader title={t('friends.title')} onBack={noop} backVariant="glass" backTestID={`${id}-back-glass`} compact transparent safeTop={false} />
          <NavHeader title={t('puzzle.title')} onBack={noop} backVariant="float" backGlyph="close" backTestID={`${id}-back-close`} safeTop={false} />
        </div>
        <Line>
          <State name="back">
            <BackButton onPress={noop} testID={`${id}-bb1`} />
          </State>
          <State name="float">
            <BackButton variant="float" onPress={noop} testID={`${id}-bb2`} />
          </State>
          <State name="glass">
            <BackButton variant="glass" onPress={noop} testID={`${id}-bb3`} />
          </State>
          <State name={d.focus} preview="focus">
            <BackButton onPress={noop} testID={`${id}-bb4`} />
          </State>
        </Line>
      </Section>

      <Section title={d.plates}>
        <Line>
          <State name={d.normal}>
            <PlateButton label={t('play.start')} onPress={noop} icon={<Play size={16} fill="currentColor" />} />
          </State>
          <State name={d.pressed}>
            <PlateButton label={t('play.start')} onPress={noop} pressedPreview />
          </State>
          <State name={d.focus} preview="focus">
            <PlateButton label={t('play.start')} onPress={noop} />
          </State>
          <State name={d.disabled}>
            <PlateButton label={t('play.start')} onPress={noop} disabled />
          </State>
          <State name={d.loading}>
            <PlateButton label={t('play.start')} onPress={noop} loading />
          </State>
        </Line>
        <Line>
          <State name={d.normal}>
            <PlateButton label={t('common.cancel')} variant="slate" onPress={noop} />
          </State>
          <State name={d.pressed}>
            <PlateButton label={t('common.cancel')} variant="slate" onPress={noop} pressedPreview />
          </State>
          <State name={d.disabled}>
            <PlateButton label={t('common.cancel')} variant="slate" onPress={noop} disabled />
          </State>
          <State name={d.loading}>
            <PlateButton label={t('common.cancel')} variant="slate" onPress={noop} loading />
          </State>
        </Line>
        <State name={d.sizes}>
          <div className="flex flex-wrap items-center gap-3">
            <PlateButton label={t('play.exit_save')} size="sm" onPress={noop} />
            <PlateButton label={t('play.exit_save')} size="md" onPress={noop} />
            <PlateButton label={t('play.exit_save')} size="lg" onPress={noop} />
            <PlateButton label={t('play.exit_save')} size="sm" variant="slate" onPress={noop} />
            <PlateButton label={t('play.exit_save')} size="lg" variant="slate" onPress={noop} />
          </div>
        </State>
        <State name={d.block} grow>
          <PlateButton label={t('play.start')} size="lg" block onPress={noop} icon={<Play size={18} fill="currentColor" />} />
        </State>
      </Section>

      <Section title={d.small}>
        <Line>
          <MiniButton label={t('friends.accept')} variant="ember" icon={CircleCheck} onPress={noop} />
          <MiniButton label={t('friends.add')} icon={UserPlus} onPress={noop} />
          <MiniButton label={t('friends.decline')} icon={X} iconOnly onPress={noop} />
          <MiniButton label={t('friends.unfriend')} busy onPress={noop} />
          <MiniButton label={t('friends.accept')} variant="ember" disabled onPress={noop} />
        </Line>
        <Line>
          <State name={d.pressed} preview="press">
            <MiniButton label={t('friends.add')} icon={UserPlus} onPress={noop} />
          </State>
          <State name={d.focus} preview="focus">
            <MiniButton label={t('friends.add')} icon={UserPlus} onPress={noop} />
          </State>
          <State name="danger">
            <MiniButton label={t('home.discard')} variant="danger" onPress={noop} />
          </State>
        </Line>
        <div className="flex gap-3">
          <MiniButton label={t('home.discard')} variant="danger" block onPress={noop} />
          <PlateButton label={t('common.cancel')} variant="slate" size="sm" onPress={noop} style={{ flex: 1 }} block />
        </div>
        <State name={d.normal} grow>
          <DangerButton label={t('home.discard')} onPress={noop} />
        </State>
        <State name={d.filled} grow>
          <DangerButton label={t('settings.reset_progress.confirm_cta')} filled onPress={noop} />
        </State>
        <State name={d.busy} grow>
          <DangerButton label={t('settings.reset_progress.confirm_cta')} filled busy onPress={noop} />
        </State>
        <Line>
          <State name={d.selected}>
            <Chip label={t('style.blitz.name')} selected={chip} onPress={() => setChip((v) => !v)} />
          </State>
          <State name={d.normal}>
            <Chip label={t('style.rapid.name')} selected={!chip} onPress={() => setChip((v) => !v)} />
          </State>
          <State name={d.focus} preview="focus">
            <Chip label={t('style.bullet.name')} onPress={noop} />
          </State>
        </Line>
        <Line>
          {(['back', 'float', 'glass', 'plain', 'tile'] as const).map((v) => (
            <State key={v} name={v}>
              <IconButton
                variant={v}
                icon={v === 'tile' ? <Play size={16} fill="currentColor" aria-hidden /> : <Settings size={20} aria-hidden />}
                onPress={noop}
                accessibilityLabel={t('settings')}
              />
            </State>
          ))}
          <State name={d.disabled}>
            <IconButton variant="float" icon={<Settings size={20} aria-hidden />} onPress={noop} disabled accessibilityLabel={t('settings')} />
          </State>
        </Line>
        <Line>
          <State name="44">
            <PillButton label={t('review.hint')} icon={<Lightbulb size={16} aria-hidden />} onPress={noop} />
          </State>
          <State name="40">
            <PillButton label={t('review.hint')} icon={<Lightbulb size={18} aria-hidden />} height={40} onPress={noop} />
          </State>
          <State name="status">
            <PillButton label={t('review.solved')} status />
          </State>
          <State name="caption">
            <PillButton label="1212 · Lichess" labelVariant="caption" onPress={noop} />
          </State>
        </Line>
        <Line>
          <State name="TextLink">
            <TextLink label={t('home.all_sessions')} onPress={noop} />
          </State>
          <State name="CountBadge">
            <div className="flex items-center gap-3 pt-1">
              <CountBadge count={3} />
              <CountBadge count={12} />
              <span className="relative inline-flex">
                <IconButton variant="glass" icon={<User size={20} aria-hidden />} onPress={noop} accessibilityLabel={t('nav.friends')} />
                <CountBadge count={2} style={{ position: 'absolute', top: -4, right: -6 }} />
              </span>
            </div>
          </State>
        </Line>
      </Section>

      <Section title={d.surfaces}>
        <div className="flex gap-3">
          <Card style={{ flex: 1 }}>
            <AppText variant="label">{t('style.blitz.name')}</AppText>
            <AppText variant="value" as="div">
              1612
            </AppText>
          </Card>
          <Card padding={12} style={{ flex: 1 }}>
            <AppText variant="label">{t('sessions.peak')}</AppText>
            <AppText variant="value" as="div">
              1664
            </AppText>
          </Card>
        </div>
        <HeroCard>
          <Kicker>HeroCard</Kicker>
          <AppText as="h3" variant="heading">
            {t('stats.title')}
          </AppText>
          <AppText as="p" variant="body" style={{ marginTop: 8 }}>
            {t('review.subtitle')}
          </AppText>
        </HeroCard>
        <div className="flex gap-3">
          <Well style={{ flex: 1, padding: 16 }}>
            <AppText variant="body" color="var(--eos-ash)">
              carved
            </AppText>
          </Well>
          <Well tone="soft" style={{ flex: 1, padding: 16 }}>
            <AppText variant="body" color="var(--eos-ash)">
              soft
            </AppText>
          </Well>
        </div>
        <div className="relative overflow-hidden rounded-[12px] p-4" style={{ background: 'url(/v2/board/board.webp) center/cover' }}>
          <div className="flex gap-3">
            <Float style={{ padding: '10px 14px' }}>
              <AppText variant="timer">2:47</AppText>
            </Float>
            <Float subtle radius={9999} style={{ padding: '10px 16px' }}>
              <AppText variant="label" color="var(--eos-bone)">
                Float · subtle
              </AppText>
            </Float>
          </div>
        </div>
        <Note title={t('home.resume_title')} body={t('review.empty_hint')} />
        <Note tone="ember" title={t('home.resume_title')} body={t('review.empty_hint')} icon={<Sparkles size={22} color="var(--eos-ember)" aria-hidden />} glow={false} />
        <Note tone="emberSoft" title={t('home.resume_title')} body={t('review.empty_hint')} icon={<TrendingDown size={20} color="var(--tone-rose)" aria-hidden />} />
        <Note tone="gold" glow title={t('home.resume_title')} body={t('review.empty_hint')} icon={<TrendingDown size={20} color="var(--tone-gold)" aria-hidden />} />
      </Section>

      <Section title={d.lists}>
        <ListSection title={t('settings.account')} footer={t('settings.preview_hint')}>
          <Row label={t('profile.display_name')} hint={t('settings.profile_hint')} icon={User} onPress={noop} testID={`${id}-row-profile`} />
          <Row label={t('settings.gameplay')} hint={t('settings.gameplay_hint')} icon={Settings} value="3" onPress={noop} testID={`${id}-row-game`} />
          <div data-v2-preview="press">
            <Row label={`${t('settings.sound')} · ${d.pressed}`} icon={Volume2} onPress={noop} testID={`${id}-row-pressed`} />
          </div>
          <div data-v2-preview="focus">
            <Row label={`${t('settings.notifications')} · ${d.focus}`} icon={Bell} onPress={noop} testID={`${id}-row-focus`} />
          </div>
          <Row label={`${t('settings.replay_onboarding')} · ${d.disabled}`} icon={History} onPress={noop} disabled testID={`${id}-row-off`} />
          <Row label={t('logout')} icon={LogOut} danger onPress={noop} testID={`${id}-row-danger`} />
        </ListSection>
        <ListSection title={t('settings.gameplay')}>
          <ToggleRow label={t('settings.focus')} hint={t('settings.focus_hint')} value={on} onChange={setOn} />
          <ToggleRow label={t('settings.sound')} hint={t('settings.sound_hint')} value={off} onChange={setOff} />
          <ToggleRow label={`${t('settings.notifications')} · ${d.disabled}`} value onChange={noop} disabled />
          <ControlBlock label={t('settings.language')} hint={t('settings.preview_hint')}>
            <Segmented
              tone="soft"
              size="sm"
              value={lang}
              onChange={setLang}
              accessibilityLabel={t('settings.language')}
              options={[
                { value: 'en', label: 'English' },
                { value: 'uk', label: 'Українська' },
              ]}
            />
          </ControlBlock>
        </ListSection>
        <ListSection title={t('settings.about')}>
          <InfoRow label={t('settings.about.version')} value="0.1.0" />
          <InfoRow label={t('settings.about.build')} value="2026.11.04" />
          <Row label={t('settings.about.licences')} icon={Info} onPress={noop} testID={`${id}-row-lic`} />
        </ListSection>
      </Section>

      <Section title={d.cards}>
        <CardRow
          title={t('sessions.title')}
          subtitle={t('review.subtitle_themes')}
          leading={
            <IconTile>
              <History size={20} color="var(--eos-bone)" aria-hidden />
            </IconTile>
          }
          onPress={noop}
          testID={`${id}-cardrow`}
        />
        <div data-v2-preview="press">
          <CardRow title={`${t('review.title')} · ${d.pressed}`} subtitle={t('review.empty_hint')} onPress={noop} testID={`${id}-cardrow-p`} />
        </div>
        <CardRow
          title={t('style.rapid.name')}
          subtitle="+12 · 1612 → 1624"
          elevated={false}
          leading={
            <IconTile size={36}>
              <TintIcon source="/v2/icons/mode-rapid@2x.webp" size={20} color="var(--eos-bone)" />
            </IconTile>
          }
          trailing={<AppText variant="valueSm" color="var(--tone-sage)">87%</AppText>}
          testID={`${id}-cardrow-flat`}
        />
        <Card padding={0}>
          <EmptyState icon={<CircleCheck size={24} color="var(--tone-sage)" aria-hidden />} title={t('review.empty')} body={t('review.empty_hint')}>
            <PlateButton label={t('play.start')} onPress={noop} style={{ alignSelf: 'center' }} />
          </EmptyState>
        </Card>
        <PageTitle title={t('review.title')} subtitle={t('review.subtitle')} />
      </Section>

      <Section title={d.tiles}>
        <Line>
          {[36, 40, 48].map((s) => (
            <State key={s} name={String(s)}>
              <IconTile size={s}>
                <TintIcon source="/v2/icons/mode-blitz@2x.webp" size={Math.round(s * 0.5)} color="var(--eos-ember)" />
              </IconTile>
            </State>
          ))}
          <State name="TintIcon">
            <div className="flex h-12 items-center gap-2">
              <TintIcon source="/v2/icons/nav-home@2x.webp" size={24} color="var(--eos-ash)" />
              <TintIcon source="/v2/icons/nav-play@2x.webp" size={24} color="var(--eos-bone)" />
              <TintIcon source="/v2/icons/nav-review-book@2x.webp" size={24} width={28} color="var(--tone-gold)" />
            </div>
          </State>
        </Line>
        <div className="flex flex-col gap-3">
          <ProgressBar value={0} label="0" />
          <ProgressBar value={0.35} label="35" />
          <ProgressBar value={0.7} colors={['var(--control-progress-copper-0)', 'var(--control-progress-copper-1)']} height={5} label="70" />
          <ProgressBar value={1} colors={['var(--control-gate-bar-0)', 'var(--control-gate-bar-1)']} label="100" />
        </div>
      </Section>

      <Section title={d.segmented}>
        <State name="md · carved · icons · badge" grow>
          <Segmented value={style} onChange={setStyle} accessibilityLabel={t('play.style')} options={styles} testID={`${id}-seg`} />
        </State>
        <State name="tight" grow>
          <Segmented size="tight" value={style} onChange={setStyle} accessibilityLabel={t('play.style')} options={styles} />
        </State>
        <State name="sm · 220" grow>
          <Segmented
            size="sm"
            value={scope}
            onChange={setScope}
            accessibilityLabel={t('leaderboard.scope_label')}
            style={{ width: 220 }}
            options={[
              { value: 'global', label: t('leaderboard.scope_global') },
              { value: 'friends', label: t('leaderboard.scope_friends') },
            ]}
          />
        </State>
        <State name={d.focus} preview="focus" grow>
          <Segmented
            size="sm"
            value={scope}
            onChange={setScope}
            accessibilityLabel={t('leaderboard.scope_label')}
            options={[
              { value: 'global', label: t('leaderboard.scope_global') },
              { value: 'friends', label: t('leaderboard.scope_friends') },
            ]}
          />
        </State>
      </Section>

      <Section title={d.toggle}>
        <Line>
          <State name="on">
            <Toggle value={on} onChange={setOn} accessibilityLabel={t('settings.focus')} />
          </State>
          <State name="off">
            <Toggle value={off} onChange={setOff} accessibilityLabel={t('settings.sound')} />
          </State>
          <State name={d.disabled}>
            <Toggle value onChange={noop} disabled accessibilityLabel={t('settings.notifications')} />
          </State>
          <State name={d.focus} preview="focus">
            <Toggle value={false} onChange={noop} accessibilityLabel={t('settings.notifications')} />
          </State>
        </Line>
      </Section>

      <Section title={d.inputs}>
        <Input label={t('profile.display_name')} labelRight={`${name.length}/40`} value={name} onChangeText={setName} maxLength={40} testID={`${id}-name`} />
        <Input accessibilityLabel={t('challenge.search')} placeholder={t('challenge.search')} leading={<Search size={16} aria-hidden />} />
        <Input label={t('auth.nickname')} defaultValue="magnus" error={t('auth.err_invalid')} testID={`${id}-err`} />
        <Input label={`${t('auth.nickname')} · ${d.disabled}`} defaultValue="magnus" disabled />
        <PasswordInput label={t('auth.password')} defaultValue="hunter22" testID={`${id}-pw`} />
        <Input label={t('profile.bio')} labelRight="0/160" multiline placeholder={t('profile.bio_placeholder')} />
      </Section>

      <Section title={d.sheet}>
        <div
          className="relative overflow-hidden rounded-[12px]"
          style={{ height: desktop ? 340 : 300, background: 'url(/v2/surfaces/background.png) center/cover, var(--eos-ink)' }}
        >
          <SheetBody static mode={desktop ? 'dialog' : 'sheet'} onClose={noop} closeLabel={t('play.exit_keep')} title={t('home.discard_title')}>
            <AppText as="h2" variant="title">
              {t('home.discard_title')}
            </AppText>
            <AppText as="p" variant="body" color="var(--eos-ash)">
              {t('home.discard_body')}
            </AppText>
            <DangerButton label={t('home.discard')} onPress={noop} />
            <PlateButton label={t('common.cancel')} variant="slate" block onPress={noop} />
          </SheetBody>
        </div>
        <Line>
          {(['seam', 'ash', 'glass', 'light', 'iron'] as const).map((tone) => (
            <State key={tone} name={tone}>
              <div className="flex h-6 w-14 items-center justify-center rounded-[6px]" style={{ background: 'var(--surface-sheet)' }}>
                <SheetGrabber tone={tone} />
              </div>
            </State>
          ))}
        </Line>
        <PlateButton label={d.open} variant="slate" onPress={() => setOpen(true)} icon={<Trash2 size={16} aria-hidden />} />
        <Sheet visible={open} onClose={() => setOpen(false)} closeLabel={t('play.exit_keep')} title={t('home.discard_title')}>
          <AppText as="h2" variant="title">
            {t('home.discard_title')}
          </AppText>
          <AppText as="p" variant="body" color="var(--eos-ash)">
            {t('home.discard_body')}
          </AppText>
          <DangerButton label={t('home.discard')} onPress={() => setOpen(false)} />
          <PlateButton label={t('common.cancel')} variant="slate" block onPress={() => setOpen(false)} />
        </Sheet>
      </Section>

      <Section title={d.text}>
        <TextVariants />
      </Section>
    </div>
  );
}

export function KitPage() {
  const t = useT();
  const d = useDev();
  const [lang, setLang] = useKitLanguage();
  return (
    <main className="min-h-dvh" style={{ background: 'var(--eos-ink)', overflowX: 'clip' }}>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 py-3" style={{ background: 'var(--eos-shade)' }}>
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
          testID="kit-lang"
          options={[
            { value: 'en', label: 'EN' },
            { value: 'uk', label: 'UK' },
          ]}
        />
      </div>
      <div className="flex justify-center gap-10 px-4 py-6">
        <div className="flex w-full min-w-0 max-w-[390px] flex-col gap-4">
          <AppText variant="eyebrow">{d.phone}</AppText>
          <Showcase desktop={false} />
        </div>
        <div className="hidden w-[560px] min-w-0 flex-col gap-4 min-[1000px]:flex">
          <AppText variant="eyebrow">{d.desktop}</AppText>
          <Showcase desktop />
        </div>
      </div>
    </main>
  );
}
