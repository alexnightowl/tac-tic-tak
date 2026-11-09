import { StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/ui/BrandLogo';
import { useT } from '@/ui/lang';
import { DText } from '../kit';

/** Knight logo + the Cinzel wordmark (Latin in both languages). */
export function Wordmark({ logo, size, gap = 12 }: { logo: number; size: number; gap?: number }) {
  const t = useT();
  return (
    <View style={[styles.row, { gap }]} accessible accessibilityRole="header" accessibilityLabel={t('brand.name')}>
      <BrandLogo size={logo} glow={{ box: logo * 2, blur: logo / 8 }} />
      <DText serif lang="en" weight={700} size={size}>
        {t('brand.name')}
      </DText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
