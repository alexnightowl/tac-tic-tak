import { eos } from '@tac/core/tokens';
import { View } from 'react-native';

export function LearnScreen() {
  return <View style={{ flex: 1, backgroundColor: eos.ink }} testID="screen-learn" />;
}
