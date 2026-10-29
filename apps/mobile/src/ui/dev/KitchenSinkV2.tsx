import { control, eos, layout, radii, space, tone } from '@tac/core/tokens';
import {
  Bell,
  CircleCheck,
  ExternalLink,
  Gamepad2,
  History,
  Info,
  KeyRound,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Search,
  Share,
  Sparkles,
  TrendingDown,
  TriangleAlert,
  UserMinus,
  UserPlus,
  Volume2,
  X,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, type TextVariantName } from '../AppText';
import { CardRow, EmptyState } from '../CardRow';
import { Chip, CountBadge, DangerButton, IconButton, MiniButton, PillButton, TextLink } from '../Buttons';
import { ControlBlock, InfoRow, ListSection, Row, ToggleRow } from '../GroupedList';
import { IconTile, ProgressBar, TintIcon } from '../IconTile';
import { Input } from '../Input';
import { useT } from '../lang';
import { BackButton, NavHeader } from '../NavHeader';
import { PlateButton } from '../PlateButton';
import { Kicker, PageTitle, SectionLabel } from '../SectionLabel';
import { Segmented } from '../Segmented';
import { Sheet, SheetGrabber } from '../Sheet';
import { Card, Float, HeroCard, Note, Well } from '../Surfaces';
import { useDevT } from './devStrings';

// /dev/kitchen-sink, design v2 sections: every primitive of the "Mobile app"
// page in its states. testIDs: ks2-<primitive>[-<state>].

const MODE = {
  rapid: require('../../../assets/icons/mode-rapid.webp'),
  blitz: require('../../../assets/icons/mode-blitz.webp'),
  bullet: require('../../../assets/icons/mode-bullet.webp'),
};
const PLAY_ICON = require('../../../assets/icons/nav-play.webp');

const noop = () => {};

export function KsSection({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  return (
    <View style={styles.section} testID={testID}>
      <AppText variant="sectionLabel">{title}</AppText>
      {children}
    </View>
  );
}

const VARIANTS: TextVariantName[] = [
  'display', 'sectionTitle', 'heading', 'title', 'navTitle', 'brand', 'turnTitle', 'plateLabelLg',
  'bodyLg', 'body', 'bodyStrong', 'input', 'caption', 'captionStrong', 'sectionLabel', 'label',
  'eyebrow', 'kicker', 'value', 'valueSm', 'timer', 'chip', 'tabLabel',
];

export function TypeScaleSection() {
  const d = useDevT();
  return (
    <KsSection title={d('typeScale')} testID="ks2-type">
      {VARIANTS.map((v) => (
        <View key={v} style={styles.typeRow}>
          <AppText variant="caption" color={eos.dust} style={styles.typeName}>
            {v}
          </AppText>
          <AppText variant={v} numberOfLines={1} style={styles.flex}>
            {v === 'value' || v === 'valueSm' || v === 'timer' ? '1612' : v === 'brand' ? 'tac·tic·tak' : d('pageTitle')}
          </AppText>
        </View>
      ))}
    </KsSection>
  );
}

export function SmallButtonsSection() {
  const t = useT();
  const d = useDevT();
  const [chip, setChip] = useState('all');
  return (
    <KsSection title={d('smallButtons')} testID="ks2-buttons">
      <PlateButton
        size="lg"
        block
        label={t('play.start')}
        icon={<Play size={16} color={control.plateTextEmber} fill={control.plateTextEmber} />}
        testID="ks2-plate-icon"
      />
      <View style={styles.wrap}>
        <MiniButton variant="ember" icon={CircleCheck} label={t('friends.accept')} onPress={noop} testID="ks2-mini-ember" />
        <MiniButton variant="ghost" icon={UserPlus} label={t('friends.add')} onPress={noop} testID="ks2-mini-ghost" />
        <MiniButton variant="ghost" icon={X} label={t('friends.decline')} iconOnly onPress={noop} testID="ks2-mini-icon" />
        <MiniButton variant="ghost" icon={UserMinus} label={t('friends.unfriend')} busy onPress={noop} testID="ks2-mini-busy" />
        <MiniButton variant="ember" label={t('friends.accept')} disabled onPress={noop} testID="ks2-mini-disabled" />
      </View>
      <View style={styles.wrap}>
        <MiniButton variant="danger" label={t('play.exit_discard')} block onPress={noop} testID="ks2-mini-danger" />
        <PlateButton variant="slate" size="sm" label={t('common.cancel')} style={styles.flex} block testID="ks2-plate-sm-flex" />
      </View>
      <DangerButton label={t('play.exit_discard')} onPress={noop} testID="ks2-danger" />
      <DangerButton label={t('settings.reset_progress.confirm_cta')} filled onPress={noop} testID="ks2-danger-filled" />
      <DangerButton label={t('settings.reset_progress.confirm_cta')} filled busy onPress={noop} testID="ks2-danger-busy" />
      <View style={styles.wrap}>
        {(['all', 'training', 'rank'] as const).map((c) => (
          <Chip key={c} label={c} selected={chip === c} onPress={() => setChip(c)} testID={`ks2-chip-${c}`} />
        ))}
        <TextLink label={t('home.all_sessions')} onPress={noop} testID="ks2-link" />
      </View>
      <View style={styles.wrapCenter}>
        <BackButton variant="back" onPress={noop} testID="ks2-icon-back" />
        <BackButton variant="float" onPress={noop} testID="ks2-icon-float" />
        <BackButton variant="glass" onPress={noop} testID="ks2-icon-glass" />
        <BackButton variant="float" glyph="close" onPress={noop} testID="ks2-icon-close" />
        <IconButton variant="plain" icon={<ExternalLink size={18} color={eos.ash} />} onPress={noop} testID="ks2-icon-plain" accessibilityLabel="link" />
        <IconButton variant="tile" icon={<Play size={16} color={eos.bone} />} onPress={noop} testID="ks2-icon-tile" accessibilityLabel="play" />
        <IconButton variant="float" size={48} icon={<Share size={20} color={eos.bone} />} onPress={noop} testID="ks2-icon-48" accessibilityLabel="share" />
      </View>
      <View style={styles.wrapCenter}>
        <PillButton label={t('puzzle.try_again')} icon={<RotateCcw size={16} color={eos.bone} />} onPress={noop} testID="ks2-pill" />
        <PillButton label={t('review.solved')} status icon={<CircleCheck size={16} color={tone.sage} />} testID="ks2-pill-status" />
        <PillButton height={40} label={t('play.exit')} icon={<X size={18} color={eos.bone} />} onPress={noop} testID="ks2-pill-40" />
        <PillButton height={40} icon={<Pause size={18} color={eos.bone} />} minWidth={44} onPress={noop} testID="ks2-pill-icon" accessibilityLabel="pause" />
        <PillButton label={t('review.hint')} minWidth={120} icon={<Lightbulb size={16} color={eos.bone} />} onPress={noop} testID="ks2-pill-hint">
          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotOn]} />
            <View style={styles.dot} />
          </View>
        </PillButton>
      </View>
      <View style={styles.wrapCenter}>
        <View>
          <IconTile size={36}>
            <TintIcon source={MODE.blitz} size={20} color={eos.ash} />
          </IconTile>
          <CountBadge count={2} style={styles.badgePos} testID="ks2-badge" />
        </View>
        <View>
          <IconTile size={36}>
            <TintIcon source={MODE.rapid} size={20} color={eos.ash} />
          </IconTile>
          <CountBadge count={12} style={styles.badgePos} testID="ks2-badge-9" />
        </View>
      </View>
    </KsSection>
  );
}

export function SurfacesV2Section() {
  const d = useDevT();
  return (
    <KsSection title={`${d('surfaces')} v2`} testID="ks2-surfaces">
      <View style={styles.wrap}>
        <Card padding={12} style={styles.flex} testID="ks2-card-12">
          <AppText variant="label">{'Blitz'}</AppText>
          <AppText variant="value">1612</AppText>
          <AppText variant="label" color={eos.dust}>{'Norm 1550'}</AppText>
        </Card>
        <Card style={styles.flex} testID="ks2-card-16">
          <AppText variant="label">{'Peak'}</AppText>
          <AppText variant="value">1664</AppText>
        </Card>
      </View>
      <HeroCard testID="ks2-hero">
        <SectionLabel size="section">{d('hero')}</SectionLabel>
      </HeroCard>
      <View style={styles.wrap}>
        <Well style={styles.wellDemo}>
          <AppText variant="caption">{'carved'}</AppText>
        </Well>
        <Well tone="soft" style={styles.wellDemo}>
          <AppText variant="caption">{'soft'}</AppText>
        </Well>
      </View>
      <Float style={styles.floatDemo} testID="ks2-float">
        <AppText variant="turnTitle">{d('cardTitle')}</AppText>
        <AppText variant="caption">{d('cardMeta')}</AppText>
      </Float>
      <Note title={d('noteTitle')} body={d('noteBody')} testID="ks2-note-neutral" />
      <Note tone="ember" title={d('noteTitle')} body={d('noteBody')} icon={<Sparkles size={24} color={eos.ember} strokeWidth={1.8} />} glow testID="ks2-note-ember" />
      <Note tone="emberSoft" title={d('noteTitle')} body={d('noteBody')} icon={<TrendingDown size={22} color={tone.rose} strokeWidth={1.8} />} testID="ks2-note-ember-soft" />
      <Note tone="gold" title={d('noteTitle')} body={d('noteBody')} icon={<TrendingDown size={20} color={tone.gold} strokeWidth={1.8} />} testID="ks2-note-gold" />
    </KsSection>
  );
}

export function ListsSection() {
  const t = useT();
  const d = useDevT();
  const [lang, setLang] = useState<'en' | 'uk'>('en');
  const [anim, setAnim] = useState<'instant' | 'fast' | 'normal' | 'slow'>('normal');
  const [focus, setFocus] = useState(false);
  return (
    <KsSection title={d('lists')} testID="ks2-lists">
      <ListSection>
        <Row
          padding={16}
          leading={<View style={styles.avatar} />}
          labelVariant="title"
          label="alex"
          hint={t('settings.profile_hint')}
          onPress={noop}
          testID="ks2-row-profile"
        />
      </ListSection>
      <ListSection>
        <Row icon={Gamepad2} label={t('settings.gameplay')} hint={t('settings.gameplay_hint')} onPress={noop} testID="ks2-row-hint" />
        <Row icon={Volume2} label={t('settings.sound')} hint={t('settings.sound_haptics_hint')} onPress={noop} testID="ks2-row-sound" />
        <Row icon={Bell} label={t('settings.notifications')} value="20:00" onPress={noop} testID="ks2-row-value" />
        <Row icon={KeyRound} label={t('settings.account')} hint={t('settings.account_hint')} disabled onPress={noop} testID="ks2-row-disabled" />
        <Row icon={Info} label={t('settings.about')} value="0.1.0" onPress={noop} testID="ks2-row-about" />
      </ListSection>
      <ListSection title={t('settings.tab.app')} footer={t('settings.preview_hint')}>
        <ControlBlock label={t('settings.language')}>
          <Segmented
            tone="soft"
            testID="ks2-seg-soft"
            accessibilityLabel={t('settings.language')}
            value={lang}
            onChange={setLang}
            options={[
              { value: 'en', label: 'English' },
              { value: 'uk', label: 'Українська' },
            ]}
          />
        </ControlBlock>
        <ControlBlock label={t('settings.animation')}>
          <Segmented
            tone="soft"
            size="sm"
            testID="ks2-seg-soft-sm"
            accessibilityLabel={t('settings.animation')}
            value={anim}
            onChange={setAnim}
            options={(['instant', 'fast', 'normal', 'slow'] as const).map((v) => ({ value: v, label: t(`settings.animation.${v}`) }))}
          />
        </ControlBlock>
        <ToggleRow label={t('settings.focus')} hint={t('settings.focus_hint')} value={focus} onChange={setFocus} testID="ks2-toggle-row" />
        <Row icon={History} label={t('settings.replay_onboarding')} hint={d('emptyBody')} onPress={noop} testID="ks2-row-long" />
      </ListSection>
      <ListSection title={t('settings.section.danger')}>
        <Row icon={TriangleAlert} label={t('settings.reset_progress.title')} danger onPress={noop} testID="ks2-row-danger" />
      </ListSection>
      <ListSection title={t('settings.about.licences')}>
        <InfoRow label={t('settings.about.version')} value="0.1.0" />
        <InfoRow label={t('settings.about.build')} value="1" />
      </ListSection>
    </KsSection>
  );
}

export function LabelsSection() {
  const d = useDevT();
  return (
    <KsSection title={d('labels')} testID="ks2-labels">
      <SectionLabel>{'.sect · group'}</SectionLabel>
      <SectionLabel size="section">{'.sec · section'}</SectionLabel>
      <Kicker>{d('kicker')}</Kicker>
      <PageTitle title={d('pageTitle')} subtitle={d('pageLede')} />
    </KsSection>
  );
}

export function CardsSection() {
  const d = useDevT();
  return (
    <KsSection title={d('cards')} testID="ks2-cards">
      <CardRow
        title={d('cardTitle')}
        subtitle={d('cardMeta')}
        leading={
          <IconTile>
            <History size={20} color={eos.ash} />
          </IconTile>
        }
        onPress={noop}
        testID="ks2-cardrow"
      />
      <CardRow
        title="Fork"
        subtitle="12 puzzles · from 1420"
        leading={
          <IconTile>
            <TintIcon source={PLAY_ICON} size={24} color={eos.ember} />
          </IconTile>
        }
        elevated={false}
        onPress={noop}
        testID="ks2-cardrow-flat"
      />
      <View style={styles.wrapCenter}>
        <IconTile size={36}>
          <TintIcon source={MODE.bullet} size={20} color={eos.ash} />
        </IconTile>
        <IconTile size={40} radius={10}>
          <TintIcon source={MODE.blitz} size={20} color={eos.ash} />
        </IconTile>
        <IconTile size={48}>
          <TintIcon source={MODE.rapid} size={24} color={eos.ash} />
        </IconTile>
      </View>
      <ProgressBar value={0.62} testID="ks2-progress" />
      <ProgressBar value={0.76} height={5} colors={control.progressCopper} />
      <ProgressBar value={0.3} colors={control.progressIdle} />
      <EmptyState
        icon={<Sparkles size={24} color={tone.sage} />}
        title={d('emptyTitle')}
        body={d('emptyBody')}
        testID="ks2-empty"
      />
    </KsSection>
  );
}

export function SegmentedV2Section() {
  const t = useT();
  const [style, setStyle] = useState<'rapid' | 'blitz' | 'bullet'>('blitz');
  const [dur, setDur] = useState<'3' | '5' | '10' | '20'>('10');
  const [scope, setScope] = useState<'global' | 'friends'>('global');
  return (
    <>
      <Segmented
        size="tight"
        testID="ks2-seg-tight"
        accessibilityLabel={t('style.blitz.name')}
        value={style}
        onChange={setStyle}
        options={[
          { value: 'rapid', label: t('style.rapid.name'), icon: MODE.rapid },
          { value: 'blitz', label: t('style.blitz.name'), icon: MODE.blitz, badge: '?2/5' },
          { value: 'bullet', label: t('style.bullet.name'), icon: MODE.bullet, badge: '?4/5' },
        ]}
      />
      <Segmented
        size="tight"
        testID="ks2-seg-tight-plain"
        accessibilityLabel="duration"
        value={dur}
        onChange={setDur}
        options={(['3', '5', '10', '20'] as const).map((v) => ({ value: v, label: `${v} min` }))}
      />
      <Segmented
        size="sm"
        testID="ks2-seg-scope"
        accessibilityLabel={t('leaderboard.scope_label')}
        value={scope}
        onChange={setScope}
        style={styles.scope}
        options={[
          { value: 'global', label: t('leaderboard.scope_global') },
          { value: 'friends', label: t('leaderboard.scope_friends') },
        ]}
      />
    </>
  );
}

export function InputsV2() {
  const t = useT();
  const d = useDevT();
  return (
    <>
      <Input
        testID="ks2-input-counter"
        accessibilityLabel={t('profile.display_name')}
        label={t('profile.display_name')}
        labelRight={d('counter')}
        placeholder="alex"
      />
      <Input
        testID="ks2-input-search"
        accessibilityLabel={d('search')}
        placeholder={d('search')}
        leading={<Search size={16} color={eos.dust} />}
      />
      <Input
        testID="ks2-input-multiline"
        accessibilityLabel={t('profile.bio')}
        label={t('profile.bio')}
        labelRight="0/280"
        placeholder={d('bio')}
        multiline
      />
    </>
  );
}

export function HeadersSection() {
  const t = useT();
  const d = useDevT();
  return (
    <KsSection title={d('headers')} testID="ks2-headers">
      <View style={styles.headerFrame}>
        <NavHeader safeTop={false} title={t('settings.about')} onBack={noop} backTestID="ks2-hdr-back" testID="ks2-hdr" />
      </View>
      <View style={styles.headerFrame}>
        <NavHeader
          safeTop={false}
          title={t('puzzle.title')}
          onBack={noop}
          backVariant="float"
          backTestID="ks2-hdr-float-back"
          testID="ks2-hdr-float"
          right={
            <PillButton
              label={d('lichess')}
              labelVariant="caption"
              onPress={noop}
              testID="ks2-hdr-pill"
              contentStyle={styles.lichess}
            >
              <ExternalLink size={14} color={eos.ash} />
            </PillButton>
          }
        />
      </View>
      <View style={styles.headerFrame}>
        <NavHeader
          safeTop={false}
          compact
          title={t('friends.title')}
          onBack={noop}
          backVariant="glass"
          backTestID="ks2-hdr-glass-back"
          testID="ks2-hdr-glass"
          right={<IconButton variant="glass" icon={<Share size={20} color={eos.bone} />} onPress={noop} testID="ks2-hdr-share" accessibilityLabel="share" />}
        />
      </View>
    </KsSection>
  );
}

export function SheetSection() {
  const t = useT();
  const d = useDevT();
  const [open, setOpen] = useState(false);
  return (
    <KsSection title={d('sheets')} testID="ks2-sheets">
      <View style={styles.grabbers}>
        <SheetGrabber />
        <SheetGrabber tone="ash" />
        <SheetGrabber tone="glass" />
        <SheetGrabber tone="light" />
        <SheetGrabber tone="iron" />
      </View>
      <AppText variant="caption">{d('grabbers')}</AppText>
      <PlateButton variant="slate" label={d('openSheet')} onPress={() => setOpen(true)} testID="ks2-sheet-open" />
      <Sheet visible={open} onClose={() => setOpen(false)} testID="ks2-sheet" closeLabel={t('common.cancel')}>
        <AppText variant="title">{d('sheetTitle')}</AppText>
        <AppText variant="body" color={eos.ash}>
          {d('sheetBody')}
        </AppText>
        <View style={styles.sheetButtons}>
          <PlateButton size="lg" block label={t('play.exit_save')} onPress={() => setOpen(false)} testID="ks2-sheet-save" />
          <DangerButton label={t('play.exit_discard')} onPress={() => setOpen(false)} testID="ks2-sheet-discard" />
          <PlateButton variant="slate" block label={t('play.exit_keep')} onPress={() => setOpen(false)} testID="ks2-sheet-keep" />
        </View>
      </Sheet>
    </KsSection>
  );
}

const styles = StyleSheet.create({
  section: { gap: space[3] },
  flex: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'center' },
  wrapCenter: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], alignItems: 'center' },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  typeName: { width: 92 },
  wellDemo: { flex: 1, padding: space[4] },
  floatDemo: { padding: 10, gap: space[1] },
  avatar: { width: 52, height: 52, borderRadius: radii.full, backgroundColor: eos.rise },
  badgePos: { position: 'absolute', top: -4, right: -6 },
  dots: { flexDirection: 'row', gap: space[1] },
  dot: { width: 6, height: 6, borderRadius: radii.full, backgroundColor: eos.seam },
  dotOn: { backgroundColor: tone.gold },
  scope: { width: 220 },
  lichess: { paddingHorizontal: 14, gap: space[1] },
  headerFrame: { marginHorizontal: -layout.gutter, borderWidth: 1, borderColor: eos.seam, borderStyle: 'dashed' },
  grabbers: { flexDirection: 'row', gap: space[3], alignItems: 'center', paddingVertical: space[2] },
  sheetButtons: { gap: space[2.5], marginTop: space[2] },
});
