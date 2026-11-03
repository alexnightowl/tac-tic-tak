import { eos } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';

import { CardRow, IconTile } from '@/ui';
import { useT } from '@/ui/lang';
import { stormSummaryQuery } from './api';
import { Bolt } from './parts';

/**
 * Play's "Puzzle Storm" row (app-only: the canvas opens StormStart from
 * Play without drawing the row). Same row as ReviewEntry: a 40 pt tile with
 * the Storm bolt, the title, and the best score once there is one.
 */
export function StormEntry() {
  const t = useT();
  const q = useQuery(stormSummaryQuery());
  const best = q.data?.best?.score;
  const title = t('storm.title');
  const subtitle = best != null ? t('storm.entry.best', { n: best }) : t('storm.entry.hint');
  return (
    <CardRow
      testID="play-storm"
      title={title}
      subtitle={subtitle}
      accessibilityLabel={`${title}, ${subtitle}`}
      leading={
        <IconTile size={40}>
          <Bolt size={20} color={eos.bone} />
        </IconTile>
      }
      onPress={() => router.push('/storm' as Href)}
    />
  );
}
