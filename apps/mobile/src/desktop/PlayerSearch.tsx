import { alpha, eos } from '@tac/core/tokens';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View, type ViewStyle } from 'react-native';

import type { SearchResult } from '@/features/social/api';
import { openProfile, UserIdentity } from '@/features/social/UserIdentity';
import { SearchAction, useUserSearch } from '@/features/social/UserSearchSheet';
import { fontFamily } from '@/ui/fonts';
import { useLang, useT } from '@/ui/lang';
import { MOD_KEY } from './hotkeys';
import { DText, Kbd } from './kit';
import { Portal } from './Portal';
import { dx } from './tokens';

const PANEL_WIDTH = 380;

/** The header search of the page in front (registered while that page has focus). */
let focusHeaderSearch: (() => void) | null = null;

/**
 * ⌘K and the "find friends" links: focus the header search of the page in
 * front, or open the search sheet on a page without one.
 */
export function openPlayerSearch(): void {
  if (focusHeaderSearch) focusHeaderSearch();
  else router.push('/friends/search' as Href);
}

type Anchor = { top: number; right: number };

/** The field's bottom-right corner in the window (the panel hangs from it). */
function anchorOf(node: unknown): Anchor | null {
  const el = node as unknown as HTMLElement | null;
  if (!el?.getBoundingClientRect || typeof window === 'undefined') return null;
  const r = el.getBoundingClientRect();
  return { top: r.bottom + 6, right: window.innerWidth - r.right };
}

/** Whether a DOM event target sits inside one of these views. */
function inside(target: EventTarget | null, nodes: readonly unknown[]): boolean {
  return nodes.some((n) => (n as unknown as HTMLElement | null)?.contains?.(target as Node));
}

/**
 * The header's player search (DX header, ⌘K): the chip is the field, and
 * the results drop down under it (no dialog). ↑ ↓ pick a row, Enter opens
 * the profile, Esc clears and leaves; a click outside closes the list.
 * Search state and the friend actions are the phone sheet's (useUserSearch).
 */
export function PlayerSearch() {
  const t = useT();
  const { lang } = useLang();
  const { q, setQ, loading, rows, empty, states, busy, act } = useUserSearch();
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const field = useRef<ComponentRef<typeof View>>(null);
  const panel = useRef<ComponentRef<typeof View>>(null);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [hi, setHi] = useState(0);
  const shown = open && q.trim().length > 0;
  const sel = Math.min(hi, Math.max(0, rows.length - 1));

  useFocusEffect(
    useCallback(() => {
      const focus = () => input.current?.focus();
      focusHeaderSearch = focus;
      return () => {
        if (focusHeaderSearch === focus) focusHeaderSearch = null;
      };
    }, []),
  );

  useEffect(() => {
    if (!shown || typeof window === 'undefined') return;
    const place = () => setAnchor(anchorOf(field.current));
    const away = (e: PointerEvent) => {
      if (!inside(e.target, [field.current, panel.current])) setOpen(false);
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('pointerdown', away);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('pointerdown', away);
    };
  }, [shown]);

  const type = (text: string) => {
    setQ(text);
    setHi(0);
    setOpen(true);
  };

  const leave = () => {
    setQ('');
    setOpen(false);
    input.current?.blur();
  };

  const pick = (row: SearchResult) => {
    leave();
    openProfile(row.nickname);
  };

  const onKey = (e: { nativeEvent: { key: string }; preventDefault?: () => void }) => {
    const { key } = e.nativeEvent;
    if (key === 'Escape') leave();
    else if (key === 'ArrowDown' || key === 'ArrowUp') {
      e.preventDefault?.();
      if (rows.length) setHi((sel + (key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length);
    } else if (key === 'Enter' && rows[sel]) pick(rows[sel]);
  };

  return (
    <>
      <Pressable
        ref={field}
        onPress={() => input.current?.focus()}
        style={[styles.field, focused && styles.fieldOn]}
        testID="dx-search"
        accessibilityRole="search"
      >
        <Search size={13} color={focused ? dx.bone : dx.ash} strokeWidth={2} />
        <TextInput
          ref={input}
          value={q}
          onChangeText={type}
          onKeyPress={onKey}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          placeholder={t('dx.shell.search')}
          placeholderTextColor={dx.ash}
          selectionColor={dx.ember}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          style={[styles.input, { fontFamily: fontFamily(lang, 'body', 600) }]}
          testID="dx-search-input"
          accessibilityLabel={t('friends.find')}
        />
        {loading ? <ActivityIndicator size="small" color={dx.ash} testID="dx-search-loading" /> : null}
        {q ? (
          <Pressable onPress={leave} style={styles.clear} accessibilityRole="button" accessibilityLabel={t('friends.search_close')} testID="dx-search-clear">
            <X size={14} color={dx.ash} strokeWidth={2} />
          </Pressable>
        ) : focused ? null : (
          <View style={styles.kbd}>
            <Kbd>{`${MOD_KEY}K`}</Kbd>
          </View>
        )}
      </Pressable>
      {shown && anchor ? (
        <Portal keepFocus>
          <View ref={panel} style={[styles.panel, anchor]} testID="dx-search-panel">
            {q.trim().length < 2 ? (
              <DText size={12.5} color={dx.ash} style={styles.note}>
                {t('friends.search_placeholder')}
              </DText>
            ) : empty ? (
              <DText size={12.5} color={dx.ash} style={styles.note} testID="dx-search-empty">
                {t('friends.no_matches')}
              </DText>
            ) : rows.length === 0 ? (
              <ActivityIndicator size="small" color={dx.ash} style={styles.note} />
            ) : (
              <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
                {rows.map((row, i) => (
                  <Pressable
                    key={row.id}
                    onPress={() => pick(row)}
                    onHoverIn={() => setHi(i)}
                    style={[styles.row, i === sel && styles.rowOn]}
                    accessibilityRole="link"
                    accessibilityLabel={`${row.nickname}, ${t('shell.menu.profile')}`}
                    testID={`dx-search-row-${row.nickname}`}
                  >
                    <View style={styles.who}>
                      <UserIdentity user={row} size={32} />
                    </View>
                    <SearchAction row={row} state={states[row.id] ?? row.friendship} busy={busy === row.id} onAct={() => void act(row)} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </Portal>
      ) : null}
    </>
  );
}

const fixed = { position: 'fixed' } as unknown as ViewStyle;

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 280,
    height: 32,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 999,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  fieldOn: {
    backgroundColor: dx.input,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.ember, 0.7), inset: true }],
  },
  input: { flex: 1, minWidth: 0, height: '100%', fontSize: 12.5, color: dx.bone, outlineStyle: 'none' } as object,
  clear: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  kbd: { marginLeft: 6 },
  panel: {
    ...fixed,
    width: PANEL_WIDTH,
    zIndex: 25,
    padding: 6,
    borderRadius: 12,
    backgroundColor: dx.modal,
    boxShadow: [
      { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: dx.modalEdge, inset: true },
      { offsetX: 0, offsetY: 18, blurRadius: 40, spreadDistance: 0, color: dx.popShadow },
    ],
  } as ViewStyle,
  list: { maxHeight: 420 },
  note: { paddingHorizontal: 10, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  rowOn: { backgroundColor: dx.card2 },
  who: { flex: 1, minWidth: 0 },
});
