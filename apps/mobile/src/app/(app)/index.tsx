import { TRAINING_STYLES, type TrainingStyle } from '@tac/core/rules';
import { eos, layout, space } from '@tac/core/tokens';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DevMenuButton } from '@/features/auth/DevMenuButton';
import { meQuery, resetAll } from '@/features/auth/session';
import { useAuthT } from '@/features/auth/strings';
import { useAppStore } from '@/stores/appStore';
import { useAuthStore } from '@/stores/authStore';
import { AppText, Card, PlateButton } from '@/ui';

// Temporary Phase 2 Home: greeting, the three style ratings, Play and Log
// out. The real Home (streak, resume card, recent sessions) is Phase 5.

const STYLE_ICON: Record<TrainingStyle, number> = {
  bullet: require('../../../assets/icons/mode-bullet.webp'),
  blitz: require('../../../assets/icons/mode-blitz.webp'),
  rapid: require('../../../assets/icons/mode-rapid.webp'),
};

// /play belongs to the runner stream; cast until its route file exists so
// typed routes don't fail this file's typecheck.
const PLAY = '/play' as Href;

function StyleRatingCard({ style }: { style: TrainingStyle }) {
  const t = useAuthT();
  const prog = useAppStore((s) => s.progressions[style]);
  return (
    <Card style={styles.styleCard} testID={`home-style-${style}`}>
      <View style={styles.styleHead}>
        <Image source={STYLE_ICON[style]} style={styles.styleIcon} contentFit="contain" />
        <AppText variant="label" numberOfLines={1} style={styles.shrink}>
          {t(`style.${style}.name`)}
        </AppText>
      </View>
      <AppText variant="value" testID={`home-rating-${style}`}>
        {prog.currentPuzzleRating}
      </AppText>
      <AppText variant="label" color={eos.dust} style={styles.norm}>
        {`${t('play.unlocked')} ${prog.unlockedStartRating}`}
      </AppText>
    </Card>
  );
}

export default function Home() {
  const t = useAuthT();
  const nickname = useAuthStore((s) => s.user?.nickname ?? '');
  // Revalidates the MMKV-cached ratings on mount and on app foreground;
  // the queryFn writes into the stores this screen reads.
  useQuery(meQuery);

  return (
    <SafeAreaView style={styles.root} testID="home-screen">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.greeting}>
          <AppText variant="eyebrow">{t('dashboard.welcome')}</AppText>
          <AppText variant="sectionTitle" testID="home-nickname" numberOfLines={1}>
            {nickname}
          </AppText>
        </View>
        <View style={styles.ratings}>
          {TRAINING_STYLES.map((s) => (
            <StyleRatingCard key={s} style={s} />
          ))}
        </View>
        <PlateButton testID="home-play" label={t('play')} onPress={() => router.push(PLAY)} size="lg" block />
        <PlateButton
          testID="home-logout"
          label={t('logout')}
          variant="slate"
          onPress={() => void resetAll()}
          block
        />
        <DevMenuButton />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: eos.ink },
  scroll: { paddingHorizontal: layout.gutter, paddingVertical: space[6], gap: space[5] },
  greeting: { gap: space[1] },
  ratings: { flexDirection: 'row', gap: space[2] },
  styleCard: { flex: 1, padding: space[3] },
  styleHead: { flexDirection: 'row', alignItems: 'center', gap: space[1.5], marginBottom: space[1.5] },
  styleIcon: { width: 16, height: 16 },
  shrink: { flexShrink: 1 },
  norm: { marginTop: space[1.5] },
});
