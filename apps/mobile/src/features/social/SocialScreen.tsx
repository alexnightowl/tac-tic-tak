import { control, eos, layout, radii, space } from '@tac/core/tokens';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import '@/features/achievements/icons';
import { AppText } from '@/ui/AppText';
import { useT, useTn } from '@/ui/lang';
import { Segmented } from '@/ui/Segmented';
import { useIncomingRequestCount } from './badge';
import { FriendsView } from './FriendsView';
import { LeaderboardView } from './LeaderboardView';

type Tab = 'leaderboard' | 'friends';

/**
 * Social tab (PLAN §2.3: web /leaderboard + /friends): Leaderboard |
 * Friends, with the incoming-request count badged on the Friends side.
 */
export function SocialScreen() {
  const t = useT();
  const tn = useTn();
  const [tab, setTab] = useState<Tab>('leaderboard');
  const incoming = useIncomingRequestCount();
  return (
    <View style={styles.root} testID="screen-social">
      <View style={styles.switch}>
        <Segmented
          options={[
            { value: 'leaderboard' as const, label: t('leaderboard.title') },
            { value: 'friends' as const, label: t('friends.title') },
          ]}
          value={tab}
          onChange={setTab}
          testID="social-tab"
          accessibilityLabel={t('social.sections')}
        />
        {incoming > 0 ? (
          <View
            style={styles.badge}
            pointerEvents="none"
            accessible
            accessibilityLabel={tn('friends.incoming_count', incoming).split('{n}').join(String(incoming))}
            testID="social-badge"
          >
            <AppText variant="label" color={control.segmentedActiveText} style={styles.badgeText}>
              {String(incoming)}
            </AppText>
          </View>
        ) : null}
      </View>
      {tab === 'leaderboard' ? <LeaderboardView /> : <FriendsView />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  switch: { paddingHorizontal: layout.gutter, paddingTop: space[3] },
  badge: {
    position: 'absolute',
    top: space[3] - 6,
    right: layout.gutter + space[2],
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radii.full,
    backgroundColor: eos.ember,
    borderWidth: 2,
    borderColor: eos.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10, letterSpacing: 0 },
});
