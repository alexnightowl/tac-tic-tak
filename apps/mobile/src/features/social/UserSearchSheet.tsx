import { eos, layout, radii, semantic, space } from '@tac/core/tokens';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Check, Clock, Search, UserPlus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, textStyle } from '@/ui/AppText';
import { MiniButton } from '@/ui/Buttons';
import { useLang, useT } from '@/ui/lang';
import { Tap } from '@/ui/Tap';
import { sendRequest } from './actions';
import { searchQuery, type FriendshipStatus, type SearchResult } from './api';
import { openProfile, UserIdentity } from './UserIdentity';

const DEBOUNCE_MS = 250;

/**
 * Find players (formSheet `friends/search`, web UserSearch). 250 ms debounce;
 * react-query aborts the previous request when the query changes, so a slow
 * old response can never replace newer results (web race). After an action
 * the row shows the server's answer: Add → Requested, and Accept (the server
 * auto-accepts their pending request) → Friends, not "Requested" (web bug).
 */
export function UserSearchSheet() {
  const t = useT();
  const { lang } = useLang();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [states, setStates] = useState<Record<string, FriendshipStatus>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDq(q.trim()), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [q]);

  const res = useQuery(searchQuery(dq));
  const typing = q.trim() !== dq;
  const active = dq.length >= 2;
  const loading = q.trim().length >= 2 && (typing || res.isFetching);
  const rows = active ? (res.data ?? []) : [];

  const act = async (row: SearchResult) => {
    setBusy(row.id);
    const next = await sendRequest(row);
    setBusy(null);
    if (next) setStates((s) => ({ ...s, [row.id]: next }));
  };

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]} testID="screen-friend-search">
      <View style={styles.bar}>
        <View style={styles.field}>
          <Search size={16} color={eos.dust} />
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            returnKeyType="search"
            placeholder={t('friends.search_placeholder')}
            placeholderTextColor={eos.dust}
            selectionColor={eos.ember}
            cursorColor={eos.ember}
            keyboardAppearance="dark"
            maxFontSizeMultiplier={1.4}
            style={[textStyle('input', lang), styles.input]}
            testID="search-input"
            accessibilityLabel={t('friends.find')}
          />
          {loading ? <ActivityIndicator size="small" color={eos.dust} testID="search-loading" /> : null}
        </View>
        <Tap
          testID="screen-friend-search-close"
          accessibilityRole="button"
          accessibilityLabel={t('friends.search_close')}
          onPress={() => router.back()}
          style={styles.close}
        >
          <X size={22} color={eos.bone} />
        </Tap>
      </View>

      {active && !loading && res.data && rows.length === 0 ? (
        <AppText variant="caption" color={eos.dust} style={styles.none} testID="search-empty">
          {t('friends.no_matches')}
        </AppText>
      ) : null}

      <FlashList
        data={rows}
        keyExtractor={(r) => r.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Gap}
        renderItem={({ item }) => (
          <ResultRow row={item} state={states[item.id] ?? item.friendship} busy={busy === item.id} onAct={() => void act(item)} />
        )}
        testID="search-results"
      />
    </View>
  );
}

function Gap() {
  return <View style={styles.gap} />;
}

function ResultRow({
  row,
  state,
  busy,
  onAct,
}: {
  row: SearchResult;
  state: FriendshipStatus;
  busy: boolean;
  onAct: () => void;
}) {
  const t = useT();
  const id = row.nickname;
  let action = null;
  switch (state.state) {
    case 'self':
      break;
    case 'friends':
      action = (
        <View style={styles.status} testID={`search-state-${id}`}>
          <Check size={12} color={eos.sage} />
          <AppText variant="caption" color={eos.sage}>
            {t('friends.state_friends')}
          </AppText>
        </View>
      );
      break;
    case 'outgoing':
      action = (
        <View style={styles.status} testID={`search-state-${id}`}>
          <Clock size={12} color={eos.ash} />
          <AppText variant="caption" color={eos.ash}>
            {t('friends.requested')}
          </AppText>
        </View>
      );
      break;
    case 'incoming':
      action = (
        <MiniButton testID={`search-accept-${id}`} label={t('friends.accept')} icon={Check} variant="ember" busy={busy} onPress={onAct} />
      );
      break;
    default:
      action = <MiniButton testID={`search-add-${id}`} label={t('friends.add')} icon={UserPlus} busy={busy} onPress={onAct} />;
  }
  return (
    <View style={styles.row} testID={`search-row-${id}`}>
      <Tap
        testID={`search-open-${id}`}
        accessibilityRole="link"
        accessibilityLabel={`${row.nickname}, ${t('shell.menu.profile')}`}
        onPress={() => {
          router.back();
          openProfile(row.nickname);
        }}
        style={styles.open}
      >
        <UserIdentity user={row} />
      </Tap>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.shade },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: layout.gutter, paddingTop: space[6], paddingBottom: space[2] },
  field: {
    flex: 1,
    height: layout.inputHeight,
    borderRadius: radii.control,
    backgroundColor: eos.well,
    borderWidth: 1,
    borderColor: semantic.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
  },
  input: { flex: 1, paddingVertical: 0 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  none: { paddingHorizontal: layout.gutter + space[1], paddingTop: space[2] },
  list: { paddingHorizontal: layout.gutter, paddingTop: space[2], paddingBottom: space[10] },
  gap: { height: space[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[2], paddingHorizontal: space[1] },
  open: { flex: 1, minWidth: 0 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
