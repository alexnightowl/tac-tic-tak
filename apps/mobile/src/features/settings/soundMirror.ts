import { getFeelPrefs, setFeelPrefs } from '@/feel';
import { appStore } from '@/stores/appStore';

// soundEnabled is an account setting (web parity: the web's sfx() gate
// reads it too), but the feel engine reads its own synchronous prefs. This
// mirrors the account value into them: at start, after every /users/me
// and after every toggle (optimistic, so a rollback mirrors back too).

function mirror(): void {
  const on = appStore.getState().settings.soundEnabled;
  if (getFeelPrefs().soundEnabled !== on) setFeelPrefs({ soundEnabled: on });
}

/** Idempotent to run twice (the app-wide effects and the Sound screen); returns the unsubscribe. */
export function startSoundMirror(): () => void {
  mirror();
  return appStore.subscribe((s, prev) => {
    if (s.settings.soundEnabled !== prev.settings.soundEnabled) mirror();
  });
}
