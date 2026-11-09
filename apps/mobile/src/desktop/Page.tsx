import { alpha, eos } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Bell, Search } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useIncomingRequestCount } from '@/features/social/badge';
import { useT } from '@/ui/lang';
import { MOD_KEY } from './hotkeys';
import { DText, Hover, Kbd } from './kit';
import { dx, dxSize } from './tokens';

export type PageBack = { label: string; onPress?: () => void };

/**
 * The page header (DX* artboards, 84 px, 1 px rule): Cinzel 24 title over
 * a 13.5 px subtitle or a "← Гра" back link, and on the right either the
 * page's own control (a Курси / Книги switch) or the default search chip
 * (⌘K) + bell.
 */
export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: string; back?: PageBack; right?: ReactNode }) {
  const t = useT();
  return (
    <View style={styles.header}>
      <View style={styles.titles}>
        <DText serif weight={700} size={24} numberOfLines={1} accessibilityRole="header" testID="dx-page-title">
          {title}
        </DText>
        {back ? (
          <Hover
            testID="dx-page-back"
            accessibilityRole="link"
            accessibilityLabel={`${t('dx.shell.back')}: ${back.label}`}
            onPress={back.onPress ?? (() => (router.canGoBack() ? router.back() : router.navigate('/' as Href)))}
            style={styles.back}
            hoverStyle={styles.backHover}
          >
            <DText size={13} color={dx.ash}>{`← ${back.label}`}</DText>
          </Hover>
        ) : subtitle ? (
          <DText size={13.5} color={dx.ash} style={styles.sub} numberOfLines={1}>
            {subtitle}
          </DText>
        ) : null}
      </View>
      {right === undefined ? <HeaderTools /> : right}
    </View>
  );
}

/** Search players (⌘K, the friends search dialog) + the bell (incoming requests → Friends). */
export function HeaderTools() {
  const t = useT();
  const incoming = useIncomingRequestCount();
  return (
    <View style={styles.tools}>
      <Hover
        testID="dx-search"
        accessibilityLabel={t('dx.shell.search')}
        onPress={() => router.push('/friends/search' as Href)}
        style={styles.search}
        hoverStyle={styles.searchHover}
      >
        <Search size={13} color={dx.ash} strokeWidth={2} />
        <DText size={12.5} weight={700} color={dx.ash} numberOfLines={1}>
          {t('dx.shell.search')}
        </DText>
        <View style={styles.kbd}>
          <Kbd>{`${MOD_KEY}K`}</Kbd>
        </View>
      </Hover>
      <Hover
        testID="dx-bell"
        accessibilityLabel={incoming ? `${t('dx.shell.notifications')}, ${incoming}` : t('dx.shell.notifications')}
        onPress={() => router.push('/friends' as Href)}
        style={styles.bell}
        hoverStyle={styles.bellHover}
      >
        <Bell size={16} color={dx.bone} strokeWidth={1.8} />
        {incoming ? <View style={styles.dot} testID="dx-bell-dot" /> : null}
      </Hover>
    </View>
  );
}

/**
 * A desktop page: header, then the body padded 28 / 40 / 40, scrolling.
 * With `aside` the body is two columns: the page and a fixed-width right
 * column (340 px by default), 20 px apart.
 */
export function DesktopPage({
  title,
  subtitle,
  back,
  right,
  aside,
  asideWidth = dxSize.aside,
  children,
  scroll = true,
  testID,
  bodyStyle,
}: {
  title: string;
  subtitle?: string;
  back?: PageBack;
  right?: ReactNode;
  aside?: ReactNode;
  asideWidth?: number;
  children: ReactNode;
  scroll?: boolean;
  testID: string;
  bodyStyle?: StyleProp<ViewStyle>;
}) {
  const body = aside ? (
    <View style={styles.cols}>
      <View style={styles.main}>{children}</View>
      <View style={{ width: asideWidth, gap: dxSize.gap }}>{aside}</View>
    </View>
  ) : (
    children
  );
  return (
    <View style={styles.page} testID={testID}>
      <PageHeader title={title} subtitle={subtitle} back={back} right={right} />
      {scroll ? (
        <ScrollView style={styles.flex} contentContainerStyle={[styles.body, bodyStyle]}>
          <View style={styles.cap}>{body}</View>
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.body, bodyStyle]}>
          <View style={[styles.cap, styles.flex]}>{body}</View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: eos.ink },
  header: {
    height: dxSize.header,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: dxSize.padX,
    borderBottomWidth: 1,
    borderBottomColor: dx.headerRule,
  },
  titles: { flex: 1, minWidth: 0 },
  sub: { marginTop: 2 },
  back: { alignSelf: 'flex-start', marginTop: 2, borderRadius: 6 },
  backHover: { opacity: 0.8 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 999,
    backgroundColor: dx.card2,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.05), inset: true }],
  },
  searchHover: { backgroundColor: dx.chipHover },
  kbd: { marginLeft: 12 },
  bell: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: dx.ghost,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 1, color: alpha(eos.bone, 0.06), inset: true }],
  },
  bellHover: { backgroundColor: dx.ghostHover },
  dot: { position: 'absolute', top: 9, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: dx.rose },
  body: { paddingTop: dxSize.padTop, paddingHorizontal: dxSize.padX, paddingBottom: 40 },
  // The page fills the window beside the sidebar, as the artboards do.
  cap: { width: '100%' },
  cols: { flexDirection: 'row', alignItems: 'flex-start', gap: dxSize.gap },
  main: { flex: 1, minWidth: 0, gap: 16 },
});
