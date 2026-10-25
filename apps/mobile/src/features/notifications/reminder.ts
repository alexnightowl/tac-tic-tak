import type { Streak } from '@tac/core/api';
import { formatLocalDate, localeFor } from '@tac/core/format';
import { applyStreakOnPlay } from '@tac/core/rules';
import { router, type Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import { useSyncExternalStore } from 'react';

import { appKV, readJSON, writeJSON } from '@/platform/storage';
import { appStore } from '@/stores/appStore';
import { authStore } from '@/stores/authStore';
import { translatorFor } from '@/ui/lang';

// Local streak reminder (PLAN §2.9, local part; no server or accounts
// needed). A repeating DAILY trigger can't skip a day, so instead the next
// few days are scheduled as one-shot DATE triggers starting from the first
// day the user hasn't played yet. Every sync cancels ours and re-plans, so
// a finished session (streak.lastDay becomes today) moves the next one to
// tomorrow. Device-scoped prefs (PLAN §8 #20/#21: default 20:00 local).

const PREFS_KEY = 'taktic.reminder';
/** Identifier prefix of every notification this module owns. */
const ID_PREFIX = 'streak-reminder-';
const FREEZE_ID = 'streak-freeze-back';
/** One-shot triggers ahead; reopening the app tops the queue back up. */
const DAYS_AHEAD = 7;
const ANDROID_CHANNEL = 'streak';

export const DEFAULT_REMINDER_HOUR = 20;

export type ReminderPrefs = { enabled: boolean; hour: number };

function load(): ReminderPrefs {
  const p = readJSON<Partial<ReminderPrefs>>(appKV, PREFS_KEY, {});
  const hour = typeof p.hour === 'number' && p.hour >= 0 && p.hour <= 23 ? Math.floor(p.hour) : DEFAULT_REMINDER_HOUR;
  return { enabled: p.enabled === true, hour };
}

let prefs = load();
const listeners = new Set<() => void>();

export function getReminderPrefs(): ReminderPrefs {
  return prefs;
}

function setPrefs(patch: Partial<ReminderPrefs>): void {
  prefs = { ...prefs, ...patch };
  writeJSON(appKV, PREFS_KEY, prefs);
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useReminderPrefs(): ReminderPrefs {
  return useSyncExternalStore(subscribe, getReminderPrefs, getReminderPrefs);
}

// ---- planning (pure) --------------------------------------------------------

export type PlannedReminder = {
  id: string;
  at: Date;
  kind: 'streak' | 'freeze';
  /** Streak kind: a play that day would still extend the current streak (else the copy invites a new one). */
  alive?: boolean;
};

/**
 * What a play on `day` would do to the stored streak (core rules, the
 * server's own): only 'continued' / 'frozen' mean there is a streak to
 * save. Days further out than the freeze covers get the "start a streak"
 * copy instead of a count that will already have reset.
 */
function streakAliveOn(streak: Streak, day: string): boolean {
  if (streak.days <= 0 || !streak.lastDay) return false;
  const { outcome } = applyStreakOnPlay(
    {
      streakDays: streak.days,
      streakFreezes: streak.freezes,
      streakLastDay: streak.lastDay,
      streakFreezeRegenAt: streak.freezeRegenAt,
    },
    day,
  );
  return outcome === 'continued' || outcome === 'frozen';
}

function atHour(day: Date, hour: number): Date {
  const d = new Date(day);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/**
 * Days to remind on: from today (if not played yet and the hour is still
 * ahead) or tomorrow, DAYS_AHEAD of them. Plus the freeze-regenerated note
 * on `freezeRegenAt` at the same hour, when that's still ahead.
 */
export function planReminders(streak: Streak, hour: number, now: Date = new Date()): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const playedToday = streak.lastDay === formatLocalDate(now);
  const first = new Date(now);
  first.setHours(0, 0, 0, 0);
  if (playedToday || atHour(first, hour) <= now) first.setDate(first.getDate() + 1);
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = new Date(first);
    day.setDate(first.getDate() + i);
    const key = formatLocalDate(day);
    out.push({ id: `${ID_PREFIX}${key}`, at: atHour(day, hour), kind: 'streak', alive: streakAliveOn(streak, key) });
  }
  if (streak.freezeRegenAt && streak.freezes < 1) {
    const [y, m, d] = streak.freezeRegenAt.split('-').map(Number);
    if (y && m && d) {
      const at = atHour(new Date(y, m - 1, d), Math.min(hour, 12));
      if (at > now) out.push({ id: FREEZE_ID, at, kind: 'freeze' });
    }
  }
  return out;
}

// ---- permission ---------------------------------------------------------------

export type PermissionState = 'granted' | 'denied' | 'undetermined';

function toState(p: Notifications.NotificationPermissionsStatus): PermissionState {
  if (p.granted) return 'granted';
  // iOS provisional / ephemeral still deliver quietly: count as allowed.
  const ios = p.ios?.status;
  if (ios === IosAuthorizationStatus.PROVISIONAL || ios === IosAuthorizationStatus.EPHEMERAL) {
    return 'granted';
  }
  return p.canAskAgain && p.status !== 'denied' ? 'undetermined' : 'denied';
}

export async function getPermission(): Promise<PermissionState> {
  try {
    return toState(await Notifications.getPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

export async function requestPermission(): Promise<PermissionState> {
  try {
    await ensureChannel();
    return toState(
      await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }),
    );
  } catch {
    return 'denied';
  }
}

async function ensureChannel(): Promise<void> {
  // Android 13+: the channel must exist before the permission prompt.
  if (Platform.OS !== 'android') return;
  const t = translatorFor(appStore.getState().settings.language).t;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: t('settings.reminder'),
    importance: AndroidImportance.DEFAULT,
  });
}

// ---- scheduling -----------------------------------------------------------------

export type ScheduledReminder = { id: string; at: Date | null };

/** Our pending notifications, soonest first (settings readout + diagnostics). */
export async function getScheduledReminders(): Promise<ScheduledReminder[]> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all
      .filter((n) => isOurs(n.identifier))
      .map((n) => ({ id: n.identifier, at: triggerDate(n.trigger) ?? stampedDate(n.content.data) }))
      .sort((a, b) => (a.at?.getTime() ?? Infinity) - (b.at?.getTime() ?? Infinity));
  } catch {
    return [];
  }
}

function triggerDate(trigger: Notifications.NotificationTrigger | null): Date | null {
  const tr = trigger as {
    type?: string;
    date?: number | string;
    value?: number;
    dateComponents?: { year?: number; month?: number; day?: number; hour?: number; minute?: number };
  } | null;
  if (!tr) return null;
  // Android: a 'date' trigger with the epoch in `value`.
  if (typeof tr.value === 'number') return new Date(tr.value);
  if (tr.date !== undefined) return new Date(tr.date);
  // iOS may hand back a calendar trigger.
  const c = tr.dateComponents;
  if (c?.year && c.month && c.day) return new Date(c.year, c.month - 1, c.day, c.hour ?? 0, c.minute ?? 0);
  return null;
}

/** The fire time we stamped into the payload; iOS reports some date triggers as bare intervals. */
function stampedDate(data: unknown): Date | null {
  const at = (data as { at?: unknown } | null)?.at;
  return typeof at === 'number' ? new Date(at) : null;
}

function isOurs(id: string): boolean {
  return id.startsWith(ID_PREFIX) || id === FREEZE_ID;
}

async function cancelOurs(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter((n) => isOurs(n.identifier))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

let syncing: Promise<void> = Promise.resolve();
const syncListeners = new Set<() => void>();

/** Fires after every sync, so a visible readout can re-query. */
export function onRemindersSynced(l: () => void): () => void {
  syncListeners.add(l);
  return () => syncListeners.delete(l);
}

/**
 * Cancels and re-plans (serialised: a burst of triggers runs in order).
 * Signed out, disabled or without permission: nothing stays scheduled.
 */
export function syncReminders(): Promise<void> {
  syncing = syncing.then(doSync, doSync).finally(() => syncListeners.forEach((l) => l()));
  return syncing;
}

async function doSync(): Promise<void> {
  try {
    await cancelOurs();
    if (!prefs.enabled || authStore.getState().status !== 'authed') return;
    if ((await getPermission()) !== 'granted') return;
    await ensureChannel();
    const { settings, streak } = appStore.getState();
    const t = translatorFor(settings.language).t;
    for (const r of planReminders(streak, prefs.hour)) {
      const content: Notifications.NotificationContentInput =
        r.kind === 'freeze'
          ? { title: t('settings.notify.freeze.title'), body: t('settings.notify.freeze.body'), data: { url: '/', at: r.at.getTime() } }
          : {
              title: r.alive ? t('settings.notify.streak.title') : t('settings.notify.streak.title_new'),
              body:
                r.alive
                  ? t('settings.notify.streak.body', { n: streak.days })
                  : t('settings.notify.streak.body_new'),
              data: { url: '/play', at: r.at.getTime() },
            };
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content,
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: ANDROID_CHANNEL },
      });
    }
  } catch {
    // Scheduling is best-effort; the next foreground or finish retries.
  }
}

/**
 * Turning the reminder on asks for permission first (the toggle is the
 * soft pre-prompt); a refusal leaves it off. Resolves the permission state.
 */
export async function setReminderEnabled(on: boolean): Promise<PermissionState> {
  if (!on) {
    setPrefs({ enabled: false });
    await syncReminders();
    return getPermission();
  }
  let perm = await getPermission();
  if (perm === 'undetermined') perm = await requestPermission();
  setPrefs({ enabled: perm === 'granted' });
  await syncReminders();
  return perm;
}

export async function setReminderHour(hour: number): Promise<void> {
  setPrefs({ hour });
  await syncReminders();
}

/** "20:00" / "8:00 PM" in the app language. */
export function formatHour(hour: number, language: string, at?: Date): string {
  const d = at ? new Date(at) : new Date();
  if (!at) d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString(localeFor(language), { hour: 'numeric', minute: '2-digit' });
}

// ---- lifecycle --------------------------------------------------------------------

let started = false;

/**
 * App-wide triggers: a finished session (the runner writes the new streak
 * into appStore), a language change (copy is baked in at schedule time),
 * sign-in/out, and every return to the foreground (tops up the queue and
 * drops today's once played). Idempotent; returns a stop function.
 */
export function startReminderSync(): () => void {
  if (started) return () => {};
  started = true;
  const unsubApp = appStore.subscribe((s, prev) => {
    if (s.streak !== prev.streak || s.settings.language !== prev.settings.language) void syncReminders();
  });
  const unsubAuth = authStore.subscribe((s, prev) => {
    if (s.status !== prev.status && s.status !== 'booting') void syncReminders();
  });
  const appState = AppState.addEventListener('change', (st) => {
    if (st === 'active') void syncReminders();
  });
  // A reminder that fires while the app is open still shows as a banner
  // (the user is probably not playing). Phase 10's remote pushes will own
  // this handler and turn foreground pushes into toasts.
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const ours = isOurs(n.request.identifier);
      return { shouldShowBanner: ours, shouldShowList: ours, shouldPlaySound: false, shouldSetBadge: false };
    },
  });
  // Tapping a reminder opens the screen it names (Play for the streak one).
  const response = Notifications.addNotificationResponseReceivedListener((r) => {
    const url = r.notification.request.content.data?.url;
    if (isOurs(r.notification.request.identifier) && typeof url === 'string' && authStore.getState().status === 'authed') {
      router.navigate(url as Href);
    }
  });
  void syncReminders();
  return () => {
    started = false;
    unsubApp();
    unsubAuth();
    appState.remove();
    response.remove();
  };
}
