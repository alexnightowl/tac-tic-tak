import {
  Award,
  CalendarCheck,
  CalendarHeart,
  Camera,
  Compass,
  FileText,
  Flame,
  Languages,
  Layers,
  LayoutGrid,
  MapPin,
  Medal,
  Palette,
  Play,
  Repeat,
  Sparkle,
  Star,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
} from 'lucide-react-native';

import { setAchievementIcons, type ToastIcon } from '@/shell/toast/store';

// Web ACHIEVEMENT_ICON_MAP (components/achievements/icons.tsx) over
// lucide-react-native; the names match @tac/core/catalogs' `icon` field.
// lucide 1.x dropped brand glyphs, so star-repo's Github falls back to Star
// (the slug is hidden in the app anyway, PLAN §8 #16).
export const ACHIEVEMENT_ICONS: Record<string, ToastIcon> = {
  'set-accent': Palette,
  'set-board': LayoutGrid,
  'set-language': Languages,
  'set-avatar': Camera,
  'set-bio': FileText,
  'set-country': MapPin,
  'first-session': Play,
  'ten-sessions': Repeat,
  'hundred-sessions': Award,
  'solve-100': Target,
  'solve-1000': Trophy,
  'triple-style': Layers,
  'calibration-done': Compass,
  'peak-1500': TrendingUp,
  'peak-1800': Star,
  'peak-2000': Medal,
  'streak-3': Flame,
  'streak-7': CalendarHeart,
  'streak-30': CalendarCheck,
  'streak-100': Sparkle,
  'first-friend': UserPlus,
  'five-friends': Users,
  'star-repo': Star,
};

/** Fallback for a slug the client doesn't know (the toast also uses Trophy). */
export const achievementIconFor = (slug: string): ToastIcon => ACHIEVEMENT_ICONS[slug] ?? Trophy;

// Module side effect: importing this file gives every achievement toast its
// glyph (the shell's registry). Imported by the root of each screen that can
// unlock something; the shell should import it at startup too.
setAchievementIcons(ACHIEVEMENT_ICONS);
