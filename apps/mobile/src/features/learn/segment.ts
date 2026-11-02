import { create } from 'zustand';

import { appKV } from '@/platform/storage';
import { authStore, useAuthStore } from '@/stores/authStore';

// The Learn tab's last segment, per user, in MMKV ("Courses" first).

export type LearnSegment = 'courses' | 'books';

const key = (uid: string) => `learn.segment.${uid}`;
const read = (uid: string): LearnSegment => (appKV.getString(key(uid)) === 'books' ? 'books' : 'courses');

const useSegments = create<{ byUser: Record<string, LearnSegment> }>(() => ({ byUser: {} }));

export function setLearnSegment(segment: LearnSegment, uid = authStore.getState().user?.id ?? 'anon'): void {
  appKV.set(key(uid), segment);
  useSegments.setState((s) => ({ byUser: { ...s.byUser, [uid]: segment } }));
}

export function useLearnSegment(): [LearnSegment, (s: LearnSegment) => void] {
  const uid = useAuthStore((s) => s.user?.id ?? 'anon');
  const stored = useSegments((s) => s.byUser[uid]);
  return [stored ?? read(uid), (s) => setLearnSegment(s, uid)];
}
