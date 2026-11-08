import { useFonts } from 'expo-font';

// The browser has no embedded fonts: load the faces the app uses (core
// fontFamilies + the uk display face) before the first frame. The other
// uk candidates (Cormorant, Prata) only live in the typography lab.
const FACES = {
  'Manrope-Regular': require('../../assets/fonts/Manrope-Regular.ttf'),
  'Manrope-Medium': require('../../assets/fonts/Manrope-Medium.ttf'),
  'Manrope-SemiBold': require('../../assets/fonts/Manrope-SemiBold.ttf'),
  'Manrope-Bold': require('../../assets/fonts/Manrope-Bold.ttf'),
  'Manrope-ExtraBold': require('../../assets/fonts/Manrope-ExtraBold.ttf'),
  'Cinzel-Medium': require('../../assets/fonts/Cinzel-Medium.ttf'),
  'Cinzel-SemiBold': require('../../assets/fonts/Cinzel-SemiBold.ttf'),
  'Cinzel-Bold': require('../../assets/fonts/Cinzel-Bold.ttf'),
  Forum: require('../../assets/fonts/Forum.ttf'),
};

/** True once the faces are in (or failed: then the page still renders). */
export function useWebFonts(): boolean {
  const [loaded, error] = useFonts(FACES);
  return loaded || error != null;
}
