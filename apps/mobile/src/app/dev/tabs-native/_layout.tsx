import { eos, fontFamilies } from '@tac/core/tokens';
import { Stack } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';

import { feel } from '@/feel';
import { useUiT } from '@/ui';
import { DevLangProvider } from '@/ui/dev/devLang';
import { MOCK_TABS } from '@/ui/dev/MockTabPage';

// /dev/tabs-native: the PLAN §2.3 default — system NativeTabs, ember tint,
// SF Symbols / Material Symbols. A mock under /dev so the real (tabs) group
// is untouched. On iOS 26 the bar is Liquid Glass: backgroundColor is
// ignored and the system samples the dark content behind it.

export default function TabsNativeLayout() {
  return (
    <DevLangProvider>
      <Stack.Screen options={{ title: 'Tabs · native' }} />
      <Tabs />
    </DevLangProvider>
  );
}

function Tabs() {
  const ui = useUiT();
  return (
    <NativeTabs
      tintColor={eos.ember}
      iconColor={{ default: eos.ash, selected: eos.ember }}
      labelStyle={{
        default: { fontFamily: fontFamilies.sans[600], color: eos.ash },
        selected: { fontFamily: fontFamilies.sans[700], color: eos.ember },
      }}
      backgroundColor={eos.shade}
      badgeBackgroundColor={eos.ember}
    >
      {MOCK_TABS.map((tab) => (
        <NativeTabs.Trigger
          key={tab.name}
          name={tab.name}
          testID={`tn-tab-${tab.name}`}
          accessibilityLabel={ui(tab.key)}
          listeners={{ tabPress: () => feel.emit('tabChange') }}
        >
          <NativeTabs.Trigger.Label>{ui(tab.key)}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
          {tab.name === 'social' ? <NativeTabs.Trigger.Badge>3</NativeTabs.Trigger.Badge> : null}
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
