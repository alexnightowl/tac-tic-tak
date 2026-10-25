import { isCreatorNickname } from '@tac/core/catalogs';
import { board, eos, rank } from '@tac/core/tokens';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck, Crown } from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ShellAvatar } from '@/shell/ShellAvatar';
import { useT } from '@/ui/lang';
import { GOLD } from './palette';

type Props = {
  nickname: string;
  avatarUrl?: string | null;
  size: number;
  /** Local file shown while an upload is in flight (optimistic preview). */
  previewUri?: string | null;
  testID?: string;
};

/**
 * The shared Avatar (web components/Avatar.tsx): photo or slate initials
 * disc (ShellAvatar), plus the creator decoration — gold ring with a 2 px
 * gap and a crown chip at the bottom-right (sizes from the web). Memoised:
 * it sits in every leaderboard and friends row.
 */
export const Avatar = memo(function Avatar({ nickname, avatarUrl, size, previewUri, testID }: Props) {
  const t = useT();
  const creator = isCreatorNickname(nickname);
  const chip = Math.max(14, Math.round(size * 0.32));
  const icon = Math.max(9, Math.round(chip * 0.6));
  const off = -Math.round(chip * 0.15);
  return (
    <View style={{ width: size, height: size }} testID={testID}>
      {creator ? <View pointerEvents="none" style={[styles.ring, { borderRadius: size / 2 + 4 }]} /> : null}
      {previewUri ? (
        <Image
          source={{ uri: previewUri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          testID="avatar-image"
        />
      ) : (
        <ShellAvatar nickname={nickname} avatarUrl={avatarUrl} size={size} />
      )}
      {creator ? (
        <View
          style={[styles.chipOuter, { width: chip + 4, height: chip + 4, borderRadius: chip, right: off - 2, bottom: off - 2 }]}
          accessible
          accessibilityLabel={t('profile.creator')}
        >
          <LinearGradient
            colors={GOLD}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.chip, { width: chip, height: chip, borderRadius: chip / 2 }]}
          >
            <Crown size={icon} color={eos.embers} fill={eos.embers} />
          </LinearGradient>
        </View>
      ) : null}
    </View>
  );
});

/** Verified mark next to a name (web UserBadges). */
export function VerifiedBadge({ verified, size = 14 }: { verified?: boolean; size?: number }) {
  const t = useT();
  if (!verified) return null;
  return (
    <View accessible accessibilityLabel={t('profile.verified')} testID="badge-verified">
      <BadgeCheck size={size} color={board.landingArrow} />
    </View>
  );
}

const styles = StyleSheet.create({
  // outline: 2px amber-300, offset 2px.
  ring: { position: 'absolute', top: -4, left: -4, right: -4, bottom: -4, borderWidth: 2, borderColor: rank.intermediate.color },
  chipOuter: { position: 'absolute', backgroundColor: eos.ink, alignItems: 'center', justifyContent: 'center' },
  chip: { alignItems: 'center', justifyContent: 'center' },
});
