import { eos } from '@tac/core/tokens';
import { router, type Href } from 'expo-router';
import { Swords } from 'lucide-react-native';

import { plural } from '@/features/offline/format';
import { CardRow, CountBadge, IconTile } from '@/ui';
import { useT, useTn } from '@/ui/lang';
import { useIncomingChallenges } from './api';

/**
 * Play's "Challenge a friend" row (app-only: the canvas reaches Create from
 * the Rivals / Storm surfaces). Same row as ReviewEntry: a 40 pt icon tile,
 * the title, and how many incoming challenges wait (GET /challenges, fetched
 * on focus). Opens Create with no friend picked.
 */
export function ChallengeEntry() {
  const t = useT();
  const tn = useTn();
  const { count } = useIncomingChallenges();
  const title = t('challenge.entry.title');
  const subtitle = count > 0 ? plural(tn, 'challenge.entry.incoming', count) : t('challenge.entry.hint');
  return (
    <CardRow
      testID="play-challenge"
      title={title}
      subtitle={subtitle}
      accessibilityLabel={`${title}, ${subtitle}`}
      leading={
        <IconTile size={40}>
          <Swords size={20} strokeWidth={1.8} color={count > 0 ? eos.ember : eos.bone} />
        </IconTile>
      }
      trailing={<CountBadge count={count} testID="play-challenge-count" />}
      onPress={() => router.push('/challenge/new' as Href)}
    />
  );
}
