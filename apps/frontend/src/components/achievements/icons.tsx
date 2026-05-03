'use client';

import {
  Award,
  CalendarCheck,
  CalendarHeart,
  Camera,
  Compass,
  FileText,
  Flame,
  Github,
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
  type LucideIcon,
} from 'lucide-react';

/**
 * Slug-keyed lucide-icon lookup so the achievements grid and the
 * unlock-toast can render the right glyph without a switch
 * statement on every consumer. Falls back to Trophy when a slug
 * has no entry — that way an out-of-sync registry never crashes
 * the UI, just shows a generic icon.
 */
export const ACHIEVEMENT_ICON_MAP: Record<string, LucideIcon> = {
  // Customize
  'set-accent': Palette,
  'set-board': LayoutGrid,
  'set-language': Languages,
  'set-avatar': Camera,
  'set-bio': FileText,
  'set-country': MapPin,
  // Play
  'first-session': Play,
  'ten-sessions': Repeat,
  'hundred-sessions': Award,
  'solve-100': Target,
  'solve-1000': Trophy,
  // Skill
  'triple-style': Layers,
  'calibration-done': Compass,
  'peak-1500': TrendingUp,
  'peak-1800': Star,
  'peak-2000': Medal,
  // Streak
  'streak-3': Flame,
  'streak-7': CalendarHeart,
  'streak-30': CalendarCheck,
  'streak-100': Sparkle,
  // Social
  'first-friend': UserPlus,
  'five-friends': Users,
  'star-repo': Github,
};
