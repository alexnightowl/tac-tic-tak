import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

export type StatsTab = 'stats' | 'achievements';

/**
 * The Stats tab's Stats | Achievements side. /stats?tab=achievements&at=<stamp>
 * (Experience → Achievements) switches once per request, during render so
 * the first frame shows it. Shared by the phone screen and the desktop page.
 */
export function useStatsTab(): readonly [StatsTab, (tab: StatsTab) => void] {
  const [tab, setTab] = useState<StatsTab>('stats');
  const params = useLocalSearchParams<{ tab?: string; at?: string }>();
  const [seenAt, setSeenAt] = useState<string | undefined>(undefined);
  if (params.tab === 'achievements' && params.at !== seenAt) {
    setSeenAt(params.at);
    setTab('achievements');
  }
  return [tab, setTab] as const;
}
