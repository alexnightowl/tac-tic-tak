import { STORM_FORMATS, STORM_NOTE_MAX } from '@tac/core/storm';
import { openPlayerSearch } from '../PlayerSearch';
import { alpha, eos, tone } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Check, Search, Send } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PresenceAvatar } from '@/features/challenge/parts';
import { useChallengeCreate, type CreateParams } from '@/features/challenge/useCreate';
import { Avatar } from '@/features/profile/Avatar';
import { displayNameOf } from '@/features/social/actions';
import { useAuthStore } from '@/stores/authStore';
import { PlateButton } from '@/ui';
import { useT } from '@/ui/lang';
import { Card, DText, Hover, Label, Pill, Seg, TextButton } from '../kit';
import { DesktopPage } from '../Page';
import { dx } from '../tokens';
import { DInput, OptionCard } from './parts';
import { useTwoColumns } from './useTwoColumns';

// /challenge/new on a desktop window (DXChallenge): Who (friends, online
// first), How (Race; Together disabled "Soon", as on the phone), Format /
// Difficulty / When, the note, and a preview card with Send. Logic is the
// phone's (useChallengeCreate): a fresh challenge opens the runner, a dare
// from Storm Result goes out at once.

export function DxChallenge(params: CreateParams) {
  const t = useT();
  const me = useAuthStore((s) => s.user);
  const c = useChallengeCreate(params);
  const two = useTwoColumns(900);
  const myName = me?.displayName?.trim() || me?.nickname || '';
  const formatLabel = t('dx.home.storm_format', { format: t(`challenge.format.${c.format}`) });
  const previewSub = c.dare && params.score ? `${formatLabel} · ${t('dx.home.beat', { n: params.score })}` : formatLabel;

  const preview = (
    <Card texture style={styles.preview} testID="dx-challenge-preview">
      <Label>{t('dx.home.preview')}</Label>
      <View style={styles.vs}>
        <Avatar nickname={me?.nickname ?? ''} avatarUrl={me?.avatarUrl} size={56} />
        <DText serif weight={700} size={20} color={tone.rose}>
          {t('dx.home.vs')}
        </DText>
        {c.selected ? <Avatar nickname={c.selected.user.nickname} avatarUrl={c.selected.user.avatarUrl} size={56} /> : <View style={styles.ghostAvatar} />}
      </View>
      <DText size={16} weight={800} align="center" style={styles.mt14} testID="dx-challenge-preview-title">
        {c.selected ? t('dx.home.dares', { me: myName, name: c.name }) : t('dx.home.pick_friend')}
      </DText>
      <DText size={13} color={dx.ash} align="center" style={styles.mt4}>
        {previewSub}
      </DText>
      <PlateButton
        testID="dx-challenge-send"
        label={c.selected ? t('challenge.send', { name: c.name }) : t('challenge.send_pick')}
        size="lg"
        block
        disabled={!c.selected}
        loading={c.sending}
        icon={<Send size={18} strokeWidth={1.8} color={tone.plateInk} />}
        onPress={() => void c.send()}
        style={styles.mt22}
      />
      {c.selected ? (
        <DText size={12} color={dx.dust} align="center" style={styles.mt10}>
          {t('dx.home.reply_window', { name: c.name })}
        </DText>
      ) : null}
      {c.error ? (
        <DText size={13} color={tone.danger} align="center" style={styles.mt10} testID="dx-challenge-error" accessibilityLiveRegion="polite">
          {c.error}
        </DText>
      ) : null}
    </Card>
  );

  return (
    <DesktopPage
      title={t('challenge.create.title')}
      back={{ label: t('challenge.back'), onPress: () => (router.canGoBack() ? router.back() : router.replace('/play' as Href)) }}
      aside={two ? preview : undefined}
      asideWidth={400}
      testID="dx-challenge"
    >
      <View style={styles.col}>
        <View>
          <Label style={styles.lblGap}>{t('challenge.who')}</Label>
          <DInput
            testID="dx-challenge-search"
            accessibilityLabel={t('challenge.search_a11y')}
            placeholder={t('challenge.search')}
            value={c.query}
            onChangeText={c.setQuery}
            icon={Search}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {c.friends.isPending ? (
            <ActivityIndicator color={dx.ash} style={styles.state} />
          ) : (c.friends.data ?? []).length === 0 ? (
            <View style={styles.state} testID="dx-challenge-no-friends">
              <DText size={14} color={dx.ash}>
                {t('challenge.no_friends')}
              </DText>
              <TextButton testID="dx-challenge-find-friends" accessibilityLabel={t('challenge.find_friends')} label={t('challenge.find_friends')} color={tone.rose} onPress={openPlayerSearch} />
            </View>
          ) : c.rows.length === 0 ? (
            <DText size={14} color={dx.ash} style={styles.state}>
              {t('challenge.no_match', { q: c.query.trim() })}
            </DText>
          ) : (
            <Card style={styles.friends}>
              {c.rows.map((f) => {
                const on = f.user.id === c.picked;
                const n = displayNameOf(f.user);
                return (
                  <Hover
                    key={f.user.id}
                    testID={`dx-challenge-friend-${f.user.nickname}`}
                    accessibilityRole="radio"
                    accessibilityLabel={t(f.online ? 'challenge.friend_online_a11y' : 'challenge.friend_a11y', { name: n })}
                    selected={on}
                    onPress={() => c.pick(f.user.id)}
                    style={[styles.friend, on && styles.friendOn]}
                    hoverStyle={on ? undefined : styles.friendHover}
                  >
                    <PresenceAvatar nickname={f.user.nickname} avatarUrl={f.user.avatarUrl} size={32} online={f.online} />
                    <View style={styles.flex}>
                      <DText size={14} weight={700} numberOfLines={1}>
                        {n}
                      </DText>
                      <DText size={12} color={dx.dust} numberOfLines={1}>{`@${f.user.nickname}`}</DText>
                    </View>
                    {on ? <Check size={16} color={tone.rose} strokeWidth={2.2} /> : null}
                  </Hover>
                );
              })}
            </Card>
          )}
        </View>

        <View>
          <Label style={styles.lblGap}>{t('challenge.how')}</Label>
          <View style={styles.modes} accessibilityRole="radiogroup" accessibilityLabel={t('challenge.how')}>
            <OptionCard
              testID="dx-challenge-mode-race"
              title={t('challenge.mode.race')}
              desc={t('challenge.mode.race_sub')}
              on
              radioFirst
              style={styles.flex}
            />
            <OptionCard
              testID="dx-challenge-mode-together"
              title={t('challenge.mode.together')}
              desc={t('challenge.mode.together_sub')}
              on={false}
              disabled
              radioFirst
              badge={<Pill tone="gold" label={t('challenge.soon')} style={styles.soon} />}
              style={styles.flex}
            />
          </View>
        </View>

        <Card style={styles.facts}>
          <View style={styles.fact}>
            <DText size={14} weight={700} style={styles.flex}>
              {t('challenge.format')}
            </DText>
            {c.dare ? (
              <DText size={14} color={dx.ash} testID="dx-challenge-format-fixed">
                {formatLabel}
              </DText>
            ) : (
              <Seg
                small
                testID="dx-challenge-format"
                accessibilityLabel={t('challenge.format')}
                value={c.format}
                onChange={c.setFormat}
                style={styles.formatSeg}
                options={STORM_FORMATS.map((f) => ({ value: f, label: t(`challenge.format.${f}`) }))}
              />
            )}
          </View>
          <DText size={12.5} color={dx.dust} style={styles.hint} testID="dx-challenge-format-hint">
            {c.hint}
          </DText>
          <View style={[styles.fact, styles.factRule]}>
            <DText size={14} weight={700} style={styles.flex}>
              {t('challenge.difficulty')}
            </DText>
            <DText size={14} color={dx.ash} testID="dx-challenge-difficulty">
              {c.avg != null ? t('challenge.between', { avg: c.avg }) : t('challenge.between_plain')}
            </DText>
          </View>
          <View style={[styles.fact, styles.factRule]}>
            <DText size={14} weight={700} style={styles.flex}>
              {t('challenge.when')}
            </DText>
            <DText size={14} color={dx.ash}>
              {t('challenge.within')}
            </DText>
          </View>
        </Card>

        <View>
          <View style={styles.noteHead}>
            <Label>{t('challenge.note')}</Label>
            <View style={styles.flex} />
            <DText size={12} color={dx.dust} tabular>{`${c.note.length}/${STORM_NOTE_MAX}`}</DText>
          </View>
          <DInput
            testID="dx-challenge-note"
            accessibilityLabel={t('challenge.note')}
            placeholder={t('challenge.note_placeholder')}
            value={c.note}
            onChangeText={(v) => c.setNote(v.replace(/\n/g, ' '))}
            maxLength={STORM_NOTE_MAX}
            style={styles.mt10}
          />
        </View>

        {two ? null : preview}
      </View>
    </DesktopPage>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mt4: { marginTop: 4 },
  mt10: { marginTop: 10 },
  mt14: { marginTop: 14 },
  mt22: { marginTop: 22 },
  col: { gap: 18 },
  lblGap: { marginBottom: 10 },
  state: { marginTop: 12, gap: 8, alignItems: 'flex-start' },
  friends: { marginTop: 10, padding: 8, gap: 2 },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  friendOn: { backgroundColor: alpha(eos.ember, 0.16), boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1.5, color: dx.ember, inset: true }] },
  friendHover: { backgroundColor: alpha(eos.bone, 0.03) },
  modes: { flexDirection: 'row', gap: 12 },
  soon: { height: 20 },
  facts: { paddingVertical: 4, paddingHorizontal: 20 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  factRule: { borderTopWidth: 1, borderTopColor: dx.rowRule },
  formatSeg: { width: 300 },
  hint: { marginTop: -6, paddingBottom: 12 },
  noteHead: { flexDirection: 'row', alignItems: 'center' },
  preview: { padding: 24 },
  vs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 18 },
  ghostAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderStyle: 'dashed', borderColor: tone.iron },
});
